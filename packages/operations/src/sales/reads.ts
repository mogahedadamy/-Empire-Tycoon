/** Projects offer and invoice status at the current or a future virtual day. */
import { reservedStock } from './fulfillment';
import type { Invoice, SalesOffer, SalesSnapshot } from './types';
import { integer } from './validation';

function contractStatus(snapshot: SalesSnapshot, offer: SalesOffer, day: number) {
  if (offer.cancelledDay !== null) return 'cancelled';
  if (offer.acceptedDay === null) return day > offer.offerExpiresDay ? 'expired' : 'offered';
  if (offer.deliveredQuantity === offer.quantity) return 'delivered';
  if (day > offer.deliveryDueDay) return 'late';
  if (offer.deliveredQuantity > 0) return 'partially-delivered';
  return reservedStock(snapshot, offer, day) > 0n ? 'in-progress' : 'signed';
}

function invoiceStatus(invoice: Invoice, day: number) {
  if (invoice.payment) return 'paid';
  return day > invoice.dueDay ? 'overdue' : 'open';
}

/** Returns statuses and actionable overdue-invoice alerts without writing stock or money. */
export function readSalesStatus(snapshot: SalesSnapshot, day: number) {
  integer(day, Math.max(snapshot.day, 1));
  const offers = Object.freeze(snapshot.offers.map((offer) =>
    Object.freeze({ ...offer, status: contractStatus(snapshot, offer, day) })));
  const invoices = Object.freeze(snapshot.invoices.map((invoice) =>
    Object.freeze({ ...invoice, status: invoiceStatus(invoice, day) })));
  const alerts = invoices.filter(({ status }) => status === 'overdue').map((invoice) => Object.freeze({
    code: 'invoice-overdue' as const, invoiceId: invoice.id, customerId: invoice.customerId, dueDay: invoice.dueDay,
  }));
  return Object.freeze({ offers, invoices, alerts: Object.freeze(alerts) });
}
