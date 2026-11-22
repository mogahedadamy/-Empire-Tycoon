/** Tests the shared Worker protocol: ack, lightweight progress, revision guards, and save reopen parity. */
import { expect, it } from 'vitest';
import { loadScenario } from '../../packages/content/src';
import {
  simulationProtocolVersion as version,
  type WorkerAck, type WorkerProgress, type WorkerTransport,
} from '../../packages/contracts/src';
import { createSaveRepository, type SaveRecord, type SaveStore } from '../../packages/storage/src';
import { createJourneyEngine } from '../../apps/game/src/journey/engine';
import { createJourneyWorkerClient } from '../../apps/game/src/journey/worker-client';
import { createJourneyWorkerHost, type JourneyWorkerReply } from '../../apps/game/src/journey/worker-host';
import type { JourneyCommandRecord } from '../../apps/game/src/journey/types';

function createChannel(yieldStep?: () => Promise<void>) {
  const listeners = new Set<(message: unknown) => void>();
  const outbound: JourneyWorkerReply[] = [];
  const host = createJourneyWorkerHost((reply) => {
    const cloned = JSON.parse(JSON.stringify(reply)) as JourneyWorkerReply;
    outbound.push(cloned);
    for (const listener of listeners) listener(cloned);
  }, { yieldStep });

  const transport: WorkerTransport = {
    postMessage(message) {
      void host.receive(JSON.parse(JSON.stringify(message)));
    },
    onMessage(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    transport,
    outbound,
    inject(raw: unknown) {
      for (const listener of listeners) listener(raw);
    },
  };
}

it('emits immediate ack and compact per-day progress without copying world state, matching synchronous replay', async () => {
  const seenAcks: WorkerAck[] = [];
  const seenProgress: WorkerProgress[] = [];
  let releaseStep: (() => void) | null = null;
  let midFlightChecked = false;
  let committedRevDuringFlight = -1;

  const channel = createChannel(() => new Promise<void>((resolve) => {
    releaseStep = resolve;
    queueMicrotask(() => {
      if (releaseStep) {
        const done = releaseStep;
        releaseStep = null;
        done();
      }
    });
  }));

  const client = createJourneyWorkerClient(channel.transport, 'journey:big-order', {
    onAck(ack) { seenAcks.push(ack); },
    onProgress(progress) {
      seenProgress.push(progress);
      if (!midFlightChecked && progress.closedDays === 5) {
        midFlightChecked = true;
        committedRevDuringFlight = client.committedRevision();
      }
    },
  });

  await client.init('big-order');
  await client.command({ type: 'found-company', fundingPlan: 'loan' });
  await client.command({ type: 'accept-contract', offerId: 'weekly-produce-order' });
  await client.command({ type: 'order-supply' });
  const beforeAdvanceRev = client.committedRevision();
  channel.outbound.length = 0;

  const { outcome, model } = await client.command({ type: 'advance-through', day: 17 });
  expect(outcome.status).toBe('accepted');
  expect(model.day).toBe(18);
  expect(model.inventory.quantity).toBe('100');

  expect(channel.outbound[0].type).toBe('ack');
  expect(seenAcks.at(-1)).toMatchObject({ requestedDays: 17, expectedRevision: beforeAdvanceRev });

  const progressReplies = channel.outbound.filter((msg): msg is WorkerProgress => msg.type === 'progress');
  expect(progressReplies).toHaveLength(17);
  expect(seenProgress).toHaveLength(17);
  expect(midFlightChecked).toBe(true);
  // Committed state must remain at the pre-advance revision while progress ticks stream in.
  expect(committedRevDuringFlight).toBe(beforeAdvanceRev);

  for (const [index, tick] of progressReplies.entries()) {
    expect(Object.keys(tick).sort()).toEqual([
      'closedDays', 'commandId', 'lastClosedDay', 'requestedDays', 'revision', 'sessionId', 'stopReason', 'type', 'version',
    ]);
    expect(tick.closedDays).toBe(index + 1);
    expect(JSON.stringify(tick).length).toBeLessThan(260);
  }
  expect(channel.outbound.at(-1)?.type).toBe('result');

  // Replaying the saved command log synchronously produces the exact same checkpoint.
  const replayed = createJourneyEngine(loadScenario('big-order'), client.currentSave());
  expect(replayed.read()).toEqual(model);
});

it('verifies protocol version, session ID, and monotonic revisions and ignores stale messages', async () => {
  const channel = createChannel(async () => {});
  const client = createJourneyWorkerClient(channel.transport, 'journey:big-order');
  await client.init('big-order');
  await client.command({ type: 'found-company', fundingPlan: 'loan' });
  const currentRev = client.committedRevision();
  const currentModel = client.currentModel()!;

  channel.inject({ version: 99, type: 'result', sessionId: 'journey:big-order', commandId: 'x', revision: currentRev + 5, outcome: { status: 'accepted' }, readModel: currentModel });
  channel.inject({ version, type: 'result', sessionId: 'other-session', commandId: 'x', revision: currentRev + 5, outcome: { status: 'accepted' }, readModel: currentModel });
  channel.inject({ version, type: 'result', sessionId: 'journey:big-order', commandId: 'stale', revision: currentRev - 1, outcome: { status: 'accepted' }, readModel: { ...currentModel, day: 99 } });
  channel.inject({ version, type: 'progress', sessionId: 'journey:big-order', commandId: 'unknown', revision: currentRev, requestedDays: 5, closedDays: 1, lastClosedDay: 1, stopReason: 'target-reached' });

  expect(client.ignoredMessages()).toBe(4);
  expect(client.committedRevision()).toBe(currentRev);
  expect(client.currentModel()?.day).toBe(1);
});

it('reproduces the exact liquidity forecast and shortfall diagnosis after saving and reopening a fresh worker', async () => {
  const scenario = loadScenario('big-order');
  let stored: SaveRecord | null = null;
  const store: SaveStore = {
    async read() { return stored; },
    async compareAndSwap(_slot, expectedHead, next) {
      if (expectedHead !== (stored?.head ?? null)) return false;
      stored = next;
      return true;
    },
  };
  const repository = createSaveRepository<JourneyCommandRecord>({
    store, slot: 'journey:test',
    identity: { scenarioId: scenario.id, rulesetVersion: scenario.rulesetVersion, contentVersion: scenario.contentVersion },
    verify: (progress) => { createJourneyEngine(scenario, progress); },
    now: () => '2026-11-22T00:00:00.000Z',
  });

  const first = createJourneyWorkerClient(createChannel(async () => {}).transport, 'journey:big-order');
  await first.init('big-order');
  await first.command({ type: 'found-company', fundingPlan: 'loan' });
  await first.command({ type: 'accept-contract', offerId: scenario.contract.id });
  await first.command({ type: 'order-supply' });
  await first.command({ type: 'advance-through', day: 17 });
  await first.command({ type: 'deliver', offerId: scenario.contract.id, quantity: 50 });
  await first.command({ type: 'advance', days: 1 });
  await first.command({ type: 'deliver', offerId: scenario.contract.id, quantity: 20 });
  await first.command({ type: 'advance-through', day: 30 });
  const { model: beforeReload } = await first.command({ type: 'approve-restock' });
  await repository.save(first.currentSave()!, null);

  const loaded = (await repository.load())!;
  const second = createJourneyWorkerClient(createChannel(async () => {}).transport, 'journey:big-order');
  const afterReload = await second.init('big-order', loaded.envelope);

  expect(afterReload.liquidity).toEqual(beforeReload.liquidity);
  expect(afterReload.distress).toEqual(beforeReload.distress);
  expect(afterReload.balance).toEqual(beforeReload.balance);
  expect(afterReload.monthOneIncome).toEqual(beforeReload.monthOneIncome);
  expect(afterReload.revision).toBe(beforeReload.revision);
});
