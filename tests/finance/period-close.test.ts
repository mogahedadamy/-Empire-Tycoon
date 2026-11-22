/** Verifies the ET-003 reference and the constraints of ET-009 month-end postings. */
import { expect, it } from 'vitest';
import { balanceSheet, directCashFlow, incomeStatement, Ledger } from '../../packages/finance/src';
import { fixtureLedger, month, transaction } from './fixture';
import { apply, close, loan, openFinance, referenceBeforeClose } from './treasury-fixture';

it('closes the reference month with 100 interest and 150 tax, repeating neither', () => {
  const open = referenceBeforeClose();
  const closed = apply(open, close);
  expect(closed.state.closes[0]).toMatchObject({
    fromDay: 1, throughDay: 30, utilitiesMinor: '30000', depreciationMinor: '10000',
    interestMinor: '10000', taxMinor: '15000',
  });
  const expected = fixtureLedger();
  expect(balanceSheet(closed.ledger, 30)).toEqual(balanceSheet(expected, 30));
  expect(incomeStatement(closed.ledger, month)).toEqual(incomeStatement(expected, month));
  expect(directCashFlow(closed.ledger, month)).toEqual(directCashFlow(expected, month));
  expect(closed.state.obligations.map(({ kind, dueDay }) => [kind, dueDay]))
    .toEqual([['principal', 60], ['utilities', 31], ['interest', 31], ['tax', 40]]);
  expect(apply(closed, close).ledger).toBe(closed.ledger);
  expect(() => apply(closed, { ...close, id: 'repeat' })).toThrow('already-closed');
  expect(() => apply(closed, { ...loan, id: 'late', loanId: 'backdated' })).toThrow('period-closed');
  expect(() => apply(open, { ...close, day: 60 })).toThrow('invalid-close-day');
});

it('caps depreciation at carrying value and computes no tax on a loss', () => {
  const ledger = Ledger.open({ companyId: 'small', currency: 'GAME' }).post([transaction('small-equipment', 1,
    { account: 'equipment', side: 'debit', amount: '5000' },
    { account: 'cash', side: 'credit', amount: '5000', cashFlow: 'investing' },
  )]);
  const first = apply(openFinance(ledger), close);
  expect(first.state.closes[0]).toMatchObject({ depreciationMinor: '5000', taxMinor: '0' });
  const second = apply(first, { ...close, id: 'second-month', day: 60 });
  expect(second.state.closes[1]).toMatchObject({ depreciationMinor: '0', taxMinor: '0' });
  expect(second.state.obligations.filter(({ kind }) => kind === 'tax')).toEqual([]);
});

it('calculates the next month on the outstanding opening principal, with no daily proration', () => {
  const drawn = apply(openFinance(), { ...loan, installments: [
    { dueDay: 20, amountMinor: '400000' }, { dueDay: 90, amountMinor: '600000' },
  ] });
  const reduced = apply(drawn, {
    type: 'pay-obligation', id: 'early-installment', day: 20, obligationId: 'principal:starter-loan:20',
  });
  const first = apply(reduced, close);
  const second = apply(first, { ...close, id: 'second', day: 60 });
  expect(second.state.closes.map(({ interestMinor }) => interestMinor)).toEqual(['10000', '6000']);
});
