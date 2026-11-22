/** Drives the ET-004 terms, ET-006 receipt, and ET-007 shifts through one company session. */
import { expect } from 'vitest';
import {
  createSalesSession, createWorkforce, type SalesCommand, type SalesSession, type SalesSessionCommand,
} from '../../packages/operations/src';
import { openInventory, order, receipt, scenario, scope } from './inventory-fixture';
import { plan, roleId } from './workforce-fixture';

export const contract = scenario.contract;
export const offer = {
  ...contract,
  ...scope,
  id: 'publish',
  offerId: contract.id,
  day: scenario.calendar.startDay,
  type: 'offer',
} as const;
export const accept = { id: 'accept', day: offer.day, type: 'accept', offerId: offer.offerId } as const;
export const deliver = {
  id: 'deliver', day: contract.deliveryStartsDay, type: 'deliver', offerId: offer.offerId, quantity: 50,
} as const;

export function setupSales(collidingSaleId?: string) {
  const { state, ledger } = openInventory();
  const openingLedger = collidingSaleId === undefined ? ledger : ledger.post([{
    id: `sales:${collidingSaleId}`, sourceId: 'other-sale', day: 1, lines: [
      { account: 'receivables', side: 'debit', amount: '10' },
      { account: 'sales', side: 'credit', amount: '10' },
    ],
  }]);
  return createSalesSession({
    inventory: state, workforce: createWorkforce(openingLedger, plan), ledger: openingLedger,
    dailyEquipment: 120, dailyShipping: 120,
  });
}

export function submit(session: SalesSession, command: SalesSessionCommand) {
  const receipt = session.submit(command, session.snapshot().revision);
  expect(receipt.status === 'accepted', JSON.stringify(receipt)).toBe(true);
  if (receipt.status === 'rejected') throw new Error(receipt.code);
  return receipt;
}

export function sale(session: SalesSession, command: SalesCommand) {
  return session.submit({ domain: 'sales', command }, session.snapshot().revision);
}

export function addShift(session: SalesSession, id: string, day: number) {
  submit(session, { domain: 'workforce', command: {
    id, day: session.snapshot().day || offer.day, type: 'schedule-shift',
    shiftId: id, roleId, workers: 2, workDay: day,
  } });
}

export function receiveStock(session: SalesSession) {
  submit(session, { domain: 'inventory', command: order });
  submit(session, { domain: 'inventory', command: receipt });
}

export function signedSale(quantity = 70, collidingSaleId?: string) {
  const session = setupSales(collidingSaleId);
  submit(session, { domain: 'sales', command: { ...offer, quantity } });
  submit(session, { domain: 'sales', command: accept });
  receiveStock(session);
  addShift(session, 'first-shift', deliver.day);
  addShift(session, 'second-shift', deliver.day + 1);
  return session;
}
