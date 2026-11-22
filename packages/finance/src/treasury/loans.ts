/** Posts loan principal and calculates contracted monthly interest without prorating days. */
import type { Ledger } from '../ledger';
import { applyBasisPoints } from '../money';
import { appendObligations } from './obligations';
import { postFinance } from './posting';
import { FinanceError, type FinanceCommand, type FinanceState, type Loan, type Obligation } from './types';

export function disburse(
  ledger: Ledger, state: FinanceState, command: Extract<FinanceCommand, { type: 'disburse-loan' }>,
) {
  const { loanId, principalMinor: amount, day, installments } = command;
  if (state.loans.some((loan) => loan.loanId === loanId)) throw new FinanceError('conflict');

  const journalEntryId = `finance:loan:${loanId}`;
  const { id: _id, type: _type, day: _day, ...terms } = command;
  const loan: Loan = Object.freeze({ ...terms, disbursedDay: day, journalEntryId });
  const installmentsDue = installments.map(({ dueDay, amountMinor }): Obligation => Object.freeze({
    id: `principal:${loanId}:${dueDay}`, loanId, kind: 'principal', amountMinor,
    recognizedDay: day, dueDay, accrualEntryId: journalEntryId, payment: null,
  }));
  const obligations = appendObligations(state, installmentsDue);
  const nextLedger = postFinance(ledger, [{
    id: journalEntryId, sourceId: loanId, day, lines: [
      { account: 'cash', side: 'debit', amount, cashFlow: 'financing' },
      { account: 'loanPrincipal', side: 'credit', amount },
    ],
  }]);

  return { ledger: nextLedger, loans: Object.freeze([...state.loans, loan]), obligations };
}

export function periodInterest(state: FinanceState, loan: Loan, fromDay: number, throughDay: number): bigint {
  if (loan.disbursedDay > throughDay) return 0n;

  // Fix the month's balance at its start (or disbursement), with no daily proration.
  const alreadyRepaid = state.obligations.reduce((total, item) =>
    item.loanId === loan.loanId && item.kind === 'principal' && item.payment && item.payment.day < fromDay
      ? total + BigInt(item.amountMinor) : total, 0n);
  return applyBasisPoints(BigInt(loan.principalMinor) - alreadyRepaid, loan.monthlyInterestBps);
}
