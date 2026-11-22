/** Verifies overdue notices and payment attribution across period close. */
import { expect, it } from 'vitest';
import { balanceSheet, incomeStatement } from '../../packages/finance/src';
import { readSalesStatus } from '../../packages/operations/src';
import { addShift, deliver, sale, signedSale, submit } from './sales-fixture';

function invoicedSale() {
  const session = signedSale();
  addShift(session, 'additional', deliver.day);
  const result = submit(session, { domain: 'sales', command: { ...deliver, quantity: 70 } });
  if (!result.invoiceId) throw new Error('Expected invoice ID');
  return { session, invoiceId: result.invoiceId };
}

it('reports overdue with its invoice, customer and due day and collects once without new revenue', () => {
  const { session, invoiceId } = invoicedSale();
  const before = session.snapshot();
  expect(readSalesStatus(before, 38).alerts).toEqual([]);
  expect(readSalesStatus(before, 39).alerts).toEqual([{
    code: 'invoice-overdue', invoiceId, customerId: 'aswaq-al-sunbul', dueDay: 38,
  }]);
  expect(session.snapshot()).toBe(before);
  expect(sale(session, { id: 'too-soon', type: 'collect', invoiceId, mode: 'due', day: 31 }))
    .toMatchObject({ code: 'invoice-not-due' });

  const payment = { id: 'payment', type: 'collect', invoiceId, mode: 'due', day: 39 } as const;
  const receipt = submit(session, { domain: 'sales', command: payment });
  const after = session.snapshot();
  expect(sale(session, payment)).toBe(receipt);
  expect(sale(session, { ...payment, id: 'repeat-payment' })).toMatchObject({ code: 'invoice-paid' });
  expect(readSalesStatus(after, 39).alerts).toEqual([]);
  expect(after.invoices[0].payment).toMatchObject({ cashMinor: '525000', discountMinor: '0', day: 39 });
  expect(incomeStatement(after.ledger, { fromDay: 31, throughDay: 39 }).revenue).toBe('0');
  expect(balanceSheet(after.ledger, 39).accounts).toEqual(expect.arrayContaining([
    { account: 'receivables', group: 'assets', amount: '0' },
  ]));
});

it('books the 2% early discount only in the collection period', () => {
  const { session, invoiceId } = invoicedSale();
  const before = session.snapshot();
  submit(session, { domain: 'sales', command: {
    id: 'early-payment', type: 'collect', invoiceId, mode: 'early', day: 31,
  } });
  const after = session.snapshot();

  expect(after.invoices[0].payment).toEqual({
    cashMinor: '514500', discountMinor: '10500', day: 31, journalEntryId: 'collection:early-payment',
  });
  expect(balanceSheet(after.ledger, 30)).toEqual(balanceSheet(before.ledger, 30));
  expect(incomeStatement(after.ledger, { fromDay: 31, throughDay: 31 }).revenue).toBe('-10500');
  expect(balanceSheet(after.ledger, 31).cash).toBe('3114500');
});
