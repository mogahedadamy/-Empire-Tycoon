/** Correlates stateless calculations with their worker replies and settles failures. */
export type WorkerQueryReply<Result> =
  { readonly id: number } & ({ readonly result: Result } | { readonly error: true });

export function createWorkerQuery<Input, Result>(worker: Worker) {
  let sequence = 0;
  const requests = new Map<number, (result: Result | null) => void>();
  let failed = false;
  worker.addEventListener('message', ({ data }: MessageEvent<WorkerQueryReply<Result>>) => {
    requests.get(data.id)?.('result' in data ? data.result : null);
    requests.delete(data.id);
  });

  function fail() {
    failed = true;
    for (const resolve of requests.values()) resolve(null);
    requests.clear();
  }

  worker.addEventListener('error', fail);
  worker.addEventListener('messageerror', fail);

  return (input: Input) => new Promise<Result | null>((resolve) => {
    if (failed) {
      resolve(null);
      return;
    }
    const id = ++sequence;
    requests.set(id, resolve);
    try {
      worker.postMessage({ id, input });
    } catch {
      requests.delete(id);
      resolve(null);
    }
  });
}
