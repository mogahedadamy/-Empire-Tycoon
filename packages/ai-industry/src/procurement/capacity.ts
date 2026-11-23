/** Calculates physical capacity and splits each cloud pool between bookings and interruptible work. */
import type { ComputeProcurement } from '../../../content/src/ai';
import type { HardwarePurchase } from './supply';
import type { ComputeGroup, ComputeReservation, ComputeWindow, OwnedGroup } from './types';

export function ownedWindowCapacity(group: OwnedGroup, installed: number, coolingUnits = group.coolingUnits) {
  const itWatts = Math.floor(group.sitePowerWatts * 10_000 / group.pueBps);
  const electricUnits = Math.max(0, Math.floor((itWatts - group.fixedItWatts) / group.acceleratorWatts));
  const limits = Object.freeze({
    installed, electricity: electricUnits, network: group.networkUnits, cooling: coolingUnits,
  });
  const availableUnits = Math.min(...Object.values(limits));
  const limitingFactors = Object.freeze(Object.entries(limits).filter(([, cap]) => cap === availableUnits).map(([cap]) => cap));
  return Object.freeze({ availableUnits, limits, limitingFactors });
}

export interface WindowPool {
  readonly group: ComputeGroup;
  readonly availableUnits: number;
  readonly bookedUnits: number;
  readonly reservedUnits: number;
  readonly interruptibleUnits: number;
  readonly ownedUnits: number;
  readonly site: ReturnType<typeof ownedWindowCapacity> | null;
}

/** Each group is one physical pool, including both cloud products from the same provider. */
export function windowPools(
  content: ComputeProcurement, window: ComputeWindow, purchases: readonly HardwarePurchase[],
  reservations: readonly ComputeReservation[], includeInterruptions: boolean,
): readonly WindowPool[] {
  const groups = [...content.groups].sort((left, right) => left.id < right.id ? -1 : Number(left.id > right.id));
  return groups.map((group) => {
    const limit = content.limits.find(({ groupId, windowId }) => groupId === group.id && windowId === window.id)?.units;
    if (group.kind === 'owned') {
      const installed = purchases.filter(({ groupId, installedDay }) => groupId === group.id && installedDay <= window.day)
        .reduce((sum, { units }) => sum + units, 0);
      const site = ownedWindowCapacity(group, installed, limit);
      return Object.freeze({ group, availableUnits: site.availableUnits, ownedUnits: site.availableUnits,
        bookedUnits: 0, reservedUnits: 0, interruptibleUnits: 0, site });
    }
    const bookedUnits = reservations.filter(({ groupId, windowIds }) => groupId === group.id && windowIds.includes(window.id))
      .reduce((sum, { units }) => sum + units, 0);
    const availableUnits = includeInterruptions ? limit ?? group.units : group.units;
    const reservedUnits = Math.min(availableUnits, bookedUnits);
    return Object.freeze({ group, availableUnits, bookedUnits, reservedUnits,
      interruptibleUnits: availableUnits - reservedUnits, ownedUnits: 0, site: null });
  });
}
