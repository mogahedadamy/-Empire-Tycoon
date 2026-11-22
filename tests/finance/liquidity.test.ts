/** Tests the 30-day forecast, timing assumptions, traceability and state immutability. */
import { expect, it } from 'vitest';
import { forecastLiquidity } from '../../packages/finance/src';
import { deliver } from '../operations/sales-fixture';
import { liquidityScenario, rentId } from './liquidity-fixture';

async function hash(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const result = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(result)).join(',');
}

it('shows payroll before collection and exposes the three timing assumptions', () => {
  const { read } = liquidityScenario();
  const model = forecastLiquidity(read(deliver.day));
  expect(model.baseline.days).toHaveLength(30);
  expect(model.baseline.days[0].day).toBe(deliver.day);
  expect(model.baseline.days.at(-1)?.day).toBe(deliver.day + 29);
  expect(model.alerts).toContainEqual({
    code: 'payroll-before-collection', id: 'payroll:first-payroll', partyId: 'employees',
    source: 'payroll', dueDay: 28, amountMinor: '120000', relatedId: 'invoice:deliver',
  });
  expect(model.baseline.movements.find(({ source }) => source === 'invoice')).toMatchObject({
    projectedDay: 38, dueDay: 38, amountMinor: '525000',
    journalEntryId: 'sales:deliver', partyId: 'aswaq-al-sunbul',
  });
  expect(model.pessimistic.movements.find(({ source }) => source === 'invoice')?.projectedDay).toBe(43);
  expect(model.optimistic.movements.find(({ source }) => source === 'invoice')).toMatchObject({
    projectedDay: 31, amountMinor: '514500', discountMinor: '10500',
  });
});

it('shows the first rent shortfall of 400 and prices early collection without changing the state hash', async () => {
  const scenario = liquidityScenario(true);
  const state = { treasury: scenario.finance.state, ledger: scenario.finance.ledger, sales: scenario.sales };
  const input = scenario.read(31);
  const before = await hash({ state, input });
  const first = forecastLiquidity(input);
  expect(forecastLiquidity(input)).toEqual(first);
  expect(await hash({ state, input })).toBe(before);
  expect(Object.isFrozen(first.baseline.days[0])).toBe(true);

  expect(first.confirmed).toMatchObject({ cashMinor: '180000', availableCreditMinor: '0' });
  expect(first.baseline.firstShortfall).toEqual({
    day: 32, amountMinor: '40000', dueDay: 32, reason: 'rent', sourceId: rentId, partyId: 'landlord',
  });
  expect(first.recoveryOptions).toHaveLength(1);
  expect(first.recoveryOptions[0]).toMatchObject({
    kind: 'early-collection', costMinor: '10500', immediateCashMinor: '514500', latestDay: 32,
    projection: { firstShortfall: { day: 60, reason: 'principal', amountMinor: '580500' } },
  });

  const late = forecastLiquidity(scenario.read(39));
  expect(late.alerts).toContainEqual({
    code: 'invoice-overdue', id: 'invoice:deliver', partyId: 'aswaq-al-sunbul',
    source: 'invoice', dueDay: 38, amountMinor: '525000',
  });
});

it('reports unused approved credit separately from cash and limits the proposed draw', () => {
  const input = liquidityScenario(true).read(31);
  const forecast = forecastLiquidity({ ...input, credit: {
    facilityId: 'credit-line', partyId: 'lender', availableMinor: '100000', availableDay: 31,
  } });
  expect(forecast.confirmed).toEqual({
    cashMinor: '180000', availableCreditMinor: '100000', operatingLiquidityMinor: '280000',
  });
  expect(forecast.baseline.firstShortfall?.amountMinor).toBe('40000');
  expect(forecast.recoveryOptions.find(({ kind }) => kind === 'approved-credit')).toMatchObject({
    immediateCashMinor: '40000', costMinor: null, latestDay: 32,
  });
});
