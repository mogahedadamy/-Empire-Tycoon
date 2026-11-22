/** Derives the balance sheet and period earnings from posted entries. */
import { chartOfAccounts, type AccountGroup, type AccountId } from './accounts';
import { requireDay } from './journal';
import type { Ledger } from './ledger';

export interface ReportingPeriod {
  readonly fromDay: number;
  readonly throughDay: number;
}

const accountIds = Object.keys(chartOfAccounts) as AccountId[];

export function requirePeriod({ fromDay, throughDay }: ReportingPeriod): void {
  requireDay(fromDay);
  requireDay(throughDay, fromDay);
}

function sumAccounts(ledger: Ledger, fromDay: number, throughDay: number) {
  const balances = new Map<AccountId, bigint>();

  for (const entry of ledger.entries) {
    if (entry.day < fromDay || entry.day > throughDay) continue;

    for (const line of entry.lines) {
      const amount = BigInt(line.amount);
      const delta = line.side === 'debit' ? amount : -amount;
      balances.set(line.account, (balances.get(line.account) ?? 0n) + delta);
    }
  }

  return balances;
}

function groupAccounts(balances: ReadonlyMap<AccountId, bigint>) {
  const amounts = {
    assets: 0n,
    liabilities: 0n,
    equity: 0n,
    revenue: 0n,
    costOfSales: 0n,
    operatingExpenses: 0n,
    interestExpense: 0n,
    taxExpense: 0n,
  };
  const accounts: { account: AccountId; group: AccountGroup; amount: string }[] = [];

  for (const account of accountIds) {
    const group = chartOfAccounts[account];
    const debits = balances.get(account) ?? 0n;
    // Contra accounts use their group's sign so their balance reduces the group total.
    const creditPositive = group === 'liabilities' || group === 'equity' || group === 'revenue';
    const amount = creditPositive ? -debits : debits;
    accounts.push({ account, group, amount: amount.toString() });
    amounts[group] += amount;
  }

  return { amounts, accounts };
}

function earnings(amounts: ReturnType<typeof groupAccounts>['amounts']) {
  const grossProfit = amounts.revenue - amounts.costOfSales;
  const operatingProfit = grossProfit - amounts.operatingExpenses;
  const profitBeforeTax = operatingProfit - amounts.interestExpense;
  const netIncome = profitBeforeTax - amounts.taxExpense;
  return { grossProfit, operatingProfit, profitBeforeTax, netIncome };
}

/** Returns balances through the inclusive day. Day zero returns the opening balances.
 * Monetary fields are exact decimal strings of minor units.
 */
export function balanceSheet(ledger: Ledger, throughDay: number) {
  requireDay(throughDay, 0);
  const balances = sumAccounts(ledger, 1, throughDay);
  const { amounts, accounts } = groupAccounts(balances);
  const accumulatedEarnings = earnings(amounts).netIncome;
  const equity = amounts.equity + accumulatedEarnings;

  return {
    companyId: ledger.companyId,
    currency: ledger.currency,
    throughDay,
    cash: (balances.get('cash') ?? 0n).toString(),
    assets: amounts.assets.toString(),
    liabilities: amounts.liabilities.toString(),
    contributedEquity: amounts.equity.toString(),
    accumulatedEarnings: accumulatedEarnings.toString(),
    equity: equity.toString(),
    liabilitiesAndEquity: (amounts.liabilities + equity).toString(),
    accounts: accounts.filter(({ group }) => group === 'assets' || group === 'liabilities' || group === 'equity'),
  };
}

/** Returns accrual earnings for the inclusive period in decimal strings of minor units. */
export function incomeStatement(ledger: Ledger, period: ReportingPeriod) {
  requirePeriod(period);
  const { amounts, accounts } = groupAccounts(sumAccounts(ledger, period.fromDay, period.throughDay));
  const profit = earnings(amounts);

  return {
    companyId: ledger.companyId,
    currency: ledger.currency,
    period: { ...period },
    revenue: amounts.revenue.toString(),
    costOfSales: amounts.costOfSales.toString(),
    grossProfit: profit.grossProfit.toString(),
    operatingExpenses: amounts.operatingExpenses.toString(),
    operatingProfit: profit.operatingProfit.toString(),
    interestExpense: amounts.interestExpense.toString(),
    profitBeforeTax: profit.profitBeforeTax.toString(),
    taxExpense: amounts.taxExpense.toString(),
    netIncome: profit.netIncome.toString(),
    accounts: accounts.filter(({ group }) => group !== 'assets' && group !== 'liabilities' && group !== 'equity'),
  };
}
