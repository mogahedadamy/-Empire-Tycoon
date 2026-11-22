/** Covers calendar parity, close ordering, and decision pauses through the host port. */
import { expect, it } from 'vitest';
import {
  createSimulationSession,
  type PhaseSchedule,
} from '../../packages/simulation/src';
import { options, snapshot, submit } from './fixtures';

const dailyOrder = [
  'receipts-inventory',
  'production-delivery-invoicing',
  'collections-payments',
  'accruals',
  'market-alerts',
];

it('closes five days in a single advance exactly like five individual days', () => {
  const schedule: PhaseSchedule = () => [{
    id: 'draw',
    virtualTime: 0,
    sequence: 0,
    run(nextRandomUint32) { nextRandomUint32(); },
  }];
  const batch = createSimulationSession({ ...options, schedule });
  const steps = createSimulationSession({ ...options, schedule });

  const result = submit(batch, 'batch', 0, { type: 'advance', days: 5 });
  for (let index = 0; index < 5; index += 1) {
    submit(steps, `step-${index}`, index, { type: 'advance', days: 1 });
  }

  expect(snapshot(batch)).toEqual(snapshot(steps));
  expect(snapshot(batch)).toMatchObject({ openDay: 6, lastClosedDay: 5, revision: 5 });
  expect(snapshot(batch).randomState).not.toBe(options.seed);
  expect(result.outcome).toMatchObject({
    status: 'accepted',
    commandDay: 1,
    sequence: 1,
    progress: {
      type: 'progress',
      commandId: 'batch',
      revision: 5,
      requestedDays: 5,
      closedDays: 5,
      lastClosedDay: 5,
      stopReason: 'target-reached',
    },
  });
});

it('runs the five close phases in order and closes the month after day 30', () => {
  const calls: string[] = [];
  const host = createSimulationSession({
    ...options,
    schedule({ day, phase }) {
      if (day >= 29) calls.push(`${day}/${phase}`);
      return [];
    },
  });

  submit(host, 'through', 0, { type: 'advance-through', day: 31 });

  expect(calls).toEqual([
    ...dailyOrder.map((phase) => `29/${phase}`),
    ...dailyOrder.map((phase) => `30/${phase}`),
    '30/month-end',
    ...dailyOrder.map((phase) => `31/${phase}`),
  ]);
  expect(snapshot(host)).toMatchObject({ openDay: 32, lastClosedDay: 31, revision: 31 });
});

it('orders phase work by virtual time, sequence, and ordinal ID', () => {
  const calls: string[] = [];
  const host = createSimulationSession({
    ...options,
    schedule({ phase }) {
      if (phase !== 'receipts-inventory') return [];
      const entries = [
        { id: 'z', virtualTime: 4, sequence: 0 },
        { id: 'b', virtualTime: 2, sequence: 1 },
        { id: 'a', virtualTime: 2, sequence: 1 },
        { id: 'late-sequence', virtualTime: 2, sequence: 2 },
        { id: 'early', virtualTime: 1, sequence: 10 },
      ];
      return entries.map((work) => ({ ...work, run() { calls.push(work.id); } }));
    },
  });

  submit(host, 'step', 0, { type: 'advance', days: 1 });
  expect(calls).toEqual(['early', 'a', 'b', 'late-sequence', 'z']);
});

it('commits the full alert day and resumes after all decisions are cleared', () => {
  const host = createSimulationSession({
    ...options,
    schedule({ day, phase }) {
      if (day !== 30 || (phase !== 'market-alerts' && phase !== 'month-end')) return [];
      return [{
        id: 'decision',
        virtualTime: 0,
        sequence: 0,
        run: () => ({ code: phase }),
      }];
    },
  });

  const progress = submit(host, 'until-alert', 0, { type: 'advance-through', day: 35 });
  expect(progress.outcome).toMatchObject({
    status: 'accepted',
    progress: { closedDays: 30, lastClosedDay: 30, stopReason: 'decision-required' },
  });
  const [first, second] = snapshot(host).pendingAlerts;
  expect([first.code, second.code]).toEqual(['market-alerts', 'month-end']);
  expect(first.day).toBe(30);
  const blocked = submit(host, 'blocked', 30, { type: 'advance', days: 1 });
  expect(blocked.outcome).toEqual({ status: 'rejected', code: 'decision-required' });

  submit(host, 'resolve-first', 30, { type: 'resolve-alert', alertId: first.id });
  expect(snapshot(host).pendingAlerts).toEqual([second]);
  const stillBlocked = submit(host, 'still-blocked', 31, { type: 'advance', days: 1 });
  expect(stillBlocked.outcome).toEqual({ status: 'rejected', code: 'decision-required' });
  submit(host, 'resolve-second', 31, { type: 'resolve-alert', alertId: second.id });
  submit(host, 'resume', 32, { type: 'advance-through', day: 35 });

  expect(snapshot(host)).toMatchObject({
    openDay: 36,
    lastClosedDay: 35,
    revision: 37,
    pendingAlerts: [],
  });
});
