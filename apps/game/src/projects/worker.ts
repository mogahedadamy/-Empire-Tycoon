/** Runs operating project rules in the browser worker using the same replay code as storage. */
import { quoteProject, type ProjectChoice } from './model';

type Request = { readonly id: number; readonly input: ProjectChoice };

self.addEventListener('message', (event: MessageEvent<Request>) => {
  const { id, input } = event.data;
  try {
    self.postMessage({ id, result: quoteProject(input) });
  } catch {
    self.postMessage({ id, error: true });
  }
});
