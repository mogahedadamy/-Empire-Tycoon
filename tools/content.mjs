/** Validates authored content or prints the independent market balance report. */
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const [command, input, kind = 'scenario'] = process.argv.slice(2);
const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });

try {
  if (command === 'check') {
    const content = await server.ssrLoadModule('/packages/content/src/index.ts');
    const ai = await server.ssrLoadModule('/packages/content/src/ai/index.ts');
    const scenarios = new Map(content.scenarioIds.map((id) => [id, content.loadScenario(id)]));
    content.loadMarketScenario('wadi-produce-market');
    content.loadOperatingProjects();
    ai.loadAiScenario();
    ai.loadComputeProcurement();
    if (input) {
      const authored = JSON.parse(await readFile(input, 'utf8'));
      const decoders = { scenario: content.parseScenario, market: content.parseMarketScenario,
        projects: content.parseOperatingProjects, playbook: (value) => content.parsePlaybook(value, scenarios),
        ai: ai.parseAiScenario, compute: ai.parseComputeProcurement };
      if (!Object.hasOwn(decoders, kind)) throw new Error(`Unknown content kind: ${kind}`);
      decoders[kind](authored);
    }
    console.log(`Validated ${scenarios.size} food runs, the market, operating projects, AI founding and compute procurement${input ? `, and ${input}` : ''}.`);
  } else if (command === 'balance') {
    const { runBalanceMatrix } = await server.ssrLoadModule('/tools/balance/matrix.ts');
    console.log(JSON.stringify(runBalanceMatrix(), null, 2));
  } else {
    throw new Error('Expected check [file] [scenario|market|projects|playbook|ai|compute] or balance');
  }
} finally {
  await server.close();
}
