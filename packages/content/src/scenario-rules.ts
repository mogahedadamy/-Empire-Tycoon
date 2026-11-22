/** Checks the references and baseline feasibility of the first-company template. */
import { invalid } from './fields';
import type { Scenario } from './scenario';

function reference(value: string, expected: string, path: string) {
  if (value !== expected) invalid(path, `unknown reference: ${value}`);
}

export function validateScenarioRules(scenario: Scenario): void {
  const {
    city, sector, company, supplier, customer, product, calendar,
    supply, contract, firstDecision, payroll, opening,
  } = scenario;

  reference(company.cityId, city.id, 'company.cityId');
  reference(supplier.cityId, city.id, 'supplier.cityId');
  reference(customer.cityId, city.id, 'customer.cityId');
  reference(company.sectorId, sector.id, 'company.sectorId');
  reference(product.sectorId, sector.id, 'product.sectorId');
  reference(supply.supplierId, supplier.id, 'supply.supplierId');
  reference(supply.productId, product.id, 'supply.productId');
  reference(contract.customerId, customer.id, 'contract.customerId');
  reference(contract.productId, product.id, 'contract.productId');
  reference(firstDecision.contractId, contract.id, 'firstDecision.contractId');

  const { startDay, firstCloseDay, endDay } = calendar;
  if (startDay !== 1 || firstCloseDay !== 30 || endDay <= firstCloseDay) {
    invalid('calendar', 'ruleset 1 opens on day 1 and first closes on day 30');
  }
  if (firstDecision.day < startDay || firstDecision.day > contract.offerExpiresDay) {
    invalid('firstDecision.day', 'the opening decision must precede offer expiry');
  }
  if (contract.offerExpiresDay >= contract.deliveryStartsDay) {
    invalid('contract.offerExpiresDay', 'the offer must expire before the delivery window');
  }
  if (
    contract.deliveryStartsDay > contract.deliveryDueDay ||
    contract.deliveryDueDay >= firstCloseDay
  ) {
    invalid('contract.deliveryDueDay', 'delivery must fit in the first month before its close');
  }
  if (contract.paymentDueDay <= firstCloseDay || contract.paymentDueDay > endDay) {
    invalid('contract.paymentDueDay', 'payment must follow the first close and fit in the scenario');
  }
  if (payroll.dueDay < startDay || payroll.dueDay > firstCloseDay) {
    invalid('payroll.dueDay', 'payroll is due by the first close, before collection');
  }
  if (supply.arrivalDay < firstDecision.day || supply.arrivalDay > contract.deliveryDueDay) {
    invalid('supply.arrivalDay', 'supply must arrive between the decision and the delivery deadline');
  }
  if (supply.quantity < contract.quantity) {
    invalid('supply.quantity', 'the quoted batch must cover the contracted quantity');
  }

  const firstUsableDay = Math.max(supply.arrivalDay, contract.deliveryStartsDay);
  const lastFreshDay = supply.arrivalDay + Math.min(product.shelfLifeDays - 1, endDay - supply.arrivalDay);
  const lastUsableDay = Math.min(lastFreshDay, contract.deliveryDueDay);
  const availableDays = Math.max(0, lastUsableDay - firstUsableDay + 1);
  const totalCapacity = BigInt(availableDays) * BigInt(opening.dailyHandlingCapacity);
  if (totalCapacity < BigInt(contract.quantity)) {
    invalid('contract.quantity', 'fresh stock and daily capacity cannot meet delivery by the deadline');
  }

  const { postClose } = scenario;
  if (postClose.day <= firstCloseDay || postClose.day >= endDay) {
    invalid('postClose.day', 'post-close operations must follow the first close and precede scenario end');
  }
  if (postClose.rentDueDay < postClose.day || postClose.rentDueDay >= contract.paymentDueDay) {
    invalid('postClose.rentDueDay', 'post-close rent must be due after recognition and before collection');
  }
  if (contract.paymentDueDay + postClose.customerDelayDays > endDay) {
    invalid('postClose.customerDelayDays', 'delayed collection must remain inside the scenario calendar');
  }
  if (postClose.rescueLoanDueDay <= postClose.day) {
    invalid('postClose.rescueLoanDueDay', 'rescue loan principal must mature after disbursement');
  }
}
