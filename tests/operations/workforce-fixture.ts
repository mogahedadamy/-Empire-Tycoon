/** Shares the first scenario's payroll date and initial financial state across workforce tests. */
import { applyWorkforceCommand, createWorkforce, type WorkforceCommand } from '../../packages/operations/src';
import { openInventory, scenario } from './inventory-fixture';

export const roleId = 'handling';
export const payrollId = 'first-payroll';
export const dueDay = scenario.payroll.dueDay;
export const payrollAmount = scenario.payroll.amountMinor;
export const plan = {
  roles: [{ id: roleId, workers: 2, unitsPerWorkerPerShift: 25, wagePerWorkerMinor: '60000' }],
  payroll: [{ id: payrollId, accrualDay: dueDay - 1, dueDay }],
};
export const accrue = {
  id: 'accrue', day: dueDay - 1, type: 'accrue-payroll', payrollId,
} as const;
export const pay = { id: 'pay', day: dueDay, type: 'pay-payroll', payrollId } as const;

export function openWorkforce(funded = true, configuration = plan) {
  const { ledger } = openInventory(funded);
  return { state: createWorkforce(ledger, configuration), ledger };
}

export function apply(input: ReturnType<typeof openWorkforce>, command: WorkforceCommand) {
  return applyWorkforceCommand(input.state, input.ledger, command);
}
