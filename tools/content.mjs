/** Validates authored content or prints the independent market balance report. */
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const [command, input, kind = 'scenario'] = process.argv.slice(2);
const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });

try {
  if (command === 'check') {
    const content = await server.ssrLoadModule('/packages/content/src/index.ts');
    const scenarios = new Map(content.scenarioIds.map((id) => [id, content.loadScenario(id)]));
    content.loadMarketScenario('wadi-produce-market');
    content.loadOperatingProjects();
    if (input) {
      const authored = JSON.parse(await readFile(input, 'utf8'));
      const decoders = { scenario: content.parseScenario, market: content.parseMarketScenario,
        projects: content.parseOperatingProjects, playbook: (value) => content.parsePlaybook(value, scenarios) };
      if (!Object.hasOwn(decoders, kind)) throw new Error(`Unknown content kind: ${kind}`);
      decoders[kind](authored);
    }
    console.log(`Validated ${scenarios.size} scenarios, the market and operating projects${input ? `, and ${input}` : ''}.`);
  } else if (command === 'balance') {
    const { runBalanceMatrix } = await server.ssrLoadModule('/tools/balance/matrix.ts');
    console.log(JSON.stringify(runBalanceMatrix(), null, 2));
  } else {
    throw new Error('Expected check [file] [scenario|market|projects|playbook] or balance');
  }
} finally {
  await server.close();
}
