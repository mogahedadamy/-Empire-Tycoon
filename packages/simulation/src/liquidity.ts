/** Reads the confirmed ledger and open commercial records for the liquidity forecast. */
import { balanceSheet, type ApprovedCredit, type FinanceState, type Ledger,
  type LiquidityInput, type LiquidityPolicy, type ScheduledCashFlow } from '../../finance/src';
import { scheduledPayrollAmount, type SalesSnapshot } from '../../operations/src';

export interface LiquiditySnapshot {
  /** The host's authoritative ledger after incorporating the submitted domain snapshots. */
  readonly ledger: Ledger;
  readonly treasury: FinanceState;
  readonly sales: SalesSnapshot;
  readonly day: number;
  readonly policy: LiquidityPolicy;
  readonly credit?: ApprovedCredit;
}

const creditors = {
  rent: 'landlord', utilities: 'utilities-provider', tax: 'tax-authority',
  interest: 'lender', principal: 'lender',
} as const;

/** Maps unpaid invoices, liabilities, and planned payroll/purchases into the shared forecast. */
export function readLiquidityInput(snapshot: LiquiditySnapshot): LiquidityInput {
  const { ledger, treasury, sales, day, policy, credit } = snapshot;
  const states = [treasury, sales.ledger, sales.workforce, sales.inventory];
  if (states.some((state) => state.companyId !== ledger.companyId || state.currency !== ledger.currency)) {
    throw new RangeError('Liquidity snapshots must belong to the same company and currency');
  }
  if (day < Math.max(1, sales.day, treasury.day, sales.inventory.day, sales.workforce.day)) {
    throw new RangeError('Liquidity day must include all committed state');
  }

  const offers = new Map(sales.offers.map((offer) => [offer.offerId, offer]));
  const payroll = new Map(sales.workforce.payrollRecords.map((item) => [item.id, item]));
  const flows: ScheduledCashFlow[] = [];

  for (const invoice of sales.invoices) {
    if (invoice.payment) continue;
    const offer = offers.get(invoice.contractId);
    if (!offer) throw new RangeError('Expected contract for open invoice');
    flows.push({
      id: invoice.id, source: 'invoice', partyId: invoice.customerId, dueDay: invoice.dueDay,
      amountMinor: invoice.amountMinor, journalEntryId: invoice.salesEntryId,
      earlyPaymentDiscountBps: offer.earlyPaymentDiscountBps,
    });
  }
  for (const obligation of treasury.obligations) {
    if (obligation.payment) continue;
    flows.push({
      id: obligation.id, source: obligation.kind, partyId: obligation.loanId ?? creditors[obligation.kind],
      dueDay: obligation.dueDay, amountMinor: obligation.amountMinor, journalEntryId: obligation.accrualEntryId,
    });
  }

  const wage = scheduledPayrollAmount(sales.workforce);
  for (const schedule of sales.workforce.payroll) {
    const record = payroll.get(schedule.id);
    if (record?.payment) continue;
    flows.push({
      id: `payroll:${schedule.id}`, source: 'payroll', partyId: 'employees', dueDay: schedule.dueDay,
      amountMinor: record?.amountMinor ?? wage, journalEntryId: record?.accrualEntryId, committed: !!record,
    });
  }
  for (const order of sales.inventory.orders) {
    if (order.payment !== 'cash' || order.receivedDay !== null) continue;
    flows.push({
      id: `purchase:${order.orderId}`, source: 'purchase', partyId: order.supplierId, dueDay: order.expectedDay,
      amountMinor: (BigInt(order.quantity) * BigInt(order.unitCostMinor)).toString(), committed: false,
    });
  }

  return Object.freeze({
    companyId: ledger.companyId, currency: ledger.currency, day, cashMinor: balanceSheet(ledger, day).cash,
    flows: Object.freeze(flows.map((flow) => Object.freeze(flow))),
    policy: Object.freeze({ ...policy }), credit: credit ? Object.freeze({ ...credit }) : undefined,
  });
}
