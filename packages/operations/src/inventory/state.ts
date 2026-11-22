/** Applies inventory commands atomically with the company ledger. */
import type { Ledger } from '../../../finance/src';
import { ageStock } from './aging';
import { deliverStock, releaseStock, reserveStock } from './fulfillment';
import { orderPurchase, receivePurchase } from './purchases';
import { InventoryError, type InventoryCommand, type InventoryState, type StockMovement } from './types';
import { normalizeCommand } from './validation';

export interface InventoryResult {
  readonly state: InventoryState;
  readonly ledger: Ledger;
  /** The movements created by the command, or the same movements on an exact retry. */
  readonly movements: readonly StockMovement[];
}

/** Starts an empty inventory for the company and currency of its ledger. */
export function createInventory(ledger: Ledger): InventoryState {
  return Object.freeze({
    companyId: ledger.companyId, currency: ledger.currency, day: 0, lastAgedDay: 0,
    orders: Object.freeze([]), lots: Object.freeze([]), movements: Object.freeze([]),
    commands: Object.freeze([]),
  });
}

function stage(state: InventoryState, ledger: Ledger, command: InventoryCommand) {
  switch (command.type) {
    case 'order':
      return { ledger, orders: orderPurchase(state, command), lots: state.lots, movements: [] };
    case 'receive':
      return receivePurchase(state, ledger, command);
    case 'reserve':
      return { ledger, orders: state.orders, ...reserveStock(state, command) };
    case 'release':
      return { ledger, orders: state.orders, ...releaseStock(state, command) };
    case 'deliver':
      return { orders: state.orders, ...deliverStock(state, ledger, command) };
    case 'age':
      return { orders: state.orders, ...ageStock(state, ledger, command) };
  }
}

/**
 * Applies one ordered command. Publish the returned state and ledger together.
 * Rejection leaves both inputs intact. Exact retries preserve current state and return original movements.
 * Run aging during day close; any catch-up loss is posted on the supplied accounting day.
 */
export function applyInventoryCommand(
  state: InventoryState, ledger: Ledger, input: InventoryCommand,
): InventoryResult {
  if (state.companyId !== ledger.companyId || state.currency !== ledger.currency) {
    throw new InventoryError('scope-mismatch');
  }

  const command = normalizeCommand(input);
  const prior = state.commands.find(({ id }) => id === command.id);
  if (prior) {
    if (JSON.stringify(prior) !== JSON.stringify(command)) throw new InventoryError('conflict');
    return {
      state, ledger,
      movements: Object.freeze(state.movements.filter(({ commandId }) => commandId === command.id)),
    };
  }
  if (command.day < state.day) throw new InventoryError('past-day');

  const next = stage(state, ledger, command);
  const movements = Object.freeze(next.movements);
  return {
    state: Object.freeze({
      ...state, day: command.day, lastAgedDay: command.type === 'age' ? command.day : state.lastAgedDay,
      orders: next.orders, lots: next.lots, movements: Object.freeze([...state.movements, ...movements]),
      commands: Object.freeze([...state.commands, command]),
    }),
    ledger: next.ledger,
    movements,
  };
}
