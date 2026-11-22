/** Shared-ledger journey domain state, initial setup, and distress evaluation helpers. */
import type { Scenario } from '../../../../packages/content/src';
import {
  applyFinanceCommand, createFinanceState, Ledger, reviewDistress,
  type DistressAction, type DistressCase, type FinanceCommand, type FinanceState,
} from '../../../../packages/finance/src';
import {
  applySalesCommand, createInventory, createSalesState, createWorkforce,
  type SalesDailyLimits, type SalesSessionCommand, type SalesSnapshot,
} from '../../../../packages/operations/src';
import { readLiquidityInput } from '../../../../packages/simulation/src';
import type { DecisionImpact, FundingPlan, RestockChoice } from './types';

export const warehouseId = 'distribution-hub';
export const payrollScheduleId = 'first-payroll';

export interface JourneyDomainState {
  readonly founded: boolean;
  readonly fundingPlan: FundingPlan | null;
  readonly supplyOrdered: boolean;
  readonly restockChoice: RestockChoice;
  readonly rescueLoanTaken: boolean;
  readonly ledger: Ledger;
  readonly sales: SalesSnapshot;
  readonly treasury: FinanceState;
  readonly distress: DistressCase | null;
  readonly failedPaymentId: string | null;
  readonly overdueNotified: boolean;
  readonly decisions: readonly DecisionImpact[];
}

export function stockScope(scenario: Scenario) {
  return { productId: scenario.product.id, warehouseId };
}

export function dailyLimits(scenario: Scenario): SalesDailyLimits {
  const cap = scenario.opening.dailyHandlingCapacity;
  return { equipment: cap, shipping: cap };
}

export function liquidityPolicy(scenario: Scenario) {
  return {
    pessimisticDelayDays: Math.max(5, scenario.postClose.customerDelayDays),
    optimisticEarlyDays: 7,
    defaultGraceDays: scenario.postClose.defaultGraceDays,
  };
}

/** Creates the pre-founding empty state on day 1 with zero cash and zero inventory. */
export function createInitialDomain(scenario: Scenario): JourneyDomainState {
  const { company, currency, monthlyClose, postClose, opening, payroll, calendar } = scenario;
  const ledger = Ledger.open({ companyId: company.id, currency });
  const treasury = createFinanceState(ledger, {
    monthlyUtilitiesMinor: monthlyClose.utilitiesMinor,
    monthlyDepreciationMinor: monthlyClose.depreciationMinor,
    incomeTaxBps: monthlyClose.incomeTaxBps,
    utilitiesDueAfterCloseDays: postClose.utilitiesDueAfterCloseDays,
    taxDueAfterCloseDays: postClose.taxDueAfterCloseDays,
  });
  const workforce = createWorkforce(ledger, {
    roles: [{
      id: 'dispatch',
      workers: 1,
      unitsPerWorkerPerShift: opening.dailyHandlingCapacity,
      wagePerWorkerMinor: payroll.amountMinor,
    }],
    payroll: [{
      id: payrollScheduleId,
      dueDay: payroll.dueDay,
      accrualDay: Math.max(calendar.startDay, payroll.dueDay - 1),
    }],
  });
  const sales = createSalesState({
    ledger,
    inventory: createInventory(ledger),
    workforce,
    dailyEquipment: opening.dailyHandlingCapacity,
    dailyShipping: opening.dailyHandlingCapacity,
  });
  return Object.freeze({
    founded: false, fundingPlan: null, supplyOrdered: false, restockChoice: 'pending',
    rescueLoanTaken: false, ledger, sales, treasury, distress: null,
    failedPaymentId: null, overdueNotified: false, decisions: Object.freeze([]),
  });
}

/** Applies a treasury command and synchronizes the shared authoritative ledger onto sales. */
export function applyDomainFinance(domain: JourneyDomainState, command: FinanceCommand): JourneyDomainState {
  const result = applyFinanceCommand(domain.treasury, domain.ledger, command);
  const sales = Object.freeze({ ...domain.sales, ledger: result.ledger });
  return Object.freeze({ ...domain, ledger: result.ledger, treasury: result.state, sales });
}

/** Applies a sales, inventory, or workforce command against the shared authoritative ledger. */
export function applyDomainOps(
  domain: JourneyDomainState,
  request: SalesSessionCommand,
  limits: SalesDailyLimits,
) {
  const transition = applySalesCommand(domain.sales, request, limits);
  const next = Object.freeze({ ...domain, ledger: transition.snapshot.ledger, sales: transition.snapshot });
  return { domain: next, invoiceId: transition.invoiceId };
}

/** Evaluates distress using current authoritative balances without mutating committed entries. */
export function evaluateDistress(
  domain: JourneyDomainState,
  scenario: Scenario,
  day: number,
  action: DistressAction = {},
): DistressCase {
  const input = readLiquidityInput({
    ledger: domain.ledger, treasury: domain.treasury, sales: domain.sales,
    day, policy: liquidityPolicy(scenario),
  });
  let effectiveAction = action;
  if (!action.failedPaymentId && domain.failedPaymentId) {
    const failed = input.flows.find(({ id }) => id === domain.failedPaymentId);
    if (failed && failed.dueDay === day && BigInt(input.cashMinor) < BigInt(failed.amountMinor)) {
      effectiveAction = { ...action, failedPaymentId: domain.failedPaymentId };
    }
  }
  return reviewDistress(input, domain.distress, effectiveAction);
}
