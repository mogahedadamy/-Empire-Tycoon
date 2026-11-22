/** Validates the save format and migrates legacy flat checkpoints in memory. */
import { SaveError, type SaveEnvelope, type SaveIdentity } from './types';

export const schemaVersion = 2;

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new SaveError('invalid-save');
  return value as Record<string, unknown>;
}

function integer(value: unknown, minimum = 1, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new SaveError('invalid-save');
  }
  return value;
}

function matchVersion(found: unknown, supported: number, code: 'future-ruleset' | 'future-content') {
  const version = integer(found);
  if (version > supported) throw new SaveError(code, version, supported);
  if (version !== supported) throw new SaveError('unsupported-version', version, supported);
  return version;
}

/** Decodes and checks compatibility before returning a version-two envelope. */
export function decodeEnvelope<Command>(raw: string, identity: SaveIdentity) {
  let source: Record<string, unknown>;
  try {
    source = record(JSON.parse(raw));
  } catch {
    throw new SaveError('invalid-save');
  }

  const originalVersion = integer(source.schemaVersion);
  if (originalVersion > schemaVersion) throw new SaveError('future-schema', originalVersion, schemaVersion);
  if (source.scenarioId !== identity.scenarioId || (originalVersion === 2 && source.mode !== 'single-player')) {
    throw new SaveError('invalid-save');
  }
  const rulesetVersion = matchVersion(source.rulesetVersion, identity.rulesetVersion, 'future-ruleset');
  const contentVersion = matchVersion(source.contentVersion, identity.contentVersion, 'future-content');

  const legacy = originalVersion === 1;
  const value = legacy ? {
    revision: source.revision, day: source.day, randomState: source.seed, state: source.snapshot,
  } : record(source.checkpoint);
  if (typeof source.savedAt !== 'string' || !Number.isFinite(Date.parse(source.savedAt)) ||
      typeof value.state !== 'string' || !Array.isArray(source.commands)) {
    throw new SaveError('invalid-save');
  }
  const envelope: SaveEnvelope<Command> = {
    schemaVersion, mode: 'single-player', scenarioId: identity.scenarioId, rulesetVersion, contentVersion,
    savedAt: source.savedAt,
    checkpoint: {
      revision: integer(value.revision, 0), day: integer(value.day),
      randomState: integer(value.randomState, 0, 0xffffffff), state: value.state,
    },
    commands: source.commands as Command[],
  };
  return { envelope, migrated: legacy };
}
