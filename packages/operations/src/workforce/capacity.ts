/** Calculates the day-specific operating bottlenecks for the requesting domain. */
import { WorkforceError, type WorkforceState } from './types';
import { positiveInt } from './validation';

export interface CapacityInput {
  readonly day: number;
  readonly materials: number | bigint;
  readonly equipment: number | bigint;
  readonly shipping: number | bigint;
}

type CapacityLimit = 'labor' | 'materials' | 'equipment' | 'shipping';

function units(value: number | bigint): bigint {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  throw new WorkforceError('invalid-input');
}

/** Returns effective capacity, every tied bottleneck, and the labor lost to recorded absence. */
export function readOperatingCapacity(state: WorkforceState, input: CapacityInput) {
  const day = positiveInt(input.day);
  const roles = new Map(state.roles.map((role) => [role.id, role]));
  const absences = new Map<string, number>();
  for (const absence of state.absences) {
    absences.set(absence.shiftId, (absences.get(absence.shiftId) ?? 0) + absence.workers);
  }

  let plannedLabor = 0n;
  let labor = 0n;
  for (const shift of state.shifts) {
    if (shift.workDay !== day) continue;
    const role = roles.get(shift.roleId);
    if (!role) throw new WorkforceError('unknown-role');

    const rate = BigInt(role.unitsPerWorkerPerShift);
    plannedLabor += BigInt(shift.workers) * rate;
    labor += BigInt(shift.workers - (absences.get(shift.shiftId) ?? 0)) * rate;
  }

  const limits: Record<CapacityLimit, bigint> = {
    labor, materials: units(input.materials), equipment: units(input.equipment), shipping: units(input.shipping),
  };
  const keys = Object.keys(limits) as CapacityLimit[];
  const available = keys.reduce((lowest, key) => limits[key] < lowest ? limits[key] : lowest, labor);
  return Object.freeze({
    day, plannedLabor, absenceLoss: plannedLabor - labor, limits: Object.freeze(limits), available,
    limitingFactors: Object.freeze(keys.filter((key) => limits[key] === available)),
  });
}
