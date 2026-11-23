/** Requests operating-project receipts from the browser worker. */
import { createWorkerQuery } from '../platform/worker-query';
import type { ProjectChoice, ProjectReceipt } from './model';

export function createProjectClient() {
  return createWorkerQuery<ProjectChoice, ProjectReceipt>(
    new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
  );
}
