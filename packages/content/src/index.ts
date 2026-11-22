/** Public entry point for loading the shipped content or validating edited scenario data. */
import bigOrder from '../data/big-order.json';
import { parseScenario, type Scenario } from './scenario';

export { parseScenario };
export type { Scenario };

const catalog = new Map<string, unknown>([['big-order', bigOrder]]);

/** Loads the scenario and its pinned seed by ID. Throws if the ID or bundled data is invalid. */
export function loadScenario(id: string): Scenario {
  const data = catalog.get(id);
  if (data === undefined) throw new RangeError(`Unknown scenario: ${id}`);

  const scenario = parseScenario(data);
  if (scenario.id !== id) throw new RangeError(`Scenario ID does not match catalog entry: ${id}`);
  return scenario;
}
