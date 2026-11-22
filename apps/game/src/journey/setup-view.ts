/** Renders Day 1 founding: scenario terms, funding plan comparison, and guidance preference. */
import type { Scenario } from '../../../../packages/content/src';
import { action, detailRows, el } from '../../../../packages/ui/src';
import { previewModel, type FundingPlan } from '../preview-model';
import type { JourneyLabels } from './text';

export interface SetupOptions {
  scenario: Scenario;
  scenarioId: string;
  plan: FundingPlan;
  guidanceSkipped: boolean;
  busy: boolean;
  selectScenario(id: string): void;
  selectPlan(plan: FundingPlan): void;
  selectGuidance(skipped: boolean): void;
  found(): void;
}

export function setupView(labels: JourneyLabels, options: SetupOptions) {
  const { c, money } = labels;
  const { scenario, scenarioId, plan, guidanceSkipped, busy } = options;
  const model = previewModel(scenario, plan);

  const scenarios = el('fieldset', 'plans', el('legend', '', c.scenarioLabel));
  for (const [id, title, hint] of [
    ['big-order', c.scenarioRef, c.scenarioRefHint],
    ['big-order-tight', c.scenarioTight, c.scenarioTightHint],
  ] as const) {
    const input = el('input', '');
    input.type = 'radio';
    input.name = 'scenario';
    input.value = id;
    input.checked = scenarioId === id;
    input.disabled = busy;
    input.addEventListener('change', () => options.selectScenario(id));
    scenarios.append(el('label', 'plan', input, el('span', '', el('strong', '', title), el('small', '', hint))));
  }

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
    input.disabled = busy;
    input.addEventListener('change', () => options.selectPlan(value));
    plans.append(el('label', 'plan', input, el('span', '', el('strong', '', label), el('small', '', hint))));
  }

  const guidance = el('fieldset', 'plans', el('legend', '', c.guidanceMode));
  for (const [skipped, label] of [[false, c.guidanceOn], [true, c.guidanceOff]] as const) {
    const input = el('input', '');
    input.type = 'radio';
    input.name = 'guidance';
    input.value = skipped ? 'off' : 'on';
    input.checked = guidanceSkipped === skipped;
    input.disabled = busy;
    input.addEventListener('change', () => options.selectGuidance(skipped));
    guidance.append(el('label', 'plan', input, el('span', '', el('strong', '', label))));
  }

  const image = el('img', 'scene-image');
  image.src = `${import.meta.env.BASE_URL}images/produce-terminal.webp`;
  image.alt = c.imageAlt;
  image.width = 1120;
  image.height = 747;

  const confirm = action(c.foundAction, options.found);
  confirm.dataset.foundCompany = '';
  confirm.disabled = busy;

  return el('div', 'view-layout',
    el('figure', 'scene',
      image,
      el('figcaption', 'scene-caption', el('span', '', c.sector), el('strong', '', c.company), el('span', '', c.city)),
    ),
    el('section', 'panel funding-panel view-stack',
      scenarios,
      plans,
      detailRows([
        [c.capital, money(model.capital.toString())],
        [c.loan, money(model.loan.toString())],
        [c.setupCost, money(model.setup.toString())],
        [c.profit, money(model.netIncome.toString())],
      ]),
      el('div', 'funding-total', el('span', '', c.initialCash), money(model.startingCash.toString())),
      guidance,
      confirm,
    ),
  );
}
