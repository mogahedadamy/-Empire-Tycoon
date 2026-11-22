/** Summarizes a reproducible isolated market matrix and retains measured balance concerns. */
import { difficultyIds } from '../../packages/content/src';
import { horizon, policies, seeds, stresses } from './fixture';
import { runBalanceTrial } from './trial';

function average(values: readonly string[]) {
  return (values.reduce((total, value) => total + BigInt(value), 0n) / BigInt(values.length)).toString();
}

export function runBalanceMatrix() {
  const trials = difficultyIds.flatMap((difficulty) => stresses.flatMap((stress) =>
    policies.flatMap((policy) => seeds.map((seed) => runBalanceTrial(difficulty, stress, policy, seed)))));
  const groups = difficultyIds.flatMap((difficulty) => stresses.flatMap((stress) => policies.map(({ id }) => {
    const selected = trials.filter((trial) => trial.difficulty === difficulty && trial.stress === stress && trial.policy === id);
    return { difficulty, stress, policy: id, averageNetIncomeMinor: average(selected.map(({ netIncomeMinor }) => netIncomeMinor)),
      averageCashMinor: average(selected.map(({ cashMinor }) => cashMinor)),
      averageDefaultedMinor: average(selected.map(({ defaultedMinor }) => defaultedMinor)),
      purchaseShortageRuns: selected.filter(({ supplyBlockedDays }) => supplyBlockedDays > 0).length,
      unpaidOperatingRuns: selected.filter(({ unpaidDays }) => unpaidDays > 0).length,
    };
  })));
  const profitLeaders = policies.map(({ id }) => ({
    policy: id, groupsLed: groups.filter((group) => group.policy === id && groups.every((other) =>
      group.difficulty !== other.difficulty || group.stress !== other.stress || group.policy === other.policy ||
      BigInt(group.averageNetIncomeMinor) > BigInt(other.averageNetIncomeMinor))).length,
  }));
  const comparisons = difficultyIds.length * stresses.length;
  const customerLossRuns = trials.filter(({ defaultedMinor }) => BigInt(defaultedMinor) > 0n).length;
  const purchaseShortageRuns = trials.filter(({ supplyBlockedDays }) => supplyBlockedDays > 0).length;
  const unpaidOperatingRuns = trials.filter(({ unpaidDays }) => unpaidDays > 0).length;
  const findings = [
    ...profitLeaders.filter(({ groupsLed }) => groupsLed * 5 >= comparisons * 4)
      .map(({ policy, groupsLed }) => ({ code: 'profit-dominance', policy, affected: groupsLed, total: comparisons })),
    { code: 'purchase-liquidity', affected: purchaseShortageRuns, total: trials.length },
    { code: 'uncollected-customer-loss', affected: customerLossRuns, total: trials.length },
    { code: 'unpaid-operating-cost', affected: unpaidOperatingRuns, total: trials.length },
  ].filter(({ affected }) => affected > 0);
  return { horizon, seeds, trials: trials.length, groups, profitLeaders, findings,
    customerLossRuns, purchaseShortageRuns, unpaidOperatingRuns };
}
