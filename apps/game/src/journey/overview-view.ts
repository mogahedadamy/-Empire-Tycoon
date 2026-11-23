/** Renders decision-first overview: active trade-offs first, explicit period metrics, and forecast. */
import { action, el } from '../../../../packages/ui/src';
import { dataTable } from '../company/view-tools';
import {
  buildAlerts, buildDecisionLog, buildDiagnosisPanel, buildEvaluationReport, buildPostClosePanel,
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

function buildProfitCard(model: JourneyReadModel, labels: JourneyLabels) {
  const { c, money } = labels;
  if (!model.monthOneIncome) {
    return el('section', 'panel metric',
      el('h2', '', c.profitSinceFounding),
      money(model.income.netIncome),
      el('span', 'metric-note', c.confirmed),
    );
  }
  const monthTwoNet = model.monthTwoIncome?.netIncome ?? '0';
  const hasMonthTwoDelta = monthTwoNet !== '0';
  return el('section', 'panel metric metric-profit',
    el('h2', '', c.monthOneProfitTitle),
    money(model.monthOneIncome.netIncome),
    el('div', 'metric-subrows',
      el('span', 'metric-subrow', el('span', '', c.profitSinceFounding, ': '), money(model.income.netIncome)),
      hasMonthTwoDelta
        ? el('span', 'metric-subrow metric-delta', el('span', '', c.monthTwoDelta, ': '), money(monthTwoNet))
        : null,
    ),
  );
}

export function journeyOverview(model: JourneyReadModel, labels: JourneyLabels, options: OverviewOptions) {
  const { c, money, day } = labels;
  const receivables = model.balance.accounts.find(({ account }) => account === 'receivables')?.amount ?? '0';
  const openInvoice = model.invoices.find((inv) => !inv.payment);
  const report = buildEvaluationReport(model, labels, options);
  const alertsBlock = buildAlerts(model, labels, options);
  const postCloseBlock = buildPostClosePanel(model, labels, options);
  const diagnosisBlock = buildDiagnosisPanel(model, labels, options);
  const hasPriorityDecision = Boolean(postCloseBlock || diagnosisBlock || report);

  const figures = el('div', 'metrics company-metrics',
    el('section', 'panel metric metric-primary', el('h2', '', c.cashAvailableNow), money(model.balance.cash),
      action(c.cashSource, options.traceCash, 'trace')),
    el('section', 'panel metric',
      el('h2', '', c.receivables),
      money(receivables),
      openInvoice ? el('span', 'metric-subrow', c.receivablesDueHint, ' ', day(openInvoice.dueDay)) : null,
      action(c.openInvoices, options.openInvoices, 'trace'),
    ),
    buildProfitCard(model, labels),
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

  const analysisGrid = el('div', 'view-layout finance-layout',
    el('section', 'panel',
      el('div', 'panel-heading', el('h2', '', c.analysis), el('span', 'badge', c.predicted)),
      controls, graph, dates, table,
    ),
    el('section', 'panel',
      el('h2', '', c.nextDates),
      movement.length ? el('ol', 'event-list company-events', ...movement) : el('p', 'muted', c.noDates),
      ...alerts,
    ),
  );

  const forecastSection = hasPriorityDecision
    ? el('details', 'why-drawer', el('summary', 'panel why-summary', c.whyForecastToggle), analysisGrid)
    : analysisGrid;

  return el('div', 'view-stack',
    report,
    postCloseBlock,
    diagnosisBlock,
    alertsBlock,
    figures,
    forecastSection,
    buildDecisionLog(model, labels),
  );
}
