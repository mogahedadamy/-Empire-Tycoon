/** Inventory documents, commands, and auditable stock movements for one company. */
export interface StockScope {
  readonly productId: string;
  readonly warehouseId: string;
}

export interface PurchaseTerms extends StockScope {
  readonly orderId: string;
  readonly supplierId: string;
  readonly quantity: number;
  readonly unitCostMinor: string;
  readonly expectedDay: number;
  readonly shelfLifeDays: number;
  readonly payment: 'cash' | 'credit';
  /** Optional wear in whole units per day, starting at the specified age after receipt. */
  readonly spoilage?: { readonly startsAtAge: number; readonly unitsPerDay: number };
}

export interface PurchaseOrder extends PurchaseTerms {
  readonly orderedDay: number;
  readonly receivedDay: number | null;
}

export type InventoryCommand = { readonly id: string; readonly day: number } & (
  | ({ readonly type: 'order' } & PurchaseTerms)
  | { readonly type: 'receive'; readonly orderId: string }
  | ({ readonly type: 'reserve' | 'deliver'; readonly contractId: string; readonly quantity: number } & StockScope)
  | ({ readonly type: 'release'; readonly contractId: string } & StockScope)
  | { readonly type: 'age' }
);

export interface Reservation {
  readonly contractId: string;
  readonly quantity: number;
}

export interface InventoryLot extends StockScope {
  readonly orderId: string;
  readonly receivedDay: number;
  /** The first day on which this lot cannot be reserved or delivered. */
  readonly expiresOnDay: number;
  readonly unitCostMinor: string;
  readonly quantity: number;
  readonly spoiledQuantity: number;
  readonly reservations: readonly Reservation[];
}

export interface StockMovement {
  readonly kind: 'received' | 'reserved' | 'released' | 'delivered' | 'spoiled';
  readonly commandId: string;
  readonly day: number;
  readonly orderId: string;
  readonly quantity: number;
  /** Valuation at the cost of this lot, in an exact decimal string of minor units. */
  readonly costMinor: string;
  readonly contractId?: string;
  readonly journalEntryId?: string;
}

export interface InventoryState {
  readonly companyId: string;
  readonly currency: string;
  readonly day: number;
  readonly lastAgedDay: number;
  readonly orders: readonly PurchaseOrder[];
  readonly lots: readonly InventoryLot[];
  readonly movements: readonly StockMovement[];
  readonly commands: readonly InventoryCommand[];
}

export type InventoryErrorCode =
  | 'invalid-command' | 'scope-mismatch' | 'conflict' | 'past-day' | 'already-aged'
  | 'unknown-order' | 'already-received' | 'receipt-too-early'
  | 'insufficient-cash' | 'insufficient-stock' | 'no-reservation' | 'journal-conflict';

export class InventoryError extends Error {
  constructor(readonly code: InventoryErrorCode) {
    super(code);
    this.name = 'InventoryError';
  }
}
