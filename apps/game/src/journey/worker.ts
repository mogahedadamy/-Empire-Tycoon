/** Dedicated Web Worker entry point owning the local Big Order simulation session. */
import { createJourneyWorkerHost } from './worker-host';

interface DedicatedWorkerScope {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
}

const scope = globalThis as unknown as DedicatedWorkerScope;
const host = createJourneyWorkerHost((reply) => scope.postMessage(reply));

scope.addEventListener('message', (event) => {
  void host.receive(event.data);
});
