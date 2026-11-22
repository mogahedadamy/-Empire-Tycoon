/** Records purchase terms and turns a purchase order into one valued lot on receipt. */
import type { Ledger } from '../../../finance/src';
import { postReceipt } from './accounting';
import { movement } from './lots';
import { InventoryError, type InventoryCommand, type InventoryLot, type InventoryState } from './types';

export function orderPurchase(state: InventoryState, command: Extract<InventoryCommand, { type: 'order' }>) {
  const { type: _type, id: _id, day, ...terms } = command;
  if (state.orders.some((order) => order.orderId === terms.orderId)) throw new InventoryError('conflict');

  const order = Object.freeze({ ...terms, orderedDay: day, receivedDay: null });
  return Object.freeze([...state.orders, order]);
}

export function receivePurchase(
  state: InventoryState, ledger: Ledger, command: Extract<InventoryCommand, { type: 'receive' }>,
) {
  const order = state.orders.find((item) => item.orderId === command.orderId);
  if (!order) throw new InventoryError('unknown-order');
  if (order.receivedDay !== null) throw new InventoryError('already-received');
  if (command.day < order.expectedDay) throw new InventoryError('receipt-too-early');

  const expiresOnDay = command.day + order.shelfLifeDays;
  if (!Number.isSafeInteger(expiresOnDay)) throw new InventoryError('invalid-command');

  const lot: InventoryLot = Object.freeze({
    orderId: order.orderId, productId: order.productId, warehouseId: order.warehouseId,
    receivedDay: command.day, expiresOnDay, quantity: order.quantity, unitCostMinor: order.unitCostMinor,
    spoiledQuantity: 0, reservations: Object.freeze([]),
  });
  const posting = postReceipt(ledger, command, order);
  const received = Object.freeze({ ...order, receivedDay: command.day });

  return {
    ledger: posting.ledger,
    orders: Object.freeze(state.orders.map((item) => item === order ? received : item)),
    lots: Object.freeze([...state.lots, lot]),
    movements: [movement(lot, command, 'received', lot.quantity, { journalEntryId: posting.journalEntryId })],
  };
}
