/** Pure sales-state transitions for hosts composing commercial operations with treasury on one ledger. */
import { findOffer, stageCommand } from './commands';
import { readDeliveryCapacity } from './fulfillment';
import {
  SalesError, type SalesSessionCommand, type SalesSessionOptions, type SalesSnapshot,
} from './types';
import { integer, normalizeRequest } from './validation';

export interface SalesDailyLimits {
  readonly equipment: number;
  readonly shipping: number;
}

export interface SalesTransition {
  readonly snapshot: SalesSnapshot;
  readonly invoiceId?: string;
}

/** Creates an initial commercial snapshot aligned to the supplied ledger, inventory, and workforce. */
export function createSalesState(options: SalesSessionOptions): SalesSnapshot {
  const { inventory, workforce, ledger } = options;
  for (const state of [inventory, workforce]) {
    if (state.companyId !== ledger.companyId || state.currency !== ledger.currency) {
      throw new SalesError('scope-mismatch');
    }
  }
  integer(options.dailyEquipment, 0);
  integer(options.dailyShipping, 0);
  return Object.freeze({
    revision: 0,
    day: Math.max(inventory.day, workforce.day),
    ledger,
    inventory,
    workforce,
    offers: Object.freeze([]),
    invoices: Object.freeze([]),
  });
}

/** Applies one validated commercial, inventory, or workforce command without mutating the input snapshot. */
export function applySalesCommand(
  snapshot: SalesSnapshot,
  input: SalesSessionCommand,
  limits: SalesDailyLimits,
): SalesTransition {
  const request = normalizeRequest(input);
  const { day } = request.command;
  if (day < snapshot.day) throw new SalesError('past-day');

  const checkedLimits = {
    equipment: integer(limits.equipment, 0),
    shipping: integer(limits.shipping, 0),
  };
  const result = stageCommand(snapshot, request, checkedLimits);
  const revision = integer(snapshot.revision + 1);
  return Object.freeze({
    snapshot: Object.freeze({ ...snapshot, ...result.changes, day, revision }),
    invoiceId: result.invoiceId,
  });
}

/** Reads remaining daily fulfillment capacity for an offer without reserving stock. */
export function readSalesCapacity(
  snapshot: SalesSnapshot,
  offerId: string,
  day: number,
  limits: SalesDailyLimits,
) {
  integer(day, Math.max(snapshot.day, 1));
  return readDeliveryCapacity(snapshot, findOffer(snapshot, offerId), day, {
    equipment: integer(limits.equipment, 0),
    shipping: integer(limits.shipping, 0),
  });
}
