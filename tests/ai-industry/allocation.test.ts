/** Tests compatible allocation, fixed commitments, replay and atomic reservation across windows. */
import { expect, it } from 'vitest';
import aiAuthored from '../../packages/content/data/contract-before-launch.json';
import { replayProcurement, type ProcurementCommand } from '../../packages/ai-industry/src';
import { parseAiScenario } from '../../packages/content/src/ai';
import { cooling, first, harbor, job, network, plateau, procurementOptions, start } from './procurement-fixture';

it('blocks incompatible groups and never joins units from separate pools', () => {
  const { run } = start();
  const result = run(first, [
    job('memory-limit', 1, { memoryGiB: 128 }), job('interconnect-limit', 1, { interconnectGbps: 600 }),
    job('not-in-region', 1, { regionId: 'southern-cove', hardwareFamilyId: 'basalt-80' }), job('cannot-split', 40),
  ]);
  expect(result.assignments).toEqual([
    { status: 'deferred', jobId: 'cannot-split', reason: 'capacity-unavailable', largestEligibleUnits: 36 },
    { status: 'deferred', jobId: 'interconnect-limit', reason: 'insufficient-interconnect', largestEligibleUnits: 0 },
    { status: 'deferred', jobId: 'memory-limit', reason: 'insufficient-memory', largestEligibleUnits: 0 },
    { status: 'deferred', jobId: 'not-in-region', reason: 'no-compatible-group', largestEligibleUnits: 0 },
  ]);
});

it('reallocates interrupted requests by priority, due window and ID with separate capacity and cost totals', () => {
  const { session, accept, submit, run } = start();
  accept('book', { type: 'reserve-compute', groupId: harbor, units: 12, windowIds: [first, network] });
  const jobs = [
    job('b-evaluation', 16, { dueWindowId: network, kind: 'evaluation' }),
    job('a-evaluation', 16, { dueWindowId: network, kind: 'evaluation' }),
    job('urgent', 20),
    job('service', 12, { priority: 30, allowInterruptible: false, kind: 'service' }),
    job('small', 8, { priority: 5 }),
  ];
  const planned = session.preview(first, jobs);
  expect(session.preview(first, [...jobs].reverse())).toEqual(planned);
  const result = run(first, jobs);
  expect(result.plannedAssignments).toEqual(planned.assignments);
  expect(result.assignments).toMatchObject([
    { jobId: 'service', groupId: harbor, reservedUnits: 12 },
    { jobId: 'urgent', groupId: plateau, interruptibleUnits: 20 },
    { jobId: 'a-evaluation', groupId: plateau, interruptibleUnits: 16 },
    { jobId: 'b-evaluation', status: 'deferred', largestEligibleUnits: 12 },
    { jobId: 'small', groupId: harbor, interruptibleUnits: 8 },
  ]);
  expect(result.interruptions).toEqual([
    { jobId: 'urgent', previousGroupId: harbor, reassignedGroupId: plateau },
    { jobId: 'a-evaluation', previousGroupId: harbor, reassignedGroupId: plateau },
    { jobId: 'b-evaluation', previousGroupId: harbor, reassignedGroupId: null },
  ]);
  expect(result.groups.find(({ group }) => group.id === harbor)).toMatchObject({
    availableUnits: 24, bookedUnits: 12, usage: { reservedUnits: 12, interruptibleUnits: 8 },
    cost: { reservedMinor: '4800', interruptibleMinor: '1920', totalMinor: '6720', settlement: 'cash' },
    acceleratorEnergyWh: '0',
  });
  expect(result.groups.find(({ group }) => group.id === plateau)).toMatchObject({
    availableUnits: 36, usage: { interruptibleUnits: 36 }, cost: { totalMinor: '10080' },
  });
  expect(submit('repeat-job', { type: 'run-compute-window', windowId: network, jobs: [jobs[2]] }))
    .toMatchObject({ code: 'job-already-executed' });
  const retry = run(network, [jobs[0]]);
  expect(retry.assignments[0]).toMatchObject({ jobId: 'b-evaluation', status: 'allocated' });
  expect(replayProcurement(procurementOptions(), session.commandLog()).read()).toEqual(session.read());
  expect(() => replayProcurement(procurementOptions(), [...session.commandLog(), session.commandLog()[0]]))
    .toThrow('Invalid compute command log');
});

it('rejects an overlapping multi-window booking atomically and charges idle reservations once', () => {
  const { session, submit, accept, run } = start();
  accept('book', { type: 'reserve-compute', groupId: harbor, units: 100, windowIds: [network] });
  const before = session.read();
  expect(submit('overbook', { type: 'reserve-compute', groupId: harbor, units: 1, windowIds: [first, network] }))
    .toMatchObject({ status: 'rejected', code: 'reservation-limit' });
  expect(session.read()).toEqual(before);
  expect(submit('skip', { type: 'run-compute-window', windowId: network, jobs: [] }))
    .toMatchObject({ code: 'invalid-window' });

  run(first);
  const command: ProcurementCommand = { id: 'idle', version: 1, expectedRevision: session.read().revision,
    action: { type: 'run-compute-window', windowId: network, jobs: [] } };
  const confirmed = session.submit(command);
  expect(confirmed).toMatchObject({ status: 'accepted', event: { type: 'window-completed' } });
  expect(session.submit({ ...command, action: { jobs: [], windowId: network, type: 'run-compute-window' } })).toEqual(confirmed);
  expect(session.submit({ ...command, action: { type: 'run-compute-window', windowId: cooling, jobs: [] } }))
    .toMatchObject({ code: 'command-conflict' });
  expect(session.read().balance.cash).toBe('13160000');
  expect(session.read().journal.at(-1)?.lines).toContainEqual({ account: 'computeExpense', side: 'debit', amount: '40000' });
  expect(session.read().journal).toHaveLength(3);
});

it('records the supplier payable when company cash cannot cover the window charge', () => {
  const scenario = parseAiScenario({ ...aiAuthored, founderCapitalMinor: '7900010' });
  const { session, accept, submit, run } = start(procurementOptions(scenario, 'general-lab'));
  expect(submit('no-funding', { type: 'purchase-hardware', offerId: 'harbor-basalt-batch', groupId: 'owned-wadi-basalt', day: 1, units: 1 }))
    .toMatchObject({ code: 'insufficient-cash' });
  accept('book', { type: 'reserve-compute', groupId: harbor, units: 1, windowIds: [first] });
  const result = run(first);
  expect(result.groups.find(({ group }) => group.id === harbor)?.cost)
    .toMatchObject({ totalMinor: '400', settlement: 'payable' });
  expect(session.read().balance).toMatchObject({ cash: '10', liabilities: '400' });
  expect(session.read().journal.at(-1)?.lines).toContainEqual({ account: 'supplierPayables', side: 'credit', amount: '400' });
});
