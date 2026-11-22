/** Public entry point for loading the shipped content or validating edited scenario data. */
import bigOrder from '../data/big-order.json';
import bigOrderTight from '../data/big-order-tight.json';
import harborSupply from '../data/harbor-supply.json';
import { createPlaybookCatalog } from './playbook';
import { parseScenario, type Scenario } from './scenario';

export { parseScenario };
export type { Scenario };
export { loadMarketScenario, parseMarketScenario } from './market-scenario';
export { loadOperatingProjects, parseOperatingProjects } from './operating-projects';
export { difficultyIds, parsePlaybook, type Difficulty, type PlayMode } from './playbook';

const catalog = new Map<string, Scenario>([
  ['big-order', bigOrder],
  ['big-order-tight', bigOrderTight],
  ['harbor-supply', harborSupply],
].map(([key, raw]) => {
  const scenario = parseScenario(raw);
  if (scenario.id !== key) throw new RangeError(`Scenario ID does not match catalog entry: ${key}`);
  return [scenario.id, scenario];
}));
const runCatalog = createPlaybookCatalog(catalog);

/** Identifiers of all shipped scenarios available from the catalog. */
export const scenarioIds = Object.freeze([...catalog.keys(), ...runCatalog.keys()]);

/** Lists the validated, localized campaign and sandbox entries in authored order. */
export const playbookRuns = Object.freeze([...runCatalog.values()]);

/** Returns launch metadata when a stored ID denotes a campaign or sandbox variant. */
export const getPlaybookRun = (scenarioId: string) => runCatalog.get(scenarioId);

/** Loads the scenario and its pinned seed by ID. Throws if the ID or bundled data is invalid. */
export function loadScenario(id: string): Scenario {
  const scenario = catalog.get(id) ?? runCatalog.get(id)?.scenario;
  if (!scenario) throw new RangeError(`Unknown scenario: ${id}`);
  return scenario;
}
