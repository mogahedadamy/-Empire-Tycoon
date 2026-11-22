/** Public operations API for inventory, workforce and payroll. */
export { readInventory } from './inventory/lots';
export { applyInventoryCommand, createInventory } from './inventory/state';
export type { InventoryResult } from './inventory/state';
export { InventoryError } from './inventory/types';
export type {
  InventoryCommand, InventoryErrorCode, InventoryLot, InventoryState,
  PurchaseOrder, PurchaseTerms, Reservation, StockMovement, StockScope,
} from './inventory/types';

export { readOperatingCapacity } from './workforce/capacity';
export type { CapacityInput } from './workforce/capacity';
export { applyWorkforceCommand, createWorkforce } from './workforce/state';
export type { WorkforceResult } from './workforce/state';
export { WorkforceError } from './workforce/types';
export type {
  Absence, PayrollRecord, PayrollSchedule, Shift, WorkforceCommand, WorkforceErrorCode,
  WorkforcePlan, WorkforceRole, WorkforceState,
} from './workforce/types';
