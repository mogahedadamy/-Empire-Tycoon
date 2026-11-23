/** Persistent local storage for the unified Empire Tycoon investor portfolio (IndexedDB + fallback). */
import { createInitialEmpire, deserializeEmpire, serializeEmpire, type EmpireState } from '../../../../packages/empire/src';
import { openIndexedDbSaveStore } from '../../../../packages/storage/web/indexed-db';

const DB_NAME = 'empire-tycoon-solo';
const SLOT = 'empire-tycoon:investor:v1';
const FALLBACK_KEY = 'empire-tycoon-investor-v1';

export interface EmpirePersistence {
  load(nowMs: number): Promise<EmpireState>;
  save(state: EmpireState): Promise<void>;
  reset(nowMs: number): Promise<EmpireState>;
}

export async function createEmpirePersistence(): Promise<EmpirePersistence> {
  let store: Awaited<ReturnType<typeof openIndexedDbSaveStore>> | null = null;
  let head: string | null = null;
  try {
    if (typeof indexedDB !== 'undefined') {
      store = await openIndexedDbSaveStore(indexedDB, DB_NAME);
    }
  } catch {
    store = null;
  }

  async function save(state: EmpireState) {
    const serialized = serializeEmpire(state);
    try {
      localStorage.setItem(FALLBACK_KEY, serialized);
    } catch {
      // Ignore quota/private mode errors.
    }
    if (!store) return;
    try {
      const ok = await store.compareAndSwap(SLOT, head, { head: serialized, previous: head });
      if (ok) {
        head = serialized;
      } else {
        const latest = await store.read(SLOT);
        head = latest?.head ?? null;
        await store.compareAndSwap(SLOT, head, { head: serialized, previous: head });
        head = serialized;
      }
    } catch {
      // LocalStorage backup already updated.
    }
  }

  return {
    async load(nowMs: number) {
      try {
        if (store) {
          const rec = await store.read(SLOT);
          if (rec) {
            head = rec.head;
            return deserializeEmpire(rec.head, nowMs);
          }
        }
      } catch {
        // Fallback below.
      }
      try {
        const raw = localStorage.getItem(FALLBACK_KEY);
        if (raw) return deserializeEmpire(raw, nowMs);
      } catch {
        // Ignore unavailable storage.
      }
      return createInitialEmpire(nowMs);
    },
    save,
    async reset(nowMs: number) {
      const fresh = createInitialEmpire(nowMs);
      await save(fresh);
      return fresh;
    },
  };
}
