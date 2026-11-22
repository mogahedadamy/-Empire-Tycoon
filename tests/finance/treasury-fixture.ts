/** Shares the founding scenario's rates and reference operating ledger with ET-009 tests. */
import { loadScenario } from '../../packages/content/src';
import { applyFinanceCommand, createFinanceState, Ledger, type FinanceCommand, type FinanceResult } from '../../packages/finance/src';
import { fixtureLedger } from './fixture';

export const scenario = loadScenario('big-order');
export const policy = {
  monthlyUtilitiesMinor: scenario.monthlyClose.utilitiesMinor,
  monthlyDepreciationMinor: scenario.monthlyClose.depreciationMinor,
  incomeTaxBps: scenario.monthlyClose.incomeTaxBps,
  utilitiesDueAfterCloseDays: 1,
  taxDueAfterCloseDays: 10,
};
export const loan = {
  id: 'draw', type: 'disburse-loan', day: 3, loanId: 'starter-loan',
  principalMinor: scenario.opening.loanPrincipalMinor,
  monthlyInterestBps: scenario.opening.loanMonthlyInterestBps,
  interestDueAfterCloseDays: 1,
  installments: [{ dueDay: 60, amountMinor: scenario.opening.loanPrincipalMinor }],
} as const;
export const close = { type: 'close-month', id: 'close-first', day: 30 } as const;

export function apply(finance: FinanceResult, command: FinanceCommand) {
  return applyFinanceCommand(finance.state, finance.ledger, command);
}

export function openFinance(ledger = Ledger.open({ companyId: 'food-company', currency: 'GAME' })) {
  return { state: createFinanceState(ledger, policy), ledger };
}

export function referenceBeforeClose() {
  const operating = fixtureLedger();
  const upstream = operating.entries.filter(({ id }) =>
    ['capital', 'deposit', 'equipment', 'inventory', 'sale', 'cost', 'payroll'].includes(id));
  return apply(openFinance(Ledger.open(operating).post(upstream)), loan);
}
