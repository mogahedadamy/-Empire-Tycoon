/** Keeps the latest validated checkpoint and its predecessor behind an optimistic write token. */
import { decodeEnvelope, schemaVersion } from './envelope';
import { SaveError, type SaveEnvelope, type SaveIdentity, type SaveProgress, type SaveRecord, type SaveStore } from './types';

export interface SaveRepositoryOptions<Command> {
  readonly store: SaveStore;
  readonly slot: string;
  readonly identity: SaveIdentity;
  /** Verifies and replays domain data before a record can become current. */
  readonly verify: (progress: SaveProgress<Command>) => void;
  readonly now: () => string;
}

export function createSaveRepository<Command>(options: SaveRepositoryOptions<Command>) {
  const { store, slot, identity, verify, now } = options;
  function checked(raw: string) {
    const decoded = decodeEnvelope<Command>(raw, identity);
    try {
      verify(decoded.envelope);
    } catch {
      throw new SaveError('invalid-save');
    }
    return decoded;
  }

  function select(record: SaveRecord) {
    try {
      return { ...checked(record.head), validRaw: record.head, recovered: false };
    } catch (error) {
      // A newer application may own this slot. Compatibility errors must survive recovery.
      if (!(error instanceof SaveError) || error.code !== 'invalid-save' || record.previous === null) throw error;
      return { ...checked(record.previous), validRaw: record.previous, recovered: true };
    }
  }

  return {
    /** Opens the newest valid save, or its backup if the head was damaged. */
    async load() {
      const record = await store.read(slot);
      if (!record) return null;
      const { validRaw: _validRaw, ...selected } = select(record);
      return { ...selected, token: record.head };
    },

    /** Commits only against the caller's opened version. Verified migrations retain their original. */
    async save(progress: SaveProgress<Command>, expectedHead: string | null) {
      const record = await store.read(slot);
      if ((record?.head ?? null) !== expectedHead) throw new SaveError('write-conflict');
      const envelope: SaveEnvelope<Command> = {
        schemaVersion, mode: 'single-player', ...identity, savedAt: now(),
        checkpoint: progress.checkpoint, commands: progress.commands,
      };
      const raw = JSON.stringify(envelope);
      const next = checked(raw).envelope;
      const previous = record ? select(record) : null;
      if (previous) {
        const previousProgress = previous.envelope;
        if (next.checkpoint.revision < previousProgress.checkpoint.revision ||
            next.checkpoint.day < previousProgress.checkpoint.day) throw new SaveError('write-conflict');
        if (next.checkpoint.revision === previousProgress.checkpoint.revision) {
          const exact = JSON.stringify(next.checkpoint) === JSON.stringify(previousProgress.checkpoint) &&
            JSON.stringify(next.commands) === JSON.stringify(previousProgress.commands);
          if (!exact) throw new SaveError('write-conflict');
          if (!previous.migrated && !previous.recovered) return previous.validRaw;
        }
      }
      if (!await store.compareAndSwap(slot, expectedHead, { head: raw, previous: previous?.validRaw ?? null })) {
        throw new SaveError('write-conflict');
      }
      return raw;
    },

    /** Reports changes by another context without opening or modifying its save. */
    async isCurrent(token: string | null) {
      return ((await store.read(slot))?.head ?? null) === token;
    },
  };
}
