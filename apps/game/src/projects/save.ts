/** Persists a confirmed project in its own replay-verified single-player slot. */
import { createSaveRepository, SaveError, type SaveProgress } from '../../../../packages/storage/src';
import { openIndexedDbSaveStore } from '../../../../packages/storage/web/indexed-db';
import { quoteProject, scenario, type Project, type ProjectChoice, type ProjectReceipt } from './model';

function progress(choice: ProjectChoice, receipt: ProjectReceipt): SaveProgress<ProjectChoice> {
  return {
    checkpoint: { revision: 1, day: 1, randomState: 0, state: JSON.stringify(receipt) },
    commands: [choice],
  };
}

/** Opens a sector-specific receipt and commits once with compare-and-swap across tabs. */
export async function openProjectSave(project: Project) {
  const store = await openIndexedDbSaveStore(indexedDB, 'empire-tycoon-solo');
  const scenarioId = `${scenario.id}:${project}`;
  const repository = createSaveRepository<ProjectChoice>({
    store, slot: `single-player:project:${scenarioId}`,
    identity: { scenarioId, rulesetVersion: scenario.rulesetVersion, contentVersion: scenario.contentVersion },
    verify({ commands, checkpoint }) {
      const [choice] = commands;
      if (commands.length !== 1 || choice.project !== project) throw new SaveError('invalid-save');
      const expected = progress(choice, quoteProject(choice)).checkpoint;
      if (checkpoint.revision !== expected.revision || checkpoint.day !== expected.day ||
          checkpoint.randomState !== expected.randomState || checkpoint.state !== expected.state) {
        throw new SaveError('invalid-save');
      }
    },
    now: () => new Date().toISOString(),
  });
  try {
    const opened = await repository.load();
    return {
      choice: opened?.envelope.commands[0],
      commit: (choice: ProjectChoice, receipt: ProjectReceipt) => repository.save(progress(choice, receipt), null),
    };
  } catch (error) {
    store.close();
    throw error;
  }
}
