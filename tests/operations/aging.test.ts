/** Covers progressive loss, lot expiration, and the corresponding accounting entries. */
import { expect, it } from 'vitest';
import { balanceSheet, incomeStatement } from '../../packages/finance/src';
import { readInventory } from '../../packages/operations/src';
import { apply, openInventory, order, receipt, scope } from './inventory-fixture';

it('posts progressive spoilage, reduces free units first, and adjusts reservations on expiry', () => {
  const shortLife = { ...order, quantity: 10, shelfLifeDays: 4, spoilage: { startsAtAge: 1, unitsPerDay: 2 } };
  const received = apply(apply(openInventory(), shortLife), receipt);
  const reserved = apply(received, {
    ...scope, type: 'reserve', id: 'reserve', contractId: 'first', quantity: 8, day: receipt.day,
  });
  const firstDay = { type: 'age', id: 'age-first', day: receipt.day + 1 } as const;
  const aged = apply(reserved, firstDay);

  expect(readInventory(aged.state, scope)).toMatchObject({ quantity: 8n, reserved: 8n, available: 0n });
  expect(aged.movements).toEqual([expect.objectContaining({ kind: 'spoiled', costMinor: '8000', quantity: 2 })]);
  expect(apply(aged, firstDay).ledger).toBe(aged.ledger);
  expect(() => apply(aged, { ...firstDay, id: 'same-day' })).toThrow('already-aged');

  const next = apply(aged, { ...firstDay, id: 'age-second', day: receipt.day + 2 });
  expect(readInventory(next.state, scope)).toMatchObject({ quantity: 6n, reserved: 6n, valueMinor: '24000' });
  expect(next.movements.map(({ kind, quantity }) => [kind, quantity])).toEqual([
    ['released', 2], ['spoiled', 2],
  ]);
  const expiry = receipt.day + shortLife.shelfLifeDays;
  const expired = apply(next, { ...firstDay, id: 'age-expiry', day: expiry });
  expect(readInventory(expired.state, scope)).toMatchObject({ quantity: 0n, reserved: 0n, valueMinor: '0' });
  expect(expired.movements).toEqual([
    expect.objectContaining({ kind: 'released', quantity: 6, contractId: 'first' }),
    expect.objectContaining({ kind: 'spoiled', quantity: 6, journalEntryId: 'inventory:age-expiry' }),
  ]);
  expect(expired.ledger.entries.at(-1)?.lines).toEqual([
    { account: 'inventorySpoilageExpense', side: 'debit', amount: '24000' },
    { account: 'inventory', side: 'credit', amount: '24000' },
  ]);
  expect(incomeStatement(expired.ledger, { fromDay: receipt.day, throughDay: expiry }).operatingExpenses)
    .toBe('40000');
  const balance = balanceSheet(expired.ledger, expiry);
  expect(balance.cash).toBe('2960000');
  expect(balance.assets).toBe(balance.liabilitiesAndEquity);
});

it('rejects delivery from expired stock even before the loss is posted', () => {
  const received = apply(apply(openInventory(), order), receipt);
  const reserved = apply(received, {
    ...scope, type: 'reserve', id: 'reserve', contractId: 'first', quantity: 1, day: receipt.day,
  });
  expect(() => apply(reserved, {
    ...scope, type: 'deliver', id: 'late', contractId: 'first', quantity: 1,
    day: receipt.day + order.shelfLifeDays,
  })).toThrow('insufficient-stock');
});
