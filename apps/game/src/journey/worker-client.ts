/** Revision-verifying client bridge over a browser Web Worker or an in-memory test transport. */
import {
  simulationProtocolVersion as version,
  type WorkerAck, type WorkerProgress, type WorkerTransport,
} from '../../../../packages/contracts/src';
import type { SaveProgress } from '../../../../packages/storage/src';
import type {
  JourneyAction, JourneyCommandRecord, JourneyDeliveryPreview, JourneyOutcome,
  JourneyReadModel,
} from './types';
import type { JourneyWorkerReply, JourneyWorkerRequest } from './worker-host';

export interface JourneyClientEvents {
  onAck?(ack: WorkerAck): void;
  onProgress?(progress: WorkerProgress): void;
  onCommitted?(model: JourneyReadModel, save: SaveProgress<JourneyCommandRecord> | undefined): void;
}

interface Pending<T> {
  resolve(value: T): void;
  reject(error: Error): void;
}

/** Creates a browser Worker transport using the bundled module worker. */
export function createBrowserWorkerTransport(): WorkerTransport {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  return {
    postMessage(message) { worker.postMessage(message); },
    onMessage(listener) {
      const handler = (event: MessageEvent<unknown>) => listener(event.data);
      worker.addEventListener('message', handler);
      return () => worker.removeEventListener('message', handler);
    },
    terminate() { worker.terminate(); },
  };
}

/**
 * Connects UI views to the simulation worker while checking protocol version, session ID,
 * and monotonic message revisions before publishing committed read models.
 */
export function createJourneyWorkerClient(
  transport: WorkerTransport,
  sessionId: string,
  events: JourneyClientEvents = {},
) {
  let committedRevision = -1;
  let lastProgressRevision = -1;
  let activeCommandId: string | null = null;
  let ignoredMessages = 0;
  let seq = 0;
  let latestModel: JourneyReadModel | null = null;
  let latestSave: SaveProgress<JourneyCommandRecord> | undefined;

  const pendingReads = new Map<string, Pending<JourneyReadModel>>();
  const pendingPreviews = new Map<string, Pending<JourneyDeliveryPreview>>();
  const pendingCommands = new Map<string, Pending<{ outcome: JourneyOutcome; model: JourneyReadModel }>>();

  function nextId(prefix: string): string {
    seq += 1;
    return `${prefix}:${seq}`;
  }

  function handleMessage(raw: unknown) {
    if (typeof raw !== 'object' || raw === null) { ignoredMessages += 1; return; }
    const msg = raw as JourneyWorkerReply;
    if (msg.version !== version || (msg.sessionId !== undefined && msg.sessionId !== sessionId)) {
      ignoredMessages += 1;
      return;
    }

    if (msg.type === 'error') {
      const error = new Error(msg.detail ?? msg.code);
      if (msg.requestId) {
        pendingReads.get(msg.requestId)?.reject(error);
        pendingReads.delete(msg.requestId);
        pendingPreviews.get(msg.requestId)?.reject(error);
        pendingPreviews.delete(msg.requestId);
      }
      if (msg.commandId) {
        pendingCommands.get(msg.commandId)?.reject(error);
        pendingCommands.delete(msg.commandId);
        if (activeCommandId === msg.commandId) activeCommandId = null;
      }
      return;
    }

    if (msg.type === 'ack') {
      if (msg.commandId !== activeCommandId) { ignoredMessages += 1; return; }
      lastProgressRevision = Math.max(committedRevision, msg.expectedRevision);
      events.onAck?.(msg);
      return;
    }

    if (msg.type === 'progress') {
      // Progress updates never replace committed state and must advance monotonically for the active command.
      if (msg.commandId !== activeCommandId || msg.revision < committedRevision || msg.revision < lastProgressRevision) {
        ignoredMessages += 1;
        return;
      }
      lastProgressRevision = msg.revision;
      events.onProgress?.(msg);
      return;
    }

    if (msg.type === 'snapshot') {
      if (msg.revision < committedRevision) { ignoredMessages += 1; return; }
      committedRevision = msg.revision;
      seq = Math.max(seq, msg.saveProgress?.commands.length ?? 0);
      latestModel = msg.readModel;
      latestSave = msg.saveProgress;
      const waiter = pendingReads.get(msg.requestId);
      pendingReads.delete(msg.requestId);
      events.onCommitted?.(msg.readModel, msg.saveProgress);
      waiter?.resolve(msg.readModel);
      return;
    }

    if (msg.type === 'preview') {
      if (msg.revision < committedRevision) { ignoredMessages += 1; return; }
      const waiter = pendingPreviews.get(msg.requestId);
      pendingPreviews.delete(msg.requestId);
      waiter?.resolve(msg.preview);
      return;
    }

    if (msg.type === 'result') {
      if (msg.revision < committedRevision) { ignoredMessages += 1; return; }
      committedRevision = msg.revision;
      latestModel = msg.readModel;
      latestSave = msg.saveProgress;
      if (activeCommandId === msg.commandId) activeCommandId = null;
      const waiter = pendingCommands.get(msg.commandId);
      pendingCommands.delete(msg.commandId);
      events.onCommitted?.(msg.readModel, msg.saveProgress);
      waiter?.resolve({ outcome: msg.outcome, model: msg.readModel });
    }
  }

  const unsubscribe = transport.onMessage(handleMessage);

  function send(request: JourneyWorkerRequest) {
    transport.postMessage(request);
  }

  return {
    init(scenarioId: string, saved?: SaveProgress<JourneyCommandRecord>): Promise<JourneyReadModel> {
      const requestId = nextId('init');
      committedRevision = -1;
      lastProgressRevision = -1;
      activeCommandId = null;
      return new Promise((resolve, reject) => {
        pendingReads.set(requestId, { resolve, reject });
        send({ version, type: 'init', sessionId, requestId, payload: { scenarioId, saved } });
      });
    },

    read(): Promise<JourneyReadModel> {
      const requestId = nextId('read');
      return new Promise((resolve, reject) => {
        pendingReads.set(requestId, { resolve, reject });
        send({ version, type: 'read', sessionId, requestId });
      });
    },

    previewDelivery(quantity: number): Promise<JourneyDeliveryPreview> {
      const requestId = nextId('preview');
      return new Promise((resolve, reject) => {
        pendingPreviews.set(requestId, { resolve, reject });
        send({ version, type: 'preview', sessionId, requestId, payload: { type: 'delivery', quantity } });
      });
    },

    command(
      action: JourneyAction,
      expectedRevision = committedRevision,
      explicitCommandId?: string,
    ): Promise<{ outcome: JourneyOutcome; model: JourneyReadModel }> {
      const commandId = explicitCommandId ?? nextId(`cmd:r${expectedRevision}`);
      activeCommandId = commandId;
      return new Promise((resolve, reject) => {
        pendingCommands.set(commandId, { resolve, reject });
        send({ version, type: 'command', sessionId, commandId, expectedRevision, payload: action });
      });
    },

    currentModel: () => latestModel,
    currentSave: () => latestSave,
    committedRevision: () => committedRevision,
    ignoredMessages: () => ignoredMessages,
    isBusy: () => activeCommandId !== null,
    dispose() {
      unsubscribe();
      transport.terminate?.();
    },
  };
}

export type JourneyWorkerClient = ReturnType<typeof createJourneyWorkerClient>;
