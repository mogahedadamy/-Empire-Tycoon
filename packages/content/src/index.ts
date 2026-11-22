/** Public entry point for loading the shipped content or validating edited scenario data. */
import bigOrder from '../data/big-order.json';
import bigOrderTight from '../data/big-order-tight.json';
import { parseScenario, type Scenario } from './scenario';

export { parseScenario };
export type { Scenario };
export { loadMarketScenario, parseMarketScenario } from './market-scenario';
export { loadOperatingProjects, parseOperatingProjects } from './operating-projects';

const catalog = new Map<string, unknown>([
  ['big-order', bigOrder],
  ['big-order-tight', bigOrderTight],
]);

/** Identifiers of all shipped scenarios available from the catalog. */
export const scenarioIds = Object.freeze(Array.from(catalog.keys()));

/** Loads the scenario and its pinned seed by ID. Throws if the ID or bundled data is invalid. */
export function loadScenario(id: string): Scenario {
  const data = catalog.get(id);
  if (data === undefined) throw new RangeError(`Unknown scenario: ${id}`);

  const scenario = parseScenario(data);
  if (scenario.id !== id) throw new RangeError(`Scenario ID does not match catalog entry: ${id}`);
  return scenario;
}
