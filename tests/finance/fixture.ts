/** Posts every transaction in ECONOMY_FIXTURE.md, with amounts in minor units. */
import {
  applyBasisPoints,
  incomeStatement,
  Ledger,
  parseMinorUnits,
  type JournalEntryInput,
  type JournalLine,
} from '../../packages/finance/src';

export const month = { fromDay: 1, throughDay: 30 };

export function transaction(
  id: string,
  day: number,
  ...lines: JournalLine[]
): JournalEntryInput {
  return { id, sourceId: `event-${id}`, day, lines };
}

export function fixtureLedger(): Ledger {
  const beforeTax = Ledger.open({ companyId: 'food-company', currency: 'GAME' }).post([
    transaction('capital', 1,
      { account: 'cash', side: 'debit', amount: '3000000', cashFlow: 'financing' },
      { account: 'contributedCapital', side: 'credit', amount: '3000000' }),
    transaction('deposit', 1,
      { account: 'rentalDeposits', side: 'debit', amount: '200000' },
      { account: 'cash', side: 'credit', amount: '200000', cashFlow: 'operating' }),
    transaction('equipment', 1,
      { account: 'equipment', side: 'debit', amount: '600000' },
      { account: 'cash', side: 'credit', amount: '600000', cashFlow: 'investing' }),
    transaction('inventory', 2,
      { account: 'inventory', side: 'debit', amount: '400000' },
      { account: 'cash', side: 'credit', amount: '400000', cashFlow: 'operating' }),
    transaction('loan', 3,
      { account: 'cash', side: 'debit', amount: '1000000', cashFlow: 'financing' },
      { account: 'loanPrincipal', side: 'credit', amount: '1000000' }),
    transaction('sale', 20,
      { account: 'receivables', side: 'debit', amount: '525000' },
      { account: 'sales', side: 'credit', amount: '525000' }),
    transaction('cost', 20,
      { account: 'costOfSales', side: 'debit', amount: '280000' },
      { account: 'inventory', side: 'credit', amount: '280000' }),
    transaction('payroll', 28,
      { account: 'payrollExpense', side: 'debit', amount: '120000' },
      { account: 'cash', side: 'credit', amount: '120000', cashFlow: 'operating' }),
    transaction('utilities', 30,
      { account: 'utilitiesExpense', side: 'debit', amount: '30000' },
      { account: 'utilitiesPayable', side: 'credit', amount: '30000' }),
    transaction('depreciation', 30,
      { account: 'depreciationExpense', side: 'debit', amount: '10000' },
      { account: 'accumulatedDepreciation', side: 'credit', amount: '10000' }),
    transaction('interest', 30,
      { account: 'interestExpense', side: 'debit', amount: '10000' },
      { account: 'interestPayable', side: 'credit', amount: '10000' }),
  ]);
  const profit = parseMinorUnits(incomeStatement(beforeTax, month).profitBeforeTax);
  const tax = applyBasisPoints(profit, 2_000).toString();

  return beforeTax.post([transaction('tax', 30,
    { account: 'taxExpense', side: 'debit', amount: tax },
    { account: 'taxPayable', side: 'credit', amount: tax },
  )]);
}
