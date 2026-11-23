/** Decodes compute procurement tied to the founding catalog's regional and hardware identities. */
import source from '../../data/compute-procurement.json';
import { id, integer, invalid, money, section } from '../fields';
import { catalog, choice, reference } from './catalog';
import { loadAiScenario, type AiScenario } from './scenario';

const unitLimit = 1_000_000;

function hardwareOffer(ai: AiScenario, row: Record<string, unknown>, path: string) {
  const supplier = reference(ai.suppliers, row.supplierId, path + '.supplierId');
  const hardware = reference(ai.hardwareFamilies, row.hardwareFamilyId, path + '.hardwareFamilyId');
  if (!supplier.hardwareFamilyIds.includes(hardware.id)) invalid(path + '.hardwareFamilyId', 'not offered by supplier');
  return { supplierId: supplier.id, hardwareFamilyId: hardware.id };
}

function parseGroups(value: unknown, ai: AiScenario) {
  return catalog(value, 'groups', (row, at) => {
    const groupId = id(row.id, at + '.id');
    const kind = choice(row.kind, at + '.kind', ['owned', 'cloud']);
    if (kind === 'cloud') {
      const offer = hardwareOffer(ai, row, at);
      return {
        id: groupId, kind, ...offer,
        regionId: reference(ai.suppliers, offer.supplierId, at + '.supplierId').regionId,
        units: integer(row.units, at + '.units', 1, unitLimit),
        reservedUnitPriceMinor: money(row.reservedUnitPriceMinor, at + '.reservedUnitPriceMinor'),
        interruptibleUnitPriceMinor: money(row.interruptibleUnitPriceMinor, at + '.interruptibleUnitPriceMinor'),
      };
    }
    return {
      id: groupId, kind, regionId: reference(ai.regions, row.regionId, at + '.regionId').id,
      hardwareFamilyId: reference(ai.hardwareFamilies, row.hardwareFamilyId, at + '.hardwareFamilyId').id,
      installationDays: integer(row.installationDays, at + '.installationDays', 0, 360),
      rackUnits: integer(row.rackUnits, at + '.rackUnits', 1, unitLimit),
      sitePowerWatts: integer(row.sitePowerWatts, at + '.sitePowerWatts', 1, 1_000_000_000),
      pueBps: integer(row.pueBps, at + '.pueBps', 10_000, 100_000),
      fixedItWatts: integer(row.fixedItWatts, at + '.fixedItWatts', 0, 1_000_000_000),
      acceleratorWatts: integer(row.acceleratorWatts, at + '.acceleratorWatts', 1, 1_000_000),
      networkUnits: integer(row.networkUnits, at + '.networkUnits', 0, unitLimit),
      coolingUnits: integer(row.coolingUnits, at + '.coolingUnits', 0, unitLimit),
    };
  });
}

/** Validates windows, resource references, fixed site limits and window-specific reductions. */
export function parseComputeProcurement(value: unknown, ai = loadAiScenario()) {
  const data = section(value, 'compute-procurement');
  const schemaVersion = integer(data.schemaVersion, 'schemaVersion', 1, 1);
  const contentVersion = integer(data.contentVersion, 'contentVersion');
  if (data.scenarioId !== ai.id) invalid('scenarioId', 'unknown founding scenario');
  const windows = [...catalog(data.windows, 'windows', (row, at) => ({
    id: id(row.id, at + '.id'),
    day: integer(row.day, at + '.day', 1, 360),
    hour: integer(row.hour, at + '.hour', 0, 23),
  }))].sort((left, right) => left.day - right.day || left.hour - right.hour);
  if (new Set(windows.map(({ day, hour }) => day * 24 + hour)).size !== windows.length) {
    invalid('windows', 'overlapping hour');
  }
  const groups = parseGroups(data.groups, ai);
  const hardwareOffers = catalog(data.hardwareOffers, 'hardwareOffers', (row, at) => ({
    id: id(row.id, at + '.id'),
    ...hardwareOffer(ai, row, at),
    units: integer(row.units, at + '.units', 1, unitLimit),
    leadDays: integer(row.leadDays, at + '.leadDays', 1, 360),
    unitPriceMinor: money(row.unitPriceMinor, at + '.unitPriceMinor'),
  }));

  const shock = section(data.memoryShock, 'memoryShock');
  const sourceId = id(shock.sourceId, 'memoryShock.sourceId');
  if (!ai.suppliers.some(({ memorySourceId }) => memorySourceId === sourceId)) invalid('memoryShock.sourceId', 'unknown memory source');
  const fromDay = integer(shock.fromDay, 'memoryShock.fromDay', 1, 360);
  const memoryShock = Object.freeze({
    sourceId, fromDay, throughDay: integer(shock.throughDay, 'memoryShock.throughDay', fromDay, 360),
    delayDays: integer(shock.delayDays, 'memoryShock.delayDays', 1, 360),
    probabilityBps: integer(shock.probabilityBps, 'memoryShock.probabilityBps', 0, 10_000),
  });
  if (!Array.isArray(data.limits)) invalid('limits', 'expected list');
  const limits = data.limits.map((value, index) => {
    const at = `limits[${index}]`;
    const row = section(value, at);
    const group = reference(groups, row.groupId, at + '.groupId');
    const windowId = reference(windows, row.windowId, at + '.windowId').id;
    return Object.freeze({
      groupId: group.id, windowId,
      units: integer(row.units, at + '.units', 0, group.kind === 'cloud' ? group.units : group.coolingUnits),
    });
  });
  if (new Set(limits.map(({ groupId, windowId }) => groupId + ':' + windowId)).size !== limits.length) {
    invalid('limits', 'duplicate limit for this group and window');
  }
  return Object.freeze({ schemaVersion, contentVersion, scenarioId: ai.id, windows: Object.freeze(windows),
    groups, hardwareOffers, memoryShock, limits: Object.freeze(limits) });
}

export type ComputeProcurement = ReturnType<typeof parseComputeProcurement>;

export function loadComputeProcurement() {
  return shipped ??= parseComputeProcurement(source);
}

let shipped: ComputeProcurement | undefined;
