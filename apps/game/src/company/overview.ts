/** Renders the ledger summary, accessible forecast, and company operating data. */
import { action, detailRows, el } from '../../../../packages/ui/src';
import type { CompanyRead } from './host';
import { dataTable, type Labels } from './view-tools';

export type ForecastMode = 'baseline' | 'pessimistic' | 'optimistic';

export function overview(model: CompanyRead, labels: Labels, options: {
  mode: ForecastMode;
  select(mode: ForecastMode): void;
  traceCash(): void;
  openInvoices(): void;
  openEntry(id: string): void;
}) {
  const { c, money, day } = labels;
  const receivables = model.balance.accounts.find(({ account }) => account === 'receivables')?.amount ?? '0';
  const figures = el('div', 'metrics company-metrics',
    el('section', 'panel metric metric-primary', el('h2', '', c.cash), money(model.balance.cash),
      action(c.cashSource, options.traceCash, 'trace')),
    el('section', 'panel metric', el('h2', '', c.receivables), money(receivables),
      action(c.openInvoices, options.openInvoices, 'trace')),
    el('section', 'panel metric', el('h2', '', c.profit), money(model.income.netIncome),
      el('span', 'metric-note', c.confirmed)),
  );

  const forecast = model.liquidity[options.mode];
  const controls = el('div', 'company-controls');
  for (const mode of ['baseline', 'pessimistic', 'optimistic'] as const) {
    const button = action(c[mode], () => options.select(mode), 'secondary');
    button.setAttribute('aria-pressed', String(mode === options.mode));
    button.dataset.mode = mode;
    controls.append(button);
  }
  const graph = el('div', 'liquidity-plot');
  graph.setAttribute('aria-hidden', 'true');
  const peak = forecast.days.reduce((maximum, entry) => {
    const amount = BigInt(entry.cashMinor);
    const magnitude = amount < 0n ? -amount : amount;
    return magnitude > maximum ? magnitude : maximum;
  }, 1n);
  if (forecast.days.some(({ cashMinor }) => BigInt(cashMinor) < 0n)) graph.classList.add('has-negative');
  for (const value of forecast.days) {
    const cash = BigInt(value.cashMinor);
    const bar = el('span', cash < 0n ? 'below-zero' : '');
    const magnitude = cash < 0n ? -cash : cash;
    bar.style.setProperty('--level', `${Number(magnitude * 100n / peak)}%`);
    graph.append(bar);
  }
  const dates = el('div', 'plot-dates', day(forecast.days[0].day), day(forecast.days.at(-1)!.day));
  dates.setAttribute('aria-hidden', 'true');
  const values = el('details', 'figure-detail',
    el('summary', '', c.forecastData),
    dataTable(c.forecastData, [c.day, c.amount], forecast.days.map((value) =>
      [day(value.day), money(value.cashMinor)])),
  );
  const notices = model.liquidity.alerts.map((alert) => {
    const label = alert.code === 'invoice-overdue' ? c.overdueWarning :
      alert.code === 'payroll-before-collection' ? c.payrollWarning : c.projectedWarning;
    return el('div', 'notice', el('strong', '', label), el('p', '', day(alert.dueDay), ' · ', money(alert.amountMinor)));
  });
  const movement = forecast.movements.slice(0, 5).map((entry) => {
    const item = el('li', '',
      el('div', '', el('strong', '', c[entry.source]), day(entry.projectedDay)),
      money(entry.direction === 'out' ? `-${entry.amountMinor}` : entry.amountMinor),
    );
    const id = entry.journalEntryId;
    if (id) item.firstElementChild?.append(action(c.viewEntry, () => options.openEntry(id), 'trace'));
    return item;
  });
  return el('div', 'view-stack', figures, el('div', 'view-layout finance-layout',
    el('section', 'panel',
      el('div', 'panel-heading', el('h2', '', c.analysis), el('span', 'badge', c.predicted)),
      controls, graph, dates, values,
    ),
    el('section', 'panel',
      el('h2', '', c.nextDates),
      movement.length ? el('ol', 'event-list company-events', ...movement) : el('p', 'muted', c.noDates),
      ...notices,
    ),
  ));
}

export function company(model: CompanyRead, { c, money, qty }: Labels) {
  const photo = el('img', 'company-photo');
  photo.src = `${import.meta.env.BASE_URL}images/produce-terminal.webp`;
  photo.alt = c.imageAlt;
  const preview = el('a', 'button secondary preview-link', c.companySetup);
  preview.href = '?preview=1';

  return el('div', 'view-layout company-business',
    el('section', 'panel company-location', photo, el('h2', '', c.company), el('p', 'muted', c.city, ' · ', c.sector), preview),
    el('div', 'view-stack',
      el('section', 'panel', el('h2', '', c.stock), el('p', 'muted', c.warehouse),
        detailRows([
          [c.onHand, qty(model.inventory.quantity)], [c.reserved, qty(model.inventory.reserved)],
          [c.availableStock, qty(model.inventory.available)],
          [c.bookValue, money(model.inventory.valueMinor)],
        ]),
      ),
      el('section', 'panel', el('h2', '', c.dispatch), detailRows([
        [c.labor, qty(model.capacity.limits.labor)], [c.equipment, qty(model.capacity.limits.equipment)],
        [c.shipping, qty(model.capacity.limits.shipping)], [c.materials, qty(model.capacity.limits.materials)],
      ])),
    ),
  );
}
