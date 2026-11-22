/** Renders company stock, capacity, supplier ordering, payroll, and treasury obligations. */
import type { Scenario } from '../../../../packages/content/src';
import { action, detailRows, el } from '../../../../packages/ui/src';
import { dataTable } from '../company/view-tools';
import type { JourneyLabels } from './text';
import type { JourneyReadModel } from './types';

export interface CompanyViewOptions {
  scenario: Scenario;
  busy: boolean;
  canWrite: boolean;
  orderSupply(): void;
  payObligation(obligationId: string): void;
  openEntry(id: string): void;
}

export function companyView(model: JourneyReadModel, labels: JourneyLabels, options: CompanyViewOptions) {
  const { c, money, qty, day } = labels;
  const { scenario, busy, canWrite } = options;
  const photo = el('img', 'company-photo');
  photo.src = `${import.meta.env.BASE_URL}images/produce-terminal.webp`;
  photo.alt = c.imageAlt;
  const preview = el('a', 'button secondary preview-link', c.companySetup);
  preview.href = '?preview=1';

  const supplyTotal = (BigInt(scenario.supply.quantity) * BigInt(scenario.supply.unitCostMinor)).toString();
  const orderButton = action(c.supplyAction, options.orderSupply);
  orderButton.dataset.orderSupply = '';
  orderButton.disabled = busy || !canWrite || model.supplyOrdered || !model.distress.canOperate;
  const openingOrder = model.orders.find(({ orderId }) => orderId === 'opening-stock');

  const supplyPanel = el('section', 'panel',
    el('h2', '', c.supplyTitle),
    el('p', 'muted', labels.party(scenario.supplier.id)),
    detailRows([
      [c.orderQty, qty(scenario.supply.quantity)],
      [c.orderUnitCost, money(scenario.supply.unitCostMinor)],
      [c.orderTotal, money(supplyTotal)],
      [c.orderArrival, day(scenario.supply.arrivalDay)],
    ]),
    !model.supplyOrdered
      ? el('div', 'actions panel-actions', orderButton)
      : el('p', 'muted', openingOrder?.receivedDay !== null && openingOrder ? c.supplyReceived : c.supplyOrdered),
  );

  const obligationRows = model.obligations.map((ob) => {
    const status = el('span', `badge ${ob.status === 'overdue' ? 'badge-danger' : ''}`, c[ob.status]);
    const controls = el('div', 'actions');
    controls.append(action(c.viewEntry, () => options.openEntry(ob.accrualEntryId), 'trace'));
    if (ob.payment) {
      const payId = ob.payment.journalEntryId;
      controls.append(action(c.paymentEntry, () => options.openEntry(payId), 'trace'));
    } else if (model.day >= ob.dueDay && model.distress.canOperate) {
      const pay = action(c.payObligationAction, () => options.payObligation(ob.id), 'secondary');
      pay.dataset.payObligation = ob.id;
      pay.disabled = busy || !canWrite;
      controls.append(pay);
    }
    return [c[ob.kind], day(ob.dueDay), money(ob.amountMinor), status, controls];
  });

  const obligationsPanel = el('section', 'panel',
    el('h2', '', c.obligationsTitle),
    detailRows([
      [c.payrollStatusLabel, el('span', 'badge', c[model.payroll.status])],
      [c.payroll, el('span', 'dates', day(model.payroll.dueDay), ' · ', money(model.payroll.amountMinor))],
    ]),
    obligationRows.length
      ? dataTable(c.obligationsTitle, [c.account, c.payDue, c.amount, c.side, c.source], obligationRows)
      : el('p', 'muted', c.noDates),
  );

  return el('div', 'view-stack',
    el('div', 'view-layout company-business',
      el('section', 'panel company-location', photo, el('h2', '', c.company), el('p', 'muted', c.city, ' · ', c.sector), preview),
      el('div', 'view-stack',
        supplyPanel,
        el('section', 'panel', el('h2', '', c.stock), el('p', 'muted', c.warehouse),
          detailRows([
            [c.onHand, qty(model.inventory.quantity)],
            [c.reserved, qty(model.inventory.reserved)],
            [c.availableStock, qty(model.inventory.available)],
            [c.bookValue, money(model.inventory.valueMinor)],
          ]),
        ),
        el('section', 'panel', el('h2', '', c.dispatch), detailRows([
          [c.labor, qty(model.capacity.limits.labor)],
          [c.equipment, qty(model.capacity.limits.equipment)],
          [c.shipping, qty(model.capacity.limits.shipping)],
          [c.materials, qty(model.capacity.limits.materials)],
        ])),
      ),
    ),
    obligationsPanel,
  );
}
