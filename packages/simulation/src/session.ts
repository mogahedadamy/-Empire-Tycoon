/** Owns one headless session and commits clock updates and idempotency receipts together. */
import {
  simulationProtocolVersion as version,
  type AdvanceProgress,
  type CommandResult,
  type RejectionCode,
  type SimulationCommand,
  type SimulationHost,
  type SimulationReply,
  type SimulationSnapshot,
} from '../../contracts/src';
import { advanceClock, maxAdvanceDays, type PhaseSchedule } from './clock';
import { isIdentifier, parseRequest } from './request';

export interface SessionOptions {
  readonly sessionId: string;
  /** Unsigned 32-bit seed. Zero is valid. */
  readonly seed: number;
  /** Use the same deterministic schedule and content for both live execution and replay. */
  readonly schedule?: PhaseSchedule;
  /** Stages transactional domain work separately for each accepted advance attempt. */
  readonly prepareAdvance?: () => StagedAdvance;
}

export interface StagedAdvance {
  readonly schedule: PhaseSchedule;
  /** Publishes a prepared immutable state after all scheduled work succeeds. Must not throw. */
  commit(): void;
}

export interface SimulationSession extends SimulationHost {
  /** Returns first submissions in order, including recorded rejections and excluding retries. */
  commandLog(): readonly SimulationCommand[];
}

interface Receipt {
  readonly command: SimulationCommand;
  readonly result: CommandResult;
}

function reject(command: SimulationCommand, revision: number, code: RejectionCode): CommandResult {
  return Object.freeze({
    version,
    type: 'result',
    sessionId: command.sessionId,
    commandId: command.commandId,
    revision,
    outcome: Object.freeze({ status: 'rejected', code }),
  });
}

/** Starts on day 1 at revision 0. Throws RangeError for an invalid session ID or seed. */
export function createSimulationSession(options: SessionOptions): SimulationSession {
  const { sessionId, seed, schedule = () => [], prepareAdvance } = options;
  if (!isIdentifier(sessionId) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Expected a session ID and an unsigned 32-bit seed');
  }

  let snapshot: SimulationSnapshot = Object.freeze({
    sessionId,
    openDay: 1,
    lastClosedDay: 0,
    revision: 0,
    randomState: seed >>> 0,
    pendingAlerts: Object.freeze([]),
  });
  let sequence = 0;
  const receipts = new Map<string, Receipt>();

  function accept(
    command: SimulationCommand,
    nextSnapshot: SimulationSnapshot,
    progress: AdvanceProgress | null,
  ): CommandResult {
    const result: CommandResult = Object.freeze({
      version,
      type: 'result',
      sessionId,
      commandId: command.commandId,
      revision: nextSnapshot.revision,
      outcome: Object.freeze({
        status: 'accepted',
        commandDay: snapshot.openDay,
        sequence: sequence + 1,
        progress,
      }),
    });
    snapshot = nextSnapshot;
    sequence += 1;
    return result;
  }

  function apply(command: SimulationCommand): CommandResult {
    const { payload } = command;
    if (command.expectedRevision !== snapshot.revision) {
      return reject(command, snapshot.revision, 'stale-revision');
    }

    if (payload.type === 'resolve-alert') {
      const pendingAlerts = snapshot.pendingAlerts.filter((alert) => alert.id !== payload.alertId);
      if (pendingAlerts.length === snapshot.pendingAlerts.length) {
        return reject(command, snapshot.revision, 'alert-not-pending');
      }

      return accept(command, Object.freeze({
        ...snapshot,
        revision: snapshot.revision + 1,
        pendingAlerts: Object.freeze(pendingAlerts),
      }), null);
    }

    if (snapshot.pendingAlerts.length > 0) {
      return reject(command, snapshot.revision, 'decision-required');
    }

    const days = payload.type === 'advance' ? payload.days : payload.day - snapshot.lastClosedDay;
    if (
      days < 1 ||
      days > maxAdvanceDays ||
      !Number.isSafeInteger(snapshot.openDay + days) ||
      !Number.isSafeInteger(snapshot.revision + days)
    ) {
      return reject(command, snapshot.revision, 'invalid-target');
    }

    const staged = prepareAdvance?.();
    const next = advanceClock(snapshot, days, staged
      ? (context) => [...schedule(context), ...staged.schedule(context)]
      : schedule);
    staged?.commit();
    return accept(command, next, Object.freeze({
      type: 'progress',
      sessionId,
      commandId: command.commandId,
      revision: next.revision,
      requestedDays: days,
      closedDays: next.lastClosedDay - snapshot.lastClosedDay,
      lastClosedDay: next.lastClosedDay,
      stopReason: next.pendingAlerts.length > 0 ? 'decision-required' : 'target-reached',
    }));
  }

  function handle(input: unknown): SimulationReply {
    const request = parseRequest(input);
    if (!request) return { version, type: 'error', code: 'invalid-request' };
    if (request.sessionId !== sessionId) return { version, type: 'error', code: 'session-mismatch' };
    if (request.type === 'read') return { version, type: 'snapshot', snapshot };

    const existing = receipts.get(request.commandId);
    if (existing) {
      return JSON.stringify(existing.command.payload) === JSON.stringify(request.payload)
        ? existing.result
        : reject(request, snapshot.revision, 'conflict');
    }

    // Rule exceptions leave both the snapshot and the receipt table untouched.
    const result = apply(request);
    receipts.set(request.commandId, { command: request, result });
    return result;
  }

  return {
    handle,
    commandLog: () => Array.from(receipts.values(), ({ command }) => command),
  };
}

/** Rebuilds a session by submitting its recorded commands against the original seed and schedule. */
export function replaySimulation(
  options: SessionOptions,
  commands: readonly SimulationCommand[],
): SimulationSession {
  const session = createSimulationSession(options);
  for (const command of commands) {
    const reply = session.handle(command);
    if (reply.type === 'error') throw new Error(`Invalid command log: ${reply.code}`);
  }
  return session;
}
