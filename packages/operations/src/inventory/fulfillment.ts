/** Moves ownership only on delivery and preserves other contracts' reserved quantities. */
import type { Ledger } from '../../../finance/src';
import { postStockCost } from './accounting';
import { allocateStock, cost, heldQuantity, inScope, movement, reduceReservations, updateLots } from './lots';
import { InventoryError, type InventoryCommand, type InventoryLot, type InventoryState } from './types';

type AllocationCommand = Extract<InventoryCommand, { type: 'reserve' | 'deliver' }>;

export function reserveStock(state: InventoryState, command: AllocationCommand) {
  const allocations = allocateStock(state, command, command.day, command.quantity);
  const changes = new Map<string, InventoryLot>();

  for (const { lot, quantity } of allocations) {
    const reservation = Object.freeze({ contractId: command.contractId, quantity });
    changes.set(lot.orderId, Object.freeze({
      ...lot, reservations: Object.freeze([...lot.reservations, reservation]),
    }));
  }

  return {
    lots: updateLots(state, changes),
    movements: allocations.map(({ lot, quantity }) =>
      movement(lot, command, 'reserved', quantity, { contractId: command.contractId })),
  };
}

export function releaseStock(
  state: InventoryState, command: Extract<InventoryCommand, { type: 'release' }>,
) {
  const movements = [];
  const changes = new Map<string, InventoryLot>();

  for (const lot of state.lots) {
    if (!inScope(lot, command)) continue;
    const released = heldQuantity(lot, command.contractId);
    if (released === 0) continue;

    changes.set(lot.orderId, Object.freeze({
      ...lot, reservations: reduceReservations(lot, command.contractId, released),
    }));
    movements.push(movement(lot, command, 'released', released, { contractId: command.contractId }));
  }

  if (changes.size === 0) throw new InventoryError('no-reservation');
  return { lots: updateLots(state, changes), movements };
}

export function deliverStock(state: InventoryState, ledger: Ledger, command: AllocationCommand) {
  const allocations = allocateStock(state, command, command.day, command.quantity, command.contractId);
  const total = allocations.reduce((sum, { lot, quantity }) => sum + cost(lot, quantity), 0n);
  const { ledger: nextLedger, journalEntryId } = postStockCost(ledger, command, total, 'costOfSales');
  const changes = new Map<string, InventoryLot>();

  for (const { lot, quantity } of allocations) {
    changes.set(lot.orderId, Object.freeze({
      ...lot, quantity: lot.quantity - quantity,
      reservations: reduceReservations(lot, command.contractId, quantity),
    }));
  }

  return {
    ledger: nextLedger,
    lots: updateLots(state, changes),
    movements: allocations.map(({ lot, quantity }) =>
      movement(lot, command, 'delivered', quantity, { contractId: command.contractId, journalEntryId })),
  };
}
