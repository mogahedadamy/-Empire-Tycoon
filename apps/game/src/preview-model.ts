/** Calculates the ET-005 read-only projections from the shipped scenario. */
import type { Scenario } from '../../../packages/content/src';
import { applyBasisPoints } from '../../../packages/finance/src';

export type FundingPlan = 'loan' | 'capital';

export function previewModel(scenario: Scenario, plan: FundingPlan) {
  const { opening, supply, contract, payroll, monthlyClose } = scenario;
  const loan = plan === 'loan' ? BigInt(opening.loanPrincipalMinor) : 0n;
  const capital = BigInt(opening.capitalMinor);
  const setup = BigInt(opening.rentalDepositMinor) + BigInt(opening.equipmentMinor);
  const startingCash = BigInt(opening.cashMinor) + capital + loan - setup;
  const stockPurchase = BigInt(supply.unitCostMinor) * BigInt(supply.quantity);
  const revenue = BigInt(contract.unitPriceMinor) * BigInt(contract.quantity);
  const costOfSales = BigInt(supply.unitCostMinor) * BigInt(contract.quantity);
  const wage = BigInt(payroll.amountMinor);
  const beforeTax = revenue - costOfSales - wage - BigInt(monthlyClose.utilitiesMinor)
    - BigInt(monthlyClose.depreciationMinor) - applyBasisPoints(loan, opening.loanMonthlyInterestBps);
  const tax = beforeTax > 0n ? applyBasisPoints(beforeTax, monthlyClose.incomeTaxBps) : 0n;
  const closingCash = startingCash - stockPurchase - wage;

  return {
    loan, capital, setup, startingCash, stockPurchase, revenue, costOfSales,
    closingCash, wage, netIncome: beforeTax - tax, afterCollection: closingCash + revenue,
    deliveryDays: Math.ceil(contract.quantity / opening.dailyHandlingCapacity),
    timeline: [
      { day: scenario.calendar.startDay, cash: startingCash },
      { day: supply.arrivalDay, cash: startingCash - stockPurchase },
      { day: payroll.dueDay, cash: closingCash },
      { day: contract.paymentDueDay, cash: closingCash + revenue },
    ],
  };
}

export type PreviewModel = ReturnType<typeof previewModel>;
