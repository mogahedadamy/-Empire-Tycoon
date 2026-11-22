/** Pure domain command transitions for contracts, supply, delivery, and liquidity containment. */
import type { Scenario } from '../../../../packages/content/src';
import { applyBasisPoints, balanceSheet, FinanceError } from '../../../../packages/finance/src';
import { InventoryError, SalesError, WorkforceError } from '../../../../packages/operations/src';
import {
  applyDomainFinance, applyDomainOps, dailyLimits, evaluateDistress, stockScope,
  type JourneyDomainState,
} from './domain-state';
import { addDecision, applyFounding, ensureRentAccrued } from './founding';
import type { JourneyAction, JourneyErrorCode } from './types';

export interface ActionFailure {
  readonly ok: false;
  readonly code: JourneyErrorCode;
  readonly shortfallMinor?: string;
  readonly domain?: JourneyDomainState;
}

export interface ActionSuccess {
  readonly ok: true;
  readonly domain: JourneyDomainState;
  readonly invoiceId?: string;
  readonly resolveCodes?: readonly string[];
}

export type ActionResult = ActionSuccess | ActionFailure;

function mapDomainError(error: unknown): ActionFailure {
  if (error instanceof FinanceError) {
    return { ok: false, code: error.code as JourneyErrorCode, shortfallMinor: error.shortfallMinor };
  }
  if (error instanceof SalesError || error instanceof InventoryError || error instanceof WorkforceError) {
    return { ok: false, code: error.code as JourneyErrorCode };
  }
  throw error;
}

/** Executes one non-clock player action on the open day without mutating the supplied domain state. */
export function executeJourneyAction(
  domain: JourneyDomainState,
  scenario: Scenario,
  day: number,
  commandId: string,
  action: Exclude<JourneyAction, { type: 'advance' | 'advance-through' | 'resolve-alert' }>,
): ActionResult {
  if (action.type === 'found-company') {
    if (domain.founded) return { ok: false, code: 'already-founded' };
    return { ok: true, domain: applyFounding(domain, scenario, day, action.fundingPlan) };
  }
  if (!domain.founded) return { ok: false, code: 'not-founded' };
  if (domain.distress?.stage === 'ended') return { ok: false, code: 'company-ended' };

  const limits = dailyLimits(scenario);
  const scope = stockScope(scenario);

  try {
    switch (action.type) {
      case 'accept-contract': {
        const res = applyDomainOps(domain, {
          domain: 'sales', command: { id: commandId, type: 'accept', day, offerId: action.offerId },
        }, limits);
        return { ok: true, domain: Object.freeze({ ...res.domain, distress: evaluateDistress(res.domain, scenario, day) }) };
      }
      case 'order-supply': {
        if (domain.supplyOrdered) return { ok: false, code: 'order-already-placed' };
        const { supply, supplier, product } = scenario;
        const res = applyDomainOps(domain, {
          domain: 'inventory',
          command: {
            ...scope, id: commandId, type: 'order', orderId: 'opening-stock', day,
            supplierId: supplier.id, quantity: supply.quantity, unitCostMinor: supply.unitCostMinor,
            expectedDay: Math.max(day, supply.arrivalDay), shelfLifeDays: product.shelfLifeDays, payment: 'cash',
          },
        }, limits);
        const next = Object.freeze({ ...res.domain, supplyOrdered: true });
        return { ok: true, domain: Object.freeze({ ...next, distress: evaluateDistress(next, scenario, day) }) };
      }
      case 'deliver': {
        const res = applyDomainOps(domain, {
          domain: 'sales',
          command: { id: commandId, type: 'deliver', day, offerId: action.offerId, quantity: action.quantity },
        }, limits);
        return {
          ok: true, invoiceId: res.invoiceId,
          domain: Object.freeze({ ...res.domain, distress: evaluateDistress(res.domain, scenario, day) }),
        };
      }
      case 'approve-restock': {
        const { postClose, supplier, product } = scenario;
        if (day < postClose.day) return { ok: false, code: 'restock-not-ready' };
        if (domain.restockChoice !== 'pending') return { ok: false, code: 'restock-already-decided' };
        const total = BigInt(postClose.restockQuantity) * BigInt(postClose.restockUnitCostMinor);
        const cash = BigInt(balanceSheet(domain.ledger, day).cash);
        if (cash < total) return { ok: false, code: 'insufficient-cash', shortfallMinor: (total - cash).toString() };
        let next = ensureRentAccrued(domain, scenario, day);
        next = applyDomainOps(next, {
          domain: 'inventory',
          command: {
            ...scope, id: `${commandId}:order`, type: 'order', orderId: postClose.restockOrderId, day,
            supplierId: supplier.id, quantity: postClose.restockQuantity, unitCostMinor: postClose.restockUnitCostMinor,
            expectedDay: day, shelfLifeDays: product.shelfLifeDays, payment: 'cash',
          },
        }, limits).domain;
        next = applyDomainOps(next, {
          domain: 'inventory',
          command: { id: `${commandId}:receive`, type: 'receive', day, orderId: postClose.restockOrderId },
        }, limits).domain;
        next = addDecision(Object.freeze({ ...next, restockChoice: 'ordered' }), {
          id: `restock:${commandId}`, day, kind: 'restock',
          costMinor: total.toString(), liquidityProtectionMinor: '0', debtAddedMinor: '0',
        });
        return {
          ok: true, resolveCodes: ['month-closed'],
          domain: Object.freeze({ ...next, distress: evaluateDistress(next, scenario, day) }),
        };
      }
      case 'defer-restock': {
        const { postClose } = scenario;
        if (day < postClose.day) return { ok: false, code: 'restock-not-ready' };
        if (domain.restockChoice !== 'pending') return { ok: false, code: 'restock-already-decided' };
        const saved = (BigInt(postClose.restockQuantity) * BigInt(postClose.restockUnitCostMinor)).toString();
        let next = ensureRentAccrued(domain, scenario, day);
        next = addDecision(Object.freeze({ ...next, restockChoice: 'deferred' }), {
          id: `defer:${commandId}`, day, kind: 'defer-restock',
          costMinor: '0', liquidityProtectionMinor: saved, debtAddedMinor: '0',
        });
        return {
          ok: true, resolveCodes: ['month-closed'],
          domain: Object.freeze({ ...next, distress: evaluateDistress(next, scenario, day) }),
        };
      }
      case 'collect-early': {
        const open = domain.sales.invoices.filter((inv) => !inv.payment && day < inv.dueDay);
        if (open.length === 0 || scenario.contract.earlyPaymentDiscountBps === 0) {
          return { ok: false, code: 'no-early-invoices' };
        }
        let next = domain;
        let cash = 0n;
        let discount = 0n;
        for (const inv of open) {
          next = applyDomainOps(next, {
            domain: 'sales', command: { id: `${commandId}:${inv.id}`, type: 'collect', day, invoiceId: inv.id, mode: 'early' },
          }, limits).domain;
          const paid = next.sales.invoices.find(({ id }) => id === inv.id)?.payment;
          if (paid) { cash += BigInt(paid.cashMinor); discount += BigInt(paid.discountMinor); }
        }
        next = addDecision(next, {
          id: `early:${commandId}`, day, kind: 'early-collection',
          costMinor: discount.toString(), liquidityProtectionMinor: cash.toString(), debtAddedMinor: '0',
        });
        return {
          ok: true, resolveCodes: ['payment-shortfall'],
          domain: Object.freeze({ ...next, distress: evaluateDistress(next, scenario, day) }),
        };
      }
      case 'draw-rescue-loan': {
        const { postClose } = scenario;
        if (day < postClose.day) return { ok: false, code: 'restock-not-ready' };
        if (domain.rescueLoanTaken) return { ok: false, code: 'rescue-loan-taken' };
        let next = applyDomainFinance(domain, {
          id: `rescue:${commandId}`, type: 'disburse-loan', day, loanId: postClose.rescueLoanId,
          principalMinor: postClose.rescueLoanPrincipalMinor,
          monthlyInterestBps: postClose.rescueLoanMonthlyInterestBps,
          interestDueAfterCloseDays: postClose.interestDueAfterCloseDays,
          installments: [{ dueDay: postClose.rescueLoanDueDay, amountMinor: postClose.rescueLoanPrincipalMinor }],
        });
        const interest = applyBasisPoints(BigInt(postClose.rescueLoanPrincipalMinor), postClose.rescueLoanMonthlyInterestBps).toString();
        next = addDecision(Object.freeze({ ...next, rescueLoanTaken: true }), {
          id: `rescue-loan:${commandId}`, day, kind: 'rescue-loan',
          costMinor: interest, liquidityProtectionMinor: postClose.rescueLoanPrincipalMinor,
          debtAddedMinor: postClose.rescueLoanPrincipalMinor,
        });
        return {
          ok: true, resolveCodes: ['payment-shortfall'],
          domain: Object.freeze({ ...next, distress: evaluateDistress(next, scenario, day) }),
        };
      }
      case 'pay-obligation': {
        try {
          let next = applyDomainFinance(domain, {
            id: `pay:${commandId}`, type: 'pay-obligation', day, obligationId: action.obligationId,
          });
          if (next.failedPaymentId === action.obligationId) next = Object.freeze({ ...next, failedPaymentId: null });
          return {
            ok: true, resolveCodes: ['payment-shortfall'],
            domain: Object.freeze({ ...next, distress: evaluateDistress(next, scenario, day) }),
          };
        } catch (error) {
          if (error instanceof FinanceError && error.code === 'insufficient-cash') {
            // Do not post a partial payment; escalate distress for the blocked due obligation.
            const distress = evaluateDistress(domain, scenario, day, { failedPaymentId: action.obligationId });
            const escalated = Object.freeze({ ...domain, distress, failedPaymentId: action.obligationId });
            return { ok: false, code: 'insufficient-cash', shortfallMinor: error.shortfallMinor, domain: escalated };
          }
          throw error;
        }
      }
      case 'collect-due': {
        const minDay = (dueDay: number) => dueDay + scenario.postClose.customerDelayDays;
        const targets = domain.sales.invoices.filter((inv) =>
          !inv.payment && day >= minDay(inv.dueDay) && (!action.invoiceId || inv.id === action.invoiceId));
        if (targets.length === 0) return { ok: false, code: 'no-due-invoices' };
        let next = domain;
        for (const inv of targets) {
          next = applyDomainOps(next, {
            domain: 'sales', command: { id: `${commandId}:${inv.id}`, type: 'collect', day, invoiceId: inv.id, mode: 'due' },
          }, limits).domain;
        }
        return {
          ok: true, resolveCodes: ['invoice-overdue'],
          domain: Object.freeze({ ...next, distress: evaluateDistress(next, scenario, day) }),
        };
      }
      case 'end-company': {
        const current = evaluateDistress(domain, scenario, day);
        if (current.stage !== 'default') return { ok: false, code: 'not-defaulted' };
        const ended = evaluateDistress(domain, scenario, day, { endCompany: true });
        let next: JourneyDomainState = Object.freeze({ ...domain, distress: ended });
        next = addDecision(next, {
          id: `end:${commandId}`, day, kind: 'end-company',
          costMinor: '0', liquidityProtectionMinor: '0', debtAddedMinor: '0',
        });
        return { ok: true, domain: next, resolveCodes: ['company-default', 'payment-shortfall'] };
      }
    }
  } catch (error) {
    return mapDomainError(error);
  }
}
