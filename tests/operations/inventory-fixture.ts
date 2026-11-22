/** Builds a funded headless stock state and purchase terms from the shipped scenario. */
import { loadScenario } from '../../packages/content/src';
import { Ledger } from '../../packages/finance/src';
import { applyInventoryCommand, createInventory, type InventoryCommand, type InventoryState } from '../../packages/operations/src';

export const scenario = loadScenario('big-order');
export const scope = { productId: scenario.product.id, warehouseId: 'warehouse' };
export const order = {
  type: 'order', id: 'place-order', day: 1, orderId: 'produce-order',
  supplierId: scenario.supplier.id, ...scope, quantity: scenario.supply.quantity,
  unitCostMinor: scenario.supply.unitCostMinor, expectedDay: scenario.supply.arrivalDay,
  shelfLifeDays: scenario.product.shelfLifeDays, payment: 'cash',
} as const;
export const receipt = {
  type: 'receive', id: 'receive-order', day: order.expectedDay, orderId: order.orderId,
} as const;

export function openInventory(funded = true) {
  let ledger = Ledger.open({ companyId: scenario.company.id, currency: scenario.currency });
  if (funded) {
    const amount = scenario.opening.capitalMinor;
    ledger = ledger.post([{ id: 'capital', sourceId: 'founder', day: 1, lines: [
      { account: 'cash', side: 'debit', amount, cashFlow: 'financing' },
      { account: 'contributedCapital', side: 'credit', amount },
    ] }]);
  }

  return { state: createInventory(ledger), ledger };
}

export function apply(input: { state: InventoryState; ledger: Ledger }, command: InventoryCommand) {
  return applyInventoryCommand(input.state, input.ledger, command);
}
