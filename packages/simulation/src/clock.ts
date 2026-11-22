/** Closes virtual days in economy order and produces authoritative clock snapshots. */
import { daysPerMonth, type DecisionAlert, type SimulationSnapshot } from '../../contracts/src';

export { daysPerMonth };
export const maxAdvanceDays = 360;

const dailyPhases = [
  'receipts-inventory',
  'production-delivery-invoicing',
  'collections-payments',
  'accruals',
  'market-alerts',
] as const;

export type ClosePhase = typeof dailyPhases[number] | 'month-end';

export interface CloseContext {
  readonly day: number;
  readonly phase: ClosePhase;
}

/** Trusted rule work for one phase. Rules must be deterministic and free of external effects. */
export interface PhaseWork {
  readonly id: string;
  readonly virtualTime: number;
  readonly sequence: number;
  /** Draws from the session's seeded stream. Return a decision alert to pause after day close. */
  run(nextRandomUint32: () => number): { readonly code: string } | void;
}

/** Supplies work due on a particular day and phase. Work IDs must be unique within the phase. */
export type PhaseSchedule = (context: CloseContext) => readonly PhaseWork[];

function compareWork(left: PhaseWork, right: PhaseWork): number {
  return left.virtualTime - right.virtualTime ||
    left.sequence - right.sequence ||
    (left.id < right.id ? -1 : Number(left.id > right.id));
}

/** Closes up to the requested days and stops at the first day with a decision. */
export function advanceClock(
  snapshot: SimulationSnapshot,
  days: number,
  schedule: PhaseSchedule,
): SimulationSnapshot {
  let randomState = snapshot.randomState;
  const alerts: DecisionAlert[] = [];
  let closedDay = snapshot.lastClosedDay;
  const targetDay = closedDay + days;

  function nextRandomUint32() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState;
  }

  function closePhase(day: number, phase: ClosePhase) {
    const work = [...schedule({ day, phase })].sort(compareWork);
    const ids = new Set<string>();
    for (const item of work) {
      if (ids.has(item.id)) throw new Error(`Duplicate work ID in ${phase}: ${item.id}`);
      ids.add(item.id);
      const alert = item.run(nextRandomUint32);
      if (alert) {
        alerts.push(Object.freeze({
          id: JSON.stringify([day, phase, item.id]),
          code: alert.code,
          day,
        }));
      }
    }
  }

  while (closedDay < targetDay && alerts.length === 0) {
    closedDay += 1;
    for (const phase of dailyPhases) closePhase(closedDay, phase);
    if (closedDay % daysPerMonth === 0) closePhase(closedDay, 'month-end');
  }

  return Object.freeze({
    sessionId: snapshot.sessionId,
    openDay: closedDay + 1,
    lastClosedDay: closedDay,
    revision: snapshot.revision + (closedDay - snapshot.lastClosedDay),
    randomState,
    pendingAlerts: Object.freeze(alerts),
  });
}
