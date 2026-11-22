/** Verifies loan disbursement and obligation scheduling, priority and insufficient-cash handling. */
import { expect, it } from 'vitest';
import { balanceSheet, directCashFlow, incomeStatement } from '../../packages/finance/src';
import { transaction } from './fixture';
import { apply, close, loan, openFinance, referenceBeforeClose } from './treasury-fixture';

it('disburses 10,000 as financing without adding sales and tracks scheduled principal', () => {
  const funded = apply(openFinance(), loan);

  expect(balanceSheet(funded.ledger, 3)).toMatchObject({ cash: '1000000', liabilities: '1000000', equity: '0' });
  expect(incomeStatement(funded.ledger, { fromDay: 1, throughDay: 3 }).revenue).toBe('0');
  expect(directCashFlow(funded.ledger, { fromDay: 1, throughDay: 3 }).financing.receipts).toBe('1000000');
  expect(funded.state.obligations).toEqual([expect.objectContaining({
    id: 'principal:starter-loan:60', accrualEntryId: 'finance:loan:starter-loan',
    dueDay: 60, amountMinor: '1000000', payment: null,
  })]);
  expect(apply(funded, loan).ledger).toBe(funded.ledger);
  expect(() => apply(funded, { ...loan, id: 'reissued' })).toThrow('conflict');
  expect(() => apply(openFinance(), { ...loan, installments: [{ dueDay: 60, amountMinor: '5' }] }))
    .toThrow('invalid-command');
});

it('requires related earlier obligations and same-day interest before principal', () => {
  const funded = apply(openFinance(), { ...loan, installments: [
    { dueDay: 31, amountMinor: '400000' }, { dueDay: 60, amountMinor: '600000' },
  ] });
  const closed = apply(funded, close);
  const principal = {
    id: 'repay', day: 31, type: 'pay-obligation', obligationId: 'principal:starter-loan:31',
  } as const;
  expect(() => apply(closed, principal)).toThrow('payment-order');
  const interest = apply(closed, { ...principal, id: 'settle-interest', obligationId: 'interest:starter-loan:30' });
  const paid = apply(interest, principal);
  expect(balanceSheet(paid.ledger, 31).accounts).toEqual(expect.arrayContaining([
    { account: 'loanPrincipal', group: 'liabilities', amount: '600000' },
    { account: 'interestPayable', group: 'liabilities', amount: '0' },
  ]));
  expect(directCashFlow(paid.ledger, { fromDay: 31, throughDay: 31 })).toMatchObject({
    operating: { payments: '10000' },
    financing: { payments: '400000' },
  });
  expect(apply(paid, principal).state).toBe(paid.state);
});

it('reports a 400 rent shortfall and preserves the full payable until cash is available', () => {
  const closed = apply(referenceBeforeClose(), close);
  const ledger = closed.ledger.post([transaction('pressure-purchase', 31,
    { account: 'inventory', side: 'debit', amount: '2500000' },
    { account: 'cash', side: 'credit', amount: '2500000', cashFlow: 'operating' },
  )]);
  const accrued = apply({ ...closed, ledger }, {
    id: 'rent-cost', type: 'accrue-obligation', day: 31, dueDay: 32,
    obligationId: 'next-rent', kind: 'rent', amountMinor: '220000',
  });
  const pay = { id: 'pay-rent', day: 32, type: 'pay-obligation', obligationId: 'next-rent' } as const;
  expect(() => apply(accrued, pay)).toThrow(expect.objectContaining({
    code: 'insufficient-cash', shortfallMinor: '40000',
  }));
  expect(balanceSheet(accrued.ledger, 32)).toMatchObject({
    cash: '180000',
    accounts: expect.arrayContaining([{ account: 'rentPayable', group: 'liabilities', amount: '220000' }]),
  });
  expect(accrued.state.obligations.find(({ id }) => id === 'next-rent')?.payment).toBeNull();
  expect(accrued.ledger.entries.some(({ id }) => id === 'finance:payment:next-rent')).toBe(false);

  const funded = accrued.ledger.post([transaction('cash-top-up', 33,
    { account: 'cash', side: 'debit', amount: '40000', cashFlow: 'financing' },
    { account: 'contributedCapital', side: 'credit', amount: '40000' },
  )]);
  const settled = apply({ ...accrued, ledger: funded }, { ...pay, day: 33 });
  expect(balanceSheet(settled.ledger, 33)).toMatchObject({
    cash: '0',
    accounts: expect.arrayContaining([{ account: 'rentPayable', group: 'liabilities', amount: '0' }]),
  });
  expect(incomeStatement(settled.ledger, { fromDay: 31, throughDay: 33 }).operatingExpenses).toBe('220000');
});
