/** Plans whole-window work against compatible pools and reports conflicts without overbooking. */
import type { AiScenario, ComputeProcurement } from '../../../content/src/ai';
import type { WindowPool } from './capacity';
import { ProcurementError, type ComputeJob } from './types';

const compareId = (left: string, right: string) => left < right ? -1 : Number(left > right);
const validId = (value: unknown) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const count = (value: number, minimum = 0) => Number.isSafeInteger(value) && value >= minimum && value <= 1_000_000;

export function sortJobs(ai: AiScenario, content: ComputeProcurement, jobs: readonly ComputeJob[]) {
  const deadlines = new Map(content.windows.map(({ id }, index) => [id, index]));
  if (!Array.isArray(jobs)) throw new ProcurementError('invalid-job');
  const ids = new Set<string>();
  for (const job of jobs) {
    if (!job || !validId(job.id) || ids.has(job.id) || !['training', 'evaluation', 'service'].includes(job.kind) ||
        !count(job.priority) || !count(job.units, 1) || !count(job.memoryGiB) || !count(job.interconnectGbps) ||
        !deadlines.has(job.dueWindowId) || typeof job.allowInterruptible !== 'boolean' ||
        (job.regionId !== undefined && !ai.regions.some(({ id }) => id === job.regionId)) ||
        (job.hardwareFamilyId !== undefined && !ai.hardwareFamilies.some(({ id }) => id === job.hardwareFamilyId))) {
      throw new ProcurementError('invalid-job');
    }
    ids.add(job.id);
  }
  return [...jobs].sort((left, right) => right.priority - left.priority ||
    deadlines.get(left.dueWindowId)! - deadlines.get(right.dueWindowId)! || compareId(left.id, right.id));
}

type DeferredReason = 'no-compatible-group' | 'insufficient-memory' | 'insufficient-interconnect' | 'capacity-unavailable';

export type ComputeAssignment =
  | { readonly status: 'deferred'; readonly jobId: string; readonly reason: DeferredReason; readonly largestEligibleUnits: number }
  | { readonly status: 'allocated'; readonly jobId: string; readonly groupId: string;
      readonly ownedUnits: number; readonly reservedUnits: number; readonly interruptibleUnits: number };

function defer(job: ComputeJob, reason: DeferredReason, largestEligibleUnits = 0): ComputeAssignment {
  return Object.freeze({ status: 'deferred', jobId: job.id, reason, largestEligibleUnits });
}

export function allocateWindow(ai: AiScenario, pools: readonly WindowPool[], orderedJobs: readonly ComputeJob[]) {
  const hardware = new Map(ai.hardwareFamilies.map((family) => [family.id, family]));
  const available = pools.map((pool) => ({
    group: pool.group, owned: pool.ownedUnits, reserved: pool.reservedUnits, interruptible: pool.interruptibleUnits,
    family: hardware.get(pool.group.hardwareFamilyId)!,
  }));

  return Object.freeze(orderedJobs.map((job): ComputeAssignment => {
    const locations = available.filter(({ group }) => (!job.regionId || group.regionId === job.regionId) &&
      (!job.hardwareFamilyId || group.hardwareFamilyId === job.hardwareFamilyId));
    if (!locations.length) return defer(job, 'no-compatible-group');
    const sized = locations.filter(({ family }) => family.memoryGiB >= job.memoryGiB);
    if (!sized.length) return defer(job, 'insufficient-memory');
    const compatible = sized.filter(({ family }) => family.interconnectGbps >= job.interconnectGbps);
    if (!compatible.length) return defer(job, 'insufficient-interconnect');
    const total = (pool: typeof compatible[number]) => pool.owned + pool.reserved + (job.allowInterruptible ? pool.interruptible : 0);
    const pool = compatible.find(({ owned }) => owned >= job.units) ??
      compatible.find(({ reserved }) => reserved >= job.units) ?? compatible.find((candidate) => total(candidate) >= job.units);
    if (!pool) return defer(job, 'capacity-unavailable', compatible.reduce((max, candidate) => Math.max(max, total(candidate)), 0));

    const ownedUnits = Math.min(pool.owned, job.units);
    const reservedUnits = Math.min(pool.reserved, job.units - ownedUnits);
    const interruptibleUnits = job.units - ownedUnits - reservedUnits;
    pool.owned -= ownedUnits;
    pool.reserved -= reservedUnits;
    pool.interruptible -= interruptibleUnits;
    return Object.freeze({ status: 'allocated', jobId: job.id, groupId: pool.group.id, ownedUnits, reservedUnits, interruptibleUnits });
  }));
}

export function compareInterruption(planned: readonly ComputeAssignment[], actual: readonly ComputeAssignment[]) {
  return Object.freeze(planned.flatMap((before, index) => {
    const after = actual[index];
    if (before.status !== 'allocated') return [];
    if (after.status === 'allocated' && before.groupId === after.groupId &&
        before.interruptibleUnits === after.interruptibleUnits && before.reservedUnits === after.reservedUnits) return [];
    return [Object.freeze({ jobId: before.jobId, previousGroupId: before.groupId,
      reassignedGroupId: after.status === 'allocated' ? after.groupId : null })];
  }));
}
