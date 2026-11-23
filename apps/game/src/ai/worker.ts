/** Runs comparison and founding in the local AI worker using the shipped content contract. */
import { foundAiCompany, quoteAiFounding, type AiFoundingCommand, type AiFoundingQuote, type AiFoundingReceipt } from '../../../../packages/ai-industry/src';
import { loadAiScenario } from '../../../../packages/content/src/ai';

export type AiQuery = { readonly type: 'compare' } | AiFoundingCommand;
export type AiAnswer =
  | { readonly type: 'comparison'; readonly quotes: readonly AiFoundingQuote[] }
  | { readonly type: 'founded'; readonly receipt: AiFoundingReceipt };

const scenario = loadAiScenario();
self.addEventListener('message', ({ data }: MessageEvent<{ id: number; input: AiQuery }>) => {
  const { id, input } = data;
  try {
    const result: AiAnswer = input.type === 'compare'
      ? { type: 'comparison', quotes: quoteAiFounding(scenario) }
      : { type: 'founded', receipt: foundAiCompany(scenario, input) };
    self.postMessage({ id, result });
  } catch {
    self.postMessage({ id, error: true });
  }
});
