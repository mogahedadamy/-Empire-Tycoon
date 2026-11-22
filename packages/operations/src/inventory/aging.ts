/** Recognizes daily wear and expires stock at its original carrying cost. */
import type { Ledger } from '../../../finance/src';
import { postStockCost } from './accounting';
import { cost, heldQuantity, movement, updateLots } from './lots';
import {
  InventoryError, type InventoryCommand, type InventoryLot, type InventoryState,
  type PurchaseOrder, type Reservation, type StockMovement,
} from './types';

type AgingCommand = Extract<InventoryCommand, { type: 'age' }>;

function lossByDay(lot: InventoryLot, order: PurchaseOrder, day: number): number {
  if (day >= lot.expiresOnDay) return lot.quantity;
  if (!order.spoilage) return 0;

  const { startsAtAge, unitsPerDay } = order.spoilage;
  const affectedDays = day - lot.receivedDay - startsAtAge + 1;
  if (affectedDays <= 0) return 0;

  const loss = BigInt(affectedDays) * BigInt(unitsPerDay) - BigInt(lot.spoiledQuantity);
  return loss >= BigInt(lot.quantity) ? lot.quantity : Number(loss);
}

function afterLoss(
  lot: InventoryLot, lost: number, command: AgingCommand, movements: StockMovement[],
): InventoryLot {
  // Free units absorb losses first. If stock is reserved, preserve earlier allocations.
  let reservedLoss = Math.max(0, lost - (lot.quantity - heldQuantity(lot)));
  const reservations: Reservation[] = [];

  for (const hold of [...lot.reservations].reverse()) {
    const cut = Math.min(hold.quantity, reservedLoss);
    reservedLoss -= cut;
    if (cut > 0) {
      movements.push(movement(lot, command, 'released', cut, { contractId: hold.contractId }));
    }
    if (hold.quantity > cut) reservations.push(Object.freeze({ ...hold, quantity: hold.quantity - cut }));
  }

  return Object.freeze({
    ...lot, quantity: lot.quantity - lost, spoiledQuantity: lot.spoiledQuantity + lost,
    reservations: Object.freeze(reservations.reverse()),
  });
}

export function ageStock(state: InventoryState, ledger: Ledger, command: AgingCommand) {
  if (command.day <= state.lastAgedDay) throw new InventoryError('already-aged');

  const orders = new Map(state.orders.map((order) => [order.orderId, order]));
  const losses: { lot: InventoryLot; quantity: number }[] = [];
  let total = 0n;

  for (const lot of state.lots) {
    const order = orders.get(lot.orderId);
    if (!order) throw new InventoryError('unknown-order');

    const quantity = lossByDay(lot, order, command.day);
    if (quantity === 0) continue;

    total += cost(lot, quantity);
    losses.push({ lot, quantity });
  }

  if (total === 0n) return { ledger, lots: state.lots, movements: [] };
  const { ledger: nextLedger, journalEntryId } = postStockCost(ledger, command, total, 'inventorySpoilageExpense');
  const changes = new Map<string, InventoryLot>();
  const movements: StockMovement[] = [];

  for (const { lot, quantity } of losses) {
    changes.set(lot.orderId, afterLoss(lot, quantity, command, movements));
    movements.push(movement(lot, command, 'spoiled', quantity, { journalEntryId }));
  }

  return { ledger: nextLedger, lots: updateLots(state, changes), movements };
}
