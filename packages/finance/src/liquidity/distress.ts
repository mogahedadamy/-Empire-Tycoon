/** Tracks escalation from forecast warning to actual unpaid obligations and an explicit exit. */
import { forecastLiquidity } from './forecast';
import type { LiquidityInput, LiquiditySource, ScheduledCashFlow } from './types';

export type DistressStage = 'healthy' | 'warning' | 'payment-shortfall' | 'default' | 'recovered' | 'ended';

export interface DistressCause {
  readonly reason: 'projected-shortfall' | 'unpaid-obligation';
  readonly source: LiquiditySource | 'opening-cash';
  readonly sourceId: string;
  readonly partyId: string;
  readonly amountMinor: string;
  readonly dueDay: number;
  readonly responseByDay: number;
}

export interface DistressCase {
  readonly companyId: string;
  readonly currency: string;
  readonly day: number;
  readonly stage: DistressStage;
  readonly cause: DistressCause | null;
  readonly canOperate: boolean;
  readonly ending: { readonly cashMinor: string; readonly unpaidIds: readonly string[] } | null;
}

export interface DistressAction {
  /** ID of an unpaid, confirmed liability rejected for insufficient cash by the authoritative host today. */
  readonly failedPaymentId?: string;
  readonly endCompany?: boolean;
}

function confirmedDebt(flow: ScheduledCashFlow) {
  return flow.source !== 'invoice' && flow.source !== 'purchase' && flow.committed !== false;
}

function deadline(dueDay: number, days: number) {
  const result = dueDay + days;
  if (!Number.isSafeInteger(result)) throw new RangeError('Invalid distress deadline');
  return result;
}

/**
 * Reassesses a case using the current balances. Only confirmed liabilities can cause default.
 * Ending a defaulted company records the outstanding obligations and preserves its accounts.
 */
export function reviewDistress(
  input: LiquidityInput, previous: DistressCase | null = null, action: DistressAction = {},
): DistressCase {
  if (previous && (previous.companyId !== input.companyId || previous.currency !== input.currency ||
      previous.day > input.day)) throw new RangeError('Distress case does not match the company or date');
  if (previous?.stage === 'ended') return previous;

  const forecast = forecastLiquidity(input);
  const debts = input.flows.filter(confirmedDebt);
  const failed = action.failedPaymentId === undefined ? undefined :
    debts.find(({ id, dueDay }) => id === action.failedPaymentId && dueDay <= input.day);
  if (action.failedPaymentId !== undefined && (!failed || BigInt(input.cashMinor) >= BigInt(failed.amountMinor))) {
    throw new RangeError('Expected a due liability blocked by insufficient cash');
  }

  const overdue = debts.filter((flow) => flow.dueDay < input.day || flow === failed)
    .sort((a, b) => a.dueDay - b.dueDay || (a.id < b.id ? -1 : Number(a.id > b.id)));
  const unpaid = overdue[0];
  const gap = forecast.baseline.firstShortfall;
  let cause: DistressCause | null = null;
  let stage: DistressStage = previous && previous.stage !== 'healthy' ? 'recovered' : 'healthy';

  if (unpaid) {
    const responseByDay = deadline(unpaid.dueDay, input.policy.defaultGraceDays);
    stage = input.day >= responseByDay ? 'default' : 'payment-shortfall';
    cause = Object.freeze({
      reason: 'unpaid-obligation', source: unpaid.source, sourceId: unpaid.id, partyId: unpaid.partyId,
      amountMinor: unpaid.amountMinor, dueDay: unpaid.dueDay, responseByDay,
    });
  } else if (gap) {
    stage = 'warning';
    cause = Object.freeze({
      reason: 'projected-shortfall', source: gap.reason, sourceId: gap.sourceId, partyId: gap.partyId,
      amountMinor: gap.amountMinor, dueDay: gap.dueDay, responseByDay: gap.day,
    });
  }

  if (action.endCompany && stage !== 'default') throw new RangeError('Only a defaulted company can end');
  const ending = action.endCompany ? Object.freeze({
    cashMinor: input.cashMinor, unpaidIds: Object.freeze(overdue.map(({ id }) => id)),
  }) : null;

  return Object.freeze({
    companyId: input.companyId, currency: input.currency, day: input.day,
    stage: ending ? 'ended' : stage, cause, canOperate: !ending, ending,
  });
}
