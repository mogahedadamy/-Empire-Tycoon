/** Validates and normalizes commands so retries can compare a stable payload. */
import { parseMinorUnits } from '../../../finance/src';
import { InventoryError, type InventoryCommand, type StockScope } from './types';

function identifier(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InventoryError('invalid-command');
  }
  return value;
}

function positiveInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new InventoryError('invalid-command');
  return value;
}

function scope(input: StockScope): StockScope {
  return { productId: identifier(input.productId), warehouseId: identifier(input.warehouseId) };
}

function unitCost(value: unknown): string {
  try {
    if (parseMinorUnits(value) > 0n) return value as string;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
  }
  throw new InventoryError('invalid-command');
}

export function normalizeCommand(input: InventoryCommand): InventoryCommand {
  if (!input || typeof input !== 'object') throw new InventoryError('invalid-command');
  const common = { id: identifier(input.id), day: positiveInteger(input.day) };

  switch (input.type) {
    case 'order': {
      const { payment } = input;
      const expectedDay = positiveInteger(input.expectedDay);
      const shelfLifeDays = positiveInteger(input.shelfLifeDays);
      if (
        expectedDay < common.day ||
        !Number.isSafeInteger(expectedDay + shelfLifeDays) ||
        (payment !== 'cash' && payment !== 'credit')
      ) throw new InventoryError('invalid-command');

      const spoilage = input.spoilage === undefined ? undefined : Object.freeze({
        startsAtAge: positiveInteger(input.spoilage?.startsAtAge),
        unitsPerDay: positiveInteger(input.spoilage?.unitsPerDay),
      });
      if (spoilage && spoilage.startsAtAge >= shelfLifeDays) {
        throw new InventoryError('invalid-command');
      }

      return Object.freeze({
        ...common, type: 'order', ...scope(input),
        orderId: identifier(input.orderId), supplierId: identifier(input.supplierId),
        quantity: positiveInteger(input.quantity), unitCostMinor: unitCost(input.unitCostMinor),
        expectedDay, shelfLifeDays, payment, spoilage,
      });
    }
    case 'receive':
      return Object.freeze({ ...common, type: 'receive', orderId: identifier(input.orderId) });
    case 'reserve':
    case 'deliver':
      return Object.freeze({
        ...common, type: input.type, ...scope(input),
        contractId: identifier(input.contractId), quantity: positiveInteger(input.quantity),
      });
    case 'release':
      return Object.freeze({
        ...common, type: 'release', ...scope(input), contractId: identifier(input.contractId),
      });
    case 'age':
      return Object.freeze({ ...common, type: 'age' });
    default:
      throw new InventoryError('invalid-command');
  }
}
