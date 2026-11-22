/** Runs operating project rules in the browser worker using the same replay code as storage. */
import { quoteProject, type ProjectChoice } from './model';

type Request = { readonly id: number; readonly choice: ProjectChoice };

self.addEventListener('message', (event: MessageEvent<Request>) => {
  const { id, choice } = event.data;
  try {
    self.postMessage({ id, receipt: quoteProject(choice) });
  } catch {
    self.postMessage({ id, error: true });
  }
});
