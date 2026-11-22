/** Validates ET-018 authoring references and plays the new contract through the shared journey rules. */
import { expect, it } from 'vitest';
import authored from '../../packages/content/data/wadi-playbook.json';
import { difficultyIds, getPlaybookRun, loadScenario, parsePlaybook, playbookRuns } from '../../packages/content/src';
import { createJourneyEngine } from '../../apps/game/src/journey/engine';
import type { JourneyAction } from '../../apps/game/src/journey/types';

const harbor = loadScenario('harbor-supply');
const original = loadScenario('big-order');
const catalog = new Map([[original.id, original], [harbor.id, harbor]]);

it('loads two chapters and independent free-play saves for each authored difficulty', () => {
  expect(playbookRuns).toHaveLength(12);
  for (const level of difficultyIds) {
    const campaign = getPlaybookRun(`campaign-harbor-supply-${level}`)!;
    const sandbox = getPlaybookRun(`sandbox-harbor-supply-${level}`)!;
    expect(campaign).toMatchObject({ mode: 'campaign', difficulty: level, guided: level === 'supported' });
    expect(sandbox.scenario.id).not.toBe(campaign.scenario.id);
    expect(sandbox.scenario.calendar.endDay).toBe(60);
    expect(campaign.scenario.calendar.endDay).toBe(48);
  }
  expect(loadScenario('campaign-harbor-supply-supported')).toMatchObject({
    opening: { capitalMinor: '3025000', loanMonthlyInterestBps: 90 }, postClose: { customerDelayDays: 3 },
  });
  expect(loadScenario('campaign-harbor-supply-expert')).toMatchObject({
    opening: { capitalMinor: '2475000', loanMonthlyInterestBps: 180 }, postClose: { customerDelayDays: 6 },
  });
  expect(harbor.contract.id).not.toBe(original.contract.id);
  expect(harbor.customer.id).not.toBe(original.customer.id);
});

it.each(['contractId', 'productId', 'sectorId', 'scenarioId'] as const)('rejects a missing campaign reference in %s', (field) => {
  const example = structuredClone(authored);
  example.campaign.chapters[1][field] = 'missing-reference';
  expect(() => parsePlaybook(example, catalog)).toThrow(`campaign.chapters[1].${field}`);
});

it('rejects duplicate levels and sandbox scenarios without a playable chapter', () => {
  const levels = structuredClone(authored);
  levels.levels[1].id = levels.levels[0].id;
  expect(() => parsePlaybook(levels, catalog)).toThrow('levels');
  const modes = structuredClone(authored);
  modes.sandbox.scenarioIds.push('unknown-scenario');
  expect(() => parsePlaybook(modes, catalog)).toThrow('sandbox.scenarioIds');
});

it.each(difficultyIds)('completes the authored harbor chapter in %s with replay parity', (difficulty) => {
  const scenario = loadScenario(`campaign-harbor-supply-${difficulty}`);
  const engine = createJourneyEngine(scenario);
  let command = 0;
  const submit = (action: JourneyAction) => {
    const result = engine.submit({ commandId: `action-${++command}`, expectedRevision: engine.revision(), action });
    expect(result.status, JSON.stringify(result)).toBe('accepted');
  };
  submit({ type: 'found-company', fundingPlan: 'loan' });
  submit({ type: 'accept-contract', offerId: scenario.contract.id });
  submit({ type: 'order-supply' });
  submit({ type: 'advance-through', day: scenario.contract.deliveryStartsDay - 1 });
  for (const quantity of [36, 36, 24]) {
    submit({ type: 'deliver', offerId: scenario.contract.id, quantity });
    submit({ type: 'advance', days: 1 });
  }
  submit({ type: 'advance-through', day: scenario.calendar.firstCloseDay });
  expect(engine.read().evaluation).toMatchObject({ deliveredOnTime: true, payrollPaidOnTime: true });
  expect(engine.read().invoices).toHaveLength(3);
  expect(engine.read().monthOneIncome?.revenue).toBe('796800');
  submit({ type: 'defer-restock' });
  submit({ type: 'collect-early' });
  submit({ type: 'advance-through', day: scenario.calendar.endDay });
  expect(engine.read().evaluation).toMatchObject({ status: 'succeeded', solvent: true });
  expect(createJourneyEngine(scenario, engine.capture()).read()).toEqual(engine.read());
});
