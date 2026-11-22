/** Builds baseline, late-collection and early-collection views and compares containment options. */
import { applyBasisPoints, parseMinorUnits } from '../money';
import { liquidityHorizonDays, project } from './projection';
import type {
  LiquidityAlert, LiquidityInput, LiquidityProjection, ProjectedMovement, ScheduledCashFlow,
} from './types';

function date(day: number, minimum = 1) {
  if (!Number.isSafeInteger(day) || day < minimum) throw new RangeError('Invalid liquidity date');
  return day;
}

function validate(input: LiquidityInput) {
  date(input.day);
  date(input.day + liquidityHorizonDays);
  parseMinorUnits(input.cashMinor);
  date(input.policy.pessimisticDelayDays, 0);
  date(input.policy.optimisticEarlyDays, 0);
  date(input.policy.defaultGraceDays, 1);
  const ids = new Set<string>();
  for (const flow of input.flows) {
    if (ids.has(flow.id)) throw new RangeError('Duplicate cash flow');
    ids.add(flow.id);
    date(flow.dueDay);
    if (parseMinorUnits(flow.amountMinor) <= 0n) throw new RangeError('Invalid cash flow amount');
    const rate = flow.earlyPaymentDiscountBps ?? 0;
    if (!Number.isSafeInteger(rate) || rate < 0 || rate >= 10_000) throw new RangeError('Invalid discount');
  }
  if (input.credit) {
    date(input.credit.availableDay);
    if (parseMinorUnits(input.credit.availableMinor) < 0n) throw new RangeError('Invalid credit amount');
  }
}

function movement(flow: ScheduledCashFlow, projectedDay: number, rate = 0): ProjectedMovement {
  const face = BigInt(flow.amountMinor);
  const discount = applyBasisPoints(face, rate);
  return Object.freeze({
    id: flow.id, source: flow.source, partyId: flow.partyId, dueDay: flow.dueDay,
    projectedDay, amountMinor: (face - discount).toString(), discountMinor: discount.toString(),
    direction: flow.source === 'invoice' ? 'in' : 'out', journalEntryId: flow.journalEntryId,
  });
}

function alerts(input: LiquidityInput, baseline: LiquidityProjection): readonly LiquidityAlert[] {
  const result: LiquidityAlert[] = [];
  const invoices = input.flows.filter(({ source }) => source === 'invoice');
  for (const item of invoices) {
    if (item.dueDay < input.day) result.push(Object.freeze({
      code: 'invoice-overdue', id: item.id, partyId: item.partyId,
      source: item.source, dueDay: item.dueDay, amountMinor: item.amountMinor,
    }));
  }
  const nextReceipt = baseline.movements.find(({ direction }) => direction === 'in');
  if (nextReceipt) {
    for (const pay of baseline.movements) {
      if (pay.source !== 'payroll' || pay.projectedDay >= nextReceipt.projectedDay) continue;
      result.push(Object.freeze({
        code: 'payroll-before-collection', id: pay.id, partyId: pay.partyId, source: pay.source,
        dueDay: pay.dueDay, amountMinor: pay.amountMinor, relatedId: nextReceipt.id,
      }));
    }
  }
  const gap = baseline.firstShortfall;
  if (gap) result.push(Object.freeze({
    code: 'projected-shortfall', id: gap.sourceId, partyId: gap.partyId, source: gap.reason,
    dueDay: gap.dueDay, amountMinor: gap.amountMinor,
  }));
  return Object.freeze(result);
}

function recoveryOptions(input: LiquidityInput, movements: readonly ProjectedMovement[], baseline: LiquidityProjection) {
  const gap = baseline.firstShortfall;
  if (!gap) return Object.freeze([]);

  const options: {
    kind: 'early-collection' | 'approved-credit';
    partyId: string;
    sourceId: string;
    latestDay: number;
    costMinor: string | null;
    immediateCashMinor: string;
    projection: LiquidityProjection;
  }[] = [];
  for (const invoice of input.flows) {
    if (invoice.source !== 'invoice' || !invoice.earlyPaymentDiscountBps || invoice.dueDay <= gap.day) continue;
    const replacement = movement(invoice, gap.day, invoice.earlyPaymentDiscountBps);
    options.push(Object.freeze({
      kind: 'early-collection', partyId: invoice.partyId, sourceId: invoice.id,
      latestDay: gap.day, costMinor: replacement.discountMinor, immediateCashMinor: replacement.amountMinor,
      projection: project(input, [...movements.filter(({ id }) => id !== invoice.id), replacement]),
    }));
  }

  const credit = input.credit;
  if (credit && credit.availableDay <= gap.day && BigInt(credit.availableMinor) > 0n) {
    const draw = BigInt(credit.availableMinor) < BigInt(gap.amountMinor) ? credit.availableMinor : gap.amountMinor;
    const receipt: ProjectedMovement = Object.freeze({
      id: credit.facilityId, source: 'credit', partyId: credit.partyId, dueDay: gap.day,
      projectedDay: gap.day, amountMinor: draw, direction: 'in', discountMinor: '0',
    });
    options.push(Object.freeze({
      kind: 'approved-credit', partyId: credit.partyId, sourceId: credit.facilityId,
      latestDay: gap.day, costMinor: null, immediateCashMinor: draw, projection: project(input, [...movements, receipt]),
    }));
  }
  return Object.freeze(options);
}

/** Projects cash over 30 days. Scenario assumptions and forecasts do not change the input or ledger. */
export function forecastLiquidity(input: LiquidityInput) {
  validate(input);
  const baselineFlows = input.flows.map((flow) => movement(flow, Math.max(input.day, flow.dueDay)));
  const baseline = project(input, baselineFlows);
  const pessimistic = project(input, input.flows.map((flow) => movement(flow,
    flow.source === 'invoice'
      ? date(Math.max(input.day, flow.dueDay) + input.policy.pessimisticDelayDays)
      : Math.max(input.day, flow.dueDay))));
  const optimistic = project(input, input.flows.map((flow) => {
    const due = Math.max(input.day, flow.dueDay);
    const rate = flow.earlyPaymentDiscountBps ?? 0;
    if (flow.source !== 'invoice' || rate === 0 || due === input.day) return movement(flow, due);

    const earlier = Math.max(input.day, due - input.policy.optimisticEarlyDays);
    return movement(flow, earlier, earlier < due ? rate : 0);
  }));

  const unusedCredit = input.credit && input.credit.availableDay <= input.day ? input.credit.availableMinor : '0';
  return Object.freeze({
    companyId: input.companyId, currency: input.currency, asOfDay: input.day,
    confirmed: Object.freeze({
      cashMinor: input.cashMinor, availableCreditMinor: unusedCredit,
      operatingLiquidityMinor: (BigInt(input.cashMinor) + BigInt(unusedCredit)).toString(),
    }),
    assumptions: Object.freeze({ ...input.policy }),
    baseline, pessimistic, optimistic, alerts: alerts(input, baseline),
    recoveryOptions: recoveryOptions(input, baselineFlows, baseline),
  });
}
