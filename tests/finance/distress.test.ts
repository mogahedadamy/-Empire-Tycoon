/** Tests escalation, actual financing and repayment, and a terminal report without a write-off. */
import { expect, it } from 'vitest';
import { applyFinanceCommand, balanceSheet, reviewDistress } from '../../packages/finance/src';
import { liquidityScenario, rentId } from './liquidity-fixture';

const rentPayment = { type: 'pay-obligation', id: 'settle-rent', obligationId: rentId, day: 32 } as const;

it('moves from warning to failed payment, then recovers after actually financing and paying rent', () => {
  const scenario = liquidityScenario(true);
  const warning = reviewDistress(scenario.read(31));
  expect(warning).toMatchObject({
    stage: 'warning', cause: { source: 'rent', amountMinor: '40000', responseByDay: 32 },
  });
  expect(() => applyFinanceCommand(scenario.finance.state, scenario.finance.ledger, rentPayment))
    .toThrow(expect.objectContaining({ code: 'insufficient-cash', shortfallMinor: '40000' }));
  const failed = reviewDistress(scenario.read(32), warning, { failedPaymentId: rentId });
  expect(failed).toMatchObject({
    stage: 'payment-shortfall',
    cause: { partyId: 'landlord', amountMinor: '220000', dueDay: 32, responseByDay: 35 },
  });

  const draw = applyFinanceCommand(scenario.finance.state, scenario.finance.ledger, {
    id: 'liquidity-draw', day: 33, type: 'disburse-loan', loanId: 'rescue-loan',
    principalMinor: '600000', monthlyInterestBps: 100, interestDueAfterCloseDays: 1,
    installments: [{ dueDay: 90, amountMinor: '600000' }],
  });
  const paid = applyFinanceCommand(draw.state, draw.ledger, { ...rentPayment, day: 33 });
  expect(reviewDistress(scenario.read(33, paid), failed)).toMatchObject({
    stage: 'recovered', cause: null, canOperate: true,
  });
  expect(balanceSheet(paid.ledger, 33).cash).toBe('560000');
});

it('escalates after the grace period and explicitly ends the scenario with readable balances', () => {
  const scenario = liquidityScenario(true);
  const warning = reviewDistress(scenario.read(31));
  expect(() => reviewDistress(scenario.read(31), warning, { endCompany: true })).toThrow('Only a defaulted');
  expect(reviewDistress(scenario.read(34), warning).stage).toBe('payment-shortfall');
  const breached = reviewDistress(scenario.read(35), warning);
  expect(breached).toMatchObject({
    stage: 'default', cause: { sourceId: rentId, dueDay: 32, responseByDay: 35 },
  });
  const issued = balanceSheet(scenario.finance.ledger, 35);
  const ended = reviewDistress(scenario.read(35), breached, { endCompany: true });
  expect(ended).toMatchObject({
    stage: 'ended', canOperate: false,
    ending: { cashMinor: '180000', unpaidIds: expect.arrayContaining([rentId]) },
  });
  expect(reviewDistress(scenario.read(40), ended)).toBe(ended);
  expect(balanceSheet(scenario.finance.ledger, 35)).toEqual(issued);
});

it('does not classify a planned but unrecognized wage as an actual default', () => {
  const input = liquidityScenario().read(40);
  const before = input.flows.find(({ source }) => source === 'payroll');
  expect(before).toMatchObject({ dueDay: 28, committed: false });
  expect(reviewDistress(input).stage).toBe('healthy');
});
