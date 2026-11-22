/** Correlates quote requests and results from the operating-project worker. */
import type { ProjectChoice, ProjectReceipt } from './model';

type Reply = { readonly id: number } & ({ readonly receipt: ProjectReceipt } | { readonly error: true });

export function createProjectClient() {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  let sequence = 0;
  const requests = new Map<number, (receipt: ProjectReceipt | null) => void>();
  let failed = false;
  worker.addEventListener('message', ({ data }: MessageEvent<Reply>) => {
    requests.get(data.id)?.('receipt' in data ? data.receipt : null);
    requests.delete(data.id);
  });
  worker.addEventListener('error', () => {
    failed = true;
    for (const resolve of requests.values()) resolve(null);
    requests.clear();
  });

  return (choice: ProjectChoice) => new Promise<ProjectReceipt | null>((resolve) => {
    if (failed) { resolve(null); return; }
    const id = ++sequence;
    requests.set(id, resolve);
    worker.postMessage({ id, choice });
  });
}
