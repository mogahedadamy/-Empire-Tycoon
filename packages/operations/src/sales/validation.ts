/** Validates and owns commercial payloads before idempotency and posting. */
import { parseMinorUnits } from '../../../finance/src';
import { normalizeCommand as normalizeInventory } from '../inventory/validation';
import { normalizeCommand as normalizeWorkforce } from '../workforce/validation';
import { SalesError, type SalesCommand, type SalesSessionCommand } from './types';

function text(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new SalesError('invalid-command');
  return value;
}

export function integer(value: unknown, minimum = 1): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new SalesError('invalid-command');
  }
  return value;
}

function price(value: unknown): string {
  try {
    if (parseMinorUnits(value) > 0n) return value as string;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
  }
  throw new SalesError('invalid-command');
}

function normalizeSales(input: SalesCommand): SalesCommand {
  const common = { id: text(input.id), day: integer(input.day) };
  switch (input.type) {
    case 'offer': {
      const offerExpiresDay = integer(input.offerExpiresDay);
      const deliveryStartsDay = integer(input.deliveryStartsDay);
      const deliveryDueDay = integer(input.deliveryDueDay);
      const paymentDueDay = integer(input.paymentDueDay);
      const earlyPaymentDiscountBps = integer(input.earlyPaymentDiscountBps, 0);
      if (offerExpiresDay < common.day || deliveryStartsDay <= offerExpiresDay ||
          deliveryDueDay < deliveryStartsDay || paymentDueDay < deliveryDueDay ||
          earlyPaymentDiscountBps >= 10000) throw new SalesError('invalid-command');

      return Object.freeze({
        ...common, type: 'offer', offerId: text(input.offerId), customerId: text(input.customerId),
        productId: text(input.productId), warehouseId: text(input.warehouseId),
        quantity: integer(input.quantity), unitPriceMinor: price(input.unitPriceMinor),
        offerExpiresDay, deliveryStartsDay, deliveryDueDay, paymentDueDay, earlyPaymentDiscountBps,
      });
    }
    case 'accept':
    case 'cancel':
      return Object.freeze({ ...common, type: input.type, offerId: text(input.offerId) });
    case 'reserve':
    case 'deliver':
      return Object.freeze({
        ...common, type: input.type, offerId: text(input.offerId), quantity: integer(input.quantity),
      });
    case 'collect':
      if (input.mode !== 'due' && input.mode !== 'early') throw new SalesError('invalid-command');
      return Object.freeze({ ...common, type: 'collect', invoiceId: text(input.invoiceId), mode: input.mode });
    default:
      throw new SalesError('invalid-command');
  }
}

export function normalizeRequest(input: SalesSessionCommand): SalesSessionCommand {
  if (!input || typeof input !== 'object' || !input.command || typeof input.command !== 'object') {
    throw new SalesError('invalid-command');
  }

  switch (input.domain) {
    case 'sales':
      return { domain: 'sales', command: normalizeSales(input.command) };
    case 'workforce':
      return { domain: 'workforce', command: normalizeWorkforce(input.command) };
    case 'inventory': {
      const command = normalizeInventory(input.command);
      if (command.type === 'order' || command.type === 'receive' || command.type === 'age') {
        return { domain: 'inventory', command };
      }
      throw new SalesError('invalid-command');
    }
    default:
      throw new SalesError('invalid-command');
  }
}
