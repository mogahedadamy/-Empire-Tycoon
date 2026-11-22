/** Deterministic 5-phase + month-end schedule for the Big Order simulation clock. */
import type { Scenario } from '../../../../packages/content/src';
import { balanceSheet, FinanceError } from '../../../../packages/finance/src';
import { InventoryError, WorkforceError } from '../../../../packages/operations/src';
import type { PhaseSchedule, PhaseWork } from '../../../../packages/simulation/src';
import {
  applyDomainFinance, applyDomainOps, dailyLimits, evaluateDistress, payrollScheduleId,
  type JourneyDomainState,
} from './domain-state';

export {
  applyDomainFinance, applyDomainOps, createInitialDomain, dailyLimits, evaluateDistress,
  liquidityPolicy, payrollScheduleId, stockScope, warehouseId, type JourneyDomainState,
} from './domain-state';

/** Builds the deterministic 5-phase + month-end schedule bound to a staged advance draft. */
export function createDailySchedule(
  scenario: Scenario,
  getDraft: () => JourneyDomainState,
  setDraft: (next: JourneyDomainState) => void,
): PhaseSchedule {
  const limits = dailyLimits(scenario);
  const accrualDay = Math.max(scenario.calendar.startDay, scenario.payroll.dueDay - 1);

  return ({ day, phase }) => {
    const work: PhaseWork[] = [];
    const draft = getDraft();
    if (!draft.founded || draft.distress?.stage === 'ended') return work;

    if (phase === 'receipts-inventory') {
      work.push({
        id: 'receipts-and-aging', virtualTime: 10, sequence: 1,
        run() {
          let next = getDraft();
          let alert: { code: string } | undefined;
          for (const order of next.sales.inventory.orders) {
            if (order.receivedDay !== null || order.expectedDay > day) continue;
            try {
              next = applyDomainOps(next, {
                domain: 'inventory',
                command: { id: `auto-receive:${order.orderId}`, type: 'receive', day, orderId: order.orderId },
              }, limits).domain;
            } catch (error) {
              if (error instanceof InventoryError && error.code === 'insufficient-cash') {
                alert = { code: 'supply-cash-shortfall' };
              } else throw error;
            }
          }
          if (next.sales.inventory.lastAgedDay < day) {
            next = applyDomainOps(next, {
              domain: 'inventory', command: { id: `daily-age:${day}`, type: 'age', day },
            }, limits).domain;
          }
          setDraft(next);
          return alert;
        },
      });
    }

    if (phase === 'production-delivery-invoicing' && day === scenario.contract.deliveryDueDay) {
      work.push({
        id: 'check-delivery-deadline', virtualTime: 20, sequence: 1,
        run() {
          const offer = getDraft().sales.offers.find(({ offerId }) => offerId === scenario.contract.id);
          if (offer && offer.acceptedDay !== null && offer.deliveredQuantity < offer.quantity) {
            return { code: 'delivery-missed' };
          }
        },
      });
    }

    if (phase === 'collections-payments') {
      work.push({
        id: 'settle-due-items', virtualTime: 30, sequence: 1,
        run() {
          let next = getDraft();
          let alert: { code: string } | undefined;
          for (const inv of next.sales.invoices) {
            if (inv.payment || day < inv.dueDay + scenario.postClose.customerDelayDays) continue;
            next = applyDomainOps(next, {
              domain: 'sales',
              command: { id: `auto-collect:${inv.id}`, type: 'collect', day, invoiceId: inv.id, mode: 'due' },
            }, limits).domain;
          }
          const payRec = next.sales.workforce.payrollRecords.find(({ id }) => id === payrollScheduleId);
          if (payRec && !payRec.payment && day >= payRec.dueDay) {
            try {
              next = applyDomainOps(next, {
                domain: 'workforce',
                command: { id: `auto-pay-payroll:${payRec.id}:${day}`, type: 'pay-payroll', day, payrollId: payRec.id },
              }, limits).domain;
            } catch (error) {
              if (error instanceof WorkforceError && error.code === 'insufficient-cash') {
                const prevStage = next.distress?.stage;
                const failedId = `payroll:${payRec.id}`;
                const distress = evaluateDistress(next, scenario, day, { failedPaymentId: failedId });
                next = Object.freeze({ ...next, distress, failedPaymentId: failedId });
                if (prevStage !== 'payment-shortfall' && prevStage !== 'default') alert = { code: 'payment-shortfall' };
              } else throw error;
            }
          }
          const dueObs = [...next.treasury.obligations]
            .filter((ob) => !ob.payment && ob.dueDay <= day)
            .sort((a, b) => a.dueDay - b.dueDay ||
              (a.kind === 'interest' ? 0 : 1) - (b.kind === 'interest' ? 0 : 1) ||
              (a.id < b.id ? -1 : Number(a.id > b.id)));
          for (const ob of dueObs) {
            try {
              next = applyDomainFinance(next, {
                id: `auto-pay-ob:${ob.id}:${day}`, type: 'pay-obligation', day, obligationId: ob.id,
              });
              if (next.failedPaymentId === ob.id) next = Object.freeze({ ...next, failedPaymentId: null });
            } catch (error) {
              if (error instanceof FinanceError && error.code === 'insufficient-cash') {
                const prevStage = next.distress?.stage;
                const distress = evaluateDistress(next, scenario, day, { failedPaymentId: ob.id });
                next = Object.freeze({ ...next, distress, failedPaymentId: ob.id });
                if (prevStage !== 'payment-shortfall' && prevStage !== 'default') {
                  alert = alert ?? { code: 'payment-shortfall' };
                }
              } else if (!(error instanceof FinanceError && error.code === 'payment-order')) throw error;
            }
          }
          setDraft(next);
          return alert;
        },
      });
    }

    if (phase === 'accruals') {
      work.push({
        id: 'daily-accruals', virtualTime: 40, sequence: 1,
        run() {
          let next = getDraft();
          if (day === accrualDay && !next.sales.workforce.payrollRecords.some(({ id }) => id === payrollScheduleId)) {
            next = applyDomainOps(next, {
              domain: 'workforce',
              command: { id: `auto-accrue-payroll:${payrollScheduleId}`, type: 'accrue-payroll', day, payrollId: payrollScheduleId },
            }, limits).domain;
          }
          if (day === scenario.postClose.day &&
              !next.treasury.obligations.some(({ id }) => id === scenario.postClose.rentObligationId)) {
            next = applyDomainFinance(next, {
              id: `accrue-rent:${day}`, type: 'accrue-obligation', day, kind: 'rent',
              obligationId: scenario.postClose.rentObligationId,
              dueDay: scenario.postClose.rentDueDay, amountMinor: scenario.postClose.rentAmountMinor,
            });
            if (next.restockChoice === 'pending') next = Object.freeze({ ...next, restockChoice: 'deferred' });
          }
          setDraft(next);
        },
      });
    }

    if (phase === 'market-alerts') {
      work.push({
        id: 'assess-status', virtualTime: 50, sequence: 1,
        run() {
          let next = getDraft();
          const distress = evaluateDistress(next, scenario, day);
          next = Object.freeze({ ...next, distress });
          let alert: { code: string } | undefined;
          if (distress.stage === 'default') alert = { code: 'company-default' };
          else if (day === scenario.contract.offerExpiresDay) {
            const offer = next.sales.offers.find(({ offerId }) => offerId === scenario.contract.id);
            if (offer && offer.acceptedDay === null) alert = { code: 'offer-expired' };
          } else if (day === scenario.calendar.firstCloseDay) alert = { code: 'month-closed' };
          else if (!next.overdueNotified && day > scenario.contract.paymentDueDay &&
              next.sales.invoices.some((inv) => !inv.payment && inv.dueDay < day)) {
            next = Object.freeze({ ...next, overdueNotified: true });
            alert = { code: 'invoice-overdue' };
          }
          setDraft(next);
          return alert;
        },
      });
    }

    if (phase === 'month-end') {
      work.push({
        id: 'finance-month-end', virtualTime: Number.MAX_SAFE_INTEGER, sequence: Number.MAX_SAFE_INTEGER,
        run() {
          let next = getDraft();
          const closed = next.treasury.closes.some(({ throughDay }) => throughDay === day);
          if (!closed && BigInt(balanceSheet(next.ledger, day).assets) >= 0n) {
            next = applyDomainFinance(next, { id: `finance-month-end:${day}`, day, type: 'close-month' });
            setDraft(next);
          }
        },
      });
    }
    return work;
  };
}
