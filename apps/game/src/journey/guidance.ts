/** Renders the skippable contextual guidance bar and the live worker ack/progress status bar. */
import type { WorkerAck, WorkerProgress } from '../../../../packages/contracts/src';
import { action, el } from '../../../../packages/ui/src';
import type { JourneyLabels } from './text';
import type { GuidanceStepId, JourneyReadModel } from './types';

export interface WorkerBannerState {
  readonly busy: boolean;
  readonly ack: WorkerAck | null;
  readonly progress: WorkerProgress | null;
}

export type JourneyScreen = 'overview' | 'business' | 'contracts' | 'finance';

function stepTarget(step: GuidanceStepId): JourneyScreen | null {
  switch (step) {
    case 'sign-contract':
    case 'deliver':
      return 'contracts';
    case 'order-supply':
      return 'business';
    case 'review-close':
    case 'resolve-shortfall':
    case 'review-overdue':
    case 'completed':
    case 'ended':
      return 'overview';
    default:
      return null;
  }
}

/** Builds the skippable guidance strip matching the current committed journey step. */
export function guidanceBar(
  model: JourneyReadModel,
  labels: JourneyLabels,
  options: {
    currentScreen: JourneyScreen;
    skipped: boolean;
    onSkip(): void;
    onNavigate(screen: JourneyScreen): void;
  },
) {
  if (options.skipped || !model.founded) return null;
  const { c } = labels;
  const key = `guide_${model.guidanceStep.replace(/-/g, '_')}` as keyof typeof c;
  const target = stepTarget(model.guidanceStep);
  const controls = el('div', 'actions guidance-actions');

  if (target && target !== options.currentScreen) {
    const go = action(c.guideGo, () => options.onNavigate(target), 'secondary');
    go.dataset.guideGo = target;
    controls.append(go);
  }
  const skip = action(c.skipGuidance, options.onSkip, 'trace');
  skip.dataset.skipGuidance = '';
  controls.append(skip);

  const bar = el('section', 'panel guidance-bar',
    el('div', 'guidance-copy', el('span', 'badge', c.guideTitle), el('p', '', c[key])),
    controls,
  );
  bar.dataset.guidanceStep = model.guidanceStep;
  return bar;
}

/** Renders acknowledgement and day-by-day progress for an in-flight worker command. */
export function renderWorkerBanner(container: HTMLElement, state: WorkerBannerState, labels: JourneyLabels) {
  const { c, format } = labels;
  if (!state.busy) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }
  container.hidden = false;
  const { ack, progress } = state;
  const summary = progress
    ? `${c.workerProgress}: ${format.number(progress.closedDays)} ${c.workerOf} ${format.number(progress.requestedDays)} · ${c.day} ${format.number(progress.lastClosedDay)} · ${c.workerRevision} ${format.number(progress.revision)}`
    : ack?.requestedDays
      ? `${c.workerAck} (${format.number(ack.requestedDays)})`
      : c.workerAck;

  const bar = progress ? el('progress', 'worker-meter') : null;
  if (bar && progress) {
    bar.max = Math.max(1, progress.requestedDays);
    bar.value = progress.closedDays;
  }
  container.dataset.workerState = progress ? 'progress' : 'ack';
  const heading = el('strong', '', summary);
  if (bar) container.replaceChildren(heading, bar);
  else container.replaceChildren(heading);
}
