/** Parses versioned scenario data into owned, immutable records. */
import { id, integer, section, text } from './fields';
import * as decode from './sections';
import { validateScenarioRules } from './scenario-rules';

function decodeScenario(input: unknown) {
  const data = section(input, 'scenario');
  const company = section(data.company, 'company');
  const product = section(data.product, 'product');

  return Object.freeze({
    schemaVersion: integer(data.schemaVersion, 'schemaVersion', 1, 1),
    rulesetVersion: integer(data.rulesetVersion, 'rulesetVersion', 1, 1),
    contentVersion: integer(data.contentVersion, 'contentVersion'),
    id: id(data.id, 'id'),
    seed: integer(data.seed, 'seed', 0, 0xffffffff),
    name: text(data.name, 'name'),
    currency: text(data.currency, 'currency'),
    city: Object.freeze(decode.named(data.city, 'city')),
    sector: Object.freeze(decode.named(data.sector, 'sector')),
    company: Object.freeze({
      ...decode.located(company, 'company'),
      sectorId: id(company.sectorId, 'company.sectorId'),
    }),
    supplier: Object.freeze(decode.located(data.supplier, 'supplier')),
    customer: Object.freeze(decode.located(data.customer, 'customer')),
    product: Object.freeze({
      ...decode.named(product, 'product'),
      sectorId: id(product.sectorId, 'product.sectorId'),
      shelfLifeDays: integer(product.shelfLifeDays, 'product.shelfLifeDays'),
    }),
    calendar: Object.freeze(decode.calendar(data.calendar)),
    opening: Object.freeze(decode.opening(data.opening)),
    supply: Object.freeze(decode.supply(data.supply)),
    contract: Object.freeze(decode.contract(data.contract)),
    payroll: Object.freeze(decode.payroll(data.payroll)),
    monthlyClose: Object.freeze(decode.monthlyClose(data.monthlyClose)),
    firstDecision: Object.freeze(decode.firstDecision(data.firstDecision)),
    objectives: Object.freeze(decode.objectives(data.objectives)),
    postClose: Object.freeze(decode.postClose(data.postClose)),
  });
}

export type Scenario = ReturnType<typeof decodeScenario>;

/** Decodes an edited JSON scenario. Throws RangeError with the location of invalid data. */
export function parseScenario(input: unknown): Scenario {
  const scenario = decodeScenario(input);
  validateScenarioRules(scenario);
  return scenario;
}
