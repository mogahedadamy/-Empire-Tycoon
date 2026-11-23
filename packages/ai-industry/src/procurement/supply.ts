/** Forecasts seeded supplier disruptions and the arrival and installation of purchased accelerators. */
import type { AiScenario, ComputeProcurement } from '../../../content/src/ai';
import { simulationProtocolVersion } from '../../../contracts/src';
import { createSimulationSession } from '../../../simulation/src';
import { ProcurementError, type OwnedGroup } from './types';

export type MemoryShock = ComputeProcurement['memoryShock'] & { readonly active: boolean; readonly randomState: number };

export function selectMemoryShock(content: ComputeProcurement, seed: number): MemoryShock {
  const terms = content.memoryShock;
  const sessionId = 'compute-supply';
  let bucket = 0;
  const clock = createSimulationSession({ sessionId, seed, schedule: ({ day, phase }) =>
    day === terms.fromDay && phase === 'receipts-inventory' ? [{
      id: 'memory-source', virtualTime: 0, sequence: 0,
      run(draw) { bucket = draw(); },
    }] : [] });
  const reply = clock.handle({
    version: simulationProtocolVersion, type: 'command', sessionId, commandId: 'draw-memory-event',
    expectedRevision: 0, payload: { type: 'advance', days: terms.fromDay },
  });
  if (reply.type !== 'result' || reply.outcome.status !== 'accepted') throw new Error('Unable to draw memory event');
  const rollBps = Math.floor((bucket * 10_000) / 2 ** 32);
  return Object.freeze({ ...terms, active: rollBps < terms.probabilityBps, randomState: bucket });
}

export interface HardwarePurchase {
  readonly id: string;
  readonly offerId: string;
  readonly supplierId: string;
  readonly groupId: string;
  readonly units: number;
  readonly costMinor: string;
  readonly orderedDay: number;
  readonly originalArrivalDay: number;
  readonly arrivalDay: number;
  readonly installedDay: number;
  readonly delay: { readonly sourceId: string; readonly days: number } | null;
}

export function forecastPurchase(
  ai: AiScenario, content: ComputeProcurement, shock: MemoryShock, purchases: readonly HardwarePurchase[],
  order: { readonly offerId: string; readonly groupId: string; readonly units: number; readonly day: number },
) {
  const { offerId, groupId, units, day } = order;
  const offer = content.hardwareOffers.find(({ id }) => id === offerId);
  const site = content.groups.find((group): group is OwnedGroup => group.id === groupId && group.kind === 'owned');
  if (!offer) throw new ProcurementError('unknown-offer');
  if (!site) throw new ProcurementError('unknown-group');
  if (offer.hardwareFamilyId !== site.hardwareFamilyId) throw new ProcurementError('incompatible-hardware');
  if (!Number.isSafeInteger(units) || units < 1 || !Number.isSafeInteger(day) || day < 1 || day > 360) {
    throw new ProcurementError('invalid-command');
  }
  const orderedFromOffer = purchases.filter((purchase) => purchase.offerId === offerId).reduce((sum, purchase) => sum + purchase.units, 0);
  if (units > offer.units - orderedFromOffer) throw new ProcurementError('stock-limit');
  const boundToSite = purchases.filter((purchase) => purchase.groupId === groupId).reduce((sum, purchase) => sum + purchase.units, 0);
  if (units > site.rackUnits - boundToSite) throw new ProcurementError('rack-limit');

  const supplier = ai.suppliers.find(({ id }) => id === offer.supplierId)!;
  const originalArrivalDay = day + offer.leadDays;
  const delay = shock.active && supplier.memorySourceId === shock.sourceId &&
    originalArrivalDay >= shock.fromDay && originalArrivalDay <= shock.throughDay
    ? Object.freeze({ sourceId: shock.sourceId, days: shock.delayDays }) : null;
  const arrivalDay = originalArrivalDay + (delay?.days ?? 0);
  return Object.freeze({
    offerId, groupId, supplierId: supplier.id, units, orderedDay: day, originalArrivalDay, arrivalDay, delay,
    installedDay: arrivalDay + site.installationDays,
    costMinor: (BigInt(offer.unitPriceMinor) * BigInt(units)).toString(),
  });
}
