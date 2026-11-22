/** Stages monthly operating accruals, depreciation, interest and income tax. */
import { daysPerMonth } from '../../../contracts/src';
import type { JournalEntryInput } from '../journal';
import type { Ledger } from '../ledger';
import { applyBasisPoints } from '../money';
import { balanceSheet, incomeStatement } from '../statements';
import { periodInterest } from './loans';
import { appendObligations } from './obligations';
import { accrualLines, postFinance } from './posting';
import { FinanceError, type FinanceState, type MonthlyClose, type Obligation } from './types';
import { dueAfter } from './validation';

function depreciation(ledger: Ledger, state: FinanceState, day: number) {
  const accounts = balanceSheet(ledger, day).accounts;
  const equipment = BigInt(accounts.find(({ account }) => account === 'equipment')?.amount ?? '0');
  const accumulated = BigInt(accounts.find(({ account }) => account === 'accumulatedDepreciation')?.amount ?? '0');
  const carryingValue = equipment + accumulated;
  const amount = BigInt(state.closePolicy.monthlyDepreciationMinor);
  if (carryingValue <= 0n) return 0n;
  return carryingValue < amount ? carryingValue : amount;
}

export function closeMonth(ledger: Ledger, state: FinanceState, day: number) {
  const prior = state.closes.at(-1)?.throughDay ?? 0;
  if (day - prior !== daysPerMonth) throw new FinanceError('invalid-close-day');

  const fromDay = prior + 1;
  const entries: JournalEntryInput[] = [];
  const newObligations: Obligation[] = [];
  const { closePolicy: policy } = state;

  function accrue(
    kind: 'utilities' | 'interest' | 'tax', id: string, amount: bigint, dueDays: number, loanId?: string,
  ) {
    if (amount === 0n) return;

    const amountMinor = amount.toString();
    const accrualEntryId = `finance:close:${id}`;
    entries.push({ id: accrualEntryId, sourceId: id, day, lines: accrualLines(kind, amountMinor) });
    newObligations.push(Object.freeze({
      id, kind, amountMinor, recognizedDay: day, dueDay: dueAfter(day, dueDays),
      accrualEntryId, loanId, payment: null,
    }));
  }

  const utilities = BigInt(policy.monthlyUtilitiesMinor);
  accrue('utilities', `monthly-utilities:${day}`, utilities, policy.utilitiesDueAfterCloseDays);
  const depreciationMinor = depreciation(ledger, state, day).toString();
  if (depreciationMinor !== '0') {
    entries.push({
      id: `finance:close:depreciation:${day}`, sourceId: `month:${day}`, day, lines: [
        { account: 'depreciationExpense', side: 'debit', amount: depreciationMinor },
        { account: 'accumulatedDepreciation', side: 'credit', amount: depreciationMinor },
      ],
    });
  }

  let interest = 0n;
  for (const loan of state.loans) {
    const amount = periodInterest(state, loan, fromDay, day);
    accrue('interest', `interest:${loan.loanId}:${day}`, amount, loan.interestDueAfterCloseDays, loan.loanId);
    interest += amount;
  }

  const beforeTax = postFinance(ledger, entries);
  const profit = BigInt(incomeStatement(beforeTax, { fromDay, throughDay: day }).profitBeforeTax);
  const tax = profit > 0n ? applyBasisPoints(profit, policy.incomeTaxBps) : 0n;
  const preTaxEntryCount = entries.length;
  accrue('tax', `tax:${day}`, tax, policy.taxDueAfterCloseDays);

  const close: MonthlyClose = Object.freeze({
    fromDay, throughDay: day, utilitiesMinor: utilities.toString(), depreciationMinor,
    interestMinor: interest.toString(), taxMinor: tax.toString(),
    journalEntryIds: Object.freeze(entries.map(({ id }) => id)),
  });
  return {
    obligations: appendObligations(state, newObligations),
    ledger: postFinance(beforeTax, entries.slice(preTaxEntryCount)),
    closes: Object.freeze([...state.closes, close]),
  };
}
