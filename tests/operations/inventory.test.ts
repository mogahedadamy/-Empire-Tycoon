/** Tests the business scenario through the public purchasing and inventory commands. */
import { expect, it } from 'vitest';
import { balanceSheet, incomeStatement } from '../../packages/finance/src';
import { readInventory } from '../../packages/operations/src';
import { apply, openInventory, order, receipt, scenario, scope } from './inventory-fixture';

it('receives the 100-box order for 4,000 and posts cash and stock exactly once', () => {
  const placed = apply(openInventory(), order);
  expect(placed.state.orders[0]).toMatchObject({
    orderId: order.orderId, supplierId: scenario.supplier.id, receivedDay: null, quantity: 100,
  });
  expect(placed.ledger.entries).toHaveLength(1);
  expect(() => apply(placed, { ...receipt, day: receipt.day - 1 })).toThrow('receipt-too-early');

  const received = apply(placed, receipt);
  expect(readInventory(received.state, scope)).toMatchObject({ quantity: 100n, valueMinor: '400000' });
  expect(balanceSheet(received.ledger, receipt.day)).toMatchObject({
    cash: '2600000',
    accounts: expect.arrayContaining([{ account: 'inventory', group: 'assets', amount: '400000' }]),
  });
  expect(received.movements).toEqual([{
    kind: 'received', commandId: receipt.id, day: receipt.day, orderId: receipt.orderId,
    quantity: 100, costMinor: '400000', journalEntryId: 'inventory:receive-order',
  }]);

  const exact = apply(received, receipt);
  expect(exact.state).toBe(received.state);
  expect(exact.ledger).toBe(received.ledger);
  expect(exact.movements).toEqual(received.movements);
  expect(() => apply(received, { ...receipt, day: receipt.day + 1 })).toThrow('conflict');
  expect(() => apply(received, { ...receipt, id: 'another-receipt' })).toThrow('already-received');
  expect(received.state.movements).toHaveLength(1);
});

it('reserves without posting cash or cost, then delivers 70 and keeps 30', () => {
  const received = apply(apply(openInventory(), order), receipt);
  const contractId = scenario.contract.id;
  const day = scenario.contract.deliveryDueDay;
  const hold = { ...scope, contractId, quantity: scenario.contract.quantity, day };
  const reserved = apply(received, { ...hold, type: 'reserve', id: 'reserve' });
  expect(reserved.ledger).toBe(received.ledger);
  expect(readInventory(reserved.state, scope)).toMatchObject({
    quantity: 100n, reserved: 70n, available: 30n, valueMinor: '400000',
  });
  expect(() => apply(reserved, { ...hold, type: 'reserve', id: 'oversell', contractId: 'other', quantity: 31 }))
    .toThrow('insufficient-stock');
  expect(() => apply(reserved, { ...hold, type: 'deliver', id: 'not-owner', contractId: 'other', quantity: 1 }))
    .toThrow('insufficient-stock');

  const delivered = apply(reserved, { ...hold, type: 'deliver', id: 'deliver' });
  expect(readInventory(delivered.state, scope)).toMatchObject({
    quantity: 30n, reserved: 0n, available: 30n, valueMinor: '120000',
  });
  expect(incomeStatement(delivered.ledger, { fromDay: day, throughDay: day }).costOfSales).toBe('280000');
  expect(delivered.movements[0]).toMatchObject({ kind: 'delivered', contractId, quantity: 70, costMinor: '280000' });
  const retry = apply(delivered, { ...hold, type: 'deliver', id: 'deliver' });
  expect(retry.state).toBe(delivered.state);
  expect(retry.ledger).toBe(delivered.ledger);
});

it('applies FIFO across suppliers at different costs in receipt order and keeps warehouses isolated', () => {
  const first = { ...order, orderId: 'z-first', quantity: 2, unitCostMinor: '100' };
  const second = { ...order, id: 'second', supplierId: 'other-supplier', orderId: 'a-second',
    quantity: 4, unitCostMinor: '300' };
  const third = { ...order, id: 'third', orderId: 'elsewhere', warehouseId: 'annex',
    quantity: 10, unitCostMinor: '500' };
  let current = openInventory();
  for (const document of [first, second, third]) current = apply(current, document);
  for (const document of [first, second, third]) {
    current = apply(current, { ...receipt, orderId: document.orderId, id: document.orderId });
  }
  const hold = { ...scope, contractId: 'contract', day: receipt.day };
  const reserved = apply(current, { ...hold, type: 'reserve', id: 'reserve', quantity: 5 });
  const partial = apply(reserved, { ...hold, type: 'deliver', id: 'partial', quantity: 3 });
  expect(partial.movements.map(({ orderId, quantity, costMinor }) => [orderId, quantity, costMinor]))
    .toEqual([['z-first', 2, '200'], ['a-second', 1, '300']]);

  const released = apply(partial, { ...hold, type: 'release', id: 'release-rest' });
  expect(readInventory(released.state, scope)).toMatchObject({
    quantity: 3n, reserved: 0n, available: 3n, valueMinor: '900',
  });
  expect(readInventory(released.state, third).quantity).toBe(10n);
  expect(released.ledger).toBe(partial.ledger);
});

it('keeps stock and ledger unchanged when cash or posting validation prevents receipt', () => {
  const placed = apply(openInventory(false), order);
  expect(() => apply(placed, receipt)).toThrow('insufficient-cash');
  expect(placed.state.orders[0].receivedDay).toBeNull();
  expect(placed.state.lots).toEqual([]);
  expect(placed.ledger.entries).toEqual([]);

  const funded = openInventory();
  const blockedLedger = funded.ledger.post([{
    id: 'inventory:receive-order', sourceId: 'collision', day: 1, lines: [
      { account: 'cash', side: 'debit', amount: '1', cashFlow: 'financing' },
      { account: 'contributedCapital', side: 'credit', amount: '1' },
    ],
  }]);
  const blocked = apply({ state: funded.state, ledger: blockedLedger }, order);
  expect(() => apply(blocked, receipt)).toThrow('journal-conflict');
  expect(readInventory(blocked.state, scope).quantity).toBe(0n);
  expect(blocked.state.orders[0].receivedDay).toBeNull();
  expect(blocked.ledger).toBe(blockedLedger);

  const credit = apply(apply(openInventory(false), { ...order, payment: 'credit' }), receipt);
  expect(balanceSheet(credit.ledger, receipt.day)).toMatchObject({
    cash: '0', assets: '400000', liabilities: '400000',
  });
});
