/** Persists verified Big Order journey saves in IndexedDB while keeping the worker authoritative. */
import type { Scenario } from '../../../../packages/content/src';
import {
  createSaveRepository, SaveError, type SaveProgress,
} from '../../../../packages/storage/src';
import { openIndexedDbSaveStore } from '../../../../packages/storage/web/indexed-db';
import type { SaveNotice } from '../company/storage';
import { createJourneyEngine } from './engine';
import type { JourneyCommandRecord } from './types';

export const journeyDatabaseName = 'empire-tycoon-solo';

function notification(error: unknown): SaveNotice {
  return error instanceof SaveError
    ? { kind: error.code, found: error.found, supported: error.supported }
    : { kind: 'unavailable' };
}

function clearIndexedDbSlot(factory: IDBFactory, dbName: string, slot: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = factory.open(dbName, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('slots', 'readwrite');
      tx.objectStore('slots').delete(slot);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Failed to clear save slot')); };
    };
  });
}

/** Opens the single-player journey slot, returning any verified save for worker replay. */
export async function openJourneyStorage(scenario: Scenario, report: (notice: SaveNotice) => void) {
  const slot = `single-player:journey:${scenario.id}`;
  let close: (() => void) | undefined;
  try {
    const store = await openIndexedDbSaveStore(indexedDB, journeyDatabaseName);
    close = store.close;
    const repository = createSaveRepository<JourneyCommandRecord>({
      store,
      slot,
      identity: {
        scenarioId: scenario.id, rulesetVersion: scenario.rulesetVersion, contentVersion: scenario.contentVersion,
      },
      verify: (progress) => { createJourneyEngine(scenario, progress); },
      now: () => new Date().toISOString(),
    });

    let token: string | null = null;
    let storedRevision = -1;
    let blocked = false;
    let initialProgress: SaveProgress<JourneyCommandRecord> | undefined;
    let needsRepair = false;

    async function load() {
      const opened = await repository.load();
      if (!opened) return { kind: 'saved' } as const;
      initialProgress = { checkpoint: opened.envelope.checkpoint, commands: opened.envelope.commands };
      token = opened.token;
      storedRevision = opened.envelope.checkpoint.revision;
      needsRepair = opened.migrated || opened.recovered;
      return { kind: opened.recovered ? 'recovered' : 'saved' } as const;
    }

    let notice: SaveNotice;
    try {
      notice = await load();
    } catch (error) {
      if (!(error instanceof SaveError) || error.code !== 'write-conflict') throw error;
      notice = await load();
    }

    let queue = Promise.resolve();
    function enqueue(work: () => Promise<void>) {
      queue = queue.then(async () => {
        if (blocked) return;
        try {
          await work();
        } catch (error) {
          const message = notification(error);
          blocked = message.kind !== 'unavailable';
          report(message);
        }
      });
    }

    function commit(progress: SaveProgress<JourneyCommandRecord> | undefined) {
      if (blocked || !progress) return;
      if (!needsRepair && progress.checkpoint.revision <= storedRevision) return;
      report({ kind: 'saving' });
      const repair = needsRepair;
      needsRepair = false;
      enqueue(async () => {
        if (!repair && progress.checkpoint.revision <= storedRevision) return;
        token = await repository.save(progress, token);
        storedRevision = progress.checkpoint.revision;
        report({ kind: 'saved' });
      });
    }

    function foreground() {
      enqueue(async () => {
        if (token !== null && !await repository.isCurrent(token)) throw new SaveError('write-conflict');
      });
    }

    async function reset() {
      await queue;
      close?.();
      await clearIndexedDbSlot(indexedDB, journeyDatabaseName, slot);
    }

    return {
      initialProgress,
      notice,
      commit,
      foreground,
      reset,
      canWrite: () => !blocked,
      flush: () => queue,
      close: () => close?.(),
    };
  } catch (error) {
    close?.();
    const notice = notification(error);
    return {
      initialProgress: undefined,
      notice,
      commit: () => {},
      foreground: () => {},
      reset: async () => {},
      canWrite: () => notice.kind === 'unavailable',
      flush: async () => {},
      close: () => {},
    };
  }
}

export type JourneyStorage = Awaited<ReturnType<typeof openJourneyStorage>>;
