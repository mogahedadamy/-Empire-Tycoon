/** Posts earned wages and settles each due liability once, using the shared ledger. */
import { balanceSheet, type JournalLine, type Ledger } from '../../../finance/src';
import { WorkforceError, type PayrollRecord, type WorkforceCommand, type WorkforceState } from './types';

type PayrollCommand = Extract<WorkforceCommand, { type: 'accrue-payroll' | 'pay-payroll' }>;

function postPayrollEntry(ledger: Ledger, command: PayrollCommand, lines: readonly JournalLine[]) {
  const id = `payroll:${command.id}`;
  if (ledger.entries.some((entry) => entry.id === id)) throw new WorkforceError('journal-conflict');

  return {
    ledger: ledger.post([{ id, sourceId: command.payrollId, day: command.day, lines }]),
    id,
  };
}

export function accruePayroll(state: WorkforceState, ledger: Ledger, command: PayrollCommand) {
  const schedule = state.payroll.find(({ id }) => id === command.payrollId);
  if (!schedule) throw new WorkforceError('unknown-payroll');
  if (state.payrollRecords.some(({ id }) => id === schedule.id)) throw new WorkforceError('already-accrued');
  if (command.day !== schedule.accrualDay) throw new WorkforceError('wrong-accrual-day');

  // Scheduled salary is earned regardless of attendance, output, or cash in this slice.
  const amount = state.roles.reduce((sum, role) =>
    sum + BigInt(role.workers) * BigInt(role.wagePerWorkerMinor), 0n).toString();
  const posting = postPayrollEntry(ledger, command, [
    { account: 'payrollExpense', side: 'debit', amount },
    { account: 'payrollPayable', side: 'credit', amount },
  ]);
  const record: PayrollRecord = Object.freeze({
    ...schedule, amountMinor: amount, accrualEntryId: posting.id, payment: null,
  });

  return { ledger: posting.ledger, payrollRecords: Object.freeze([...state.payrollRecords, record]) };
}

export function payPayroll(state: WorkforceState, ledger: Ledger, command: PayrollCommand) {
  const record = state.payrollRecords.find(({ id }) => id === command.payrollId);
  if (!record) throw new WorkforceError('payroll-not-accrued');
  if (record.payment) throw new WorkforceError('already-paid');
  if (command.day < record.dueDay) throw new WorkforceError('payroll-not-due');
  if (!ledger.entries.some(({ id }) => id === record.accrualEntryId)) {
    throw new WorkforceError('journal-conflict');
  }

  const amount = record.amountMinor;
  if (BigInt(balanceSheet(ledger, command.day).cash) < BigInt(amount)) {
    throw new WorkforceError('insufficient-cash');
  }

  const posting = postPayrollEntry(ledger, command, [
    { account: 'payrollPayable', side: 'debit', amount },
    { account: 'cash', side: 'credit', amount, cashFlow: 'operating' },
  ]);
  const settled: PayrollRecord = Object.freeze({
    ...record, payment: Object.freeze({ day: command.day, journalEntryId: posting.id }),
  });

  return {
    ledger: posting.ledger,
    payrollRecords: Object.freeze(state.payrollRecords.map((item) => item === record ? settled : item)),
  };
}
