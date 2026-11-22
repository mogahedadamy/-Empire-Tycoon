/** Message-driven simulation host shared by the real Web Worker and headless worker tests. */
import { loadScenario } from '../../../../packages/content/src';
import {
  simulationProtocolVersion as version,
  type WorkerAck, type WorkerCommittedResult, type WorkerErrorReply, type WorkerHostReply,
  type WorkerHostRequest, type WorkerPreviewReply, type WorkerProgress, type WorkerSnapshotReply,
} from '../../../../packages/contracts/src';
import type { SaveProgress } from '../../../../packages/storage/src';
import { createJourneyEngine, type JourneyEngine } from './engine';
import type {
  JourneyAction, JourneyCommandRecord, JourneyDeliveryPreview, JourneyOutcome,
  JourneyPreviewRequest, JourneyReadModel, JourneyWorkerInit,
} from './types';

export type JourneyWorkerRequest = WorkerHostRequest<JourneyWorkerInit, JourneyAction, JourneyPreviewRequest>;
export type JourneyWorkerReply = WorkerHostReply<
  JourneyOutcome, JourneyReadModel, JourneyDeliveryPreview, SaveProgress<JourneyCommandRecord>
>;

export interface WorkerHostOptions {
  /** Yields between closed days so progress messages flush before the next step. */
  readonly yieldStep?: () => Promise<void>;
}

const defaultYield = () => new Promise<void>((resolve) => { setTimeout(resolve, 0); });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Creates a stateful worker host bound to a message posting function. */
export function createJourneyWorkerHost(
  post: (reply: JourneyWorkerReply) => void,
  options: WorkerHostOptions = {},
) {
  const yieldStep = options.yieldStep ?? defaultYield;
  let engine: JourneyEngine | null = null;
  let queue: Promise<void> = Promise.resolve();

  function fail(code: WorkerErrorReply['code'], fields?: Partial<WorkerErrorReply>) {
    post({ version, type: 'error', code, ...fields });
  }

  function computeRequestedDays(action: JourneyAction): number | undefined {
    if (!engine) return undefined;
    const model = engine.read();
    if (action.type === 'advance') return action.days;
    if (action.type === 'advance-through') return Math.max(0, action.day - model.lastClosedDay);
    return undefined;
  }

  async function process(raw: unknown): Promise<void> {
    if (!isRecord(raw) || raw.version !== version || typeof raw.sessionId !== 'string' || !raw.sessionId.trim()) {
      fail('invalid-request');
      return;
    }
    const request = raw as unknown as JourneyWorkerRequest;

    if (request.type === 'init') {
      try {
        const scenario = loadScenario(request.payload.scenarioId);
        engine = createJourneyEngine(scenario, request.payload.saved, request.sessionId);
        const reply: WorkerSnapshotReply<JourneyReadModel, SaveProgress<JourneyCommandRecord>> = {
          version, type: 'snapshot', sessionId: engine.sessionId, requestId: request.requestId,
          revision: engine.revision(), readModel: engine.read(), saveProgress: engine.capture(),
        };
        post(reply);
      } catch (error) {
        fail('host-error', {
          sessionId: request.sessionId, requestId: request.requestId,
          detail: error instanceof Error ? error.message : 'Init failed',
        });
      }
      return;
    }

    if (!engine) {
      fail('not-initialized', {
        sessionId: request.sessionId,
        requestId: 'requestId' in request ? request.requestId : undefined,
        commandId: 'commandId' in request ? request.commandId : undefined,
      });
      return;
    }
    if (request.sessionId !== engine.sessionId) {
      fail('session-mismatch', {
        sessionId: request.sessionId,
        requestId: 'requestId' in request ? request.requestId : undefined,
        commandId: 'commandId' in request ? request.commandId : undefined,
      });
      return;
    }

    if (request.type === 'read') {
      const reply: WorkerSnapshotReply<JourneyReadModel, SaveProgress<JourneyCommandRecord>> = {
        version, type: 'snapshot', sessionId: engine.sessionId, requestId: request.requestId,
        revision: engine.revision(), readModel: engine.read(), saveProgress: engine.capture(),
      };
      post(reply);
      return;
    }

    if (request.type === 'preview') {
      const preview = engine.previewDelivery(request.payload.quantity);
      const reply: WorkerPreviewReply<JourneyDeliveryPreview> = {
        version, type: 'preview', sessionId: engine.sessionId, requestId: request.requestId,
        revision: engine.revision(), preview,
      };
      post(reply);
      return;
    }

    if (request.type === 'command') {
      const { commandId, expectedRevision, payload } = request;
      const requestedDays = computeRequestedDays(payload);
      const ack: WorkerAck = {
        version, type: 'ack', sessionId: engine.sessionId, commandId, expectedRevision, requestedDays,
      };
      post(ack);

      const record: JourneyCommandRecord = { commandId, expectedRevision, action: payload };
      const outcome = payload.type === 'advance' || payload.type === 'advance-through'
        ? await engine.runAdvanceAsync(record, async (progress) => {
          const update: WorkerProgress = { version, ...progress };
          post(update);
          await yieldStep();
        })
        : engine.submit(record);

      const committed: WorkerCommittedResult<
        JourneyOutcome, JourneyReadModel, SaveProgress<JourneyCommandRecord>
      > = {
        version, type: 'result', sessionId: engine.sessionId, commandId,
        revision: engine.revision(), outcome, readModel: engine.read(), saveProgress: engine.capture(),
      };
      post(committed);
      return;
    }

    fail('invalid-request', { sessionId: engine.sessionId });
  }

  return {
    /** Queues one inbound message for ordered execution inside the worker context. */
    receive(message: unknown): Promise<void> {
      queue = queue.then(() => process(message));
      return queue;
    },
  };
}
