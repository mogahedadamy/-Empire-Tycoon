/** Stock queries and deterministic FIFO allocation within a product and warehouse. */
import {
  InventoryError, type InventoryLot, type InventoryState, type Reservation,
  type StockMovement, type StockScope,
} from './types';

export interface LotAllocation {
  readonly lot: InventoryLot;
  readonly quantity: number;
}

export function heldQuantity(lot: InventoryLot, contractId?: string): number {
  return lot.reservations.reduce((total, hold) =>
    total + (contractId === undefined || hold.contractId === contractId ? hold.quantity : 0), 0);
}

export function cost(lot: InventoryLot, quantity: number): bigint {
  return BigInt(lot.unitCostMinor) * BigInt(quantity);
}

export function inScope(lot: InventoryLot, scope: StockScope): boolean {
  return lot.productId === scope.productId && lot.warehouseId === scope.warehouseId;
}

export function allocateStock(
  state: InventoryState, scope: StockScope, day: number, quantity: number, contractId?: string,
): LotAllocation[] {
  // Receipts append in day and command order, including ties within the same day.
  const candidates = state.lots.filter((lot) => inScope(lot, scope) && day < lot.expiresOnDay);
  const allocations: LotAllocation[] = [];
  let remaining = quantity;

  for (const lot of candidates) {
    const available = contractId === undefined ? lot.quantity - heldQuantity(lot) : heldQuantity(lot, contractId);
    const portion = Math.min(remaining, available);
    if (portion === 0) continue;

    allocations.push({ lot, quantity: portion });
    remaining -= portion;
    if (remaining === 0) return allocations;
  }

  throw new InventoryError('insufficient-stock');
}

export function updateLots(state: InventoryState, changes: ReadonlyMap<string, InventoryLot>) {
  return Object.freeze(state.lots.map((lot) => changes.get(lot.orderId) ?? lot));
}

export function reduceReservations(lot: InventoryLot, contractId: string, quantity: number) {
  const remaining: Reservation[] = [];

  for (const hold of lot.reservations) {
    const used = hold.contractId === contractId ? Math.min(hold.quantity, quantity) : 0;
    quantity -= used;
    if (used !== hold.quantity) {
      remaining.push(Object.freeze({ contractId: hold.contractId, quantity: hold.quantity - used }));
    }
  }

  return Object.freeze(remaining);
}

export function movement(
  lot: InventoryLot, command: { id: string; day: number },
  kind: StockMovement['kind'], quantity: number,
  links: Pick<StockMovement, 'contractId' | 'journalEntryId'> = {},
): StockMovement {
  return Object.freeze({
    kind, commandId: command.id, day: command.day, orderId: lot.orderId,
    quantity, costMinor: cost(lot, quantity).toString(), ...links,
  });
}

/** Reads physical on-hand, reserved, and fresh unreserved stock in one location. */
export function readInventory(state: InventoryState, scope: StockScope) {
  const lots = state.lots.filter((lot) => inScope(lot, scope));
  let quantity = 0n;
  let reserved = 0n;
  let available = 0n;
  let value = 0n;

  for (const lot of lots) {
    const held = heldQuantity(lot);
    quantity += BigInt(lot.quantity);
    reserved += BigInt(held);
    if (state.day < lot.expiresOnDay) available += BigInt(lot.quantity - held);
    value += cost(lot, lot.quantity);
  }

  return Object.freeze({ quantity, reserved, available, valueMinor: value.toString(), lots: Object.freeze(lots) });
}
