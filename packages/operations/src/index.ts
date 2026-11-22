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
export { scheduledPayrollAmount } from './workforce/payroll';
export { applyWorkforceCommand, createWorkforce } from './workforce/state';
export type { WorkforceResult } from './workforce/state';
export { WorkforceError } from './workforce/types';
export type {
  Absence, PayrollRecord, PayrollSchedule, Shift, WorkforceCommand, WorkforceErrorCode,
  WorkforcePlan, WorkforceRole, WorkforceState,
} from './workforce/types';

export { createSalesSession } from './sales/session';
export type { SalesSession } from './sales/session';
export { readSalesStatus } from './sales/reads';
export { SalesError } from './sales/types';
export type {
  Invoice, SalesCommand, SalesErrorCode, SalesOffer, SalesReceipt, SalesSessionCommand,
  SalesSessionOptions, SalesSnapshot, SalesTerms,
} from './sales/types';
