/** Stages balanced entries with traceable IDs for the finance domain. */
import type { JournalEntryInput, JournalLine } from '../journal';
import type { Ledger } from '../ledger';
import { FinanceError, type ObligationKind } from './types';

export const liabilityAccounts = {
  rent: 'rentPayable', utilities: 'utilitiesPayable', principal: 'loanPrincipal',
  interest: 'interestPayable', tax: 'taxPayable',
} as const satisfies Record<ObligationKind, JournalLine['account']>;

const expenseAccounts = {
  rent: 'rentExpense', utilities: 'utilitiesExpense', interest: 'interestExpense', tax: 'taxExpense',
} as const;

export function accrualLines(kind: Exclude<ObligationKind, 'principal'>, amount: string): JournalLine[] {
  return [
    { account: expenseAccounts[kind], side: 'debit', amount },
    { account: liabilityAccounts[kind], side: 'credit', amount },
  ];
}

export function postFinance(ledger: Ledger, entries: readonly JournalEntryInput[]): Ledger {
  const ids = new Set(ledger.entries.map(({ id }) => id));
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new FinanceError('journal-conflict');
    ids.add(entry.id);
  }
  return entries.length ? ledger.post(entries) : ledger;
}
