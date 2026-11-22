/** Headless Big Order session engine coordinating the simulation clock, operations, finance, and replay. */
import type { Scenario } from '../../../../packages/content/src';
import {
  simulationProtocolVersion as version,
  type AdvanceProgress, type SimulationSnapshot,
} from '../../../../packages/contracts/src';
import { readSalesCapacity } from '../../../../packages/operations/src';
import { createSimulationSession } from '../../../../packages/simulation/src';
import type { SaveProgress } from '../../../../packages/storage/src';
import { executeJourneyAction } from './actions';
import {
  createDailySchedule, createInitialDomain, dailyLimits, type JourneyDomainState,
} from './phases';
import { buildJourneyReadModel } from './reads';
import type {
  JourneyAction, JourneyCommandRecord, JourneyDeliveryPreview, JourneyErrorCode, JourneyOutcome,
} from './types';

function reject(
  commandId: string, revision: number, code: JourneyErrorCode, shortfallMinor?: string,
): JourneyOutcome {
  return Object.freeze({ status: 'rejected', commandId, revision, code, shortfallMinor });
}

function canonicalState(domain: JourneyDomainState, clock: SimulationSnapshot): string {
  return JSON.stringify({
    founded: domain.founded,
    fundingPlan: domain.fundingPlan,
    supplyOrdered: domain.supplyOrdered,
    restockChoice: domain.restockChoice,
    rescueLoanTaken: domain.rescueLoanTaken,
    failedPaymentId: domain.failedPaymentId,
    overdueNotified: domain.overdueNotified,
    pendingAlerts: clock.pendingAlerts,
    sales: domain.sales,
    treasury: domain.treasury,
    distress: domain.distress,
    decisions: domain.decisions,
  });
}

/**
 * Owns one single-player Big Order journey session.
 * Runs identically inside a Web Worker, headless Vitest suites, or save replay verification.
 */
export function createJourneyEngine(
  scenario: Scenario,
  saved?: SaveProgress<JourneyCommandRecord>,
  sessionId = `journey:${scenario.id}`,
) {
  let domain = createInitialDomain(scenario);
  let domainRevision = 0;
  const commands: JourneyCommandRecord[] = [];
  const receipts = new Map<string, { payload: string; outcome: JourneyOutcome }>();

  const clock = createSimulationSession({
    sessionId,
    seed: scenario.seed,
    prepareAdvance() {
      let draft = domain;
      return {
        schedule: createDailySchedule(scenario, () => draft, (next) => { draft = next; }),
        commit() { domain = draft; },
      };
    },
  });

  function readClock(): SimulationSnapshot {
    const reply = clock.handle({ version, type: 'read', sessionId });
    if (reply.type !== 'snapshot') throw new Error('Failed to read simulation clock');
    return reply.snapshot;
  }

  function revision(): number {
    return readClock().revision + domainRevision;
  }

  function openDay(): number {
    return Math.min(readClock().openDay, scenario.calendar.endDay);
  }

  function resolveClockAlerts(commandId: string, codes: readonly string[]) {
    const pending = readClock().pendingAlerts;
    for (const alert of pending) {
      if (!codes.includes(alert.code)) continue;
      clock.handle({
        version, type: 'command', sessionId,
        commandId: `${commandId}:resolve:${alert.id}`,
        expectedRevision: readClock().revision,
        payload: { type: 'resolve-alert', alertId: alert.id },
      });
    }
  }

  function validateAdvance(
    commandId: string, expectedRevision: number,
    action: Extract<JourneyAction, { type: 'advance' | 'advance-through' }>,
  ): { ok: true; requestedDays: number } | { ok: false; outcome: JourneyOutcome } {
    const rev = revision();
    if (expectedRevision !== rev) return { ok: false, outcome: reject(commandId, rev, 'stale-revision') };
    if (!domain.founded) return { ok: false, outcome: reject(commandId, rev, 'not-founded') };
    if (domain.distress?.stage === 'ended') return { ok: false, outcome: reject(commandId, rev, 'company-ended') };
    const snap = readClock();
    if (snap.pendingAlerts.length > 0) return { ok: false, outcome: reject(commandId, rev, 'decision-required') };
    const days = action.type === 'advance' ? action.days : action.day - snap.lastClosedDay;
    if (!Number.isSafeInteger(days) || days < 1 || snap.lastClosedDay + days > scenario.calendar.endDay) {
      return { ok: false, outcome: reject(commandId, rev, 'invalid-target') };
    }
    return { ok: true, requestedDays: days };
  }

  function stepOneDay(commandId: string, stepIndex: number, requestedDays: number, startClosedDay: number): AdvanceProgress {
    const snap = readClock();
    const reply = clock.handle({
      version, type: 'command', sessionId,
      commandId: `${commandId}:step:${stepIndex}`,
      expectedRevision: snap.revision,
      payload: { type: 'advance', days: 1 },
    });
    if (reply.type !== 'result' || reply.outcome.status !== 'accepted') {
      throw new Error('Unexpected clock rejection during stepped advance');
    }
    const nextSnap = readClock();
    return Object.freeze({
      type: 'progress',
      sessionId,
      commandId,
      revision: nextSnap.revision + domainRevision,
      requestedDays,
      closedDays: nextSnap.lastClosedDay - startClosedDay,
      lastClosedDay: nextSnap.lastClosedDay,
      stopReason: nextSnap.pendingAlerts.length > 0 ? 'decision-required' : 'target-reached',
    });
  }

  function lookupReceipt(record: JourneyCommandRecord): JourneyOutcome | null {
    const existing = receipts.get(record.commandId);
    if (!existing) return null;
    return existing.payload === JSON.stringify(record.action)
      ? existing.outcome
      : reject(record.commandId, revision(), 'conflict');
  }

  function recordOutcome(record: JourneyCommandRecord, outcome: JourneyOutcome, logCommand: boolean): JourneyOutcome {
    const owned = JSON.parse(JSON.stringify(record)) as JourneyCommandRecord;
    receipts.set(record.commandId, { payload: JSON.stringify(owned.action), outcome });
    if (logCommand) commands.push(owned);
    return outcome;
  }

  /** Submits any command synchronously; used by tests, single-step commands, and replay verification. */
  function submit(record: JourneyCommandRecord): JourneyOutcome {
    const prior = lookupReceipt(record);
    if (prior) return prior;
    const { commandId, expectedRevision, action } = record;

    if (action.type === 'advance' || action.type === 'advance-through') {
      const check = validateAdvance(commandId, expectedRevision, action);
      if (!check.ok) return recordOutcome(record, check.outcome, false);
      const startClosedDay = readClock().lastClosedDay;
      let progress: AdvanceProgress | null = null;
      for (let step = 1; step <= check.requestedDays; step += 1) {
        progress = stepOneDay(commandId, step, check.requestedDays, startClosedDay);
        if (progress.stopReason === 'decision-required') break;
      }
      const outcome: JourneyOutcome = Object.freeze({
        status: 'accepted', commandId, revision: revision(), progress,
      });
      return recordOutcome(record, outcome, true);
    }

    const rev = revision();
    if (expectedRevision !== rev) return recordOutcome(record, reject(commandId, rev, 'stale-revision'), false);

    if (action.type === 'resolve-alert') {
      const reply = clock.handle({
        version, type: 'command', sessionId, commandId: `${commandId}:clock`,
        expectedRevision: readClock().revision, payload: { type: 'resolve-alert', alertId: action.alertId },
      });
      if (reply.type !== 'result' || reply.outcome.status !== 'accepted') {
        return recordOutcome(record, reject(commandId, revision(), 'alert-not-pending'), false);
      }
      return recordOutcome(record, Object.freeze({ status: 'accepted', commandId, revision: revision() }), true);
    }

    const result = executeJourneyAction(domain, scenario, openDay(), commandId, action);
    if (!result.ok) {
      if (result.domain) {
        // Persist a recorded failed payment escalation so reopen reproduces the exact shortfall diagnosis.
        domain = result.domain;
        domainRevision += 1;
        return recordOutcome(record, reject(commandId, revision(), result.code, result.shortfallMinor), true);
      }
      return recordOutcome(record, reject(commandId, revision(), result.code, result.shortfallMinor), false);
    }

    domain = result.domain;
    domainRevision += 1;
    if (result.resolveCodes?.length) resolveClockAlerts(commandId, result.resolveCodes);
    return recordOutcome(record, Object.freeze({
      status: 'accepted', commandId, revision: revision(), invoiceId: result.invoiceId,
    }), true);
  }

  /** Runs a multi-day advance asynchronously, emitting lightweight per-day progress with no world copy. */
  async function runAdvanceAsync(
    record: JourneyCommandRecord,
    onProgress: (progress: AdvanceProgress) => Promise<void> | void,
  ): Promise<JourneyOutcome> {
    const prior = lookupReceipt(record);
    if (prior) return prior;
    const { commandId, expectedRevision, action } = record;
    if (action.type !== 'advance' && action.type !== 'advance-through') return submit(record);

    const check = validateAdvance(commandId, expectedRevision, action);
    if (!check.ok) return recordOutcome(record, check.outcome, false);

    const startClosedDay = readClock().lastClosedDay;
    let progress: AdvanceProgress | null = null;
    for (let step = 1; step <= check.requestedDays; step += 1) {
      progress = stepOneDay(commandId, step, check.requestedDays, startClosedDay);
      await onProgress(progress);
      if (progress.stopReason === 'decision-required') break;
    }
    const outcome: JourneyOutcome = Object.freeze({
      status: 'accepted', commandId, revision: revision(), progress,
    });
    return recordOutcome(record, outcome, true);
  }

  function read() {
    return buildJourneyReadModel(scenario, domain, readClock(), revision());
  }

  function previewDelivery(quantity: number): JourneyDeliveryPreview {
    const day = openDay();
    const rev = revision();
    const offer = domain.sales.offers.find(({ offerId }) => offerId === scenario.contract.id);
    if (!offer || offer.acceptedDay === null || offer.cancelledDay !== null) {
      return Object.freeze({
        day, revision: rev, quantity, max: 0, remaining: 0, priceMinor: scenario.contract.unitPriceMinor,
        amountMinor: '0', valid: false,
      });
    }
    const { available } = readSalesCapacity(domain.sales, offer.offerId, day, dailyLimits(scenario));
    const remaining = offer.quantity - offer.deliveredQuantity;
    const max = Number(available < BigInt(remaining) ? available : BigInt(remaining));
    const validQuantity = Number.isSafeInteger(quantity) && quantity >= 1;
    return Object.freeze({
      day, revision: rev, quantity, max, remaining,
      priceMinor: offer.unitPriceMinor,
      amountMinor: validQuantity ? (BigInt(offer.unitPriceMinor) * BigInt(quantity)).toString() : '0',
      valid: validQuantity && quantity <= max && day >= offer.deliveryStartsDay && day <= offer.deliveryDueDay,
    });
  }

  function capture(): SaveProgress<JourneyCommandRecord> {
    const snap = readClock();
    return {
      checkpoint: {
        revision: revision(),
        day: openDay(),
        randomState: snap.randomState,
        state: canonicalState(domain, snap),
      },
      commands: commands.map((entry) => JSON.parse(JSON.stringify(entry)) as JourneyCommandRecord),
    };
  }

  if (saved) {
    for (const entry of saved.commands) {
      if (revision() !== entry.expectedRevision) {
        throw new RangeError('The saved journey command log could not be replayed');
      }
      const prevRev = revision();
      submit(entry);
      if (revision() <= prevRev) {
        throw new RangeError('A saved journey command did not reproduce its revision');
      }
    }
    const actual = capture().checkpoint;
    const expected = saved.checkpoint;
    if (actual.day !== expected.day || actual.revision !== expected.revision ||
        actual.randomState !== expected.randomState || actual.state !== expected.state) {
      throw new RangeError('The saved journey checkpoint differs from replay');
    }
  }

  return Object.freeze({
    sessionId,
    scenario,
    revision,
    read,
    submit,
    runAdvanceAsync,
    previewDelivery,
    capture,
  });
}

export type JourneyEngine = ReturnType<typeof createJourneyEngine>;
