/** Verifies the production catalog and validation of independently edited scenario data. */
import { expect, it } from 'vitest';
import { loadScenario, parseScenario } from '../../packages/content/src';
import { createSimulationSession } from '../../packages/simulation/src';
import { simulationProtocolVersion } from '../../packages/contracts/src';

it('loads the shipped first company and its seed through the public catalog', () => {
  const scenario = loadScenario('big-order');

  expect(scenario).toEqual(loadScenario('big-order'));
  expect(scenario).toMatchObject({
    id: 'big-order',
    seed: 202627,
    currency: 'GAME',
    calendar: { startDay: 1, firstCloseDay: 30, endDay: 45 },
    opening: { cashMinor: '0', capitalMinor: '3000000', dailyHandlingCapacity: 50 },
    supply: { quantity: 100, unitCostMinor: '4000' },
    contract: { quantity: 70, unitPriceMinor: '7500', paymentDueDay: 38 },
    payroll: { amountMinor: '120000', dueDay: 28 },
    firstDecision: { day: 1, options: ['accept-contract', 'review-alternatives'] },
  });
  expect(scenario.contract.customerId).toBe(scenario.customer.id);

  const session = createSimulationSession({ sessionId: scenario.id, seed: scenario.seed });
  expect(session.handle({
    version: simulationProtocolVersion,
    type: 'read',
    sessionId: scenario.id,
  })).toMatchObject({
    type: 'snapshot',
    snapshot: { openDay: scenario.calendar.startDay, randomState: scenario.seed },
  });
  expect(() => loadScenario('missing')).toThrow('Unknown scenario: missing');
});

it('accepts coordinated edits to time, contract terms, and quantities without mutating the catalog', () => {
  const baseline = loadScenario('big-order');
  const edited = {
    ...baseline,
    calendar: { ...baseline.calendar, endDay: 50 },
    supply: { ...baseline.supply, quantity: 120, arrivalDay: 9 },
    contract: { ...baseline.contract, quantity: 90, unitPriceMinor: '7600', paymentDueDay: 42 },
  };
  const scenario = parseScenario(edited);
  edited.contract.quantity = 1;

  expect(scenario).toMatchObject({
    calendar: { endDay: 50 },
    supply: { quantity: 120, arrivalDay: 9 },
    contract: { quantity: 90, unitPriceMinor: '7600', paymentDueDay: 42 },
  });
  expect(Object.isFrozen(scenario.contract)).toBe(true);
  expect(Object.isFrozen(scenario.firstDecision.options)).toBe(true);
  expect(loadScenario('big-order')).toEqual(baseline);
});

it('rejects malformed dates, unsupported rules and noncanonical amounts', () => {
  const base = loadScenario('big-order');
  expect(() => parseScenario(null)).toThrow('scenario');
  expect(() => parseScenario({ ...base, rulesetVersion: 2 })).toThrow('rulesetVersion');
  expect(() => parseScenario({ ...base, seed: -1 })).toThrow('seed');
  expect(() => parseScenario({ ...base, supply: { ...base.supply, unitCostMinor: 40 } }))
    .toThrow('supply.unitCostMinor');
  expect(() => parseScenario({ ...base, contract: { ...base.contract, paymentDueDay: 37.5 } }))
    .toThrow('contract.paymentDueDay');
});

it('identifies a broken city, sector, supplier, customer, product, or decision reference', () => {
  const base = loadScenario('big-order');
  for (const [section, field] of [
    ['company', 'cityId'],
    ['product', 'sectorId'],
    ['supply', 'supplierId'],
    ['contract', 'customerId'],
    ['contract', 'productId'],
    ['firstDecision', 'contractId'],
  ] as const) {
    const broken = { ...base, [section]: { ...base[section], [field]: 'unknown' } };
    expect(() => parseScenario(broken)).toThrow(`${section}.${field}: unknown reference`);
  }
});

it('rejects infeasible calendar, supply, shelf life and capacity combinations', () => {
  const base = loadScenario('big-order');
  expect(() => parseScenario({ ...base, calendar: { ...base.calendar, endDay: 35 } }))
    .toThrow('contract.paymentDueDay');
  expect(() => parseScenario({ ...base, payroll: { ...base.payroll, dueDay: 39 } }))
    .toThrow('payroll.dueDay');
  expect(() => parseScenario({ ...base, supply: { ...base.supply, quantity: 60 } }))
    .toThrow('supply.quantity');
  expect(() => parseScenario({ ...base, product: { ...base.product, shelfLifeDays: 11 } }))
    .toThrow('contract.quantity');
  expect(() => parseScenario({ ...base, opening: { ...base.opening, dailyHandlingCapacity: 20 } }))
    .toThrow('contract.quantity');
});
