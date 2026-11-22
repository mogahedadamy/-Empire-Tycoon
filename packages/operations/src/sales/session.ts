/** Owns the headless company transaction boundary and checks revisions before committing writes. */
import { InventoryError } from '../inventory/types';
import { WorkforceError } from '../workforce/types';
import { findOffer, stageCommand } from './commands';
import { readDeliveryCapacity } from './fulfillment';
import {
  SalesError, type SalesErrorCode, type SalesReceipt, type SalesSessionCommand, type SalesSessionOptions,
  type SalesSnapshot,
} from './types';
import { integer, normalizeRequest } from './validation';

function reject(commandId: string, revision: number, code: SalesErrorCode): SalesReceipt {
  return Object.freeze({ status: 'rejected', commandId, revision, code });
}

function domainCode(error: unknown): SalesErrorCode {
  if (error instanceof SalesError || error instanceof InventoryError || error instanceof WorkforceError) {
    return error.code;
  }
  throw error;
}

/**
 * Owns contracts, inventory, the workforce, and the ledger of a single company.
 * Hosts submit against one authoritative snapshot. A successful submission commits all changes
 * together and advances its revision. Exact retries return the original receipt.
 */
export function createSalesSession(options: SalesSessionOptions) {
  const { inventory, workforce, ledger } = options;
  for (const state of [inventory, workforce]) {
    if (state.companyId !== ledger.companyId || state.currency !== ledger.currency) {
      throw new SalesError('scope-mismatch');
    }
  }
  const limits = {
    equipment: integer(options.dailyEquipment, 0),
    shipping: integer(options.dailyShipping, 0),
  };
  let current: SalesSnapshot = Object.freeze({
    revision: 0, day: Math.max(inventory.day, workforce.day), ledger, inventory, workforce,
    offers: Object.freeze([]), invoices: Object.freeze([]),
  });
  const receipts = new Map<string, { payload: string; receipt: SalesReceipt }>();

  function submit(input: SalesSessionCommand, expectedRevision: number): SalesReceipt {
    let request: SalesSessionCommand;
    try {
      request = normalizeRequest(input);
      integer(expectedRevision, 0);
    } catch (error) {
      const suppliedId = input?.command?.id;
      return reject(typeof suppliedId === 'string' ? suppliedId : '', current.revision, domainCode(error));
    }

    const { id, day } = request.command;
    const payload = JSON.stringify(request);
    const saved = receipts.get(id);
    if (saved) {
      return saved.payload === payload ? saved.receipt : reject(id, current.revision, 'conflict');
    }

    function execute(): SalesReceipt {
      if (expectedRevision !== current.revision) return reject(id, current.revision, 'stale-revision');
      if (day < current.day) return reject(id, current.revision, 'past-day');

      try {
        const result = stageCommand(current, request, limits);
        const revision = integer(current.revision + 1);
        const receipt: SalesReceipt = Object.freeze({
          status: 'accepted', commandId: id, revision, invoiceId: result.invoiceId,
        });
        current = Object.freeze({ ...current, ...result.changes, day, revision });
        return receipt;
      } catch (error) {
        return reject(id, current.revision, domainCode(error));
      }
    }

    const receipt = execute();
    receipts.set(id, { payload, receipt });
    return receipt;
  }

  return Object.freeze({
    snapshot: () => current,
    submit,
    /** Reads the remaining capacity today or on a future day without committing a reservation. */
    capacity(offerId: string, day: number) {
      integer(day, Math.max(current.day, 1));
      return readDeliveryCapacity(current, findOffer(current, offerId), day, limits);
    },
  });
}

export type SalesSession = ReturnType<typeof createSalesSession>;
