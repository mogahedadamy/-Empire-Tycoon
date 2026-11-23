/** Presents contract signing, revision-aware delivery previews, and source-linked invoices. */
import { action, detailRows, el, notice } from '../../../../packages/ui/src';
import { dataTable, reference } from '../company/view-tools';
import { gameIcon } from '../visuals/icons';
import type { JourneyLabels } from './text';
import type { JourneyDeliveryPreview, JourneyReadModel } from './types';

export type JourneyDeliveryState =
  | { type: 'idle' | 'pending' | 'rejected' }
  | { type: 'preview'; preview: JourneyDeliveryPreview; previous?: JourneyDeliveryPreview }
  | { type: 'accepted'; invoiceId: string };

export interface ContractsViewOptions {
  quantity: string;
  decision: JourneyDeliveryState;
  busy: boolean;
  canWrite: boolean;
  signContract(offerId: string): void;
  changeQuantity(value: string): void;
  submitDelivery(): void;
  collectDue(invoiceId: string): void;
  openEntry(id: string): void;
}

function decisionPanel(model: JourneyReadModel, labels: JourneyLabels, options: ContractsViewOptions) {
  const { c, money, day, qty } = labels;
  const offer = model.offer;
  if (!offer) return null;

  if (offer.status === 'offered') {
    const revenue = (BigInt(offer.unitPriceMinor) * BigInt(offer.quantity)).toString();
    const sign = action(c.signContractAction, () => options.signContract(offer.offerId));
    sign.dataset.signContract = '';
    sign.disabled = options.busy || !options.canWrite || !model.distress.canOperate;
    return el('section', 'panel delivery-panel',
      el('h2', '', c.signContractTitle),
      detailRows([
        [c.revenue, money(revenue)],
        [c.wages, day(model.payroll.dueDay)],
        [c.payDue, day(offer.paymentDueDay)],
      ]),
      notice(c.warning, c.warningBody),
      el('div', 'decision-dock', sign),
    );
  }

  if (offer.status === 'expired') {
    return el('section', 'panel delivery-panel', el('h2', '', c.contractTerms), notice(c.contractExpired, c.alert_offer_expired, 'error'));
  }

  const complete = offer.deliveredQuantity === offer.quantity;
  const { decision } = options;
  const quantity = el('input', 'delivery-quantity');
  quantity.type = 'number';
  quantity.min = '1';
  quantity.step = '1';
  quantity.inputMode = 'numeric';
  quantity.value = options.quantity;
  quantity.disabled = complete || decision.type === 'pending' || options.busy || !model.distress.canOperate;
  quantity.id = 'delivery-quantity';
  quantity.addEventListener('input', () => options.changeQuantity(quantity.value));
  const quantityLabel = el('label', '', c.numberOfBoxes);
  quantityLabel.htmlFor = quantity.id;

  let details: HTMLElement | null = null;
  if (decision.type === 'preview') {
    const selected = decision.preview;
    const rows = [
      [c.day, day(selected.day)],
      [c.requested, Number.isSafeInteger(selected.quantity) ? qty(selected.quantity) : '–'],
      [c.maximum, qty(selected.max)],
      [c.invoiceAmount, money(selected.amountMinor)],
    ] as const;
    if (decision.previous) {
      const prev = decision.previous;
      const changes: [string, HTMLElement, HTMLElement][] = [];
      if (prev.day !== selected.day) changes.push([c.day, day(prev.day), day(selected.day)]);
      if (prev.max !== selected.max) changes.push([c.maximum, qty(prev.max), qty(selected.max)]);
      if (prev.remaining !== selected.remaining) changes.push([c.remaining, qty(prev.remaining), qty(selected.remaining)]);
      if (prev.priceMinor !== selected.priceMinor) changes.push([c.rate, money(prev.priceMinor), money(selected.priceMinor)]);
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
  const control = action(mayConfirm ? c.confirm : c.preview, options.submitDelivery);
  control.dataset.deliveryAction = '';
  control.disabled = complete || decision.type === 'pending' || options.busy || !options.canWrite || !model.distress.canOperate;
  const title = el('h2', '', c.preview);
  title.id = 'delivery-title';
  if (details) details.classList.add('delivery-details');

  return el('section', 'panel delivery-panel',
    title,
    offer.status === 'late' ? notice(c.contractLate, c.alert_delivery_missed, 'error') : null,
    complete ? el('p', 'muted', c.completed) : el('div', 'quantity-field', quantityLabel, quantity),
    details,
    complete ? null : el('div', 'decision-dock', control),
  );
}

export function journeyContractsView(model: JourneyReadModel, labels: JourneyLabels, options: ContractsViewOptions) {
  const { c, money, day, qty, format } = labels;
  const offer = model.offer;
  const pct = offer ? Math.round((offer.deliveredQuantity / Math.max(1, offer.quantity)) * 100) : 0;
  const barFill = el('span', 'contract-bar-fill');
  barFill.setAttribute('style', `inline-size: ${pct}%`);
  const visualTrack = offer ? el('div', 'contract-visual-track',
    el('div', 'panel-heading',
      el('span', 'contract-stamp', gameIcon(offer.status === 'offered' ? 'contract' : 'truck'),
        offer.status === 'offered' ? c.signContractAction : `${format.number(offer.deliveredQuantity)} / ${format.number(offer.quantity)}`),
      el('span', 'badge', `${format.number(pct)}%`),
    ),
    el('div', 'contract-bar', barFill),
  ) : null;

  const terms = offer ? el('section', 'panel',
    el('h2', 'title-with-icon', gameIcon('contract'), c.contractTerms),
    el('p', 'muted', labels.party(offer.customerId)),
    visualTrack,
    detailRows([
      [c.rate, money(offer.unitPriceMinor)],
      [c.ordered, qty(offer.quantity)],
      [c.fulfilled, qty(offer.deliveredQuantity)],
      [c.remaining, qty(offer.quantity - offer.deliveredQuantity)],
      [c.deliveryWindow, el('span', 'dates', day(offer.deliveryStartsDay), '–', day(offer.deliveryDueDay))],
      [c.payDue, day(offer.paymentDueDay)],
    ]),
  ) : el('section', 'panel', el('p', 'muted', c.noInvoice));

  const entries = model.invoices.map((invoice) => {
    const links: HTMLElement[] = [
      action(c.salesEntry, () => options.openEntry(invoice.salesEntryId), 'trace'),
      action(c.stockEntry, () => options.openEntry(invoice.stockEntryId), 'trace'),
    ];
    if (invoice.payment) {
      const id = invoice.payment.journalEntryId;
      links.push(action(c.paymentEntry, () => options.openEntry(id), 'trace'));
    } else if (model.day >= invoice.dueDay + model.customerDelayDays && model.distress.canOperate) {
      const collect = action(c.collectDueAction, () => options.collectDue(invoice.id), 'secondary');
      collect.dataset.collectDue = invoice.id;
      collect.disabled = options.busy || !options.canWrite;
      links.push(collect);
    }
    return el('article', 'invoice-row',
      el('div', 'invoice-heading',
        el('div', '', el('strong', 'title-with-icon', gameIcon('invoice'), labels.party(invoice.customerId)), reference(invoice.id)),
        el('span', `badge ${invoice.status === 'overdue' ? 'badge-danger' : ''}`, c[invoice.status]),
      ),
      detailRows([[c.amount, money(invoice.amountMinor)], [c.issued, day(invoice.issueDay)], [c.payDue, day(invoice.dueDay)]]),
      el('div', 'actions', ...links),
    );
  });

  const section = el('section', 'panel invoices', el('h2', 'title-with-icon', gameIcon('invoice'), c.invoices),
    entries.length ? el('div', 'invoice-grid', ...entries) : el('p', 'muted', c.noInvoice));
  section.id = 'invoices';

  return el('div', 'view-stack',
    el('div', 'view-layout contract-layout', terms, decisionPanel(model, labels, options)),
    section,
  );
}
