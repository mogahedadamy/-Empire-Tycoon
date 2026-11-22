/** Covers scheduled payroll, retry safety, and outstanding wages until cash is available. */
import { expect, it } from 'vitest';
import { balanceSheet, directCashFlow, incomeStatement, Ledger } from '../../packages/finance/src';
import { applyWorkforceCommand, createWorkforce } from '../../packages/operations/src';
import { accrue, apply, dueDay, openWorkforce, pay, payrollAmount, plan } from './workforce-fixture';

const period = { fromDay: accrue.day, throughDay: dueDay };

it('accrues 1,200 with no sales and pays it once on the due date', () => {
  const open = openWorkforce();
  expect(() => apply(open, pay)).toThrow('payroll-not-accrued');
  expect(() => apply(open, { ...accrue, day: accrue.day - 1 })).toThrow('wrong-accrual-day');
  const accrued = apply(open, accrue);

  expect(accrued.state.payrollRecords[0]).toMatchObject({
    amountMinor: payrollAmount, dueDay, accrualEntryId: 'payroll:accrue', payment: null,
  });
  expect(balanceSheet(accrued.ledger, dueDay)).toMatchObject({ cash: '3000000', liabilities: '120000' });
  expect(directCashFlow(accrued.ledger, period).operating.payments).toBe('0');
  expect(() => apply(accrued, { ...pay, day: accrue.day })).toThrow('payroll-not-due');
  expect(() => apply(accrued, { ...accrue, id: 'another-accrual' })).toThrow('already-accrued');

  const paid = apply(accrued, pay);
  expect(paid.state.payrollRecords[0].payment).toEqual({ day: dueDay, journalEntryId: 'payroll:pay' });
  expect(incomeStatement(paid.ledger, period)).toMatchObject({ revenue: '0', operatingExpenses: '120000' });
  expect(balanceSheet(paid.ledger, dueDay)).toMatchObject({ cash: '2880000', liabilities: '0' });
  expect(directCashFlow(paid.ledger, period).operating.payments).toBe('120000');
  expect(apply(paid, pay)).toEqual(paid);
  expect(apply(paid, accrue)).toEqual(paid);
  expect(() => apply(paid, { ...pay, id: 'another-payment' })).toThrow('already-paid');
  expect(paid.ledger.entries.map(({ id, sourceId }) => [id, sourceId]).slice(-2)).toEqual([
    ['payroll:accrue', accrue.payrollId], ['payroll:pay', accrue.payrollId],
  ]);
});

it('keeps the full wage payable when cash is insufficient and supports a later funded retry', () => {
  const accrued = apply(openWorkforce(false), accrue);
  const ledger = accrued.ledger.post([{
    id: 'partial-funding', sourceId: 'founder', day: dueDay, lines: [
      { account: 'cash', side: 'debit', amount: '100000', cashFlow: 'financing' },
      { account: 'contributedCapital', side: 'credit', amount: '100000' },
    ],
  }]);

  expect(() => apply({ ...accrued, ledger }, pay)).toThrow('insufficient-cash');
  expect(accrued.state.payrollRecords[0].payment).toBeNull();
  expect(balanceSheet(ledger, dueDay)).toMatchObject({ cash: '100000', liabilities: '120000' });
  expect(ledger.entries).toHaveLength(2);

  const funded = ledger.post([{
    id: 'final-funding', sourceId: 'founder', day: dueDay + 1, lines: [
      { account: 'cash', side: 'debit', amount: '20000', cashFlow: 'financing' },
      { account: 'contributedCapital', side: 'credit', amount: '20000' },
    ],
  }]);
  const settled = apply({ ...accrued, ledger: funded }, { ...pay, day: dueDay + 1 });
  expect(settled.state.payrollRecords[0].payment?.day).toBe(dueDay + 1);
  expect(balanceSheet(settled.ledger, dueDay)).toMatchObject({ cash: '100000', liabilities: '120000' });
  expect(balanceSheet(settled.ledger, dueDay + 1)).toMatchObject({ cash: '0', liabilities: '0' });
});

it('rejects conflicting retries, plans with invalid wages, and ledgers from another company', () => {
  const open = openWorkforce();
  const accrued = apply(open, accrue);
  expect(() => apply(accrued, { ...accrue, payrollId: 'different' })).toThrow('conflict');
  expect(() => createWorkforce(open.ledger, {
    ...plan, roles: [{ ...plan.roles[0], wagePerWorkerMinor: '600.5' }],
  })).toThrow('invalid-input');
  const other = Ledger.open({ companyId: 'other-company', currency: open.ledger.currency });
  expect(() => applyWorkforceCommand(open.state, other, accrue)).toThrow('scope-mismatch');

  const wrongLedger = open.ledger;
  expect(() => apply({ state: accrued.state, ledger: wrongLedger }, pay)).toThrow('journal-conflict');
  expect(accrued.state.payrollRecords[0].payment).toBeNull();
});
