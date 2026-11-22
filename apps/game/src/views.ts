/** Renders the setup, finance and contract views from the same scenario projection. */
import type { Scenario } from '../../../packages/content/src';
import {
  action, createFormatters, detailRows, el, figure, notice, type Locale,
} from '../../../packages/ui/src';
import type { PreviewCopy } from './copy';
import type { FundingPlan, PreviewModel } from './preview-model';

export type View = 'setup' | 'finance' | 'contract';
export type Confirmation = 'idle' | 'pending' | 'confirmed';

export interface ViewContext {
  copy: PreviewCopy;
  locale: Locale;
  scenario: Scenario;
  model: PreviewModel;
  plan: FundingPlan;
  confirmation: Confirmation;
  receipt: string;
  navigate(view: View): void;
  select(plan: FundingPlan): void;
  confirm(): void;
}

function helpers({ locale, copy }: ViewContext) {
  const format = createFormatters(locale);
  return {
    money: (value: bigint) => figure(format.money(value), copy.unit),
    day: (value: number) => el('span', 'display-day', copy.day, ' ', el('bdi', '', format.number(value))),
    count: (value: number, unit: string) => figure(format.number(value), unit),
  };
}

export function setupView(context: ViewContext) {
  const { copy: c, model, plan } = context;
  const { money } = helpers(context);
  const plans = el('fieldset', 'plans', el('legend', '', c.fundingTitle));
  for (const [value, label, hint] of [
    ['loan', c.withLoan, c.loanHint],
    ['capital', c.capitalOnly, c.capitalHint],
  ] as const) {
    const input = el('input', '');
    input.type = 'radio';
    input.name = 'funding';
    input.value = value;
    input.checked = plan === value;
    input.addEventListener('change', () => context.select(value));
    plans.append(el('label', 'plan', input, el('span', '', el('strong', '', label), el('small', '', hint))));
  }

  const image = el('img', 'scene-image');
  image.src = `${import.meta.env.BASE_URL}images/produce-terminal.webp`;
  image.alt = c.imageAlt;
  image.width = 1120;
  image.height = 747;

  return el('div', 'view-layout',
    el('figure', 'scene',
      image,
      el('figcaption', 'scene-caption', el('span', '', c.sector), el('strong', '', c.company), el('span', '', c.city)),
    ),
    el('section', 'panel funding-panel',
      plans,
      el('p', 'muted funding-hint', c.fundingHint),
      detailRows([[c.capital, money(model.capital)], [c.loan, money(model.loan)], [c.setupCost, money(model.setup)]]),
      el('div', 'funding-total', el('span', '', c.initialCash), money(model.startingCash)),
      action(c.continue, () => context.navigate('finance')),
    ),
  );
}

function forecast(context: ViewContext) {
  const { copy: c, model } = context;
  const { day, money } = helpers(context);
  const table = el('table', 'forecast-table');
  table.append(el('caption', 'sr-only', c.projection));
  const head = el('thead', '', el('tr', '', el('th', '', c.day), el('th', '', c.projection)));
  const body = el('tbody', '');
  const plot = el('div', 'bar-chart');
  plot.setAttribute('aria-hidden', 'true');
  const peak = model.timeline.reduce((max, item) => {
    const magnitude = item.cash < 0n ? -item.cash : item.cash;
    return magnitude > max ? magnitude : max;
  }, 1n);

  for (const [index, item] of model.timeline.entries()) {
    body.append(el('tr', '', el('th', '', day(item.day)), el('td', '', money(item.cash))));
    const bar = el('div', `bar ${item.cash < 0n ? 'negative' : ''} ${index === 2 ? 'accent' : ''}`);
    const magnitude = item.cash < 0n ? -item.cash : item.cash;
    bar.style.setProperty('--height', `${Math.max(2, Number(magnitude * 100n / peak))}%`);
    plot.append(el('div', 'bar-column', money(item.cash), el('div', 'bar-track', bar), day(item.day)));
  }
  table.append(head, body);
  const explanation = el('details', 'figure-detail', el('summary', '', c.projection), table);

  return el('section', 'panel forecast',
    el('div', 'panel-heading', el('h2', '', c.projection), el('span', 'badge', c.forecast)),
    plot, explanation,
  );
}

export function financeView(context: ViewContext) {
  const { copy: c, model, scenario } = context;
  const { money, day } = helpers(context);
  const metrics = el('div', 'metrics', ...([
    [c.cash, model.closingCash, c.cashDetail],
    [c.profit, model.netIncome, c.profitDetail],
    [c.receivables, model.revenue, c.receivablesDetail],
  ] as const).map(([label, amount, description], index) =>
    el('section', `panel metric ${index === 0 ? 'metric-primary' : ''}`,
      el('h2', '', label), money(amount),
      el('details', 'figure-detail', el('summary', '', c.explanation), el('p', '', description)),
    ),
  ));

  const milestones = [
    { label: c.supply, day: scenario.supply.arrivalDay, amount: -model.stockPurchase },
    { label: c.wages, day: scenario.payroll.dueDay, amount: -model.wage },
    { label: c.payment, day: scenario.contract.paymentDueDay, amount: model.revenue },
  ].sort((a, b) => a.day - b.day);

  return el('div', 'view-stack', metrics,
    el('p', 'muted close-period', c.projectedClose, ' · ', day(scenario.calendar.firstCloseDay)),
    el('div', 'view-layout finance-layout', forecast(context),
      el('section', 'panel milestones', el('h2', '', c.milestones),
        el('ol', 'event-list', ...milestones.map((item) =>
          el('li', '', el('div', '', el('strong', '', item.label), day(item.day)), money(item.amount)),
        )),
        el('p', 'muted', context.confirmation === 'confirmed' ? c.confirmed : c.noReceipt),
        action(c.review, () => context.navigate('contract')),
      ),
    ),
  );
}

export function contractView(context: ViewContext) {
  const { copy: c, scenario, model } = context;
  const { day, money, count } = helpers(context);
  const { contract, payroll } = scenario;
  const status = el('div', 'contract-status');
  if (context.confirmation === 'confirmed') {
    status.append(notice(c.confirmed, c.confirmedBody, 'success'), el('code', '', context.receipt));
  } else if (context.confirmation === 'pending') {
    status.textContent = c.pending;
  }

  const confirm = action(c.confirm, context.confirm);
  confirm.disabled = context.confirmation === 'pending' || context.confirmation === 'confirmed';
  confirm.dataset.confirm = '';

  return el('div', 'view-layout contract-layout',
    el('section', 'panel',
      el('h2', '', c.terms), el('p', 'muted', c.client),
      detailRows([
        [c.order, count(contract.quantity, c.boxes)], [c.unitPrice, money(BigInt(contract.unitPriceMinor))],
        [c.offer, day(contract.offerExpiresDay)],
        [c.delivery, el('span', 'dates', day(contract.deliveryStartsDay), '–', day(contract.deliveryDueDay))],
        [c.wages, day(payroll.dueDay)], [c.payment, day(contract.paymentDueDay)],
      ]),
    ),
    el('section', 'panel contract-impact',
      el('h2', '', c.impact),
      detailRows([
        [c.revenue, money(model.revenue)], [c.inventoryCost, money(model.stockPurchase)],
        [c.cashBefore, money(model.startingCash)], [c.cashAfter, money(model.afterCollection)],
        [c.handling, count(model.deliveryDays, c.days)],
      ]),
      notice(c.warning, c.warningBody),
      status,
      el('div', 'actions', confirm, action(c.alternatives, () => context.navigate('setup'), 'secondary')),
    ),
  );
}
