/** Day 1 founding and Month 2 rent accrual helpers for the Big Order journey. */
import type { Scenario } from '../../../../packages/content/src';
import { applyBasisPoints, type JournalEntryInput } from '../../../../packages/finance/src';
import {
  applyDomainFinance, applyDomainOps, dailyLimits, evaluateDistress, stockScope,
  type JourneyDomainState,
} from './domain-state';
import type { DecisionImpact, FundingPlan } from './types';

export function addDecision(domain: JourneyDomainState, entry: DecisionImpact): JourneyDomainState {
  return Object.freeze({ ...domain, decisions: Object.freeze([...domain.decisions, Object.freeze(entry)]) });
}

export function ensureRentAccrued(domain: JourneyDomainState, scenario: Scenario, day: number): JourneyDomainState {
  const { postClose } = scenario;
  if (domain.treasury.obligations.some(({ id }) => id === postClose.rentObligationId)) return domain;
  return applyDomainFinance(domain, {
    id: `accrue-rent:${postClose.day}`, type: 'accrue-obligation', day, kind: 'rent',
    obligationId: postClose.rentObligationId, dueDay: postClose.rentDueDay, amountMinor: postClose.rentAmountMinor,
  });
}

/** Posts Day 1 capital, setup assets, optional starter loan, offer publication, and dispatch shifts. */
export function applyFounding(domain: JourneyDomainState, scenario: Scenario, day: number, plan: FundingPlan) {
  const { opening, company, contract, calendar, postClose } = scenario;
  const entries: JournalEntryInput[] = [];
  if (opening.capitalMinor !== '0') {
    entries.push({
      id: 'founder-capital', sourceId: company.id, day, lines: [
        { account: 'cash', side: 'debit', amount: opening.capitalMinor, cashFlow: 'financing' },
        { account: 'contributedCapital', side: 'credit', amount: opening.capitalMinor },
      ],
    });
  }
  const setupAssets = [
    ['rentalDeposits', opening.rentalDepositMinor, 'operating'],
    ['equipment', opening.equipmentMinor, 'investing'],
  ] as const;
  for (const [account, amount, cashFlow] of setupAssets) {
    if (amount === '0') continue;
    entries.push({
      id: `setup-${account}`, sourceId: company.id, day, lines: [
        { account, side: 'debit', amount },
        { account: 'cash', side: 'credit', amount, cashFlow },
      ],
    });
  }
  const ledger = domain.ledger.post(entries);
  let next: JourneyDomainState = Object.freeze({
    ...domain, founded: true, fundingPlan: plan, ledger,
    sales: Object.freeze({ ...domain.sales, ledger }),
  });
  const loanMinor = plan === 'loan' ? opening.loanPrincipalMinor : '0';
  if (plan === 'loan' && loanMinor !== '0') {
    next = applyDomainFinance(next, {
      id: 'opening-loan', type: 'disburse-loan', day, loanId: 'starter-loan',
      principalMinor: loanMinor, monthlyInterestBps: opening.loanMonthlyInterestBps,
      interestDueAfterCloseDays: postClose.interestDueAfterCloseDays,
      installments: [{ dueDay: calendar.firstCloseDay * 2, amountMinor: loanMinor }],
    });
  }
  const limits = dailyLimits(scenario);
  const scope = stockScope(scenario);
  next = applyDomainOps(next, {
    domain: 'sales',
    command: { ...contract, ...scope, type: 'offer', id: 'publish-offer', offerId: contract.id, day },
  }, limits).domain;
  for (let workDay = contract.deliveryStartsDay; workDay <= contract.deliveryDueDay; workDay += 1) {
    next = applyDomainOps(next, {
      domain: 'workforce',
      command: { type: 'schedule-shift', id: `shift-${workDay}`, shiftId: `shift-${workDay}`, roleId: 'dispatch', day, workDay, workers: 1 },
    }, limits).domain;
  }
  const interestCost = plan === 'loan' ? applyBasisPoints(BigInt(loanMinor), opening.loanMonthlyInterestBps).toString() : '0';
  next = addDecision(next, {
    id: `funding:${plan}`, day, kind: 'funding',
    costMinor: interestCost, liquidityProtectionMinor: loanMinor, debtAddedMinor: loanMinor,
  });
  return Object.freeze({ ...next, distress: evaluateDistress(next, scenario, day) });
}
