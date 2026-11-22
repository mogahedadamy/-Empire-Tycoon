/** Decodes the content records for geography, opening terms, supply and the order. */
import { id, integer, money, section, text, invalid } from './fields';

export function named(value: unknown, path: string) {
  const item = section(value, path);
  return { id: id(item.id, `${path}.id`), name: text(item.name, `${path}.name`) };
}

export function located(value: unknown, path: string) {
  const item = section(value, path);
  return { ...named(item, path), cityId: id(item.cityId, `${path}.cityId`) };
}

export function calendar(value: unknown) {
  const item = section(value, 'calendar');
  return {
    startDay: integer(item.startDay, 'calendar.startDay'),
    firstCloseDay: integer(item.firstCloseDay, 'calendar.firstCloseDay'),
    endDay: integer(item.endDay, 'calendar.endDay', 1, Number.MAX_SAFE_INTEGER - 1),
  };
}

export function opening(value: unknown) {
  const item = section(value, 'opening');
  return {
    cashMinor: money(item.cashMinor, 'opening.cashMinor', true),
    inventoryQuantity: integer(item.inventoryQuantity, 'opening.inventoryQuantity', 0),
    capitalMinor: money(item.capitalMinor, 'opening.capitalMinor', true),
    loanPrincipalMinor: money(item.loanPrincipalMinor, 'opening.loanPrincipalMinor', true),
    loanMonthlyInterestBps: integer(item.loanMonthlyInterestBps, 'opening.loanMonthlyInterestBps', 0, 10_000),
    rentalDepositMinor: money(item.rentalDepositMinor, 'opening.rentalDepositMinor', true),
    equipmentMinor: money(item.equipmentMinor, 'opening.equipmentMinor', true),
    dailyHandlingCapacity: integer(item.dailyHandlingCapacity, 'opening.dailyHandlingCapacity'),
  };
}

export function supply(value: unknown) {
  const item = section(value, 'supply');
  return {
    supplierId: id(item.supplierId, 'supply.supplierId'),
    productId: id(item.productId, 'supply.productId'),
    quantity: integer(item.quantity, 'supply.quantity'),
    unitCostMinor: money(item.unitCostMinor, 'supply.unitCostMinor'),
    arrivalDay: integer(item.arrivalDay, 'supply.arrivalDay'),
  };
}

export function contract(value: unknown) {
  const item = section(value, 'contract');
  return {
    id: id(item.id, 'contract.id'),
    customerId: id(item.customerId, 'contract.customerId'),
    productId: id(item.productId, 'contract.productId'),
    quantity: integer(item.quantity, 'contract.quantity'),
    unitPriceMinor: money(item.unitPriceMinor, 'contract.unitPriceMinor'),
    offerExpiresDay: integer(item.offerExpiresDay, 'contract.offerExpiresDay'),
    deliveryStartsDay: integer(item.deliveryStartsDay, 'contract.deliveryStartsDay'),
    deliveryDueDay: integer(item.deliveryDueDay, 'contract.deliveryDueDay'),
    paymentDueDay: integer(item.paymentDueDay, 'contract.paymentDueDay'),
    earlyPaymentDiscountBps: integer(item.earlyPaymentDiscountBps, 'contract.earlyPaymentDiscountBps', 0, 9_999),
  };
}

export function payroll(value: unknown) {
  const item = section(value, 'payroll');
  return { amountMinor: money(item.amountMinor, 'payroll.amountMinor'), dueDay: integer(item.dueDay, 'payroll.dueDay') };
}

export function monthlyClose(value: unknown) {
  const item = section(value, 'monthlyClose');
  return {
    utilitiesMinor: money(item.utilitiesMinor, 'monthlyClose.utilitiesMinor', true),
    depreciationMinor: money(item.depreciationMinor, 'monthlyClose.depreciationMinor', true),
    incomeTaxBps: integer(item.incomeTaxBps, 'monthlyClose.incomeTaxBps', 0, 10_000),
  };
}

export function firstDecision(value: unknown) {
  const item = section(value, 'firstDecision');
  if (
    !Array.isArray(item.options) ||
    item.options.length !== 2 ||
    !item.options.includes('accept-contract') ||
    !item.options.includes('review-alternatives')
  ) {
    return invalid('firstDecision.options', 'expected the accept and review choices once each');
  }

  const options = item.options as ('accept-contract' | 'review-alternatives')[];
  return {
    day: integer(item.day, 'firstDecision.day'),
    contractId: id(item.contractId, 'firstDecision.contractId'),
    options: Object.freeze([...options]),
  };
}

export function objectives(value: unknown) {
  const item = section(value, 'objectives');
  if (item.deliverContractByDueDay !== true || item.payPayrollByDueDay !== true) {
    return invalid('objectives', 'the first company requires both delivery and payroll objectives');
  }
  return {
    deliverContractByDueDay: true as const,
    payPayrollByDueDay: true as const,
    minimumClosingCashMinor: money(item.minimumClosingCashMinor, 'objectives.minimumClosingCashMinor', true),
  };
}

export function postClose(value: unknown) {
  const item = section(value, 'postClose');
  return {
    day: integer(item.day, 'postClose.day'),
    rentObligationId: id(item.rentObligationId, 'postClose.rentObligationId'),
    rentAmountMinor: money(item.rentAmountMinor, 'postClose.rentAmountMinor'),
    rentDueDay: integer(item.rentDueDay, 'postClose.rentDueDay'),
    restockOrderId: id(item.restockOrderId, 'postClose.restockOrderId'),
    restockQuantity: integer(item.restockQuantity, 'postClose.restockQuantity'),
    restockUnitCostMinor: money(item.restockUnitCostMinor, 'postClose.restockUnitCostMinor'),
    rescueLoanId: id(item.rescueLoanId, 'postClose.rescueLoanId'),
    rescueLoanPrincipalMinor: money(item.rescueLoanPrincipalMinor, 'postClose.rescueLoanPrincipalMinor'),
    rescueLoanMonthlyInterestBps: integer(item.rescueLoanMonthlyInterestBps, 'postClose.rescueLoanMonthlyInterestBps', 0, 10_000),
    rescueLoanDueDay: integer(item.rescueLoanDueDay, 'postClose.rescueLoanDueDay'),
    customerDelayDays: integer(item.customerDelayDays, 'postClose.customerDelayDays', 0),
    utilitiesDueAfterCloseDays: integer(item.utilitiesDueAfterCloseDays, 'postClose.utilitiesDueAfterCloseDays'),
    interestDueAfterCloseDays: integer(item.interestDueAfterCloseDays, 'postClose.interestDueAfterCloseDays'),
    taxDueAfterCloseDays: integer(item.taxDueAfterCloseDays, 'postClose.taxDueAfterCloseDays'),
    defaultGraceDays: integer(item.defaultGraceDays, 'postClose.defaultGraceDays'),
  };
}
