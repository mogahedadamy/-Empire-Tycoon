/** Displays financial statements and drills down to the source journal lines. */
import { action, detailRows, el } from '../../../../packages/ui/src';
import type { CompanyRead } from './host';
import { accountName } from './text';
import { dataTable, reference, type Labels } from './view-tools';

export type Statement = 'income' | 'balance' | 'flow';

interface FinanceOptions {
  statement: Statement;
  account: string | null;
  selectStatement(id: Statement): void;
  selectAccount(id: string | null): void;
  openEntry(id: string): void;
}

export function financeView(model: CompanyRead, labels: Labels, options: FinanceOptions) {
  const { c, locale, money, day } = labels;
  const controls = el('div', 'company-controls');
  for (const id of ['income', 'balance', 'flow'] as const) {
    const button = action(c[id], () => options.selectStatement(id), 'secondary');
    button.setAttribute('aria-pressed', String(options.statement === id));
    button.dataset.statement = id;
    controls.append(button);
  }

  const incomeRows = [[c.netIncome, money(model.income.netIncome)]] as const;
  const balanceRows = [
    [c.cash, money(model.balance.cash)], [c.assets, money(model.balance.assets)],
    [c.liabilities, money(model.balance.liabilities)], [c.equity, money(model.balance.equity)],
  ] as const;
  const flowRows = [
    [c.operating, money(model.cashFlow.operating.net)], [c.investing, money(model.cashFlow.investing.net)],
    [c.financing, money(model.cashFlow.financing.net)], [c.cash, money(model.cashFlow.closingCash)],
  ] as const;

  const statement = options.statement;
  const reportRows = statement === 'income' ? incomeRows : statement === 'balance' ? balanceRows : flowRows;
  const accounts = statement === 'flow' ? [] :
    (statement === 'income' ? model.income.accounts : model.balance.accounts).filter(({ amount }) => amount !== '0');
  const accountRows = accounts.map((line) => [
    action(accountName(line.account, locale), () => options.selectAccount(line.account), 'trace'), money(line.amount),
  ]);

  const entries = options.account === 'cash' ? model.cashEntries :
    model.journal.filter(({ lines }) => options.account === null || lines.some(({ account }) => account === options.account));
  const filtered = options.account === null ? c.allEntries :
    options.account === 'cash' ? c.cashEntries : accountName(options.account, locale);
  const entryRows = entries.map((entry) => {
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
      controls, detailRows(reportRows),
      accounts.length ? dataTable(c[statement], [c.account, c.amount], accountRows) : null,
    ),
    el('section', 'panel journal-panel',
      ledgerTitle,
      el('div', 'company-controls', el('strong', '', filtered),
        options.account === null ? null : action(c.allEntries, () => options.selectAccount(null), 'secondary')),
      entries.length ? dataTable(c.ledger, [c.entry, c.day, c.source], entryRows) : el('p', 'muted', c.noEntries),
    ),
  );
}

export function journalDialog(entry: CompanyRead['journal'][number], { c, locale, money, day }: Labels) {
  const title = el('h2', '', c.entry);
  title.id = 'source-entry-title';
  const dialog = el('dialog', 'confirmation-dialog source-dialog',
    title, reference(entry.id),
    detailRows([[c.day, day(entry.day)], [c.source, reference(entry.sourceId)]]),
    dataTable(c.entry, [c.account, c.side, c.amount], entry.lines.map((line) => [
      accountName(line.account, locale), line.side === 'debit' ? c.debit : c.creditSide, money(line.amount),
    ])),
  );
  dialog.setAttribute('aria-labelledby', title.id);
  dialog.append(action(c.close, () => dialog.close(), 'secondary'));
  return dialog;
}
