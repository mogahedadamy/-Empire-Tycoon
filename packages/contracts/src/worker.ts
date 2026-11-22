/** Versioned async host protocol for local Web Workers and headless message-port adapters. */
import type { AdvanceProgress, simulationProtocolVersion } from './index';

type Version = typeof simulationProtocolVersion;

/** Request to initialize or restore a session inside a worker host. */
export interface WorkerInitRequest<InitPayload> {
  readonly version: Version;
  readonly type: 'init';
  readonly sessionId: string;
  readonly requestId: string;
  readonly payload: InitPayload;
}

/** Request to execute one mutating command against an expected world revision. */
export interface WorkerCommandRequest<CommandPayload> {
  readonly version: Version;
  readonly type: 'command';
  readonly sessionId: string;
  readonly commandId: string;
  readonly expectedRevision: number;
  readonly payload: CommandPayload;
}

/** Request for a read-only preview that does not alter state or revision. */
export interface WorkerPreviewRequest<PreviewPayload> {
  readonly version: Version;
  readonly type: 'preview';
  readonly sessionId: string;
  readonly requestId: string;
  readonly payload: PreviewPayload;
}

/** Request for the latest committed read model. */
export interface WorkerReadRequest {
  readonly version: Version;
  readonly type: 'read';
  readonly sessionId: string;
  readonly requestId: string;
}

export type WorkerHostRequest<InitPayload, CommandPayload, PreviewPayload> =
  | WorkerInitRequest<InitPayload>
  | WorkerCommandRequest<CommandPayload>
  | WorkerPreviewRequest<PreviewPayload>
  | WorkerReadRequest;

/** Immediate acknowledgement sent before a command executes or iterates across days. */
export interface WorkerAck {
  readonly version: Version;
  readonly type: 'ack';
  readonly sessionId: string;
  readonly commandId: string;
  readonly expectedRevision: number;
  readonly requestedDays?: number;
}

/** Compact progress update for a multi-day advance; carries no world snapshot or ledger copy. */
export interface WorkerProgress extends AdvanceProgress {
  readonly version: Version;
}

/** Committed result emitted once a command settles, with the authoritative revision and read model. */
export interface WorkerCommittedResult<Outcome, ReadModel, SavePayload = unknown> {
  readonly version: Version;
  readonly type: 'result';
  readonly sessionId: string;
  readonly commandId: string;
  readonly revision: number;
  readonly outcome: Outcome;
  readonly readModel: ReadModel;
  readonly saveProgress?: SavePayload;
}

/** Read-only snapshot reply emitted for init and read requests. */
export interface WorkerSnapshotReply<ReadModel, SavePayload = unknown> {
  readonly version: Version;
  readonly type: 'snapshot';
  readonly sessionId: string;
  readonly requestId: string;
  readonly revision: number;
  readonly readModel: ReadModel;
  readonly saveProgress?: SavePayload;
}

/** Read-only preview reply emitted without advancing the world revision. */
export interface WorkerPreviewReply<PreviewResult> {
  readonly version: Version;
  readonly type: 'preview';
  readonly sessionId: string;
  readonly requestId: string;
  readonly revision: number;
  readonly preview: PreviewResult;
}

/** Structured host error for malformed or session-mismatched messages. */
export interface WorkerErrorReply {
  readonly version: Version;
  readonly type: 'error';
  readonly sessionId?: string;
  readonly requestId?: string;
  readonly commandId?: string;
  readonly code: 'invalid-request' | 'session-mismatch' | 'not-initialized' | 'host-error';
  readonly detail?: string;
}

export type WorkerHostReply<Outcome, ReadModel, PreviewResult, SavePayload = unknown> =
  | WorkerAck
  | WorkerProgress
  | WorkerCommittedResult<Outcome, ReadModel, SavePayload>
  | WorkerSnapshotReply<ReadModel, SavePayload>
  | WorkerPreviewReply<PreviewResult>
  | WorkerErrorReply;

/** Platform-neutral transport port matching browser Web Workers and in-memory test channels. */
export interface WorkerTransport {
  postMessage(message: unknown): void;
  onMessage(listener: (message: unknown) => void): () => void;
  terminate?(): void;
}
