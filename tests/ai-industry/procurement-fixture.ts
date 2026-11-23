/** Supplies the authored procurement session and concise helpers for its acceptance tests. */
import { expect } from 'vitest';
import { createProcurementSession, foundAiCompany, type ComputeJob, type ProcurementAction,
  type ProcurementSessionOptions } from '../../packages/ai-industry/src';
import { loadAiScenario, loadComputeProcurement } from '../../packages/content/src/ai';

export const first = 'first-window';
export const network = 'network-window';
export const cooling = 'cooling-window';
export const harbor = 'harbor-cloud-basalt';
export const plateau = 'plateau-cloud-basalt';
export const owned = 'owned-wadi-basalt';

export function procurementOptions(scenario = loadAiScenario(), pathId: 'specialized-api' | 'general-lab' = 'specialized-api') {
  return { scenario, content: loadComputeProcurement(), founding: foundAiCompany(scenario, { type: 'found-ai-company', pathId }) };
}

export function start(options: ProcurementSessionOptions = procurementOptions()) {
  const session = createProcurementSession(options);
  function submit(id: string, action: ProcurementAction) {
    return session.submit({ version: 1, id, expectedRevision: session.read().revision, action });
  }
  function accept(id: string, action: ProcurementAction) {
    const outcome = submit(id, action);
    expect(outcome.status, JSON.stringify(outcome)).toBe('accepted');
    if (outcome.status !== 'accepted') throw new Error(outcome.code);
    return outcome.event;
  }
  function run(windowId: string, jobs: readonly ComputeJob[] = []) {
    const event = accept('run-' + windowId, { type: 'run-compute-window', windowId, jobs });
    if (event.type !== 'window-completed') throw new Error('No window receipt');
    return event.window;
  }
  function purchase(id: string, offerId: string, groupId: string, units: number) {
    const event = accept(id, { type: 'purchase-hardware', offerId, groupId, units, day: 1 });
    if (event.type !== 'purchased') throw new Error('No purchase receipt');
    return event.purchase;
  }
  return { session, submit, accept, run, purchase };
}

export function job(id: string, units: number, extra: Partial<ComputeJob> = {}): ComputeJob {
  return { id, units, kind: 'training', priority: 10, dueWindowId: first, memoryGiB: 64,
    interconnectGbps: 300, allowInterruptible: true, ...extra };
}
