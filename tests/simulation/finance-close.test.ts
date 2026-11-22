/** Verifies that the real monthly clock phase publishes finance and clock changes together. */
import { expect, it } from 'vitest';
import { createFinancialSimulation } from '../../packages/simulation/src';
import { referenceBeforeClose } from '../finance/treasury-fixture';
import { command, options, snapshot } from './fixtures';

it('runs the monthly closing phase once when advancing across day 30', () => {
  const finance = referenceBeforeClose();
  const host = createFinancialSimulation({ ...options, finance });
  host.handle(command('to-29', 0, { type: 'advance-through', day: 29 }));
  expect(host.financeSnapshot().ledger).toBe(finance.ledger);

  const advance = command('through-30', 29, { type: 'advance-through', day: 30 });
  const receipt = host.handle(advance);
  expect(receipt).toMatchObject({ revision: 30, outcome: { status: 'accepted' } });
  const closed = host.financeSnapshot();
  expect(closed.state.closes[0]).toMatchObject({ throughDay: 30, taxMinor: '15000' });
  expect(host.handle(advance)).toBe(receipt);
  host.handle(command('to-31', 30, { type: 'advance', days: 1 }));
  expect(host.financeSnapshot()).toBe(closed);
  expect(snapshot(host).lastClosedDay).toBe(31);
});

it('discards a prepared month close if a later phase in the same advance fails', () => {
  const finance = referenceBeforeClose();
  let fail = true;
  const host = createFinancialSimulation({
    ...options,
    finance,
    schedule({ day, phase }) {
      if (fail && day === 31 && phase === 'receipts-inventory') throw new Error('following rule failed');
      return [];
    },
  });
  const before = host.financeSnapshot();
  const request = command('batch', 0, { type: 'advance', days: 31 });
  expect(() => host.handle(request)).toThrow('following rule failed');
  expect(snapshot(host).lastClosedDay).toBe(0);
  expect(host.financeSnapshot()).toBe(before);
  expect(host.commandLog()).toEqual([]);

  fail = false;
  expect(host.handle(request)).toMatchObject({ revision: 31, outcome: { status: 'accepted' } });
  expect(host.financeSnapshot().state.closes).toHaveLength(1);
});
