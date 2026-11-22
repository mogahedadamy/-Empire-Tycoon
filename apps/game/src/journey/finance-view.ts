/** Displays Month 1 close, Month 2, and cumulative financial statements with journal drill-down. */
import { action, detailRows, el } from '../../../../packages/ui/src';
import { accountName } from '../company/text';
import { dataTable, reference } from '../company/view-tools';
import type { JourneyLabels } from './text';
import type { JourneyReadModel } from './types';

export type StatementTab = 'income' | 'balance' | 'flow';
export type ReportPeriod = 'cumulative' | 'month-1' | 'month-2';

export interface FinanceViewOptions {
  statement: StatementTab;
  period: ReportPeriod;
  account: string | null;
  selectStatement(id: StatementTab): void;
  selectPeriod(id: ReportPeriod): void;
  selectAccount(id: string | null): void;
  openEntry(id: string): void;
}

export function journeyFinanceView(model: JourneyReadModel, labels: JourneyLabels, options: FinanceViewOptions) {
  const { c, locale, money, day } = labels;
  const statementControls = el('div', 'company-controls');
  for (const id of ['income', 'balance', 'flow'] as const) {
    const button = action(c[id], () => options.selectStatement(id), 'secondary');
    button.setAttribute('aria-pressed', String(options.statement === id));
    button.dataset.statement = id;
    statementControls.append(button);
  }

  const periodControls = model.monthOneIncome ? el('div', 'company-controls') : null;
  if (periodControls) {
    const periods: [ReportPeriod, string][] = [['month-1', c.periodMonth1], ['cumulative', c.periodCumulative]];
    if (model.monthTwoIncome) periods.push(['month-2', c.periodMonth2]);
    for (const [id, label] of periods) {
      const button = action(label, () => options.selectPeriod(id), 'secondary');
      button.setAttribute('aria-pressed', String(options.period === id));
      button.dataset.period = id;
      periodControls.append(button);
    }
  }

  const activePeriod = options.period === 'month-1' && model.monthOneIncome
    ? 'month-1'
    : options.period === 'month-2' && model.monthTwoIncome ? 'month-2' : 'cumulative';
  const income = activePeriod === 'month-1' ? model.monthOneIncome!
    : activePeriod === 'month-2' ? model.monthTwoIncome! : model.income;
  const balance = activePeriod === 'month-1' && model.monthOneBalance ? model.monthOneBalance : model.balance;
  const cashFlow = (activePeriod === 'month-1' ? model.monthOneCashFlow
    : activePeriod === 'month-2' ? model.monthTwoCashFlow : model.cashFlow) ?? model.cashFlow;

  const incomeRows = [[c.netIncome, money(income.netIncome)]] as const;
  const balanceRows = [
    [c.cash, money(balance.cash)], [c.assets, money(balance.assets)],
    [c.liabilities, money(balance.liabilities)], [c.equity, money(balance.equity)],
  ] as const;
  const flowRows = [
    [c.openingCash, money(cashFlow.openingCash)],
    [c.operating, money(cashFlow.operating.net)], [c.investing, money(cashFlow.investing.net)],
    [c.financing, money(cashFlow.financing.net)], [c.closingCash, money(cashFlow.closingCash)],
  ] as const;

  const statement = options.statement;
  const reportRows = statement === 'income' ? incomeRows : statement === 'balance' ? balanceRows : flowRows;
  const accounts = statement === 'flow' ? [] :
    (statement === 'income' ? income.accounts : balance.accounts).filter(({ amount }) => amount !== '0');
  const accountRows = accounts.map((line) => [
    action(accountName(line.account, locale), () => options.selectAccount(line.account), 'trace'), money(line.amount),
  ]);

  const entries = options.account === 'cash'
    ? model.cashEntries
    : model.journal.filter(({ lines }) => options.account === null || lines.some(({ account }) => account === options.account));
  const periodEntries = entries.filter((entry) => entry.day >= cashFlow.period.fromDay && entry.day <= cashFlow.period.throughDay);
  const filtered = options.account === null ? c.allEntries :
    options.account === 'cash' ? c.cashEntries : accountName(options.account, locale);
  const entryRows = periodEntries.map((entry) => {
    const control = action(entry.id, () => options.openEntry(entry.id), 'trace');
    control.dir = 'ltr';
    control.dataset.entry = entry.id;
    return [control, day(entry.day), reference(entry.sourceId)];
  });

  const ledgerTitle = el('h2', '', c.ledger);
  ledgerTitle.id = 'journal-title';

  return el('div', 'view-stack',
    el('section', 'panel',
      el('div', 'panel-heading', el('h2', '', c[statement]), el('span', 'badge', c.confirmed)),
      statementControls,
      periodControls,
      detailRows(reportRows),
      accounts.length ? dataTable(c[statement], [c.account, c.amount], accountRows) : null,
    ),
    el('section', 'panel journal-panel',
      ledgerTitle,
      el('div', 'company-controls', el('strong', '', filtered),
        options.account === null ? null : action(c.allEntries, () => options.selectAccount(null), 'secondary')),
      entryRows.length ? dataTable(c.ledger, [c.entry, c.day, c.source], entryRows) : el('p', 'muted', c.noEntries),
    ),
  );
}
