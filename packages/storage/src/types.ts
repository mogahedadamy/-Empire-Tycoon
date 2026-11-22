/** Single-player persistence contracts. The store commits one slot atomically. */
export interface SaveIdentity {
  readonly scenarioId: string;
  readonly rulesetVersion: number;
  readonly contentVersion: number;
}

export interface Checkpoint {
  readonly revision: number;
  readonly day: number;
  readonly randomState: number;
  /** Serialized source-domain state used to verify restoration. */
  readonly state: string;
}

export interface SaveProgress<Command> {
  readonly checkpoint: Checkpoint;
  readonly commands: readonly Command[];
}

export interface SaveEnvelope<Command> extends SaveIdentity, SaveProgress<Command> {
  readonly schemaVersion: 2;
  readonly mode: 'single-player';
  readonly savedAt: string;
}

export interface SaveRecord {
  readonly head: string;
  readonly previous: string | null;
}

export interface SaveStore {
  read(slot: string): Promise<SaveRecord | null>;
  /** Atomically publishes both records if the current head equals the expected token. */
  compareAndSwap(slot: string, expectedHead: string | null, next: SaveRecord): Promise<boolean>;
}

export type SaveErrorCode =
  | 'invalid-save' | 'future-schema' | 'future-ruleset' | 'future-content'
  | 'unsupported-version' | 'write-conflict';

export class SaveError extends Error {
  constructor(
    readonly code: SaveErrorCode,
    readonly found?: number,
    readonly supported?: number,
  ) {
    super(found === undefined ? code : `${code}: found ${found}, supported ${supported}`);
    this.name = 'SaveError';
  }
}
