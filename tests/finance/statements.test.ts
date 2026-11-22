/** Verifies the complete financial fixture and the accounting effects of later collection. */
import { expect, it } from 'vitest';
import { balanceSheet, directCashFlow, incomeStatement } from '../../packages/finance/src';
import { fixtureLedger, month, transaction } from './fixture';

it('matches the 12-entry reference close across all three financial statements', () => {
  const ledger = fixtureLedger();
  const balance = balanceSheet(ledger, 30);

  expect(ledger.entries).toHaveLength(12);
  expect(balance).toMatchObject({
    cash: '2680000',
    assets: '4115000',
    liabilities: '1055000',
    contributedEquity: '3000000',
    accumulatedEarnings: '60000',
    equity: '3060000',
    liabilitiesAndEquity: '4115000',
  });
  expect(balance.accounts).toEqual(expect.arrayContaining([
    { account: 'receivables', group: 'assets', amount: '525000' },
    { account: 'inventory', group: 'assets', amount: '120000' },
    { account: 'rentalDeposits', group: 'assets', amount: '200000' },
    { account: 'equipment', group: 'assets', amount: '600000' },
    { account: 'accumulatedDepreciation', group: 'assets', amount: '-10000' },
    { account: 'taxPayable', group: 'liabilities', amount: '15000' },
  ]));
  expect(incomeStatement(ledger, month)).toMatchObject({
    revenue: '525000',
    costOfSales: '280000',
    grossProfit: '245000',
    operatingExpenses: '160000',
    interestExpense: '10000',
    profitBeforeTax: '75000',
    taxExpense: '15000',
    netIncome: '60000',
  });
  expect(directCashFlow(ledger, month)).toMatchObject({
    operating: { receipts: '0', payments: '720000', net: '-720000' },
    investing: { receipts: '0', payments: '600000', net: '-600000' },
    financing: { receipts: '4000000', payments: '0', net: '4000000' },
    openingCash: '0',
    netChange: '2680000',
    closingCash: balance.cash,
  });
});

it('collects the receivable once without recording another sale or moving the previous close', () => {
  const original = fixtureLedger();
  const receipt = transaction('collection', 31,
    { account: 'cash', side: 'debit', amount: '525000', cashFlow: 'operating' },
    { account: 'receivables', side: 'credit', amount: '525000' });
  const updated = original.post([receipt]);
  const period = { fromDay: 31, throughDay: 31 };

  expect(updated.post([receipt])).toBe(updated);
  expect(balanceSheet(updated, 30)).toEqual(balanceSheet(original, 30));
  expect(balanceSheet(updated, 31)).toMatchObject({
    cash: '3205000',
    accounts: expect.arrayContaining([{ account: 'receivables', group: 'assets', amount: '0' }]),
  });
  expect(incomeStatement(updated, period)).toMatchObject({ revenue: '0', netIncome: '0' });
  expect(directCashFlow(updated, period)).toMatchObject({
    openingCash: '2680000',
    operating: { receipts: '525000', payments: '0', net: '525000' },
    closingCash: '3205000',
  });
});

it('recognizes the 2% early discount in the collection period as a reduction of revenue', () => {
  const original = fixtureLedger();
  const updated = original.post([transaction('early-collection', 31,
    { account: 'cash', side: 'debit', amount: '514500', cashFlow: 'operating' },
    { account: 'salesDiscounts', side: 'debit', amount: '10500' },
    { account: 'receivables', side: 'credit', amount: '525000' },
  )]);

  expect(balanceSheet(updated, 31).cash).toBe('3194500');
  expect(incomeStatement(updated, month).netIncome).toBe('60000');
  expect(incomeStatement(updated, { fromDay: 31, throughDay: 31 })).toMatchObject({
    revenue: '-10500',
    netIncome: '-10500',
  });
});
