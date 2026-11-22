/** Public operations API for purchase orders and the company stock ledger. */
export { readInventory } from './inventory/lots';
export { applyInventoryCommand, createInventory } from './inventory/state';
export type { InventoryResult } from './inventory/state';
export { InventoryError } from './inventory/types';
export type {
  InventoryCommand, InventoryErrorCode, InventoryLot, InventoryState,
  PurchaseOrder, PurchaseTerms, Reservation, StockMovement, StockScope,
} from './inventory/types';
