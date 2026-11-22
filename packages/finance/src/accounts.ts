/** The chart of accounts for the first business scenario, in reporting order. */
export const chartOfAccounts = Object.freeze({
  cash: 'assets',
  receivables: 'assets',
  inventory: 'assets',
  rentalDeposits: 'assets',
  equipment: 'assets',
  accumulatedDepreciation: 'assets',
  supplierPayables: 'liabilities',
  loanPrincipal: 'liabilities',
  payrollPayable: 'liabilities',
  utilitiesPayable: 'liabilities',
  interestPayable: 'liabilities',
  taxPayable: 'liabilities',
  contributedCapital: 'equity',
  sales: 'revenue',
  salesDiscounts: 'revenue',
  costOfSales: 'costOfSales',
  payrollExpense: 'operatingExpenses',
  utilitiesExpense: 'operatingExpenses',
  rentExpense: 'operatingExpenses',
  depreciationExpense: 'operatingExpenses',
  inventorySpoilageExpense: 'operatingExpenses',
  interestExpense: 'interestExpense',
  taxExpense: 'taxExpense',
} as const);

export type AccountId = keyof typeof chartOfAccounts;
export type AccountGroup = typeof chartOfAccounts[AccountId];

export function isAccountId(value: unknown): value is AccountId {
  return typeof value === 'string' && Object.hasOwn(chartOfAccounts, value);
}
