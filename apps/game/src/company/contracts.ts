/** Presents contract terms, source-linked invoices and a revision-aware delivery decision. */
import { action, detailRows, el, notice } from '../../../../packages/ui/src';
import type { CompanyRead, DeliveryPreview } from './host';
import { dataTable, reference, type Labels } from './view-tools';

export type DeliveryDecision =
  | { type: 'idle' | 'pending' | 'rejected' }
  | { type: 'preview'; preview: DeliveryPreview; previous?: DeliveryPreview }
  | { type: 'accepted'; invoiceId: string };

interface Options {
  quantity: string;
  decision: DeliveryDecision;
  changeQuantity(value: string): void;
  submitDecision(): void;
  openEntry(id: string): void;
}

function decisionView(model: CompanyRead, labels: Labels, options: Options) {
  const { c, money, day, qty } = labels;
  const { decision } = options;
  const complete = model.offer.deliveredQuantity === model.offer.quantity;
  const quantity = el('input', 'delivery-quantity');
  quantity.type = 'number';
  quantity.min = '1';
  quantity.step = '1';
  quantity.inputMode = 'numeric';
  quantity.value = options.quantity;
  quantity.disabled = complete || decision.type === 'pending';
  quantity.id = 'delivery-quantity';
  quantity.addEventListener('input', () => options.changeQuantity(quantity.value));
  const quantityLabel = el('label', '', c.numberOfBoxes);
  quantityLabel.htmlFor = quantity.id;

  let details = null;
  if (decision.type === 'preview') {
    const selected = decision.preview;
    const rows = [
      [c.day, day(selected.day)],
      [c.requested, Number.isSafeInteger(selected.quantity) ? qty(selected.quantity) : '–'],
      [c.maximum, qty(selected.max)],
      [c.invoiceAmount, money(selected.amountMinor)],
    ] as const;
    if (decision.previous) {
      const previous = decision.previous;
      const changes: [string, HTMLElement, HTMLElement][] = [];
      if (previous.day !== selected.day) changes.push([c.day, day(previous.day), day(selected.day)]);
      if (previous.max !== selected.max) changes.push([c.maximum, qty(previous.max), qty(selected.max)]);
      if (previous.remaining !== selected.remaining) changes.push([c.remaining, qty(previous.remaining), qty(selected.remaining)]);
      if (previous.priceMinor !== selected.priceMinor) changes.push([c.rate, money(previous.priceMinor), money(selected.priceMinor)]);
      details = el('div', 'review-change',
        notice(c.review, c.previewChanged),
        changes.length ? dataTable(c.review, [c.account, c.before, c.after], changes) : null,
        detailRows(rows),
      );
    } else {
      details = detailRows(rows);
    }
    if (!selected.valid) {
      quantity.setAttribute('aria-invalid', 'true');
      details.append(el('p', 'field-error', c.invalidQuantity));
    }
  } else if (decision.type === 'accepted') {
    details = el('div', 'notice success', el('strong', '', c.accepted), reference(decision.invoiceId));
  } else if (decision.type === 'pending') {
    details = el('p', 'muted', c.pending);
  } else if (decision.type === 'rejected') {
    details = notice(c.rejected, c.invalidQuantity, 'error');
  }

  const mayConfirm = decision.type === 'preview' && decision.preview.valid;
  const control = action(mayConfirm ? c.confirm : c.preview, options.submitDecision);
  control.dataset.deliveryAction = '';
  control.disabled = complete || decision.type === 'pending';
  const title = el('h2', '', c.preview);
  title.id = 'delivery-title';
  if (details) details.classList.add('delivery-details');

  return el('section', 'panel delivery-panel',
    title,
    complete ? el('p', 'muted', c.completed) : el('div', 'quantity-field', quantityLabel, quantity),
    details,
    complete ? null : el('div', 'decision-dock', control),
  );
}

export function contracts(model: CompanyRead, labels: Labels, options: Options) {
  const { offer, invoices } = model;
  const { c, money, day, qty } = labels;
  const terms = el('section', 'panel', el('h2', '', c.contractTerms), el('p', 'muted', c.client),
    detailRows([
      [c.rate, money(offer.unitPriceMinor)], [c.ordered, qty(offer.quantity)], [c.fulfilled, qty(offer.deliveredQuantity)],
      [c.remaining, qty(offer.quantity - offer.deliveredQuantity)],
      [c.deliveryWindow, el('span', 'dates', day(offer.deliveryStartsDay), '–', day(offer.deliveryDueDay))],
      [c.payDue, day(offer.paymentDueDay)],
    ]),
  );

  const entries = invoices.map((invoice) => {
    const links = [
      action(c.salesEntry, () => options.openEntry(invoice.salesEntryId), 'trace'),
      action(c.stockEntry, () => options.openEntry(invoice.stockEntryId), 'trace'),
    ];
    if (invoice.payment) {
      const id = invoice.payment.journalEntryId;
      links.push(action(c.paymentEntry, () => options.openEntry(id), 'trace'));
    }
    return el('article', 'invoice-row',
      el('div', 'invoice-heading', el('div', '', el('strong', '', c.client), reference(invoice.id)),
        el('span', 'badge', c[invoice.status])),
      detailRows([[c.amount, money(invoice.amountMinor)], [c.issued, day(invoice.issueDay)], [c.payDue, day(invoice.dueDay)]]),
      el('div', 'actions', ...links),
    );
  });
  const section = el('section', 'panel invoices', el('h2', '', c.invoices),
    entries.length ? el('div', 'invoice-grid', ...entries) : el('p', 'muted', c.noInvoice));
  section.id = 'invoices';
  return el('div', 'view-stack',
    el('div', 'view-layout contract-layout', terms, decisionView(model, labels, options)),
    section,
  );
}
