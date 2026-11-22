/** Immutable ledger for one company and currency, with atomic posting and linked reversals. */
import { makeEntry, requireIdentifier, type JournalEntry, type JournalEntryInput, type ReversalInput } from './journal';

export interface LedgerScope {
  readonly companyId: string;
  readonly currency: string;
}

export class Ledger {
  private constructor(
    readonly companyId: string,
    readonly currency: string,
    readonly entries: readonly JournalEntry[],
  ) {
    Object.freeze(this);
  }

  /** Opens an empty ledger. All entries use this ledger's currency. */
  static open({ companyId, currency }: LedgerScope): Ledger {
    requireIdentifier(companyId);
    requireIdentifier(currency);
    return new Ledger(companyId, currency, Object.freeze([]));
  }

  /** Returns a ledger with the entire batch posted. Throws without changing the original on failure. */
  post(inputs: readonly JournalEntryInput[]): Ledger {
    return this.append(inputs.map((input) => makeEntry(input)));
  }

  /** Posts a full opposite entry linked to its original, on the same day or a later day. */
  reverse({ id, sourceId, day, originalId }: ReversalInput): Ledger {
    const original = this.entries.find((entry) => entry.id === originalId);
    if (!original) throw new RangeError('Original journal entry not found');
    if (day < original.day) throw new RangeError('Reversal cannot predate its original');

    const reversal = makeEntry({
      id,
      sourceId,
      day,
      lines: original.lines.map((line) => ({
        ...line,
        side: line.side === 'debit' ? 'credit' : 'debit',
      })),
    }, original.id);

    return this.append([reversal]);
  }

  private append(entries: readonly JournalEntry[]): Ledger {
    const known = new Map(this.entries.map((entry) => [entry.id, entry]));
    const reversed = new Set(this.entries.map((entry) => entry.reversesId));

    for (const entry of entries) {
      const existing = known.get(entry.id);
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(entry)) throw new RangeError('Journal entry ID conflict');
        continue;
      }

      if (entry.reversesId !== null) {
        if (reversed.has(entry.reversesId)) throw new RangeError('Journal entry already reversed');
        reversed.add(entry.reversesId);
      }
      known.set(entry.id, entry);
    }

    if (known.size === this.entries.length) return this;
    return new Ledger(this.companyId, this.currency, Object.freeze([...known.values()]));
  }
}
