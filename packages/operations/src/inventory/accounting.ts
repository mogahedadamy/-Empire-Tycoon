/** Posts inventory events using the shared double-entry ledger. */
import { balanceSheet, type JournalLine, type Ledger } from '../../../finance/src';
import { InventoryError, type InventoryCommand, type PurchaseOrder } from './types';

export function postStockEntry(
  ledger: Ledger, command: InventoryCommand, lines: readonly JournalLine[],
) {
  const id = `inventory:${command.id}`;
  if (ledger.entries.some((entry) => entry.id === id)) throw new InventoryError('journal-conflict');

  return {
    ledger: ledger.post([{ id, sourceId: command.id, day: command.day, lines }]),
    journalEntryId: id,
  };
}

export function postReceipt(ledger: Ledger, command: InventoryCommand, order: PurchaseOrder) {
  const amount = (BigInt(order.unitCostMinor) * BigInt(order.quantity)).toString();
  if (order.payment === 'cash' && BigInt(balanceSheet(ledger, command.day).cash) < BigInt(amount)) {
    throw new InventoryError('insufficient-cash');
  }

  const payment: JournalLine = order.payment === 'cash'
    ? { account: 'cash', side: 'credit', amount, cashFlow: 'operating' }
    : { account: 'supplierPayables', side: 'credit', amount };

  return postStockEntry(ledger, command, [{ account: 'inventory', side: 'debit', amount }, payment]);
}

export function postStockCost(
  ledger: Ledger, command: InventoryCommand, cost: bigint, account: 'costOfSales' | 'inventorySpoilageExpense',
) {
  const amount = cost.toString();
  return postStockEntry(ledger, command, [
    { account, side: 'debit', amount },
    { account: 'inventory', side: 'credit', amount },
  ]);
}
