/** Versioned request and response data shared by simulation hosts and their clients. */
export const simulationProtocolVersion = 1;

/** Fixed month length in virtual days for the first ruleset. */
export const daysPerMonth = 30;

/** Advance by a count, close through an inclusive date, or clear a resolved decision. */
export type CommandPayload =
  | { readonly type: 'advance'; readonly days: number }
  | { readonly type: 'advance-through'; readonly day: number }
  | { readonly type: 'resolve-alert'; readonly alertId: string };

/** The expected revision applies on first submission. Retries use the same command ID and payload. */
export interface SimulationCommand {
  readonly version: typeof simulationProtocolVersion;
  readonly type: 'command';
  readonly sessionId: string;
  readonly commandId: string;
  readonly expectedRevision: number;
  readonly payload: CommandPayload;
}

export interface ReadSimulation {
  readonly version: typeof simulationProtocolVersion;
  readonly type: 'read';
  readonly sessionId: string;
}

export type SimulationRequest = ReadSimulation | SimulationCommand;

/** An unresolved decision surfaced on the day it was generated. */
export interface DecisionAlert {
  readonly id: string;
  readonly code: string;
  readonly day: number;
}

/** Read model containing only serializable values. The open day follows the last closed day. */
export interface SimulationSnapshot {
  readonly sessionId: string;
  readonly openDay: number;
  readonly lastClosedDay: number;
  readonly revision: number;
  readonly randomState: number;
  readonly pendingAlerts: readonly DecisionAlert[];
}

/** Committed progress for an advance command, correlated with its receipt. */
export interface AdvanceProgress {
  readonly type: 'progress';
  readonly sessionId: string;
  readonly commandId: string;
  readonly revision: number;
  readonly requestedDays: number;
  readonly closedDays: number;
  readonly lastClosedDay: number;
  readonly stopReason: 'target-reached' | 'decision-required';
}

export type RejectionCode =
  | 'conflict'
  | 'stale-revision'
  | 'decision-required'
  | 'invalid-target'
  | 'alert-not-pending';

export type CommandOutcome =
  | {
      readonly status: 'accepted';
      readonly commandDay: number;
      readonly sequence: number;
      readonly progress: AdvanceProgress | null;
    }
  | { readonly status: 'rejected'; readonly code: RejectionCode };

interface ReplyEnvelope {
  readonly version: typeof simulationProtocolVersion;
}

export interface CommandResult extends ReplyEnvelope {
  readonly type: 'result';
  readonly sessionId: string;
  readonly commandId: string;
  readonly revision: number;
  readonly outcome: CommandOutcome;
}

export type SimulationReply =
  | CommandResult
  | (ReplyEnvelope & { readonly type: 'snapshot'; readonly snapshot: SimulationSnapshot })
  | (ReplyEnvelope & { readonly type: 'error'; readonly code: 'invalid-request' | 'session-mismatch' });

/** Host port used by a local worker or a server adapter. */
export interface SimulationHost {
  handle(request: unknown): SimulationReply;
}

export type {
  WorkerAck,
  WorkerCommandRequest,
  WorkerCommittedResult,
  WorkerErrorReply,
  WorkerHostReply,
  WorkerHostRequest,
  WorkerInitRequest,
  WorkerPreviewReply,
  WorkerPreviewRequest,
  WorkerProgress,
  WorkerReadRequest,
  WorkerSnapshotReply,
  WorkerTransport,
} from './worker';
