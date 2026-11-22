/** Builds the review checkpoint through the same purchase, sales, and finance commands as the domain. */
import type { Scenario } from '../../../../packages/content/src';
import { applyFinanceCommand, createFinanceState, Ledger, type JournalEntryInput } from '../../../../packages/finance/src';
import { createInventory, createSalesSession, createWorkforce, type SalesSessionCommand } from '../../../../packages/operations/src';

export function companyCheckpoint(scenario: Scenario) {
  const { opening, calendar, currency, company, contract, supply, product, payroll, monthlyClose } = scenario;
  const day = calendar.startDay;
  const entries: JournalEntryInput[] = [];
  if (opening.capitalMinor !== '0') entries.push({
    id: 'founder-capital', sourceId: company.id, day, lines: [
      { account: 'cash', side: 'debit', amount: opening.capitalMinor, cashFlow: 'financing' },
      { account: 'contributedCapital', side: 'credit', amount: opening.capitalMinor },
    ],
  });
  const assets = [
    ['rentalDeposits', opening.rentalDepositMinor, 'operating'],
    ['equipment', opening.equipmentMinor, 'investing'],
  ] as const;
  for (const [account, amount, cashFlow] of assets) {
    if (amount === '0') continue;
    entries.push({ id: `setup-${account}`, sourceId: company.id, day, lines: [
      { account, side: 'debit', amount },
      { account: 'cash', side: 'credit', amount, cashFlow },
    ] });
  }
  const ledger = Ledger.open({ companyId: company.id, currency }).post(entries);
  const finance = createFinanceState(ledger, {
    monthlyUtilitiesMinor: monthlyClose.utilitiesMinor, monthlyDepreciationMinor: monthlyClose.depreciationMinor,
    incomeTaxBps: monthlyClose.incomeTaxBps, utilitiesDueAfterCloseDays: 1, taxDueAfterCloseDays: 10,
  });
  const funded = opening.loanPrincipalMinor === '0' ? { state: finance, ledger } :
    applyFinanceCommand(finance, ledger, {
      id: 'opening-loan', type: 'disburse-loan', day, loanId: 'starter-loan',
      principalMinor: opening.loanPrincipalMinor, monthlyInterestBps: opening.loanMonthlyInterestBps,
      interestDueAfterCloseDays: 1,
      installments: [{ dueDay: calendar.firstCloseDay * 2, amountMinor: opening.loanPrincipalMinor }],
    });
  const capacity = opening.dailyHandlingCapacity;
  const session = createSalesSession({
    ledger: funded.ledger, inventory: createInventory(funded.ledger),
    workforce: createWorkforce(funded.ledger, {
      roles: [{ id: 'dispatch', workers: 1, unitsPerWorkerPerShift: capacity, wagePerWorkerMinor: payroll.amountMinor }],
      payroll: [{ id: 'payroll', dueDay: payroll.dueDay, accrualDay: Math.max(day, payroll.dueDay - 1) }],
    }),
    dailyEquipment: capacity, dailyShipping: capacity,
  });
  function submit(command: SalesSessionCommand) {
    const receipt = session.submit(command, session.snapshot().revision);
    if (receipt.status === 'rejected') throw new Error(`Review checkpoint: ${receipt.code}`);
  }

  const scope = { productId: product.id, warehouseId: 'distribution-hub' };
  const offerId = contract.id;
  submit({ domain: 'sales', command: { ...contract, ...scope, type: 'offer', id: 'publish', offerId, day } });
  submit({ domain: 'sales', command: { type: 'accept', id: 'accept', offerId, day } });
  submit({ domain: 'inventory', command: {
    ...scope, type: 'order', id: 'order', orderId: 'opening-stock', day, supplierId: scenario.supplier.id,
    quantity: supply.quantity, unitCostMinor: supply.unitCostMinor, expectedDay: supply.arrivalDay,
    shelfLifeDays: product.shelfLifeDays, payment: 'cash',
  } });
  const reviewDay = Math.max(supply.arrivalDay, contract.deliveryStartsDay);
  submit({ domain: 'inventory', command: { type: 'receive', id: 'receipt', day: supply.arrivalDay, orderId: 'opening-stock' } });
  for (let workDay = reviewDay; workDay <= contract.deliveryDueDay; workDay += 1) {
    submit({ domain: 'workforce', command: {
      type: 'schedule-shift', id: `shift-${workDay}`, shiftId: `shift-${workDay}`, roleId: 'dispatch',
      day: supply.arrivalDay, workDay, workers: 1,
    } });
  }

  const firstQuantity = Math.min(40, capacity, contract.quantity);
  submit({ domain: 'sales', command: { type: 'deliver', id: 'first-delivery', day: reviewDay, offerId, quantity: firstQuantity } });
  return { session, treasury: funded.state, scope, offerId };
}
