/** Versioned orders, bookings and one-hour work requests for the AI compute session. */
import type { ComputeProcurement } from '../../../content/src/ai';

export type ComputeGroup = ComputeProcurement['groups'][number];
export type OwnedGroup = Extract<ComputeGroup, { kind: 'owned' }>;
export type CloudGroup = Extract<ComputeGroup, { kind: 'cloud' }>;
export type ComputeWindow = ComputeProcurement['windows'][number];

export interface ComputeJob {
  readonly id: string;
  readonly kind: 'training' | 'evaluation' | 'service';
  readonly priority: number;
  readonly dueWindowId: string;
  readonly units: number;
  readonly memoryGiB: number;
  readonly interconnectGbps: number;
  readonly regionId?: string;
  readonly hardwareFamilyId?: string;
  readonly allowInterruptible: boolean;
}

export type ProcurementAction =
  | { readonly type: 'purchase-hardware'; readonly offerId: string; readonly groupId: string; readonly units: number; readonly day: number }
  | { readonly type: 'reserve-compute'; readonly groupId: string; readonly windowIds: readonly string[]; readonly units: number }
  | { readonly type: 'run-compute-window'; readonly windowId: string; readonly jobs: readonly ComputeJob[] };

export interface ProcurementCommand {
  readonly version: 1;
  readonly id: string;
  readonly expectedRevision: number;
  readonly action: ProcurementAction;
}

export interface ComputeReservation {
  readonly id: string;
  readonly groupId: string;
  readonly windowIds: readonly string[];
  readonly units: number;
  readonly totalMinor: string;
}

export type ProcurementRejection =
  | 'invalid-command' | 'command-conflict' | 'stale-revision' | 'unknown-offer' | 'unknown-group'
  | 'incompatible-hardware' | 'stock-limit' | 'rack-limit' | 'insufficient-cash'
  | 'invalid-window' | 'reservation-limit' | 'invalid-job' | 'job-already-executed';

export class ProcurementError extends Error {
  constructor(readonly code: ProcurementRejection) { super(code); }
}
