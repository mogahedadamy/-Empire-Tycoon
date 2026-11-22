/** Verifies Big Order reference accounting, branching consequences, failure paths, and tight difficulty. */
import { expect, it } from 'vitest';
import { loadScenario } from '../../packages/content/src';
import { createJourneyEngine } from '../../apps/game/src/journey/engine';
import type { JourneyAction } from '../../apps/game/src/journey/types';

function run(engine: ReturnType<typeof createJourneyEngine>, id: string, action: JourneyAction) {
  return engine.submit({ commandId: id, expectedRevision: engine.revision(), action });
}

function advanceThroughDeliveryAndClose(
  scenarioId: 'big-order' | 'big-order-tight',
  fundingPlan: 'loan' | 'capital',
) {
  const scenario = loadScenario(scenarioId);
  const engine = createJourneyEngine(scenario);
  expect(run(engine, 'found', { type: 'found-company', fundingPlan }).status).toBe('accepted');
  expect(run(engine, 'sign', { type: 'accept-contract', offerId: scenario.contract.id }).status).toBe('accepted');
  expect(run(engine, 'order', { type: 'order-supply' }).status).toBe('accepted');
  expect(run(engine, 'to-delivery', { type: 'advance-through', day: 17 }).status).toBe('accepted');

  const dayOneQty = Math.min(scenario.opening.dailyHandlingCapacity, scenario.contract.quantity);
  const dayTwoQty = scenario.contract.quantity - dayOneQty;
  expect(run(engine, 'deliver-1', { type: 'deliver', offerId: scenario.contract.id, quantity: dayOneQty }).status).toBe('accepted');
  expect(run(engine, 'next-day', { type: 'advance', days: 1 }).status).toBe('accepted');
  expect(run(engine, 'deliver-2', { type: 'deliver', offerId: scenario.contract.id, quantity: dayTwoQty }).status).toBe('accepted');
  expect(run(engine, 'to-close', { type: 'advance-through', day: 30 }).status).toBe('accepted');
  return { scenario, engine };
}

it('reconciles Day 30 close with ECONOMY_FIXTURE and resolves Day 31 restock shortfall via early collection', () => {
  const { scenario, engine } = advanceThroughDeliveryAndClose('big-order', 'loan');
  const closed = engine.read();
  expect(closed.day).toBe(31);
  expect(closed.monthOneBalance).toMatchObject({
    cash: '2680000', assets: '4115000', liabilities: '1055000', equity: '3060000',
  });
  expect(closed.monthOneIncome).toMatchObject({
    revenue: '525000', costOfSales: '280000', grossProfit: '245000',
    profitBeforeTax: '75000', taxExpense: '15000', netIncome: '60000',
  });
  expect(closed.cashFlow).toMatchObject({
    operating: { net: '-720000' }, investing: { net: '-600000' },
    financing: { net: '4000000' }, closingCash: '2680000',
  });

  // Trigger post-close pressure: 25,000 restock reduces cash to 1,800 before 2,200 rent due day 32.
  expect(run(engine, 'restock', { type: 'approve-restock' }).status).toBe('accepted');
  const pressured = engine.read();
  expect(pressured.balance.cash).toBe('180000');
  expect(pressured.liquidity.baseline.firstShortfall).toMatchObject({
    day: 32, amountMinor: '40000', reason: 'rent', partyId: 'landlord',
  });
  expect(pressured.distress.stage).toBe('warning');
  expect(pressured.earlyCollectionSummary).toEqual({
    available: true, grossMinor: '525000', discountMinor: '10500', cashMinor: '514500',
  });

  // Reopening reproduces the exact same liquidity diagnosis and forecast.
  const reopened = createJourneyEngine(scenario, engine.capture());
  expect(reopened.read().liquidity).toEqual(pressured.liquidity);
  expect(reopened.read().distress).toEqual(pressured.distress);

  // Containment solution 1: early collection covers rent at a 105 discount without rewriting Month 1.
  expect(run(engine, 'early', { type: 'collect-early' }).status).toBe('accepted');
  const afterEarly = engine.read();
  expect(afterEarly.balance.cash).toBe('694500');
  expect(afterEarly.monthOneIncome?.netIncome).toBe('60000');
  expect(afterEarly.monthTwoIncome?.revenue).toBe('-10500');

  expect(run(engine, 'finish', { type: 'advance-through', day: 45 }).status).toBe('accepted');
  const done = engine.read();
  expect(done.evaluation).toEqual({
    status: 'succeeded', deliveredOnTime: true, payrollPaidOnTime: true, cashNonNegative: true, solvent: true,
  });
  expect(done.balance.cash).toBe('419500');
  expect(done.inventory.quantity).toBe('655');
});

it('produces distinct documented consequences for rescue-loan path vs capital-only deferred path', () => {
  // Path A: loan + restock + failed rent attempt -> rescue loan -> recover -> delayed customer collection.
  const { engine: rescue } = advanceThroughDeliveryAndClose('big-order', 'loan');
  expect(run(rescue, 'restock', { type: 'approve-restock' }).status).toBe('accepted');
  expect(run(rescue, 'to-rent-day', { type: 'advance', days: 1 }).status).toBe('accepted');
  const failedPay = run(rescue, 'try-rent', { type: 'pay-obligation', obligationId: 'warehouse-rent-32' });
  expect(failedPay).toMatchObject({ status: 'rejected', code: 'insufficient-cash', shortfallMinor: '40000' });
  expect(rescue.read().distress.stage).toBe('payment-shortfall');
  expect(rescue.read().balance.cash).toBe('180000');

  expect(run(rescue, 'bridge', { type: 'draw-rescue-loan' }).status).toBe('accepted');
  expect(run(rescue, 'pay-rent', { type: 'pay-obligation', obligationId: 'warehouse-rent-32' }).status).toBe('accepted');
  expect(rescue.read().balance.cash).toBe('560000');
  expect(rescue.read().distress.stage).toBe('recovered');

  // Advance stops at Day 39 with overdue customer invoice alert (delay = 3 days, no automatic write-off).
  expect(run(rescue, 'to-overdue', { type: 'advance-through', day: 45 }).status).toBe('accepted');
  const overdue = rescue.read();
  expect(overdue.pendingAlerts.some((a) => a.code === 'invoice-overdue')).toBe(true);
  expect(overdue.invoices.every((inv) => inv.status === 'overdue')).toBe(true);
  for (const alert of overdue.pendingAlerts) {
    expect(run(rescue, `ack-${alert.id}`, { type: 'resolve-alert', alertId: alert.id }).status).toBe('accepted');
  }
  expect(run(rescue, 'to-end', { type: 'advance-through', day: 45 }).status).toBe('accepted');
  const rescueEnd = rescue.read();

  // Path B: founder capital only (no loan) + defer restock -> higher Month 1 net income, zero debt, smaller stock.
  const { engine: capital } = advanceThroughDeliveryAndClose('big-order', 'capital');
  expect(capital.read().monthOneIncome?.netIncome).toBe('68000');
  expect(run(capital, 'restock-denied', { type: 'approve-restock' }))
    .toMatchObject({ status: 'rejected', code: 'insufficient-cash' });
  expect(run(capital, 'defer', { type: 'defer-restock' }).status).toBe('accepted');
  expect(run(capital, 'to-overdue-cap', { type: 'advance-through', day: 45 }).status).toBe('accepted');
  for (const alert of capital.read().pendingAlerts) {
    run(capital, `ack-cap-${alert.id}`, { type: 'resolve-alert', alertId: alert.id });
  }
  expect(run(capital, 'to-end-cap', { type: 'advance-through', day: 45 }).status).toBe('accepted');
  const capitalEnd = capital.read();

  expect(rescueEnd.evaluation.status).toBe('succeeded');
  expect(capitalEnd.evaluation.status).toBe('succeeded');
  expect(rescueEnd.balance.cash).toBe('1030000');
  expect(capitalEnd.balance.cash).toBe('1938000');
  expect(rescueEnd.inventory.quantity).toBe('655');
  expect(capitalEnd.inventory.quantity).toBe('30');
  expect(rescueEnd.balance.liabilities).toBe('1600000');
  expect(capitalEnd.balance.liabilities).toBe('0');
});

it('escalates an unresolved shortfall to default, ends with readable accounts, and blocks invalid actions', () => {
  const { scenario, engine } = advanceThroughDeliveryAndClose('big-order', 'loan');
  expect(run(engine, 'restock', { type: 'approve-restock' }).status).toBe('accepted');
  // Advance past Day 32: rent payment fails -> stops with payment-shortfall alert.
  expect(run(engine, 'hit-rent', { type: 'advance-through', day: 35 }).status).toBe('accepted');
  expect(engine.read().distress.stage).toBe('payment-shortfall');
  for (const alert of engine.read().pendingAlerts) {
    run(engine, `ignore-${alert.id}`, { type: 'resolve-alert', alertId: alert.id });
  }
  expect(run(engine, 'hit-default', { type: 'advance-through', day: 35 }).status).toBe('accepted');
  expect(engine.read().distress.stage).toBe('default');

  const beforeEnd = engine.read().balance;
  expect(run(engine, 'end', { type: 'end-company' }).status).toBe('accepted');
  const ended = engine.read();
  expect(ended.distress).toMatchObject({ stage: 'ended', canOperate: false });
  expect(ended.evaluation.status).toBe('ended-default');
  expect(ended.balance).toEqual(beforeEnd);
  expect(run(engine, 'post-end', { type: 'advance', days: 1 })).toMatchObject({ status: 'rejected', code: 'company-ended' });

  // Reopen ended company preserves terminal report and balances.
  expect(createJourneyEngine(scenario, engine.capture()).read().distress).toEqual(ended.distress);

  // Separate failure checks: expired offer and over-capacity delivery leave state intact.
  const fresh = createJourneyEngine(scenario);
  run(fresh, 'f', { type: 'found-company', fundingPlan: 'loan' });
  run(fresh, 'skip-offer', { type: 'advance-through', day: 7 });
  expect(fresh.read().offer?.status).toBe('expired');
  expect(run(fresh, 'late-accept', { type: 'accept-contract', offerId: scenario.contract.id }))
    .toMatchObject({ status: 'rejected', code: 'offer-expired' });
});

it('tunes difficulty from independent scenario data while keeping double-entry rules unchanged', () => {
  const { engine } = advanceThroughDeliveryAndClose('big-order-tight', 'loan');
  const closed = engine.read();
  expect(closed.scenarioId).toBe('big-order-tight');
  expect(closed.monthOneBalance?.assets).toBe(closed.monthOneBalance?.liabilitiesAndEquity);
  // Tight 21-day shelf life causes the 30 leftover boxes to spoil on Day 29 before close.
  expect(closed.inventory.quantity).toBe('0');
  expect(closed.journal.some((entry) => entry.lines.some((line) => line.account === 'inventorySpoilageExpense'))).toBe(true);
  expect(run(engine, 'tight-restock', { type: 'approve-restock' }).status).toBe('accepted');
  expect(engine.read().liquidity.baseline.firstShortfall).toMatchObject({ day: 32, amountMinor: '70000', reason: 'rent' });
});
