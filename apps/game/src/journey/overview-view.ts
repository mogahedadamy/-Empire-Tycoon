/** Renders the executive KPI cards, 30-day liquidity forecast, and crisis/report sections. */
import { action, el } from '../../../../packages/ui/src';
import { dataTable } from '../company/view-tools';
import {
  buildAlerts, buildDiagnosisPanel, buildPostClosePanel, buildReportAndLog,
  type CrisisPanelActions,
} from './crisis-panels';
import type { JourneyLabels } from './text';
import type { JourneyReadModel } from './types';

export type ForecastMode = 'baseline' | 'pessimistic' | 'optimistic';

export interface OverviewOptions extends CrisisPanelActions {
  mode: ForecastMode;
  selectMode(mode: ForecastMode): void;
  traceCash(): void;
  openInvoices(): void;
  openEntry(id: string): void;
}

export function journeyOverview(model: JourneyReadModel, labels: JourneyLabels, options: OverviewOptions) {
  const { c, money, day } = labels;
  const receivables = model.balance.accounts.find(({ account }) => account === 'receivables')?.amount ?? '0';
  const displayedProfit = model.monthOneIncome ? model.monthOneIncome.netIncome : model.income.netIncome;
  const profitLabel = model.monthOneIncome ? c.periodMonth1 : c.confirmed;

  const figures = el('div', 'metrics company-metrics',
    el('section', 'panel metric metric-primary', el('h2', '', c.cash), money(model.balance.cash),
      action(c.cashSource, options.traceCash, 'trace')),
    el('section', 'panel metric', el('h2', '', c.receivables), money(receivables),
      action(c.openInvoices, options.openInvoices, 'trace')),
    el('section', 'panel metric', el('h2', '', c.profit), money(displayedProfit),
      el('span', 'metric-note', profitLabel)),
  );

  const forecast = model.liquidity[options.mode];
  const controls = el('div', 'company-controls');
  for (const mode of ['baseline', 'pessimistic', 'optimistic'] as const) {
    const button = action(c[mode], () => options.selectMode(mode), 'secondary');
    button.setAttribute('aria-pressed', String(mode === options.mode));
    button.dataset.mode = mode;
    controls.append(button);
  }
  const graph = el('div', 'liquidity-plot');
  graph.setAttribute('aria-hidden', 'true');
  const peak = forecast.days.reduce((max, entry) => {
    const magnitude = BigInt(entry.cashMinor) < 0n ? -BigInt(entry.cashMinor) : BigInt(entry.cashMinor);
    return magnitude > max ? magnitude : max;
  }, 1n);
  if (forecast.days.some(({ cashMinor }) => BigInt(cashMinor) < 0n)) graph.classList.add('has-negative');
  for (const value of forecast.days) {
    const cash = BigInt(value.cashMinor);
    const bar = el('span', cash < 0n ? 'below-zero' : '');
    bar.style.setProperty('--level', `${Number((cash < 0n ? -cash : cash) * 100n / peak)}%`);
    graph.append(bar);
  }
  const dates = el('div', 'plot-dates', day(forecast.days[0].day), day(forecast.days.at(-1)!.day));
  dates.setAttribute('aria-hidden', 'true');
  const table = el('details', 'figure-detail',
    el('summary', '', c.forecastData),
    dataTable(c.forecastData, [c.day, c.amount], forecast.days.map((v) => [day(v.day), money(v.cashMinor)])),
  );
  const alerts = model.liquidity.alerts.map((alert) => {
    const label = alert.code === 'invoice-overdue' ? c.overdueWarning :
      alert.code === 'payroll-before-collection' ? c.payrollWarning : c.projectedWarning;
    return el('div', 'notice', el('strong', '', label),
      el('p', '', labels.party(alert.partyId), ' · ', day(alert.dueDay), ' · ', money(alert.amountMinor)));
  });
  const movement = forecast.movements.slice(0, 6).map((entry) => {
    const item = el('li', '',
      el('div', '', el('strong', '', c[entry.source]), day(entry.projectedDay)),
      money(entry.direction === 'out' ? `-${entry.amountMinor}` : entry.amountMinor),
    );
    const id = entry.journalEntryId;
    if (id) item.firstElementChild?.append(action(c.viewEntry, () => options.openEntry(id), 'trace'));
    return item;
  });

  return el('div', 'view-stack',
    figures,
    buildAlerts(model, labels, options),
    buildPostClosePanel(model, labels, options),
    buildDiagnosisPanel(model, labels, options),
    el('div', 'view-layout finance-layout',
      el('section', 'panel',
        el('div', 'panel-heading', el('h2', '', c.analysis), el('span', 'badge', c.predicted)),
        controls, graph, dates, table,
      ),
      el('section', 'panel',
        el('h2', '', c.nextDates),
        movement.length ? el('ol', 'event-list company-events', ...movement) : el('p', 'muted', c.noDates),
        ...alerts,
      ),
    ),
    ...buildReportAndLog(model, labels, options),
  );
}
