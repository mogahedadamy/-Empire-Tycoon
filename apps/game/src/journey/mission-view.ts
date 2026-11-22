/** Renders the Android-first opening mission from committed journey data. */
import type { Scenario } from '../../../../packages/content/src';
import { action, applyLocale, detailRows, el, notice, type Locale } from '../../../../packages/ui/src';
import { previewModel, type FundingPlan } from '../preview-model';
import type { JourneyScreen } from './guidance';
import { missionCopy } from './mission-copy';
import { readMissionStep, type MissionStep } from './mission-step';
import type { JourneyLabels } from './text';
import type { JourneyAction, JourneyReadModel } from './types';

interface MissionViewOptions {
  readonly root: HTMLElement;
  readonly locale: Locale;
  readonly labels: JourneyLabels;
  readonly scenario: Scenario;
  readonly model: JourneyReadModel;
  readonly plan: FundingPlan;
  readonly busy: boolean;
  readonly canWrite: boolean;
  readonly error: string | null;
  dispatch(command: JourneyAction): void;
  manage(screen?: JourneyScreen): void;
  toggleLanguage(): void;
}

function scene(goal: string, opening: boolean) {
  const photo = el('img', 'scene-image');
  photo.src = `${import.meta.env.BASE_URL}images/produce-terminal.webp`;
  photo.alt = '';
  photo.width = 1120;
  photo.height = 747;
  const title = el('h1', '', goal);
  title.id = 'mission-goal';
  return el('div', opening ? 'mission-scene mission-scene-opening' : 'mission-scene', photo, title);
}

function stageFacts(step: MissionStep, { model, scenario, plan, labels }: MissionViewOptions) {
  const m = missionCopy(labels.locale);
  const { money, day, qty, party, c } = labels;
  const { contract, supply } = scenario;
  const delivered = model.offer?.deliveredQuantity ?? 0;
  const awaiting = model.invoices.reduce((sum, invoice) => invoice.payment ? sum : sum + BigInt(invoice.amountMinor), 0n);

  switch (step.id) {
    case 'found': {
      const preview = previewModel(scenario, plan);
      return el('div', 'mission-facts',
        detailRows([[m.openingCash, money(preview.startingCash.toString())]]),
        el('details', 'mission-funding', el('summary', '', m.fundingNote), detailRows([
          [c.capital, money(preview.capital.toString())], [c.loan, money(preview.loan.toString())],
          [c.setupCost, money(preview.setup.toString())],
        ])),
      );
    }
    case 'contract':
      return detailRows([
        [m.client, party(contract.customerId)], [m.ordered, qty(contract.quantity)],
        [c.rate, money(contract.unitPriceMinor)], [m.deadline, day(contract.deliveryDueDay)], [m.due, day(contract.paymentDueDay)],
      ]);
    case 'order':
      return detailRows([
        [m.supplier, party(supply.supplierId)], [m.batch, qty(supply.quantity)],
        [c.orderTotal, money((BigInt(supply.unitCostMinor) * BigInt(supply.quantity)).toString())],
      ]);
    case 'arrival':
      return step.action?.type === 'advance-through' ? detailRows([[c.orderArrival, day(step.action.day)]]) : null;
    case 'delivery-day':
      return detailRows([[m.stock, qty(model.inventory.quantity)], [m.window, day(contract.deliveryStartsDay)]]);
    case 'ship': {
      if (step.action?.type !== 'deliver') return null;
      const amount = BigInt(step.action.quantity) * BigInt(contract.unitPriceMinor);
      return detailRows([[m.batch, qty(step.action.quantity)], [m.sale, money(amount.toString())], [m.due, day(contract.paymentDueDay)]]);
    }
    case 'next-trip':
      return detailRows([[m.remaining, qty(contract.quantity - delivered)], [m.pendingCash, money(awaiting.toString())]]);
    case 'done':
      return detailRows([[m.pendingCash, money(awaiting.toString())]]);
    case 'blocked': {
      const alert = model.pendingAlerts[0];
      const code = alert?.code ?? (model.offer?.status === 'expired' ? 'offer-expired'
        : model.offer?.status === 'late' ? 'delivery-missed' : null);
      if (!code) return null;
      const key = `alert_${code.replaceAll('-', '_')}`;
      return key in c ? el('p', 'notice', c[key as keyof typeof c]) : null;
    }
    default:
      return null;
  }
}

/** Mounts the focused mission shell with one primary action and links to optional reports. */
export function renderOpeningMission(options: MissionViewOptions) {
  const { root, locale, labels, model, scenario, plan, busy, canWrite, error } = options;
  const { c, day, format } = labels;
  const m = missionCopy(locale);
  const step = readMissionStep(model, scenario, plan);
  const [title, body, button] = m[step.id];
  applyLocale(document.documentElement, locale);

  const language = action(c.otherLanguage, options.toggleLanguage, 'language');
  language.lang = locale === 'ar' ? 'en' : 'ar';
  const header = el('header', 'mission-bar', el('strong', '', m.brand), day(model.day), language);
  const stageList = el('ol', 'mission-stages');
  stageList.setAttribute('aria-label', m.progress);
  for (const [index, phase] of m.phases.entries()) {
    const item = el('li', '', phase);
    item.dataset.state = index < step.phase ? 'done' : index === step.phase ? 'current' : 'pending';
    if (index === step.phase) item.setAttribute('aria-current', 'step');
    stageList.append(item);
  }

  const delivered = model.offer?.deliveredQuantity ?? 0;
  const goal = scenario.contract.quantity;
  const counter = el('div', 'mission-counter', el('span', '', m.delivered),
    el('span', 'mission-count', el('bdi', '', format.number(delivered)), ` ${m.of} `, el('bdi', '', format.number(goal))));
  const progress = el('progress', 'mission-progress');
  progress.setAttribute('aria-label', m.delivered);
  progress.max = goal;
  progress.value = delivered;
  const shipping = step.phase >= 3 ? el('div', 'mission-shipping', counter, progress) : null;

  const heading = el('h2', '', step.id === 'next-trip' && model.invoices.length > 1 ? m.shipmentReceived : title);
  heading.id = 'mission-step-title';
  const command = step.action;
  const primary = command
    ? action(button, () => options.dispatch(command), 'mission-primary')
    : action(step.id === 'blocked' ? button : m.advanceBlocked, () => options.manage(), 'mission-primary');
  if (command) {
    primary.dataset.missionAction = step.id;
    primary.disabled = busy || !canWrite;
  }
  const secondary = step.id === 'blocked' || !step.action ? null : action(
    step.id === 'found' ? m.settings : step.id === 'done' ? m.finance : m.management,
    () => options.manage(step.id === 'done' ? 'finance' : undefined), 'mission-link',
  );
  if (secondary) secondary.dataset.missionManagement = '';
  const worker = el('div', 'mission-worker');
  worker.setAttribute('role', 'status');
  const panel = el('section', 'mission-decision', heading, el('p', 'mission-copy', body),
    shipping, stageFacts(step, options), error ? notice(c.review, error, 'error') : null, worker,
    primary, secondary,
  );
  panel.setAttribute('aria-labelledby', heading.id);
  const status = el('p', 'save-status mission-save');
  const main = el('main', 'opening-mission', header, scene(m.goal, step.id === 'found'), stageList, panel, status);
  main.dataset.missionStep = step.id;
  main.dataset.missionRevision = String(model.revision);
  root.replaceChildren(main);
}
