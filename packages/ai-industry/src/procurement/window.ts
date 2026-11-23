/** Executes a compute window and posts committed and metered charges once to the shared ledger. */
import type { AiScenario, ComputeProcurement } from '../../../content/src/ai';
import { balanceSheet, type JournalLine, type Ledger } from '../../../finance/src';
import { allocateWindow, compareInterruption } from './allocation';
import { windowPools, type WindowPool } from './capacity';
import type { HardwarePurchase } from './supply';
import type { ComputeJob, ComputeReservation, ComputeWindow } from './types';

export function forecastWindow(
  ai: AiScenario, content: ComputeProcurement, window: ComputeWindow, jobs: readonly ComputeJob[],
  purchases: readonly HardwarePurchase[], reservations: readonly ComputeReservation[],
) {
  const groups = Object.freeze(windowPools(content, window, purchases, reservations, false));
  return Object.freeze({ window, groups, assignments: allocateWindow(ai, groups, jobs) });
}

function usedByGroup(pool: WindowPool, assignments: ReturnType<typeof allocateWindow>) {
  const used = { ownedUnits: 0, reservedUnits: 0, interruptibleUnits: 0 };
  for (const job of assignments) {
    if (job.status !== 'allocated' || job.groupId !== pool.group.id) continue;
    used.ownedUnits += job.ownedUnits;
    used.reservedUnits += job.reservedUnits;
    used.interruptibleUnits += job.interruptibleUnits;
  }
  return used;
}

export function executeWindow(
  ai: AiScenario, content: ComputeProcurement, window: ComputeWindow, jobs: readonly ComputeJob[],
  purchases: readonly HardwarePurchase[], reservations: readonly ComputeReservation[], openingLedger: Ledger,
) {
  const forecast = forecastWindow(ai, content, window, jobs, purchases, reservations);
  const pools = windowPools(content, window, purchases, reservations, true);
  const assignments = allocateWindow(ai, pools, jobs);
  let ledger = openingLedger;
  let cash = BigInt(balanceSheet(ledger, window.day).cash);

  const groups = Object.freeze(pools.map((pool) => {
    const { group, bookedUnits } = pool;
    const usage = usedByGroup(pool, assignments);
    const acceleratorEnergyWh = group.kind === 'owned' ? BigInt(usage.ownedUnits) * BigInt(group.acceleratorWatts) : 0n;
    const fixed = group.kind === 'cloud' ? BigInt(bookedUnits) * BigInt(group.reservedUnitPriceMinor) : 0n;
    const metered = group.kind === 'cloud' ? BigInt(usage.interruptibleUnits) * BigInt(group.interruptibleUnitPriceMinor) : 0n;
    const total = fixed + metered;
    let settlement: 'cash' | 'payable' | null = null;
    if (total > 0n) {
      const amount = total.toString();
      const credit: JournalLine = cash >= total
        ? { account: 'cash', side: 'credit', amount, cashFlow: 'operating' }
        : { account: 'supplierPayables', side: 'credit', amount };
      const sourceId = group.id + ':' + window.id;
      ledger = ledger.post([{ id: 'compute-charge:' + sourceId, sourceId, day: window.day, lines: [
        { account: 'computeExpense', side: 'debit', amount }, credit,
      ] }]);
      settlement = credit.account === 'cash' ? 'cash' : 'payable';
      if (settlement === 'cash') cash -= total;
    }
    return Object.freeze({ ...pool,
      usage: Object.freeze(usage), acceleratorEnergyWh: acceleratorEnergyWh.toString(),
      cost: Object.freeze({ reservedMinor: fixed.toString(), interruptibleMinor: metered.toString(),
        totalMinor: total.toString(), settlement }),
    });
  }));

  const receipt = Object.freeze({
    window, assignments, groups, plannedAssignments: forecast.assignments,
    interruptions: compareInterruption(forecast.assignments, assignments),
  });
  return { receipt, ledger };
}

export type ComputeWindowReceipt = ReturnType<typeof executeWindow>['receipt'];
