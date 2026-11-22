/** Pure read-model projection deriving statements, forecasts, guidance, and objectives from committed state. */
import type { Scenario } from '../../../../packages/content/src';
import type { SimulationSnapshot } from '../../../../packages/contracts/src';
import {
  applyBasisPoints, balanceSheet, directCashFlow, forecastLiquidity, incomeStatement,
} from '../../../../packages/finance/src';
import {
  readInventory, readSalesCapacity, readSalesStatus,
} from '../../../../packages/operations/src';
import { readLiquidityInput } from '../../../../packages/simulation/src';
import {
  dailyLimits, evaluateDistress, liquidityPolicy, payrollScheduleId, stockScope,
  type JourneyDomainState,
} from './phases';
import type {
  GuidanceStepId, JourneyEvaluation, JourneyMilestone, JourneyObligationRead, JourneyReadModel,
} from './types';

function computeGuidance(
  domain: JourneyDomainState,
  scenario: Scenario,
  day: number,
  closedDay: number,
  offerStatus: string | null,
  distressStage: string,
  hasOverdueInvoice: boolean,
): GuidanceStepId {
  if (distressStage === 'ended') return 'ended';
  if (closedDay >= scenario.calendar.endDay) return 'completed';
  if (!domain.founded) return 'found';
  if (offerStatus === 'offered') return 'sign-contract';
  if (!domain.supplyOrdered && offerStatus === 'signed') return 'order-supply';
  if (distressStage === 'payment-shortfall' || distressStage === 'default') return 'resolve-shortfall';
  if (offerStatus === 'signed' && day < scenario.contract.deliveryStartsDay) return 'advance-delivery';
  if ((offerStatus === 'signed' || offerStatus === 'partially-delivered' || offerStatus === 'in-progress') &&
      day >= scenario.contract.deliveryStartsDay && day <= scenario.contract.deliveryDueDay) return 'deliver';
  if (closedDay < scenario.calendar.firstCloseDay) return 'advance-close';
  if (domain.restockChoice === 'pending' && day >= scenario.postClose.day) return 'review-close';
  if (distressStage === 'warning') return 'resolve-shortfall';
  if (hasOverdueInvoice) return 'review-overdue';
  return 'advance-end';
}

function computeMilestone(
  domain: JourneyDomainState,
  scenario: Scenario,
  day: number,
  closedDay: number,
  canAdvance: boolean,
): JourneyMilestone | null {
  if (!canAdvance) return null;
  const { supply, contract, calendar, postClose } = scenario;
  const offer = domain.sales.offers.find(({ offerId }) => offerId === contract.id);
  const stockWaiting = domain.sales.inventory.orders.some((o) => o.receivedDay === null && o.expectedDay >= day);
  if (stockWaiting && closedDay < supply.arrivalDay) {
    return { targetDay: supply.arrivalDay, days: supply.arrivalDay - closedDay, reason: 'supply-arrival' };
  }
  if (offer?.acceptedDay !== null && offer && offer.deliveredQuantity < offer.quantity && day < contract.deliveryStartsDay) {
    const target = contract.deliveryStartsDay - 1;
    if (target > closedDay) return { targetDay: target, days: target - closedDay, reason: 'delivery-window' };
  }
  if (closedDay < calendar.firstCloseDay) {
    return { targetDay: calendar.firstCloseDay, days: calendar.firstCloseDay - closedDay, reason: 'monthly-close' };
  }
  if (closedDay < postClose.rentDueDay) {
    return { targetDay: postClose.rentDueDay, days: postClose.rentDueDay - closedDay, reason: 'rent-due' };
  }
  const hasOpenInvoice = domain.sales.invoices.some((i) => !i.payment);
  const overdueDay = contract.paymentDueDay + 1;
  if (hasOpenInvoice && closedDay < overdueDay) {
    return { targetDay: overdueDay, days: overdueDay - closedDay, reason: 'overdue-review' };
  }
  return { targetDay: calendar.endDay, days: calendar.endDay - closedDay, reason: 'scenario-end' };
}

function computeEvaluation(
  domain: JourneyDomainState,
  scenario: Scenario,
  closedDay: number,
  cashMinor: string,
  distressStage: string,
): JourneyEvaluation {
  const offer = domain.sales.offers.find(({ offerId }) => offerId === scenario.contract.id);
  const deliveredOnTime = Boolean(
    offer && offer.deliveredQuantity === offer.quantity &&
    domain.sales.invoices.every((inv) => inv.issueDay <= scenario.contract.deliveryDueDay),
  );
  const payRecord = domain.sales.workforce.payrollRecords.find(({ id }) => id === payrollScheduleId);
  const payrollPaidOnTime = Boolean(payRecord?.payment && payRecord.payment.day <= scenario.payroll.dueDay);
  const cashNonNegative = BigInt(cashMinor) >= BigInt(scenario.objectives.minimumClosingCashMinor);
  const solvent = distressStage !== 'default' && distressStage !== 'ended' && distressStage !== 'payment-shortfall';

  let status: JourneyEvaluation['status'] = 'in-progress';
  if (distressStage === 'ended') status = 'ended-default';
  else if (closedDay >= scenario.calendar.endDay) {
    status = deliveredOnTime && payrollPaidOnTime && cashNonNegative && solvent ? 'succeeded' : 'failed-objectives';
  }
  return Object.freeze({ status, deliveredOnTime, payrollPaidOnTime, cashNonNegative, solvent });
}

/** Projects a complete, JSON-serializable read model from committed engine state. */
export function buildJourneyReadModel(
  scenario: Scenario,
  domain: JourneyDomainState,
  clock: SimulationSnapshot,
  revision: number,
): JourneyReadModel {
  const closedDay = clock.lastClosedDay;
  const day = Math.min(clock.openDay, scenario.calendar.endDay);
  const scope = stockScope(scenario);
  const limits = dailyLimits(scenario);
  const { offers, invoices } = readSalesStatus(domain.sales, day);
  const offer = offers.find(({ offerId }) => offerId === scenario.contract.id) ?? null;
  const inv = readInventory(domain.sales.inventory, scope);
  const rawCap = offer ? readSalesCapacity(domain.sales, offer.offerId, day, limits) : null;

  const balance = balanceSheet(domain.ledger, day);
  const period = { fromDay: scenario.calendar.startDay, throughDay: day };
  const income = incomeStatement(domain.ledger, period);
  const cashFlow = directCashFlow(domain.ledger, period);
  const monthOneClosed = domain.treasury.closes.some(({ throughDay }) => throughDay === scenario.calendar.firstCloseDay);
  const monthOneBalance = monthOneClosed ? balanceSheet(domain.ledger, scenario.calendar.firstCloseDay) : null;
  const monthOneIncome = monthOneClosed
    ? incomeStatement(domain.ledger, { fromDay: scenario.calendar.startDay, throughDay: scenario.calendar.firstCloseDay })
    : null;
  const monthTwoIncome = monthOneClosed && day > scenario.calendar.firstCloseDay
    ? incomeStatement(domain.ledger, { fromDay: scenario.calendar.firstCloseDay + 1, throughDay: day })
    : null;

  const liquidityInput = readLiquidityInput({
    ledger: domain.ledger, treasury: domain.treasury, sales: domain.sales,
    day, policy: liquidityPolicy(scenario),
  });
  const liquidity = forecastLiquidity(liquidityInput);
  const distress = evaluateDistress(domain, scenario, day);

  const journal = Object.freeze(domain.ledger.entries.filter((entry) => entry.day <= day));
  const cashEntries = Object.freeze(journal.filter((entry) => entry.lines.some((line) => line.account === 'cash')));
  const obligations: readonly JourneyObligationRead[] = Object.freeze(domain.treasury.obligations.map((ob) => Object.freeze({
    ...ob,
    status: ob.payment ? 'paid' : day > ob.dueDay ? 'overdue' : 'open',
  })));

  const payRecord = domain.sales.workforce.payrollRecords.find(({ id }) => id === payrollScheduleId) ?? null;
  const payrollStatus = payRecord?.payment ? 'paid'
    : payRecord ? (day > payRecord.dueDay ? 'overdue' : 'accrued') : 'scheduled';

  let earlyGross = 0n;
  let earlyDiscount = 0n;
  const bps = scenario.contract.earlyPaymentDiscountBps;
  for (const invoice of invoices) {
    if (invoice.payment || day >= invoice.dueDay || bps === 0) continue;
    const face = BigInt(invoice.amountMinor);
    earlyGross += face;
    earlyDiscount += applyBasisPoints(face, bps);
  }

  const canAdvance = domain.founded && distress.canOperate && closedDay < scenario.calendar.endDay && clock.pendingAlerts.length === 0;
  const hasOverdueInvoice = invoices.some(({ status }) => status === 'overdue');
  const { postClose } = scenario;

  return Object.freeze({
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    day,
    lastClosedDay: closedDay,
    endDay: scenario.calendar.endDay,
    revision,
    founded: domain.founded,
    fundingPlan: domain.fundingPlan,
    supplyOrdered: domain.supplyOrdered,
    restockChoice: domain.restockChoice,
    rescueLoanTaken: domain.rescueLoanTaken,
    canAdvance,
    offer,
    invoices,
    orders: domain.sales.inventory.orders,
    inventory: Object.freeze({
      quantity: inv.quantity.toString(),
      reserved: inv.reserved.toString(),
      available: inv.available.toString(),
      valueMinor: inv.valueMinor,
    }),
    capacity: rawCap ? Object.freeze({
      available: rawCap.available.toString(),
      used: rawCap.used.toString(),
      limits: Object.freeze({
        labor: rawCap.limits.labor.toString(),
        equipment: rawCap.limits.equipment.toString(),
        shipping: rawCap.limits.shipping.toString(),
        materials: rawCap.limits.materials.toString(),
      }),
      limitingFactors: rawCap.limitingFactors,
    }) : Object.freeze({
      available: '0', used: '0',
      limits: Object.freeze({ labor: '0', equipment: '0', shipping: '0', materials: '0' }),
      limitingFactors: Object.freeze([]),
    }),
    payroll: Object.freeze({
      dueDay: scenario.payroll.dueDay,
      amountMinor: scenario.payroll.amountMinor,
      record: payRecord,
      status: payrollStatus,
    }),
    obligations,
    balance,
    income,
    monthOneBalance,
    monthOneIncome,
    monthTwoIncome,
    cashFlow,
    liquidity,
    distress,
    journal,
    cashEntries,
    pendingAlerts: clock.pendingAlerts,
    decisions: domain.decisions,
    guidanceStep: computeGuidance(domain, scenario, day, closedDay, offer?.status ?? null, distress.stage, hasOverdueInvoice),
    milestone: computeMilestone(domain, scenario, day, closedDay, canAdvance),
    evaluation: computeEvaluation(domain, scenario, closedDay, balance.cash, distress.stage),
    restockTerms: Object.freeze({
      quantity: postClose.restockQuantity,
      unitCostMinor: postClose.restockUnitCostMinor,
      totalCostMinor: (BigInt(postClose.restockQuantity) * BigInt(postClose.restockUnitCostMinor)).toString(),
      rentAmountMinor: postClose.rentAmountMinor,
      rentDueDay: postClose.rentDueDay,
    }),
    rescueLoanTerms: Object.freeze({
      principalMinor: postClose.rescueLoanPrincipalMinor,
      monthlyInterestBps: postClose.rescueLoanMonthlyInterestBps,
      dueDay: postClose.rescueLoanDueDay,
    }),
    earlyCollectionSummary: Object.freeze({
      available: earlyGross > 0n,
      grossMinor: earlyGross.toString(),
      discountMinor: earlyDiscount.toString(),
      cashMinor: (earlyGross - earlyDiscount).toString(),
    }),
    customerDelayDays: postClose.customerDelayDays,
  });
}
