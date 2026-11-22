/** Replays seeded policy runs and verifies the measured trade-offs in the report. */
import { expect, it } from 'vitest';
import { difficultyIds } from '../../packages/content/src';
import { policies, seeds } from '../../tools/balance/fixture';
import { runBalanceMatrix } from '../../tools/balance/matrix';
import { runBalanceTrial } from '../../tools/balance/trial';

it.each(difficultyIds)('repeats the financial and market result for %s', (level) => {
  const row = runBalanceTrial(level, 'normal', policies[0], seeds[0]);
  expect(runBalanceTrial(level, 'normal', policies[0], seeds[0])).toEqual(row);
  expect(row.shockDays).toHaveLength(30);
  expect(row.journalEntries).toBeGreaterThan(30);
  expect(runBalanceTrial(level, 'normal', policies[0], seeds[1]).shockDays).not.toEqual(row.shockDays);
});

it('applies customer loss without changing draws and treats funded expansion as debt', () => {
  const base = runBalanceTrial('standard', 'normal', policies[1], seeds[0]);
  const loss = runBalanceTrial('standard', 'customer-loss', policies[1], seeds[0]);
  const growth = runBalanceTrial('standard', 'financed-expansion', policies[1], seeds[0]);
  expect(loss.shockDays).toEqual(base.shockDays);
  expect(base.defaultedMinor).toBe('0');
  expect(BigInt(loss.defaultedMinor)).toBeGreaterThan(0n);
  expect(growth.debtMinor).toBe('870000');
});

it('reports the isolated matrix and identifies policies that dominate the profit comparison', () => {
  const report = runBalanceMatrix();
  expect(report.trials).toBe(180);
  expect(report.groups).toHaveLength(45);
  expect(report.findings).toContainEqual({ code: 'profit-dominance', policy: 'funded-growth', affected: 14, total: 15 });
});
