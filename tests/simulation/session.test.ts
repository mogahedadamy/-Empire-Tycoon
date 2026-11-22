/** Covers the public protocol, rejection receipts, replay and atomic command execution. */
import { expect, it } from 'vitest';
import {
  createSimulationSession,
  maxAdvanceDays,
  replaySimulation,
  type PhaseSchedule,
} from '../../packages/simulation/src';
import { command, options, snapshot, submit } from './fixtures';

it('replays the original result for a retry and rejects an ID reused for another payload', () => {
  const host = createSimulationSession(options);
  const original = submit(host, 'first', 0, { type: 'advance', days: 2 });
  submit(host, 'second', 2, { type: 'advance', days: 1 });
  const beforeRetry = snapshot(host);

  const retry = submit(host, 'first', 0, { type: 'advance', days: 2 });
  const conflict = submit(host, 'first', 3, { type: 'advance', days: 3 });

  expect(retry).toEqual(original);
  expect(conflict).toMatchObject({
    revision: 3,
    outcome: { status: 'rejected', code: 'conflict' },
  });
  expect(snapshot(host)).toEqual(beforeRetry);
  expect(host.commandLog()).toHaveLength(2);
});

it('rejects a stale command before running rules and retains its original rejection', () => {
  let phaseCalls = 0;
  const host = createSimulationSession({
    ...options,
    schedule() {
      phaseCalls += 1;
      return [];
    },
  });
  submit(host, 'advance', 0, { type: 'advance', days: 1 });
  const before = snapshot(host);
  const beforeCalls = phaseCalls;

  const stale = submit(host, 'stale', 0, { type: 'advance', days: 2 });
  expect(stale).toMatchObject({
    revision: 1,
    outcome: { status: 'rejected', code: 'stale-revision' },
  });
  expect(submit(host, 'stale', 1, { type: 'advance', days: 2 })).toEqual(stale);
  expect(snapshot(host)).toEqual(before);
  expect(phaseCalls).toBe(beforeCalls);
});

it('rebuilds the same serialized snapshot and receipts from the original schedule, seed and log', () => {
  const schedule: PhaseSchedule = ({ day, phase }) => phase === 'market-alerts' ? [{
    id: 'decision',
    virtualTime: 0,
    sequence: 0,
    run(random) {
      const value = random();
      if (day === 2) return { code: `decision-${value}` };
    },
  }] : [];
  const configuration = { ...options, seed: 17, schedule };
  const live = createSimulationSession(configuration);
  const first = submit(live, 'batch', 0, { type: 'advance', days: 5 });
  const stale = submit(live, 'stale', 0, { type: 'advance', days: 1 });
  const alertId = snapshot(live).pendingAlerts[0].id;
  submit(live, 'resolve', 2, { type: 'resolve-alert', alertId });
  submit(live, 'finish', 3, { type: 'advance-through', day: 5 });

  const log = JSON.parse(JSON.stringify(live.commandLog()));
  const replayed = replaySimulation(configuration, log);
  const differentSeed = replaySimulation({ ...configuration, seed: 18 }, log);
  expect(JSON.stringify(snapshot(replayed))).toBe(JSON.stringify(snapshot(live)));
  expect(replayed.commandLog()).toEqual(live.commandLog());
  expect(submit(replayed, 'batch', 0, { type: 'advance', days: 5 })).toEqual(first);
  expect(submit(replayed, 'stale', 0, { type: 'advance', days: 1 })).toEqual(stale);
  expect(snapshot(differentSeed).randomState).not.toBe(snapshot(live).randomState);
});

it('isolates sessions and rejects malformed messages and invalid targets', () => {
  const host = createSimulationSession(options);
  const other = createSimulationSession({ ...options, sessionId: 'other' });
  const request = command('shared-id', 0, { type: 'advance', days: 1 });

  expect(host.handle({ ...request, version: 2 })).toMatchObject({ code: 'invalid-request' });
  expect(host.handle({ ...request, expectedRevision: -1 })).toMatchObject({ code: 'invalid-request' });
  expect(host.handle({ ...request, payload: { type: 'advance', days: 1.5 } })).toMatchObject({
    code: 'invalid-request',
  });
  expect(other.handle(request)).toMatchObject({ code: 'session-mismatch' });
  expect(other.commandLog()).toEqual([]);

  const overLimit = submit(host, 'oversized', 0, { type: 'advance', days: maxAdvanceDays + 1 });
  const past = submit(host, 'past', 0, { type: 'advance-through', day: 0 });
  const absent = submit(host, 'no-alert', 0, { type: 'resolve-alert', alertId: 'absent' });
  expect(overLimit.outcome).toEqual({ status: 'rejected', code: 'invalid-target' });
  expect(past.outcome).toEqual({ status: 'rejected', code: 'invalid-target' });
  expect(absent.outcome).toEqual({ status: 'rejected', code: 'alert-not-pending' });
  expect(host.handle(request)).toMatchObject({ revision: 1, outcome: { status: 'accepted' } });
  expect(other.handle({ ...request, sessionId: 'other' })).toMatchObject({
    revision: 1,
    outcome: { status: 'accepted' },
  });
});

it('leaves the snapshot and log intact if a rule fails partway through a batch', () => {
  let fail = true;
  const host = createSimulationSession({
    ...options,
    schedule({ day }) {
      if (fail && day === 2) throw new Error('rule failure');
      return [{ id: 'draw', virtualTime: 0, sequence: 0, run(random) { random(); } }];
    },
  });
  const before = snapshot(host);
  const request = command('batch', 0, { type: 'advance', days: 2 });

  expect(() => host.handle(request)).toThrow('rule failure');
  expect(snapshot(host)).toEqual(before);
  expect(host.commandLog()).toEqual([]);

  fail = false;
  expect(host.handle(request)).toMatchObject({ revision: 2, outcome: { status: 'accepted', sequence: 1 } });
  expect(host.commandLog()).toEqual([request]);
});
