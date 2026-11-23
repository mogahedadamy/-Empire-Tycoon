/** Renders selectable operating terms and the worker's receipt for each sector. */
import { action, createFormatters, detailRows, el, figure, type Locale } from '../../../../packages/ui/src';
import { scenario, type ProjectChoice, type ProjectReceipt } from './model';
import { projectText } from './text';

type Labels = ReturnType<typeof projectText>;

function choices<T extends string | number>(label: string, name: string, options: readonly (readonly [T, string])[],
  current: T, disabled: boolean, select: (value: T) => void) {
  const group = el('fieldset', 'project-options plans', el('legend', '', label));
  group.dataset.projectOptions = name;
  for (const [value, title] of options) {
    const input = el('input', '');
    input.type = 'radio'; input.name = name; input.value = String(value); input.checked = current === value;
    input.disabled = disabled;
    input.addEventListener('change', () => select(value));
    group.append(el('label', 'plan', input, el('span', '', title)));
  }
  return group;
}

function titleFor(id: string, text: Labels) {
  return Object.hasOwn(text, id) ? text[id as keyof Labels] : id;
}

export function renderProjectTerms(choice: ProjectChoice, locale: Locale, disabled: boolean, change: (next: ProjectChoice) => void) {
  const l = projectText(locale);
  switch (choice.project) {
    case 'manufacturing': {
      const service = el('input', '');
      service.type = 'checkbox'; service.name = 'service'; service.disabled = disabled; service.checked = choice.service;
      service.addEventListener('change', () => change({ ...choice, service: service.checked }));
      return el('div', 'project-inputs', choices(l.supplier, 'supplier',
        scenario.suppliers.map(({ id }) => [id, titleFor(id, l)]), choice.supplierId, disabled,
        (supplierId) => change({ ...choice, supplierId })), el('label', 'plan project-service', service, el('span', '', l.service)));
    }
    case 'logistics':
      return choices(l.route, 'route', scenario.routes.map(({ id }) => [id, titleFor(id, l)]), choice.routeId, disabled,
        (routeId) => change({ ...choice, routeId }));
    case 'property': {
      const percentage = new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-arab' : 'en', { style: 'percent' });
      const vacancies = [0, 2000, 5000, 8000].map((value) => [value, percentage.format(value / 10_000)] as const);
      return el('div', 'project-inputs', choices(l.vacancy, 'vacancy', vacancies, choice.vacancyBps, disabled,
        (vacancyBps) => change({ ...choice, vacancyBps })), choices(l.tenure, 'tenure',
        [['lease', l.lease], ['own', l.own]] as const, choice.tenure, disabled, (tenure) => change({ ...choice, tenure })));
    }
  }
}

function renderPropertyComparison(receipt: Extract<ProjectReceipt, { project: 'property' }>, choice: Extract<ProjectChoice, { project: 'property' }>, l: Labels,
  money: (amount: string) => HTMLElement) {
  const cards = (['lease', 'own'] as const).map((tenure) => {
    const option = receipt.quote[tenure];
    const card = el('section', 'project-comparison-card', el('h3', '', l[tenure]),
      tenure === choice.tenure ? el('p', 'project-selected', l.selected) : null,
      detailRows([
        [l.initial, money(option.initialCashMinor)], [l.rent, money(option.expectedRentMinor)],
        [l.monthly, money(option.monthlyCashMinor)],
      ]), el('details', 'project-materials', el('summary', '', l.propertyDetails), detailRows([
        [l.refundable, money(option.refundableDepositMinor)], [l.operating, money(option.operatingCostsMinor)],
        [l.insurance, money(option.monthlyInsuranceMinor)], [l.noi, money(option.netOperatingIncomeMinor)],
        [l.debt, money(option.monthlyDebtServiceMinor)], [l.exit, money(option.netCashAtExitMinor)],
      ])));
    card.dataset.propertyOption = tenure;
    return card;
  });
  return el('div', 'project-comparison', ...cards);
}

export function renderProjectReceipt(receipt: ProjectReceipt, choice: ProjectChoice, locale: Locale, confirmed: boolean) {
  const l = projectText(locale);
  const formatted = createFormatters(locale);
  const money = (value: string) => figure(formatted.money(BigInt(value)), '$');
  const number = (value: number) => el('bdi', '', formatted.number(value));
  const day = (value: number) => el('span', '', l.day, ' ', number(value));
  const percentage = (value: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-arab' : 'en',
    { style: 'percent', maximumFractionDigits: 2 }).format(value / 10_000);
  const heading = confirmed ? l.complete : receipt.project === 'property' ? l.comparison : l.preview;
  const title = el('h2', '', heading);
  title.id = 'project-receipt-title';
  if (receipt.project === 'property' && choice.project === 'property') {
    return el('section', 'panel project-receipt', title, renderPropertyComparison(receipt, choice, l, money));
  }
  if (receipt.project === 'manufacturing') {
    const q = receipt.quote;
    return el('section', 'panel project-receipt', title, detailRows([
      [l.ready, day(q.readyDay)], [l.due, day(q.dueDay)], [l.capacity, number(q.capacity)],
      [l.bottleneck, q.bottlenecks.map((limit) => l[limit]).join(' · ')],
      [l.machinePlanned, number(q.plannedMachineUnits)], [l.machineLost, number(q.machineDowntimeUnits)],
      [l.failureRisk, percentage(q.nextShiftFailureRiskBps)], [l.produced, number(q.producedUnits)],
      [l.rejects, number(q.rejectedUnits)], [l.delivered, number(q.deliveredUnits)],
      [l.expense, money(q.expenseMinor)], [l.proceeds, money(q.proceedsMinor)], [l.net, money(q.projectNetMinor)],
    ]), el('details', 'project-materials', el('summary', '', l.materialDetails), detailRows(
      q.orderedMaterials.map(({ materialId, quantity }) => [titleFor(materialId, l), number(quantity)] as const),
    )));
  }
  if (receipt.project !== 'logistics') return null;
  const q = receipt.quote;
  return el('section', 'panel project-receipt', title, detailRows([
    [l.arrival, day(q.arrivalDay)], [l.due, day(q.dueDay)], [l.capacity, number(q.freeUnits)],
    [l.loaded, number(q.loadedUnits)], [l.delivered, number(q.acceptedUnits)], [l.late, number(q.lateUnits)],
    [l.unfilled, number(q.unfilledUnits)], [l.penalty, money(q.lateFeeMinor)], [l.expense, money(q.expenseMinor)],
    [l.proceeds, money(q.proceedsMinor)], [l.net, money(q.projectNetMinor)],
  ]));
}

export function projectConfirmButton(choice: ProjectChoice, l: Labels, disabled: boolean, confirm: () => void) {
  const key = choice.project === 'manufacturing' ? 'factoryCommit' : choice.project === 'logistics' ? 'logisticsCommit' : 'propertyCommit';
  const button = action(l[key], confirm);
  button.dataset.confirmProject = '';
  button.disabled = disabled;
  return button;
}
