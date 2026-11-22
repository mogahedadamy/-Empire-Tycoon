/** Owns and validates workforce configuration and command payloads. */
import { parseMinorUnits } from '../../../finance/src';
import { WorkforceError, type WorkforceCommand, type WorkforcePlan } from './types';

function invalid(): never {
  throw new WorkforceError('invalid-input');
}

function text(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) return invalid();
  return value;
}

export function positiveInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) return invalid();
  return value;
}

function wage(value: unknown): string {
  try {
    if (parseMinorUnits(value) > 0n) return value as string;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
  }
  return invalid();
}

function assertUnique(ids: string[]) {
  if (new Set(ids).size !== ids.length) invalid();
}

export function normalizePlan(plan: WorkforcePlan): WorkforcePlan {
  if (!plan || !Array.isArray(plan.roles) || !Array.isArray(plan.payroll) || plan.roles.length === 0) {
    return invalid();
  }

  const roles = Array.from(plan.roles, (item) => {
    if (!item) return invalid();
    return Object.freeze({
      id: text(item.id),
      workers: positiveInt(item.workers),
      unitsPerWorkerPerShift: positiveInt(item.unitsPerWorkerPerShift),
      wagePerWorkerMinor: wage(item.wagePerWorkerMinor),
    });
  });
  const payroll = Array.from(plan.payroll, (item) => {
    if (!item) return invalid();
    const accrualDay = positiveInt(item.accrualDay);
    const dueDay = positiveInt(item.dueDay);
    if (dueDay < accrualDay) return invalid();
    return Object.freeze({ id: text(item.id), accrualDay, dueDay });
  });
  assertUnique(roles.map(({ id }) => id));
  assertUnique(payroll.map(({ id }) => id));
  return { roles: Object.freeze(roles), payroll: Object.freeze(payroll) };
}

export function normalizeCommand(input: WorkforceCommand): WorkforceCommand {
  if (!input || typeof input !== 'object') return invalid();

  const common = { id: text(input.id), day: positiveInt(input.day) };
  switch (input.type) {
    case 'schedule-shift':
      return Object.freeze({
        ...common, type: input.type, shiftId: text(input.shiftId), roleId: text(input.roleId),
        workDay: positiveInt(input.workDay), workers: positiveInt(input.workers),
      });
    case 'record-absence':
      return Object.freeze({
        ...common, type: input.type, shiftId: text(input.shiftId),
        workers: positiveInt(input.workers), reason: text(input.reason),
      });
    case 'accrue-payroll':
    case 'pay-payroll':
      return Object.freeze({ ...common, type: input.type, payrollId: text(input.payrollId) });
    default:
      return invalid();
  }
}
