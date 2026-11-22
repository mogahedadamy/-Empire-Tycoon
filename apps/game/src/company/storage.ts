/** Opens the company resume point and queues writes at durable gameplay checkpoints. */
import type { Scenario } from '../../../../packages/content/src';
import { createSaveRepository, SaveError, type SaveErrorCode } from '../../../../packages/storage/src';
import { openIndexedDbSaveStore } from '../../../../packages/storage/web/indexed-db';
import { createCompanyHost, type CompanyCommand } from './host';

export const databaseName = 'empire-tycoon-solo';
export type SaveNotice =
  | { readonly kind: 'saved' | 'saving' | 'recovered' }
  | { readonly kind: SaveErrorCode | 'unavailable'; readonly found?: number; readonly supported?: number };

function notification(error: unknown): SaveNotice {
  return error instanceof SaveError
    ? { kind: error.code, found: error.found, supported: error.supported }
    : { kind: 'unavailable' };
}

/** Restores the verified checkpoint and prepares immediate writes and foreground checks. */
export async function openCompanyStorage(scenario: Scenario, report: (notice: SaveNotice) => void) {
  let host = createCompanyHost(scenario);
  let close: (() => void) | undefined;
  try {
    const store = await openIndexedDbSaveStore(indexedDB, databaseName);
    close = store.close;
    const repository = createSaveRepository<CompanyCommand>({
      store,
      slot: `single-player:company:${scenario.id}`,
      identity: {
        scenarioId: scenario.id, rulesetVersion: scenario.rulesetVersion, contentVersion: scenario.contentVersion,
      },
      verify: (progress) => { createCompanyHost(scenario, progress); },
      now: () => new Date().toISOString(),
    });
    let token: string | null = null;
    let storedRevision = -1;
    let blocked = false;

    async function load() {
      const opened = await repository.load();
      if (!opened) {
        const initial = host.capture();
        token = await repository.save(initial, null);
        storedRevision = initial.checkpoint.revision;
        return { kind: 'saved' } as const;
      }

      host = createCompanyHost(scenario, opened.envelope);
      token = opened.token;
      storedRevision = opened.envelope.checkpoint.revision;
      if (opened.migrated || opened.recovered) token = await repository.save(host.capture(), token);
      return { kind: opened.recovered ? 'recovered' : 'saved' } as const;
    }

    let notice: SaveNotice;
    try {
      notice = await load();
    } catch (error) {
      // A different tab can establish or migrate the first slot while this tab is opening.
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

    function save() {
      if (blocked) return;
      const progress = host.capture();
      if (progress.checkpoint.revision <= storedRevision) return;
      report({ kind: 'saving' });
      enqueue(async () => {
        const { revision } = progress.checkpoint;
        if (revision <= storedRevision) return;
        token = await repository.save(progress, token);
        storedRevision = revision;
        report({ kind: 'saved' });
      });
    }

    function foreground() {
      enqueue(async () => {
        if (!await repository.isCurrent(token)) throw new SaveError('write-conflict');
      });
    }

    return { host, notice, save, foreground, canWrite: () => !blocked };
  } catch (error) {
    close?.();
    const notice = notification(error);
    return {
      host, notice, save: () => {}, foreground: () => {},
      canWrite: () => notice.kind === 'unavailable',
    };
  }
}
