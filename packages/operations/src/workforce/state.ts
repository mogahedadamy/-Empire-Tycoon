/** Commits labor commands and payroll with the owning company's ledger. */
import type { Ledger } from '../../../finance/src';
import { recordAbsence, scheduleShift } from './attendance';
import { accruePayroll, payPayroll } from './payroll';
import { WorkforceError, type WorkforceCommand, type WorkforcePlan, type WorkforceState } from './types';
import { normalizeCommand, normalizePlan } from './validation';

export interface WorkforceResult {
  readonly state: WorkforceState;
  readonly ledger: Ledger;
}

/** Opens a fixed-roster workforce with a validated shift and payroll configuration. */
export function createWorkforce(ledger: Ledger, plan: WorkforcePlan): WorkforceState {
  return Object.freeze({
    ...normalizePlan(plan),
    companyId: ledger.companyId,
    currency: ledger.currency,
    day: 0,
    shifts: Object.freeze([]),
    absences: Object.freeze([]),
    payrollRecords: Object.freeze([]),
    commands: Object.freeze([]),
  });
}

function stage(state: WorkforceState, ledger: Ledger, command: WorkforceCommand) {
  switch (command.type) {
    case 'schedule-shift':
      return { ledger, changes: { shifts: scheduleShift(state, command) } };
    case 'record-absence':
      return { ledger, changes: { absences: recordAbsence(state, command) } };
    case 'accrue-payroll': {
      const result = accruePayroll(state, ledger, command);
      return { ledger: result.ledger, changes: { payrollRecords: result.payrollRecords } };
    }
    case 'pay-payroll': {
      const result = payPayroll(state, ledger, command);
      return { ledger: result.ledger, changes: { payrollRecords: result.payrollRecords } };
    }
  }
}

/**
 * Applies a same-day or later command. Publish the returned state and ledger together.
 * Exact retries do not repost a journal entry. A rejected command leaves both inputs intact.
 */
export function applyWorkforceCommand(
  state: WorkforceState, ledger: Ledger, input: WorkforceCommand,
): WorkforceResult {
  if (state.companyId !== ledger.companyId || state.currency !== ledger.currency) {
    throw new WorkforceError('scope-mismatch');
  }

  const command = normalizeCommand(input);
  const prior = state.commands.find(({ id }) => id === command.id);
  if (prior) {
    if (JSON.stringify(prior) !== JSON.stringify(command)) throw new WorkforceError('conflict');
    return { state, ledger };
  }
  if (command.day < state.day) throw new WorkforceError('past-day');

  const next = stage(state, ledger, command);
  return {
    state: Object.freeze({
      ...state, ...next.changes,
      day: command.day, commands: Object.freeze([...state.commands, command]),
    }),
    ledger: next.ledger,
  };
}
