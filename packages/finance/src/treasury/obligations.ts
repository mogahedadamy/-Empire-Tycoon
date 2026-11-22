/** Recognizes liabilities and settles them in full in the permitted order. */
import type { Ledger } from '../ledger';
import { balanceSheet } from '../statements';
import { accrualLines, liabilityAccounts, postFinance } from './posting';
import { FinanceError, type FinanceCommand, type FinanceState, type Obligation } from './types';

export function appendObligations(state: FinanceState, items: readonly Obligation[]) {
  const ids = new Set(state.obligations.map(({ id }) => id));
  for (const item of items) {
    if (ids.has(item.id)) throw new FinanceError('conflict');
    ids.add(item.id);
  }
  return Object.freeze([...state.obligations, ...items]);
}

export function accrueExpense(
  ledger: Ledger, state: FinanceState, command: Extract<FinanceCommand, { type: 'accrue-obligation' }>,
) {
  const { kind, day, dueDay, amountMinor, obligationId: id } = command;
  const accrualEntryId = `finance:expense:${id}`;
  const obligation: Obligation = Object.freeze({
    id, kind, amountMinor, recognizedDay: day, dueDay, accrualEntryId, payment: null,
  });
  return {
    obligations: appendObligations(state, [obligation]),
    ledger: postFinance(ledger, [{
      id: accrualEntryId, sourceId: id, day, lines: accrualLines(kind, amountMinor),
    }]),
  };
}

function hasPrecedingPayment(state: FinanceState, obligation: Obligation): boolean {
  if (!obligation.loanId) return false;
  return state.obligations.some((other) =>
    other.loanId === obligation.loanId && !other.payment &&
    (other.dueDay < obligation.dueDay ||
      (other.dueDay === obligation.dueDay && other.kind === 'interest' && obligation.kind === 'principal')));
}

export function payExpense(
  ledger: Ledger, state: FinanceState, command: Extract<FinanceCommand, { type: 'pay-obligation' }>,
) {
  const record = state.obligations.find(({ id }) => id === command.obligationId);
  if (!record) throw new FinanceError('unknown-obligation');
  if (record.payment) throw new FinanceError('already-paid');
  if (command.day < record.dueDay) throw new FinanceError('not-due');
  if (hasPrecedingPayment(state, record)) throw new FinanceError('payment-order');
  if (!ledger.entries.some(({ id }) => id === record.accrualEntryId)) throw new FinanceError('journal-conflict');

  const { cash } = balanceSheet(ledger, command.day);
  const shortfall = BigInt(record.amountMinor) - BigInt(cash);
  if (shortfall > 0n) throw new FinanceError('insufficient-cash', shortfall.toString());

  const amount = record.amountMinor;
  const journalEntryId = `finance:payment:${record.id}`;
  const nextLedger = postFinance(ledger, [{
    id: journalEntryId, sourceId: record.id, day: command.day, lines: [
      { account: liabilityAccounts[record.kind], side: 'debit', amount },
      { account: 'cash', side: 'credit', amount, cashFlow: record.kind === 'principal' ? 'financing' : 'operating' },
    ],
  }]);
  const paid = Object.freeze({
    ...record, payment: Object.freeze({ day: command.day, journalEntryId }),
  });
  return {
    ledger: nextLedger,
    obligations: Object.freeze(state.obligations.map((item) => item === record ? paid : item)),
  };
}
