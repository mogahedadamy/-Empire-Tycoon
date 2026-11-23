/** Persists a versioned AI founding command in a separate single-player slot and checks it by replay. */
import type { AiScenario } from '../../content/src/ai';
import { createSaveRepository, SaveError, type SaveProgress, type SaveStore } from '../../storage/src';
import { foundAiCompany, type AiFoundingCommand, type AiFoundingReceipt } from './founding';

/** Saves the authored scenario's deterministic receipt; rejects concurrent founding or altered checkpoints. */
export function createAiFoundingRepository(scenario: AiScenario, store: SaveStore, now: () => string) {
  function progress(command: AiFoundingCommand, receipt: AiFoundingReceipt): SaveProgress<AiFoundingCommand> {
    const { revision, day, randomState } = receipt;
    return { commands: [command], checkpoint: { revision, day, randomState, state: JSON.stringify(receipt) } };
  }

  const repository = createSaveRepository<AiFoundingCommand>({
    store, slot: 'single-player:ai:' + scenario.id,
    identity: { scenarioId: scenario.id, rulesetVersion: scenario.rulesetVersion, contentVersion: scenario.contentVersion },
    verify({ commands, checkpoint }) {
      if (commands.length !== 1) throw new SaveError('invalid-save');
      const [command] = commands;
      const expected = progress(command, foundAiCompany(scenario, command)).checkpoint;
      if (checkpoint.revision !== expected.revision || checkpoint.day !== expected.day ||
        checkpoint.randomState !== expected.randomState || checkpoint.state !== expected.state) {
        throw new SaveError('invalid-save');
      }
    },
    now,
  });

  return {
    async load() {
      const saved = await repository.load();
      return saved ? saved.envelope.commands[0] : null;
    },
    confirm(command: AiFoundingCommand, receipt: AiFoundingReceipt) {
      return repository.save(progress(command, receipt), null);
    },
  };
}
