/** Shared formatting and table rendering across the company screens. */
import { createFormatters, el, figure, type Locale } from '../../../../packages/ui/src';
import { companyText } from './text';

export function labels(locale: Locale) {
  const c = companyText(locale);
  const format = createFormatters(locale);
  return {
    c, locale,
    money: (amount: string) => figure(format.money(BigInt(amount)), c.unit),
    qty: (value: number | bigint) => figure(format.number(value), c.boxes),
    day: (value: number) => el('span', '', c.day, ' ', el('bdi', '', format.number(value))),
  };
}

export type Labels = ReturnType<typeof labels>;
type Cell = Node | string;

export function dataTable(heading: string, headers: string[], rows: Cell[][]) {
  const table = el('table', 'company-table', el('caption', 'sr-only', heading));
  const columns = headers.map((name) => {
    const cell = el('th', '', name);
    cell.scope = 'col';
    return cell;
  });
  table.append(el('thead', '', el('tr', '', ...columns)));
  const body = rows.map((row) => el('tr', '', ...row.map((cell) => el('td', '', cell))));
  table.append(el('tbody', '', ...body));
  return table;
}

export function reference(id: string) {
  const item = el('bdi', 'entry-reference', id);
  item.dir = 'ltr';
  return item;
}
