/** Validates double-entry transactions and creates immutable, serializable journal entries. */
import { isAccountId, type AccountId } from './accounts';
import { parseMinorUnits } from './money';

export type CashFlowCategory = 'operating' | 'investing' | 'financing';
export type Side = 'debit' | 'credit';

interface LineAmount {
  readonly side: Side;
  /** Positive integer minor units, serialized as a decimal string. */
  readonly amount: string;
}

/** Cash lines classify the actual receipt or payment for the direct statement. */
export type JournalLine = LineAmount & (
  | { readonly account: 'cash'; readonly cashFlow: CashFlowCategory }
  | { readonly account: Exclude<AccountId, 'cash'>; readonly cashFlow?: never }
);

export interface JournalEntryInput {
  readonly id: string;
  readonly sourceId: string;
  readonly day: number;
  readonly lines: readonly JournalLine[];
}

export interface JournalEntry extends JournalEntryInput {
  readonly reversesId: string | null;
}

export interface ReversalInput {
  readonly id: string;
  readonly sourceId: string;
  readonly day: number;
  readonly originalId: string;
}

function isCashFlowCategory(value: unknown): value is CashFlowCategory {
  return value === 'operating' || value === 'investing' || value === 'financing';
}

function normalizeLine(line: JournalLine): JournalLine {
  if (!line || !isAccountId(line.account) || (line.side !== 'debit' && line.side !== 'credit')) {
    throw new RangeError('Unknown account or invalid journal side');
  }

  const { account, side, amount, cashFlow } = line;
  if (parseMinorUnits(amount) <= 0n) throw new RangeError('Journal amounts must be positive');

  if (account === 'cash') {
    if (!isCashFlowCategory(cashFlow)) throw new RangeError('Cash lines require a cash flow category');
    return Object.freeze({ account, side, amount, cashFlow });
  }

  if (cashFlow !== undefined) throw new RangeError('Cash flow categories apply only to cash lines');
  return Object.freeze({ account, side, amount });
}

export function requireIdentifier(value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) throw new RangeError('Expected an identifier');
}

export function requireDay(value: number, minimum = 1): void {
  if (!Number.isSafeInteger(value) || value < minimum) throw new RangeError('Invalid accounting day');
}

/** Copies and balances a single transaction before the ledger can commit it. */
export function makeEntry(input: JournalEntryInput, reversesId: string | null = null): JournalEntry {
  const { id, sourceId, day } = input;
  requireIdentifier(id);
  requireIdentifier(sourceId);
  requireDay(day);

  if (!Array.isArray(input.lines) || input.lines.length < 2) {
    throw new RangeError('Journal entries require at least two lines');
  }

  const lines = Array.from(input.lines, normalizeLine);
  const balance = lines.reduce((sum, line) => {
    const amount = BigInt(line.amount);
    return sum + (line.side === 'debit' ? amount : -amount);
  }, 0n);
  if (balance !== 0n) throw new RangeError('Unbalanced journal entry');

  return Object.freeze({ id, sourceId, day, lines: Object.freeze(lines), reversesId });
}
