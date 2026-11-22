/** Opt-in user timings for journey startup, visible acknowledgement, and Worker results. */
import type { JourneyAction, JourneyReadModel } from '../journey/types';

export interface JourneyPerformance {
  opened(model: JourneyReadModel): void;
  start(action: JourneyAction, model: JourneyReadModel): void;
  acknowledge(): void;
  finish(model: JourneyReadModel): void;
}

export function createJourneyPerformance(): JourneyPerformance {
  let pending: { start: number; action: JourneyAction['type']; day: number } | undefined;
  let openingRecorded = false;

  function afterPaint(callback: () => void) {
    if (document.hidden) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!document.hidden) callback();
    }));
  }

  return {
    opened(model) {
      if (openingRecorded) return;
      openingRecorded = true;
      afterPaint(() => performance.measure('empire.open', {
        start: 0, end: performance.now(), detail: { day: model.day, revision: model.revision },
      }));
    },
    start(action, model) {
      pending = { start: performance.now(), action: action.type, day: model.day };
    },
    acknowledge() {
      if (!pending) return;
      const { start, action } = pending;
      performance.measure('empire.worker-ack', { start, end: performance.now(), detail: { action } });
      afterPaint(() => performance.measure('empire.visible-ack', {
        start, end: performance.now(), detail: { action },
      }));
    },
    finish(model) {
      if (!pending) return;
      performance.measure('empire.worker-result', {
        start: pending.start, end: performance.now(),
        detail: { action: pending.action, days: model.day - pending.day, revision: model.revision },
      });
      pending = undefined;
    },
  };
}
