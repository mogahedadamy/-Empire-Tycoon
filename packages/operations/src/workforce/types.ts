/** Simulation inputs and immutable records for labor and payroll. */
export interface WorkforceRole {
  readonly id: string;
  readonly workers: number;
  readonly unitsPerWorkerPerShift: number;
  /** Fixed wage per worker for one scheduled payroll period, in minor units. */
  readonly wagePerWorkerMinor: string;
}

export interface PayrollSchedule {
  readonly id: string;
  readonly accrualDay: number;
  readonly dueDay: number;
}

export interface WorkforcePlan {
  readonly roles: readonly WorkforceRole[];
  readonly payroll: readonly PayrollSchedule[];
}

interface ShiftTerms {
  readonly shiftId: string;
  readonly roleId: string;
  readonly workDay: number;
  readonly workers: number;
}

export interface Shift extends ShiftTerms {
  readonly scheduledDay: number;
}

export interface Absence {
  readonly shiftId: string;
  readonly workers: number;
  readonly reason: string;
  readonly day: number;
  readonly commandId: string;
}

export interface PayrollRecord extends PayrollSchedule {
  readonly amountMinor: string;
  readonly accrualEntryId: string;
  readonly payment: { readonly day: number; readonly journalEntryId: string } | null;
}

export type WorkforceCommand = { readonly id: string; readonly day: number } & (
  | ({ readonly type: 'schedule-shift' } & ShiftTerms)
  | { readonly type: 'record-absence'; readonly shiftId: string; readonly workers: number; readonly reason: string }
  | { readonly type: 'accrue-payroll' | 'pay-payroll'; readonly payrollId: string }
);

export interface WorkforceState extends WorkforcePlan {
  readonly companyId: string;
  readonly currency: string;
  readonly day: number;
  readonly shifts: readonly Shift[];
  readonly absences: readonly Absence[];
  readonly payrollRecords: readonly PayrollRecord[];
  readonly commands: readonly WorkforceCommand[];
}

export type WorkforceErrorCode =
  | 'invalid-input' | 'scope-mismatch' | 'conflict' | 'past-day'
  | 'unknown-role' | 'unknown-shift' | 'invalid-attendance'
  | 'unknown-payroll' | 'wrong-accrual-day' | 'already-accrued'
  | 'payroll-not-accrued' | 'payroll-not-due' | 'already-paid'
  | 'insufficient-cash' | 'journal-conflict';

export class WorkforceError extends Error {
  constructor(readonly code: WorkforceErrorCode) {
    super(code);
    this.name = 'WorkforceError';
  }
}
