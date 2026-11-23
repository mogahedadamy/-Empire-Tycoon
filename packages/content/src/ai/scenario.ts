/** Validates and loads the versioned founding content contract for the fictional AI sector. */
import source from '../../data/contract-before-launch.json';
import { id, integer, invalid, money, section } from '../fields';
import { catalog, choice, localized, readAiCatalog, reference } from './catalog';

const requirements = {
  'licensed-app': { capacity: 'managed', billing: 'seats', training: false },
  'specialized-api': { capacity: 'reserved', billing: 'usage', training: true },
  'general-lab': { capacity: 'interruptible', billing: 'subscription', training: true },
  'open-weight-hosting': { capacity: 'on-demand', billing: 'reserved-capacity', training: false },
} as const;
const pathIds = Object.keys(requirements) as (keyof typeof requirements)[];

/** Throws with the authoring path when a resource or permission required by a founding route is missing. */
export function parseAiScenario(value: unknown) {
  const data = section(value, 'ai-scenario');
  const schemaVersion = integer(data.schemaVersion, 'schemaVersion', 1, 1);
  const rulesetVersion = integer(data.rulesetVersion, 'rulesetVersion', 1, 1);
  const contentVersion = integer(data.contentVersion, 'contentVersion');
  const resources = readAiCatalog(data);
  const founderCapitalMinor = money(data.founderCapitalMinor, 'founderCapitalMinor');
  const paths = catalog(data.paths, 'paths', (row, at) => {
    const pathId = choice(row.id, at + '.id', pathIds);
    const requirement = requirements[pathId];
    const buyer = reference(resources.buyers, row.buyerId, at + '.buyerId');
    const supplier = reference(resources.suppliers, row.supplierId, at + '.supplierId');
    const hardware = reference(resources.hardwareFamilies, row.hardwareFamilyId, at + '.hardwareFamilyId');
    const weights = reference(resources.licenses, row.weightLicenseId, at + '.weightLicenseId');
    const dataset = reference(resources.licenses, row.dataLicenseId, at + '.dataLicenseId');
    if (buyer.billing !== requirement.billing) invalid(at + '.buyerId', 'incompatible billing terms');
    if (!supplier.hardwareFamilyIds.includes(hardware.id)) invalid(at + '.hardwareFamilyId', 'not offered by the supplier');
    if (dataset.asset !== 'data' || !dataset.rights.includes('evaluate') ||
        (requirement.training && !dataset.rights.includes('train'))) {
      invalid(at + '.dataLicenseId', 'missing usage rights');
    }
    if (weights.asset !== 'weights' || !weights.rights.includes('commercial-use') ||
        (requirement.training && !weights.rights.includes('train')) ||
        (pathId === 'licensed-app' && weights.access !== 'licensed') ||
        (pathId === 'specialized-api' && !weights.rights.includes('host')) ||
        (pathId === 'open-weight-hosting' && (weights.access !== 'open' ||
          !weights.rights.includes('host') || !weights.rights.includes('redistribute')))) {
      invalid(at + '.weightLicenseId', 'missing usage rights');
    }
    const setupPayrollMinor = money(row.setupPayrollMinor, at + '.setupPayrollMinor');
    if (BigInt(setupPayrollMinor) > BigInt(founderCapitalMinor)) invalid(at + '.setupPayrollMinor', 'exceeds founder funding');
    return {
      id: pathId, name: localized(row.name, at + '.name'), dependency: localized(row.dependency, at + '.dependency'),
      buyerId: buyer.id, supplierId: supplier.id, hardwareFamilyId: hardware.id,
      dataLicenseId: dataset.id, weightLicenseId: weights.id,
      capacityPlan: choice(row.capacityPlan, at + '.capacityPlan', [requirement.capacity]),
      setupPayrollMinor, dailyCommitmentMinor: money(row.dailyCommitmentMinor, at + '.dailyCommitmentMinor'),
      commitmentDays: integer(row.commitmentDays, at + '.commitmentDays', 1, 360),
      serviceStartsDay: integer(row.serviceStartsDay, at + '.serviceStartsDay', 2, 360),
    };
  });
  if (paths.length !== pathIds.length) invalid('paths', 'each founding path is required');
  return Object.freeze({
    id: id(data.id, 'id'), schemaVersion, rulesetVersion, contentVersion,
    title: localized(data.title, 'title'), currency: choice(data.currency, 'currency', ['GAME']),
    seed: integer(data.seed, 'seed', 0, 0xffffffff), founderCapitalMinor,
    opportunityExpiresDay: integer(data.opportunityExpiresDay, 'opportunityExpiresDay', 2, 360),
    ...resources, paths,
  });
}

export type AiScenario = ReturnType<typeof parseAiScenario>;
export type AiFoundingPath = AiScenario['paths'][number]['id'];

/** Returns the immutable shipped AI scenario independently of the food scenario catalog. */
export function loadAiScenario(): AiScenario {
  return shipped;
}

const shipped = parseAiScenario(source);
