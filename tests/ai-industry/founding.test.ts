/** Verifies authored founding costs, resource and rights checks, and the seeded financial opening. */
import { expect, it } from 'vitest';
import authored from '../../packages/content/data/contract-before-launch.json';
import { foundAiCompany, quoteAiFounding, type AiFoundingCommand } from '../../packages/ai-industry/src';
import { loadAiScenario, parseAiScenario } from '../../packages/content/src/ai';

const scenario = loadAiScenario();

it('compares four different startup costs, commitments, first payments, buyers and dependencies', () => {
  const quotes = quoteAiFounding(scenario);
  expect(quotes.map(({ pathId, startupCostMinor, totalCommitmentMinor, firstCollectionDay, cashAfterCommitmentMinor }) =>
    [pathId, startupCostMinor, totalCommitmentMinor, firstCollectionDay, cashAfterCommitmentMinor])).toEqual([
    ['licensed-app', '1350000', '1232000', 13, '13418000'],
    ['specialized-api', '2800000', '4050000', 27, '9150000'],
    ['general-lab', '7900000', '6615000', 54, '1485000'],
    ['open-weight-hosting', '2400000', '2310000', 20, '11290000'],
  ]);
  expect(new Set(quotes.map(({ dependency }) => dependency.ar)).size).toBe(4);
  expect(new Set(quotes.map(({ billing }) => billing)).size).toBe(4);
  expect(quotes[3]).toMatchObject({ weightAccess: 'open', capacityPlan: 'on-demand' });
  const [harbor, plateau, cove] = scenario.suppliers;
  expect(harbor.memorySourceId).toBe(plateau.memorySourceId);
  expect(cove.memorySourceId).not.toBe(harbor.memorySourceId);
});

it.each(['supplierId', 'hardwareFamilyId', 'dataLicenseId', 'weightLicenseId', 'buyerId'] as const)(
  'rejects an absent founding reference in %s', (field) => {
    const invalid = structuredClone(authored);
    invalid.paths[0][field] = 'unknown-reference';
    expect(() => parseAiScenario(invalid)).toThrow(`paths[0].${field}`);
  },
);

it('rejects unavailable hardware and incompatible usage rights even when the referenced IDs exist', () => {
  const incompatible = structuredClone(authored);
  incompatible.paths[0].hardwareFamilyId = 'dune-48';
  expect(() => parseAiScenario(incompatible)).toThrow('paths[0].hardwareFamilyId: not offered');
  const restricted = structuredClone(authored);
  restricted.licenses.find(({ id }) => id === 'reef-open-weights')!.rights = ['commercial-use', 'host'];
  expect(() => parseAiScenario(restricted)).toThrow('paths[3].weightLicenseId: missing usage rights');
});

it('requires each founding route and caps opening payroll at available capital', () => {
  const incomplete = structuredClone(authored);
  incomplete.paths.pop();
  expect(() => parseAiScenario(incomplete)).toThrow('paths: each founding path is required');
  const unaffordable = structuredClone(authored);
  unaffordable.paths[2].setupPayrollMinor = '16000001';
  expect(() => parseAiScenario(unaffordable)).toThrow('paths[2].setupPayrollMinor: exceeds founder funding');
});

it.each(quoteAiFounding(scenario))('replays $pathId and posts only settled founding cash', (quote) => {
  const command: AiFoundingCommand = { type: 'found-ai-company', pathId: quote.pathId };
  const receipt = foundAiCompany(scenario, command);
  expect(receipt).toEqual(foundAiCompany(parseAiScenario(structuredClone(authored)), command));
  expect(receipt).toMatchObject({ day: 1, revision: 1, currency: 'GAME', randomState: authored.seed, quote });
  expect(foundAiCompany(parseAiScenario({ ...authored, seed: authored.seed + 1 }), command).randomState).toBe(authored.seed + 1);
  expect(receipt.balance).toMatchObject({
    cash: quote.openingCashMinor, assets: quote.openingCashMinor, liabilitiesAndEquity: quote.openingCashMinor,
    contributedEquity: quote.founderCapitalMinor, accumulatedEarnings: '-' + quote.startupCostMinor, liabilities: '0',
  });
  expect(receipt.entries.map(({ id }) => id)).toEqual(['founder-capital', 'founding-payroll']);
});
