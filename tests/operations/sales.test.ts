/** Exercises contract transitions, FIFO deliveries, and the authoritative write boundary. */
import { expect, it } from 'vitest';
import { balanceSheet, incomeStatement } from '../../packages/finance/src';
import { readInventory, readSalesStatus } from '../../packages/operations/src';
import { scope } from './inventory-fixture';
import { accept, addShift, deliver, offer, sale, setupSales, signedSale, submit } from './sales-fixture';

it('publishes, signs and sells 70 at 75 in two deliveries with total FIFO cost 2,800', () => {
  const session = signedSale();
  const reserve = { ...deliver, id: 'book-quantity', type: 'reserve', day: 8, quantity: 70 } as const;
  expect(readSalesStatus(session.snapshot(), 8).offers[0].status).toBe('signed');
  const beforeReserve = session.snapshot();
  submit(session, { domain: 'sales', command: reserve });
  expect(session.snapshot().ledger).toBe(beforeReserve.ledger);
  expect(readSalesStatus(session.snapshot(), 8).offers[0].status).toBe('in-progress');
  expect(readInventory(session.snapshot().inventory, scope).reserved).toBe(70n);
  expect(sale(session, { ...deliver, id: 'early', day: deliver.day - 1 }))
    .toMatchObject({ code: 'outside-delivery-window' });
  expect(sale(session, { ...deliver, id: 'too-many-for-shift', quantity: 51 }))
    .toMatchObject({ code: 'capacity-exceeded' });

  submit(session, { domain: 'sales', command: deliver });
  expect(readSalesStatus(session.snapshot(), deliver.day).offers[0].status).toBe('partially-delivered');
  expect(session.capacity(offer.offerId, deliver.day)).toMatchObject({ used: 50n, available: 0n });
  const afterFirst = session.snapshot();
  expect(afterFirst.invoices[0]).toMatchObject({ quantity: 50, amountMinor: '375000', dueDay: 38 });
  expect(sale(session, { ...deliver, id: 'over-capacity', quantity: 1 }))
    .toMatchObject({ code: 'capacity-exceeded' });

  submit(session, { domain: 'sales', command: { ...deliver, id: 'second', day: deliver.day + 1, quantity: 20 } });
  const closed = session.snapshot();
  expect(readSalesStatus(closed, deliver.day + 1).offers[0].status).toBe('delivered');
  expect(closed.invoices.map(({ quantity, amountMinor, stockEntryId }) => [quantity, amountMinor, stockEntryId]))
    .toEqual([[50, '375000', 'inventory:sales-deliver:deliver'], [20, '150000', 'inventory:sales-deliver:second']]);
  expect(incomeStatement(closed.ledger, { fromDay: 1, throughDay: 30 })).toMatchObject({
    revenue: '525000', costOfSales: '280000',
  });
  expect(balanceSheet(closed.ledger, 30)).toMatchObject({
    cash: '2600000',
    accounts: expect.arrayContaining([{ account: 'receivables', group: 'assets', amount: '525000' }]),
  });
  expect(readInventory(closed.inventory, scope)).toMatchObject({ quantity: 30n, valueMinor: '120000' });
});

it('rejects a request for 31 of the remaining 30 without changing any state or ledger entries', () => {
  const session = signedSale(110);
  addShift(session, 'third-shift', deliver.day);
  submit(session, { domain: 'sales', command: { ...deliver, quantity: 70 } });
  const before = session.snapshot();
  expect(sale(session, { ...deliver, id: 'missing-one', day: deliver.day + 1, quantity: 31 }))
    .toMatchObject({ code: 'insufficient-stock' });
  expect(session.snapshot()).toBe(before);
  expect(readInventory(before.inventory, scope).quantity).toBe(30n);
  expect(before.invoices).toHaveLength(1);
});

it('prevents acceptance after offer expiry and releases a signed contract reservation on cancellation', () => {
  const expired = setupSales();
  submit(expired, { domain: 'sales', command: offer });
  expect(readSalesStatus(expired.snapshot(), offer.offerExpiresDay + 1).offers[0].status).toBe('expired');
  expect(sale(expired, { ...accept, day: offer.offerExpiresDay + 1 })).toMatchObject({ code: 'offer-expired' });

  const session = signedSale();
  submit(session, { domain: 'sales', command: { ...deliver, type: 'reserve', id: 'hold', day: 8, quantity: 70 } });
  const held = session.snapshot();
  expect(readSalesStatus(held, offer.deliveryDueDay + 1).offers[0].status).toBe('late');
  submit(session, { domain: 'sales', command: { ...accept, id: 'cancel', type: 'cancel', day: 9 } });
  const cancelled = session.snapshot();
  expect(readSalesStatus(cancelled, 9).offers[0].status).toBe('cancelled');
  expect(readInventory(cancelled.inventory, scope).available).toBe(100n);
  expect(cancelled.ledger).toBe(held.ledger);
});

it('commits one closing delivery when two requests compete against the same revision', async () => {
  const session = signedSale();
  submit(session, { domain: 'sales', command: deliver });
  const closing = { ...deliver, day: deliver.day + 1, id: 'close', quantity: 20 };
  const revision = session.snapshot().revision;
  const receive = (id: string) => Promise.resolve().then(() =>
    session.submit({ domain: 'sales', command: { ...closing, id } }, revision));
  const [first, duplicate, competing] = await Promise.all([receive('close'), receive('close'), receive('other')]);
  expect(first).toMatchObject({ status: 'accepted', revision: revision + 1, invoiceId: 'invoice:close' });
  expect(duplicate).toBe(first);
  expect(competing).toMatchObject({ status: 'rejected', code: 'stale-revision' });
  expect(session.snapshot().invoices).toHaveLength(2);
  expect(sale(session, { ...closing, id: 'fresh-retry' })).toMatchObject({ code: 'contract-not-open' });
  expect(sale(session, { ...closing, quantity: 19 })).toMatchObject({ code: 'conflict' });
  expect(session.snapshot().revision).toBe(revision + 1);
});

it('discards the staged release of stock if the sales posting conflicts', () => {
  const session = signedSale(70, deliver.id);
  const before = session.snapshot();
  expect(sale(session, deliver)).toMatchObject({ code: 'journal-conflict' });
  expect(session.snapshot()).toBe(before);
  expect(session.snapshot().invoices).toEqual([]);
  expect(readInventory(session.snapshot().inventory, scope)).toMatchObject({ quantity: 100n, reserved: 0n });
  expect(session.snapshot().ledger.entries.some(({ id }) => id === 'inventory:sales-deliver:deliver')).toBe(false);
});
