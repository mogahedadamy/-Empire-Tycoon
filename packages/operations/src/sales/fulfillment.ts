/** Reserves stock and stages an accepted delivery and its invoice as one change. */
import { heldQuantity, inScope } from '../inventory/lots';
import { applyInventoryCommand } from '../inventory/state';
import { readOperatingCapacity } from '../workforce/capacity';
import { invoiceDelivery } from './receivables';
import { SalesError, type SalesCommand, type SalesOffer, type SalesSnapshot } from './types';

type Allocation = Extract<SalesCommand, { type: 'reserve' | 'deliver' }>;
type DailyLimits = { readonly equipment: number; readonly shipping: number };

export function reservedStock(snapshot: SalesSnapshot, offer: SalesOffer, day: number): bigint {
  return snapshot.inventory.lots.reduce((sum, lot) =>
    inScope(lot, offer) && day < lot.expiresOnDay ? sum + BigInt(heldQuantity(lot, offer.offerId)) : sum, 0n);
}

export function readDeliveryCapacity(snapshot: SalesSnapshot, offer: SalesOffer, day: number, limits: DailyLimits) {
  const materials = snapshot.inventory.lots.reduce((sum, lot) => {
    if (!inScope(lot, offer) || day >= lot.expiresOnDay) return sum;
    return sum + BigInt(lot.quantity - heldQuantity(lot) + heldQuantity(lot, offer.offerId));
  }, 0n);
  const used = snapshot.invoices.reduce((sum, invoice) =>
    invoice.issueDay === day ? sum + BigInt(invoice.quantity) : sum, 0n);
  const capacity = readOperatingCapacity(snapshot.workforce, { day, materials, ...limits });
  const nonnegative = (value: bigint) => value > 0n ? value : 0n;
  const remaining = {
    labor: nonnegative(capacity.limits.labor - used),
    materials,
    equipment: nonnegative(capacity.limits.equipment - used),
    shipping: nonnegative(capacity.limits.shipping - used),
  };
  const available = Object.values(remaining).reduce((a, b) => a < b ? a : b);
  return Object.freeze({
    available, used, limits: Object.freeze(remaining),
    limitingFactors: Object.freeze(Object.entries(remaining).filter(([, value]) => value === available)
      .map(([factor]) => factor)),
  });
}

function allocate(snapshot: SalesSnapshot, offer: SalesOffer, command: Allocation, quantity: number) {
  return applyInventoryCommand(snapshot.inventory, snapshot.ledger, {
    id: `sales-reserve:${command.id}`, type: 'reserve', day: command.day,
    contractId: offer.offerId, productId: offer.productId, warehouseId: offer.warehouseId, quantity,
  });
}

export function reserveContract(snapshot: SalesSnapshot, offer: SalesOffer, command: Allocation) {
  if (command.day > offer.deliveryDueDay) throw new SalesError('outside-delivery-window');
  const remaining = BigInt(offer.quantity - offer.deliveredQuantity);
  if (reservedStock(snapshot, offer, command.day) + BigInt(command.quantity) > remaining) {
    throw new SalesError('exceeds-contract');
  }
  const stock = allocate(snapshot, offer, command, command.quantity);
  return { inventory: stock.state };
}

export function deliverContract(snapshot: SalesSnapshot, offer: SalesOffer, command: Extract<SalesCommand, { type: 'deliver' }>, limits: DailyLimits) {
  if (command.day < offer.deliveryStartsDay || command.day > offer.deliveryDueDay) {
    throw new SalesError('outside-delivery-window');
  }

  const capacity = readDeliveryCapacity(snapshot, offer, command.day, limits);
  const quantity = BigInt(command.quantity);
  if (quantity > capacity.limits.materials) throw new SalesError('insufficient-stock');
  if (command.quantity > offer.quantity - offer.deliveredQuantity) throw new SalesError('exceeds-contract');
  if (quantity > capacity.available) throw new SalesError('capacity-exceeded');

  const needed = quantity - reservedStock(snapshot, offer, command.day);
  const inventory = needed > 0n ? allocate(snapshot, offer, command, Number(needed)).state : snapshot.inventory;
  const stock = applyInventoryCommand(inventory, snapshot.ledger, {
    id: `sales-deliver:${command.id}`, type: 'deliver', day: command.day,
    contractId: offer.offerId, productId: offer.productId, warehouseId: offer.warehouseId,
    quantity: command.quantity,
  });
  const stockEntryId = stock.movements[0]?.journalEntryId;
  if (!stockEntryId || stock.ledger === snapshot.ledger) throw new SalesError('journal-conflict');
  const sale = invoiceDelivery(stock.ledger, offer, command, stockEntryId);

  return {
    ledger: sale.ledger,
    invoice: sale.invoice,
    inventory: stock.state,
    offer: Object.freeze({ ...offer, deliveredQuantity: offer.deliveredQuantity + command.quantity }),
  };
}

export function cancelContract(snapshot: SalesSnapshot, offer: SalesOffer, command: SalesCommand) {
  const hasHolds = snapshot.inventory.lots.some((lot) => inScope(lot, offer) && heldQuantity(lot, offer.offerId) > 0);
  return hasHolds
    ? applyInventoryCommand(snapshot.inventory, snapshot.ledger, {
      id: `sales-release:${command.id}`, type: 'release', day: command.day,
      contractId: offer.offerId, productId: offer.productId, warehouseId: offer.warehouseId,
    }).state
    : snapshot.inventory;
}
