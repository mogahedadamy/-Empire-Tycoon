/** Validates campaign links and composes immutable single-player campaign or practice runs. */
import { applyBasisPoints } from '../../finance/src';
import source from '../data/wadi-playbook.json';
import { id, integer, invalid, section, text } from './fields';
import { parseScenario, type Scenario } from './scenario';

export const difficultyIds = ['supported', 'standard', 'expert'] as const;
export type Difficulty = typeof difficultyIds[number];
export type PlayMode = 'campaign' | 'sandbox';

function records(value: unknown, path: string) {
  if (!Array.isArray(value) || !value.length) return invalid(path, 'expected a non-empty list');
  return value.map((record, index) => section(record, `${path}[${index}]`));
}

function localized(value: unknown, path: string) {
  const row = section(value, path);
  return Object.freeze({ ar: text(row.ar, `${path}.ar`), en: text(row.en, `${path}.en`) });
}

/** Checks localized metadata, required levels, and references to shipped scenarios, sectors, products, and contracts. */
export function parsePlaybook(value: unknown, scenarios: ReadonlyMap<string, Scenario>) {
  const data = section(value, 'playbook');
  integer(data.schemaVersion, 'schemaVersion', 1, 1);
  const levels = records(data.levels, 'levels').map((row, index) => {
    const path = `levels[${index}]`;
    const levelId = id(row.id, `${path}.id`);
    const difficulty = difficultyIds.find((entry) => entry === levelId);
    if (!difficulty || typeof row.guided !== 'boolean') return invalid(path, 'unknown difficulty or guidance setting');
    return Object.freeze({
      id: difficulty, guided: row.guided,
      openingCapitalBps: integer(row.openingCapitalBps, `${path}.openingCapitalBps`, 1, 20_000),
      loanInterestBps: integer(row.loanInterestBps, `${path}.loanInterestBps`, 0, 20_000),
      customerDelayAdjustmentDays: integer(row.customerDelayAdjustmentDays, `${path}.customerDelayAdjustmentDays`, -10, 10),
    });
  });
  if (levels.length !== difficultyIds.length || new Set(levels.map((row) => row.id)).size !== difficultyIds.length) {
    invalid('levels', 'each difficulty must appear once');
  }

  const campaign = section(data.campaign, 'campaign');
  const chapters = records(campaign.chapters, 'campaign.chapters').map((row, index) => {
    const path = `campaign.chapters[${index}]`;
    const scenarioId = id(row.scenarioId, `${path}.scenarioId`);
    const scenario = scenarios.get(scenarioId);
    if (!scenario) return invalid(`${path}.scenarioId`, 'unknown scenario');
    for (const [field, expected] of [['contractId', scenario.contract.id], ['productId', scenario.product.id],
      ['sectorId', scenario.sector.id]] as const) {
      if (id(row[field], `${path}.${field}`) !== expected) invalid(`${path}.${field}`, 'unknown reference in scenario');
    }
    return Object.freeze({ scenarioId, title: localized(row.title, `${path}.title`), summary: localized(row.summary, `${path}.summary`) });
  });
  if (new Set(chapters.map(({ scenarioId }) => scenarioId)).size !== chapters.length) invalid('campaign.chapters', 'duplicate scenario');
  const sandbox = section(data.sandbox, 'sandbox');
  if (!Array.isArray(sandbox.scenarioIds) || !sandbox.scenarioIds.length) return invalid('sandbox.scenarioIds', 'expected scenarios');
  const sandboxIds = sandbox.scenarioIds.map((entry, index) => id(entry, `sandbox.scenarioIds[${index}]`));
  if (new Set(sandboxIds).size !== sandboxIds.length || sandboxIds.some((entry) => !chapters.some(({ scenarioId }) => scenarioId === entry))) {
    invalid('sandbox.scenarioIds', 'expected distinct campaign scenarios');
  }
  return Object.freeze({
    levels: Object.freeze(levels), campaign: Object.freeze({ id: id(campaign.id, 'campaign.id'), chapters: Object.freeze(chapters) }),
    sandbox: Object.freeze({ scenarioIds: Object.freeze(sandboxIds), endDay: integer(sandbox.endDay, 'sandbox.endDay', 1, 360) }),
  });
}

type Playbook = ReturnType<typeof parsePlaybook>;

/** Uses distinct IDs for all modes and difficulties so older saves keep their exact terms. */
export function createPlaybookCatalog(scenarios: ReadonlyMap<string, Scenario>) {
  const playbook = parsePlaybook(source, scenarios);
  const runs = new Map<string, ReturnType<typeof makeRun>>();

  function makeRun(mode: PlayMode, chapter: Playbook['campaign']['chapters'][number], level: Playbook['levels'][number]) {
    const base = scenarios.get(chapter.scenarioId)!;
    const runId = `${mode}-${chapter.scenarioId}-${level.id}`;
    const scenario = parseScenario({
      ...base, id: runId,
      calendar: { ...base.calendar, endDay: mode === 'sandbox' ? playbook.sandbox.endDay : base.calendar.endDay },
      opening: {
        ...base.opening, capitalMinor: applyBasisPoints(BigInt(base.opening.capitalMinor), level.openingCapitalBps).toString(),
        loanMonthlyInterestBps: Number(applyBasisPoints(BigInt(base.opening.loanMonthlyInterestBps), level.loanInterestBps)),
      },
      postClose: { ...base.postClose, customerDelayDays: Math.max(0, base.postClose.customerDelayDays + level.customerDelayAdjustmentDays) },
    });
    return Object.freeze({ mode, scenario, difficulty: level.id, guided: level.guided, title: chapter.title, summary: chapter.summary });
  }

  for (const chapter of playbook.campaign.chapters) {
    for (const level of playbook.levels) {
      const campaign = makeRun('campaign', chapter, level);
      runs.set(campaign.scenario.id, campaign);
      if (playbook.sandbox.scenarioIds.includes(chapter.scenarioId)) {
        const sandbox = makeRun('sandbox', chapter, level);
        runs.set(sandbox.scenario.id, sandbox);
      }
    }
  }
  return runs;
}
