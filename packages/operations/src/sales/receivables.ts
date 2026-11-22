/** Posts a receivable per delivery and records collections in their actual reporting period. */
import { applyBasisPoints, type JournalLine, type Ledger } from '../../../finance/src';
import { SalesError, type Invoice, type SalesCommand, type SalesOffer } from './types';

type Delivery = Extract<SalesCommand, { type: 'deliver' }>;
type Collection = Extract<SalesCommand, { type: 'collect' }>;

function post(ledger: Ledger, id: string, sourceId: string, day: number, lines: readonly JournalLine[]) {
  if (ledger.entries.some((entry) => entry.id === id)) throw new SalesError('journal-conflict');
  return ledger.post([{ id, sourceId, day, lines }]);
}

export function invoiceDelivery(
  ledger: Ledger, offer: SalesOffer, command: Delivery, stockEntryId: string,
) {
  const id = `invoice:${command.id}`;
  const salesEntryId = `sales:${command.id}`;
  const amountMinor = (BigInt(offer.unitPriceMinor) * BigInt(command.quantity)).toString();
  const nextLedger = post(ledger, salesEntryId, id, command.day, [
    { account: 'receivables', side: 'debit', amount: amountMinor },
    { account: 'sales', side: 'credit', amount: amountMinor },
  ]);
  const invoice: Invoice = Object.freeze({
    id, contractId: offer.offerId, customerId: offer.customerId, issueDay: command.day,
    dueDay: offer.paymentDueDay, quantity: command.quantity, amountMinor, salesEntryId, stockEntryId, payment: null,
  });
  return { ledger: nextLedger, invoice };
}

export function collectInvoice(ledger: Ledger, offer: SalesOffer, invoice: Invoice, command: Collection) {
  if (invoice.payment) throw new SalesError('invoice-paid');
  if (command.mode === 'due' && command.day < invoice.dueDay) throw new SalesError('invoice-not-due');
  if (command.mode === 'early' && (command.day >= invoice.dueDay || offer.earlyPaymentDiscountBps === 0)) {
    throw new SalesError('early-payment-unavailable');
  }

  const face = BigInt(invoice.amountMinor);
  const discount = command.mode === 'early' ? applyBasisPoints(face, offer.earlyPaymentDiscountBps) : 0n;
  const cash = face - discount;
  const lines: JournalLine[] = [{ account: 'receivables', side: 'credit', amount: invoice.amountMinor }];
  if (cash > 0n) lines.push({ account: 'cash', side: 'debit', amount: cash.toString(), cashFlow: 'operating' });
  if (discount > 0n) lines.push({ account: 'salesDiscounts', side: 'debit', amount: discount.toString() });

  const journalEntryId = `collection:${command.id}`;
  const nextLedger = post(ledger, journalEntryId, invoice.id, command.day, lines);
  const paid = Object.freeze({
    ...invoice,
    payment: Object.freeze({
      day: command.day, cashMinor: cash.toString(), discountMinor: discount.toString(), journalEntryId,
    }),
  });
  return { ledger: nextLedger, invoice: paid };
}
