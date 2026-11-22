/** Checks the reads, source links, and revision conflict through the actual company port. */
import { expect, it } from 'vitest';
import { loadScenario } from '../../packages/content/src';
import { createCompanyHost } from '../../apps/game/src/company/host';

it('reconciles cash from ledger lines and exposes the posted invoice sources', () => {
  const host = createCompanyHost(loadScenario('big-order'));
  const model = host.read();
  const total = model.cashEntries.flatMap(({ lines }) => lines).filter(({ account }) => account === 'cash')
    .reduce((sum, { amount, side }) => sum + BigInt(amount) * (side === 'debit' ? 1n : -1n), 0n);

  expect(model.balance.cash).toBe('2800000');
  expect(model.balance.cash).toBe(total.toString());
  expect(model.liquidity.confirmed.cashMinor).toBe(model.balance.cash);
  expect(model.invoices[0]).toMatchObject({ amountMinor: '300000', salesEntryId: 'sales:first-delivery' });
  const invoice = model.invoices[0];
  expect(model.journal.find(({ id }) => id === invoice.salesEntryId)?.sourceId).toBe(invoice.id);
  expect(model.journal.find(({ id }) => id === invoice.stockEntryId)?.lines)
    .toContainEqual({ account: 'costOfSales', side: 'debit', amount: '160000' });
});

it('rejects a stale preview, shows changed capacity, and acknowledges only renewed confirmation', () => {
  const host = createCompanyHost(loadScenario('big-order'));
  const original = host.read();
  const preview = host.preview(10);
  expect(preview).toMatchObject({ day: 18, max: 10, amountMinor: '75000', valid: true });
  expect(host.read().revision).toBe(original.revision);
  host.advance();

  const result = host.confirm(preview);
  expect(result.status).toBe('review');
  if (result.status !== 'review') throw new Error('Expected re-preview');
  expect(result.previous.max).toBe(10);
  expect(result.current).toMatchObject({ day: 19, max: 30, quantity: 10, amountMinor: '75000' });
  expect(host.read().invoices).toHaveLength(1);

  const receipt = host.confirm(result.current);
  expect(receipt).toMatchObject({ status: 'accepted' });
  expect(host.confirm(result.current)).toBe(receipt);
  expect(host.read().invoices).toHaveLength(2);
  expect(host.read().offer.deliveredQuantity).toBe(50);
});
