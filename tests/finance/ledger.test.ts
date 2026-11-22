/** Exercises posting invariants, retry and reversal behavior through the public API. */
import { expect, it } from 'vitest';
import {
  applyBasisPoints,
  balanceSheet,
  directCashFlow,
  Ledger,
  parseMinorUnits,
  type JournalEntryInput,
} from '../../packages/finance/src';
import { transaction } from './fixture';

function openLedger() {
  return Ledger.open({ companyId: 'first', currency: 'GAME' });
}

function capital(id: string, amount = '100'): JournalEntryInput {
  return transaction(id, 1,
    { account: 'cash', side: 'debit', amount, cashFlow: 'financing' },
    { account: 'contributedCapital', side: 'credit', amount });
}

it('rejects an unbalanced entry and commits none of a failed batch', () => {
  const ledger = openLedger().post([capital('opening')]);
  const invalid = transaction('unbalanced', 2,
    { account: 'cash', side: 'debit', amount: '100', cashFlow: 'financing' },
    { account: 'contributedCapital', side: 'credit', amount: '99' });

  expect(() => ledger.post([capital('new'), invalid])).toThrow('Unbalanced journal entry');
  expect(ledger.entries.map(({ id }) => id)).toEqual(['opening']);
  expect(balanceSheet(ledger, 2).cash).toBe('100');
  expect(ledger.post([capital('new')]).entries).toHaveLength(2);
});

it('records immutable entries and handles retry IDs independently for each company ledger', () => {
  const original = capital('same');
  const ledger = openLedger().post([original, original]);

  expect(ledger.post([capital('same')])).toBe(ledger);
  expect(() => ledger.post([capital('same', '200')])).toThrow('Journal entry ID conflict');
  expect(Object.isFrozen(ledger.entries)).toBe(true);
  expect(Object.isFrozen(ledger.entries[0].lines[0])).toBe(true);
  expect(ledger.entries[0].lines[0]).not.toBe(original.lines[0]);

  const other = Ledger.open({ companyId: 'second', currency: 'OTHER' })
    .post([capital('same', '200')]);
  expect(balanceSheet(other, 1)).toMatchObject({ companyId: 'second', currency: 'OTHER', cash: '200' });
  expect(balanceSheet(ledger, 1).cash).toBe('100');
});

it('links a dated reversal to its original and corrects gross cash without duplicating effects', () => {
  const posted = openLedger().post([capital('original')]);
  const input = { id: 'undo', sourceId: 'correction', originalId: 'original', day: 2 };
  const reversed = posted.reverse(input);

  expect(reversed.entries[0]).toBe(posted.entries[0]);
  expect(reversed.entries[1]).toEqual({
    id: 'undo',
    sourceId: 'correction',
    day: 2,
    reversesId: 'original',
    lines: [
      { account: 'cash', side: 'credit', amount: '100', cashFlow: 'financing' },
      { account: 'contributedCapital', side: 'debit', amount: '100' },
    ],
  });
  expect(reversed.reverse(input)).toBe(reversed);
  expect(() => reversed.reverse({ ...input, id: 'second-undo' })).toThrow('already reversed');
  expect(() => posted.reverse({ ...input, originalId: 'unknown' })).toThrow('not found');
  expect(() => posted.reverse({ ...input, day: 0 })).toThrow('cannot predate');
  expect(balanceSheet(reversed, 1).cash).toBe('100');
  expect(balanceSheet(reversed, 2)).toMatchObject({ cash: '0', equity: '0' });
  expect(directCashFlow(reversed, { fromDay: 1, throughDay: 2 }).financing)
    .toEqual({ receipts: '0', payments: '0', net: '0' });
  expect(directCashFlow(reversed, { fromDay: 2, throughDay: 2 }).financing)
    .toEqual({ receipts: '-100', payments: '0', net: '-100' });

  const reinstated = reversed.reverse({ ...input, id: 'restore', originalId: 'undo', day: 3 });
  expect(directCashFlow(reinstated, { fromDay: 1, throughDay: 3 }).financing)
    .toEqual({ receipts: '100', payments: '0', net: '100' });
});

it('requires positive canonical decimal strings and preserves amounts above safe Number precision', () => {
  const ledger = openLedger();
  for (const amount of ['1.5', '1e2', '01', ' 10', '1\n', 1.5, 9_007_199_254_740_992]) {
    expect(() => ledger.post([capital('invalid', amount as string)])).toThrow('canonical integer');
  }
  for (const amount of ['0', '-10']) {
    expect(() => ledger.post([capital('invalid', amount)])).toThrow('must be positive');
  }
  const big = '900719925474099312345';
  expect(balanceSheet(ledger.post([capital('exact', big)]), 1).cash).toBe(big);
});

it('rounds both signs to the nearest minor unit with ties away from zero', () => {
  expect(applyBasisPoints(parseMinorUnits('101'), 5_000)).toBe(51n);
  expect(applyBasisPoints(parseMinorUnits('-101'), 5_000)).toBe(-51n);
  expect(applyBasisPoints(1n, 4_999)).toBe(0n);
  expect(applyBasisPoints(-1n, 5_001)).toBe(-1n);
  expect(applyBasisPoints(10n ** 30n, 2_000)).toBe(2n * 10n ** 29n);
  expect(() => applyBasisPoints(100n, 1.5)).toThrow('integer basis points');
});
