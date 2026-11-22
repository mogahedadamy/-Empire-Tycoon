/** Platform-independent save envelope, migration, and checkpoint repository. */
export { schemaVersion } from './envelope';
export { createSaveRepository } from './repository';
export type { SaveRepositoryOptions } from './repository';
export { SaveError } from './types';
export type {
  Checkpoint, SaveEnvelope, SaveErrorCode, SaveIdentity, SaveProgress, SaveRecord, SaveStore,
} from './types';
