/** Plans roster shifts and tracks documented absences within scheduled staffing. */
import { WorkforceError, type WorkforceCommand, type WorkforceState } from './types';

type ScheduleCommand = Extract<WorkforceCommand, { type: 'schedule-shift' }>;
type AbsenceCommand = Extract<WorkforceCommand, { type: 'record-absence' }>;

export function absentWorkers(state: WorkforceState, shiftId: string): number {
  return state.absences.reduce((sum, item) => sum + (item.shiftId === shiftId ? item.workers : 0), 0);
}

export function scheduleShift(state: WorkforceState, command: ScheduleCommand) {
  const { shiftId, roleId, workDay, workers, day } = command;
  const role = state.roles.find(({ id }) => id === roleId);
  if (!role) throw new WorkforceError('unknown-role');
  if (state.shifts.some((shift) => shift.shiftId === shiftId)) throw new WorkforceError('conflict');
  if (workDay < day || workers > role.workers) throw new WorkforceError('invalid-attendance');

  const shift = Object.freeze({ shiftId, roleId, workDay, workers, scheduledDay: day });
  return Object.freeze([...state.shifts, shift]);
}

export function recordAbsence(state: WorkforceState, command: AbsenceCommand) {
  const { shiftId, workers, day, reason } = command;
  const shift = state.shifts.find((item) => item.shiftId === shiftId);
  if (!shift) throw new WorkforceError('unknown-shift');
  if (day > shift.workDay || workers > shift.workers - absentWorkers(state, shiftId)) {
    throw new WorkforceError('invalid-attendance');
  }

  const absence = Object.freeze({ shiftId, workers, day, reason, commandId: command.id });
  return Object.freeze([...state.absences, absence]);
}
