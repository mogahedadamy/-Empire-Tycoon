/** Exercises success, failure, reopen parity, and mid-command interactivity through the real UI. */
import { afterEach, beforeEach, expect, it } from 'vitest';
import type { Scenario } from '../../packages/content/src';
import type { WorkerTransport } from '../../packages/contracts/src';
import { createSaveRepository, type SaveRecord, type SaveStore } from '../../packages/storage/src';
import { createJourneyEngine } from '../../apps/game/src/journey/engine';
import { mountJourneyApp } from '../../apps/game/src/journey/mount';
import type { JourneyStorage } from '../../apps/game/src/journey/storage';
import type { JourneyCommandRecord } from '../../apps/game/src/journey/types';
import { createJourneyWorkerHost } from '../../apps/game/src/journey/worker-host';
import { FakeDomEnv, FakeElement } from './dom-harness';

let env: FakeDomEnv;
let restoreDom: () => void;

beforeEach(() => {
  env = new FakeDomEnv();
  restoreDom = env.install();
});

afterEach(() => {
  restoreDom();
});

async function flush(turns = 8) {
  for (let i = 0; i < turns; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

function createMemoryHarness(stepGate?: () => Promise<void>) {
  const slots = new Map<string, SaveRecord>();
  const store: SaveStore = {
    async read(slot) { return slots.get(slot) ?? null; },
    async compareAndSwap(slot, expectedHead, next) {
      if (expectedHead !== (slots.get(slot)?.head ?? null)) return false;
      slots.set(slot, next);
      return true;
    },
  };

  function createTransport(): WorkerTransport {
    const listeners = new Set<(message: unknown) => void>();
    const host = createJourneyWorkerHost((reply) => {
      const cloned = JSON.parse(JSON.stringify(reply));
      for (const fn of listeners) fn(cloned);
    }, { yieldStep: stepGate ?? (() => Promise.resolve()) });
    return {
      postMessage(msg) { void host.receive(JSON.parse(JSON.stringify(msg))); },
      onMessage(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    };
  }

  async function openStorage(scenario: Scenario): Promise<JourneyStorage> {
    const slot = `test:journey:${scenario.id}`;
    const repo = createSaveRepository<JourneyCommandRecord>({
      store, slot,
      identity: { scenarioId: scenario.id, rulesetVersion: scenario.rulesetVersion, contentVersion: scenario.contentVersion },
      verify: (progress) => { createJourneyEngine(scenario, progress); },
      now: () => '2026-11-22T00:00:00.000Z',
    });
    const opened = await repo.load();
    let token = opened?.token ?? null;
    let storedRev = opened?.envelope.checkpoint.revision ?? -1;
    let queue = Promise.resolve();
    return {
      initialProgress: opened ? { checkpoint: opened.envelope.checkpoint, commands: opened.envelope.commands } : undefined,
      notice: { kind: 'saved' },
      commit(progress) {
        if (!progress || progress.checkpoint.revision <= storedRev) return;
        queue = queue.then(async () => {
          if (progress.checkpoint.revision <= storedRev) return;
          token = await repo.save(progress, token);
          storedRev = progress.checkpoint.revision;
        });
      },
      foreground() {},
      async reset() { await queue; slots.delete(slot); token = null; storedRev = -1; },
      canWrite: () => true,
      flush: () => queue,
      close() {},
    };
  }

  return { createTransport, openStorage };
}

function click(selector: string) {
  const el = env.root.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  el.click();
  return el;
}

function navClick(index: number) {
  const items = env.root.querySelectorAll('.nav-item');
  if (!items[index]) throw new Error(`Missing nav item ${index}`);
  items[index].click();
}

async function foundSignOrder(appRoot: FakeElement) {
  click('[data-found-company]');
  await flush();
  navClick(2); // Contracts
  click('[data-sign-contract]');
  await flush();
  navClick(1); // Company
  click('[data-order-supply]');
  await flush();
  expect(appRoot.textContent.length).toBeGreaterThan(0);
}

it('plays the full success journey through the UI, stays interactive during long Worker progress, and restores diagnosis on reopen', async () => {
  let stepCount = 0;
  let releaseMidFlight: (() => void) | null = null;
  let paused = false;

  const harness = createMemoryHarness(() => {
    stepCount += 1;
    if (stepCount === 4 && !paused) {
      paused = true;
      return new Promise<void>((resolve) => { releaseMidFlight = resolve; });
    }
    return Promise.resolve();
  });

  const app = await mountJourneyApp({
    entryMode: 'management',
    root: env.root as unknown as HTMLElement,
    live: env.live as unknown as HTMLElement,
    createTransport: harness.createTransport,
    openStorage: harness.openStorage,
  });

  // Skip and re-enable guidance, found with loan, sign contract, order supply.
  await foundSignOrder(env.root);
  expect(env.root.querySelector('.guidance-bar')).not.toBeNull();
  click('[data-skip-guidance]');
  expect(env.root.querySelector('.guidance-bar')).toBeNull();
  click('[data-toggle-guidance]');
  expect(env.root.querySelector('.guidance-bar')).not.toBeNull();

  // Launch multi-day supply-arrival advance (8 days) and prove UI stays interactive mid-flight!
  click('[data-advance-milestone="supply-arrival"]');
  await flush(3);
  const banner = env.root.querySelector('.worker-banner')!;
  expect(banner.hidden).toBe(false);
  expect(banner.dataset.workerState).toBe('progress');
  expect(app.getModel().day).toBe(1); // Committed model stays untouched while progress streams.

  // Interact with UI mid-flight: switch language to EN and navigate to Finance!
  click('.language');
  expect(env.documentElement.dir).toBe('ltr');
  navClick(3); // Finance
  expect(env.root.querySelector('#page-title')?.textContent).toBe('Financial review');

  // Release the worker and complete delivery, close, and Day 31 restock crunch.
  releaseMidFlight!();
  await flush(12);
  expect(app.getModel().day).toBe(9);
  expect(env.root.querySelector('.worker-banner')?.hidden).toBe(true);

  click('[data-advance-milestone="delivery-window"]');
  await flush(15);
  expect(app.getModel().day).toBe(18);

  // Test invalid delivery input & stale preview diff through the UI before completing 50 + 20 delivery.
  navClick(2); // Contracts
  env.root.querySelector('#delivery-quantity')!.input('51');
  click('[data-delivery-action]');
  await flush();
  expect(env.root.querySelector('.field-error')).not.toBeNull();

  env.root.querySelector('#delivery-quantity')!.input('50');
  click('[data-delivery-action]');
  await flush();
  click('[data-delivery-action]');
  await flush();
  expect(app.getModel().offer?.deliveredQuantity).toBe(50);

  click('[data-advance-one]');
  await flush();
  env.root.querySelector('#delivery-quantity')!.input('20');
  click('[data-delivery-action]');
  await flush();
  click('[data-delivery-action]');
  await flush();
  expect(app.getModel().offer?.deliveredQuantity).toBe(70);

  // Advance to Day 30 close, approve restock on Day 31 -> 400 shortfall diagnosis.
  click('[data-advance-milestone="monthly-close"]');
  await flush(20);
  expect(app.getModel().day).toBe(31);
  navClick(0); // Overview
  expect(env.root.querySelector('.company-context-bar')).not.toBeNull();
  expect(env.root.querySelector('.metric-profit')?.textContent).toContain('Month 1 net income');
  expect(env.root.querySelector('.why-drawer')).not.toBeNull();
  click('[data-approve-restock]');
  await flush();
  await app.flushSave();
  const diagnosed = app.getModel();
  expect(diagnosed.balance.cash).toBe('180000');
  expect(diagnosed.distress.stage).toBe('warning');
  expect(env.root.querySelector('[data-distress-stage="warning"]')).not.toBeNull();

  // Reopen the UI from saved storage and confirm identical forecast & diagnosis.
  app.dispose();
  const reopened = await mountJourneyApp({
    entryMode: 'management',
    root: env.root as unknown as HTMLElement,
    live: env.live as unknown as HTMLElement,
    createTransport: harness.createTransport,
    openStorage: harness.openStorage,
  });
  expect(reopened.getModel().liquidity).toEqual(diagnosed.liquidity);
  expect(reopened.getModel().distress).toEqual(diagnosed.distress);

  // Apply early collection containment solution and complete the journey on Day 45.
  click('[data-collect-early]');
  await flush();
  expect(reopened.getModel().balance.cash).toBe('694500');
  click('[data-advance-milestone="rent-due"]');
  await flush(10);
  click('[data-advance-milestone="scenario-end"]');
  await flush(20);
  expect(reopened.getModel().evaluation.status).toBe('succeeded');
  expect(env.root.querySelector('.report-panel .notice.success')).not.toBeNull();
  reopened.dispose();
});

it('verifies UI failure paths: rejected shortfall payment, default escalation, end company, and readable statements', async () => {
  const harness = createMemoryHarness();
  const app = await mountJourneyApp({
    entryMode: 'management',
    root: env.root as unknown as HTMLElement,
    live: env.live as unknown as HTMLElement,
    createTransport: harness.createTransport,
    openStorage: harness.openStorage,
  });

  await foundSignOrder(env.root);
  click('[data-advance-milestone="supply-arrival"]');
  await flush(12);
  click('[data-advance-milestone="delivery-window"]');
  await flush(15);
  navClick(2);
  env.root.querySelector('#delivery-quantity')!.input('50');
  click('[data-delivery-action]');
  await flush();
  click('[data-delivery-action]');
  await flush();
  click('[data-advance-one]');
  await flush();
  env.root.querySelector('#delivery-quantity')!.input('20');
  click('[data-delivery-action]');
  await flush();
  click('[data-delivery-action]');
  await flush();
  click('[data-advance-milestone="monthly-close"]');
  await flush(20);

  navClick(0);
  click('[data-approve-restock]');
  await flush();
  click('[data-advance-one]'); // Close Day 31 -> openDay 32 (rent due!)
  await flush();
  expect(app.getModel().day).toBe(32);

  // Attempt rent payment with only 1,800 cash -> rejected cleanly with 400 shortfall and payment-shortfall stage.
  click('[data-pay-obligation="warehouse-rent-32"]');
  await flush();
  expect(app.getModel().distress.stage).toBe('payment-shortfall');
  expect(app.getModel().balance.cash).toBe('180000');
  expect(env.root.querySelector('.notice.error')).not.toBeNull();

  // Let grace period expire through Day 35 -> default -> explicitly end company.
  for (let i = 0; i < 4; i += 1) {
    if (env.root.querySelector('[data-ack-alert]')) { click('[data-ack-alert]'); await flush(); }
    if (app.getModel().distress.stage === 'default') break;
    click('[data-advance-one]');
    await flush();
  }
  expect(app.getModel().distress.stage).toBe('default');
  click('[data-end-company]');
  await flush();
  expect(app.getModel().distress.stage).toBe('ended');
  expect(app.getModel().evaluation.status).toBe('ended-default');
  expect(env.root.querySelector('.report-panel .notice.error')).not.toBeNull();

  // Statements and ledger remain readable after ending; starting a new run resets to Day 1 setup.
  navClick(3); // Finance
  expect(env.root.querySelector('#journal-title')).not.toBeNull();
  navClick(0); // Overview
  click('[data-new-run]');
  await flush(10);
  expect(app.getModel().founded).toBe(false);
  expect(app.getModel().day).toBe(1);
  app.dispose();
});
