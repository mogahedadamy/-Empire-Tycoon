/** Owns compute orders, bookings and completed windows behind revision-checked commands. */
import type { AiScenario, ComputeProcurement } from '../../../content/src/ai';
import { balanceSheet, Ledger } from '../../../finance/src';
import type { AiFoundingReceipt } from '../founding';
import { sortJobs } from './allocation';
import { forecastPurchase, selectMemoryShock, type HardwarePurchase } from './supply';
import { ProcurementError, type ComputeJob, type ComputeReservation, type ProcurementAction,
  type ProcurementCommand, type ProcurementRejection } from './types';
import { executeWindow, forecastWindow, type ComputeWindowReceipt } from './window';

export interface ProcurementSessionOptions {
  readonly scenario: AiScenario;
  readonly content: ComputeProcurement;
  readonly founding: AiFoundingReceipt;
}

type ProcurementEvent =
  | { readonly type: 'purchased'; readonly purchase: HardwarePurchase }
  | { readonly type: 'reserved'; readonly reservation: ComputeReservation }
  | { readonly type: 'window-completed'; readonly window: ComputeWindowReceipt };

type Outcome =
  | { readonly status: 'accepted'; readonly revision: number; readonly event: ProcurementEvent }
  | { readonly status: 'rejected'; readonly revision: number; readonly code: ProcurementRejection };

function reject(revision: number, code: ProcurementRejection): Outcome {
  return Object.freeze({ status: 'rejected', revision, code });
}

// Sorting object keys makes retried commands independent of serialization by their caller.
function encode(value: unknown) {
  return JSON.stringify(value, (_key: string, data: unknown) => {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return data;
    const fields = Object.entries(data).sort(([left], [right]) => left < right ? -1 : Number(left > right));
    return Object.fromEntries(fields);
  });
}

/** Builds a deterministic headless session from a completed ET-025 founding and linked scenario content. */
export function createProcurementSession({ scenario, content, founding }: ProcurementSessionOptions) {
  if (content.scenarioId !== scenario.id || founding.scenarioId !== scenario.id ||
      founding.contentVersion !== scenario.contentVersion || founding.rulesetVersion !== scenario.rulesetVersion ||
      founding.currency !== scenario.currency) throw new RangeError('Procurement and founding versions must agree');

  const shock = selectMemoryShock(content, founding.randomState);
  let ledger = Ledger.open({ companyId: founding.companyId, currency: founding.currency }).post(founding.entries);
  let day = founding.day;
  let revision: number = founding.revision;
  const purchases: HardwarePurchase[] = [];
  const reservations: ComputeReservation[] = [];
  const completed: ComputeWindowReceipt[] = [];
  const executedJobs = new Set<string>();
  const receipts = new Map<string, { readonly signature: string; readonly outcome: Outcome }>();
  const accepted: string[] = [];
  const windowIndex = new Map(content.windows.map(({ id }, index) => [id, index]));
  const nextWindow = () => content.windows[completed.length];

  function pricePurchase(action: Extract<ProcurementAction, { type: 'purchase-hardware' }>) {
    const next = nextWindow();
    if (!next || action.day < day || action.day > next.day) throw new ProcurementError('invalid-window');
    return forecastPurchase(scenario, content, shock, purchases, action);
  }

  function purchase(commandId: string, action: Extract<ProcurementAction, { type: 'purchase-hardware' }>): ProcurementEvent {
    const quote = pricePurchase(action);
    if (BigInt(quote.costMinor) > BigInt(balanceSheet(ledger, quote.orderedDay).cash)) {
      throw new ProcurementError('insufficient-cash');
    }
    ledger = ledger.post([{ id: 'hardware-purchase:' + commandId, sourceId: commandId, day: quote.orderedDay, lines: [
      { account: 'equipment', side: 'debit', amount: quote.costMinor },
      { account: 'cash', side: 'credit', amount: quote.costMinor, cashFlow: 'investing' },
    ] }]);
    const order = Object.freeze({ id: commandId, ...quote });
    purchases.push(order);
    day = quote.orderedDay;
    return { type: 'purchased', purchase: order };
  }

  function reserve(commandId: string, action: Extract<ProcurementAction, { type: 'reserve-compute' }>): ProcurementEvent {
    const { groupId, units, windowIds } = action;
    const group = content.groups.find(({ id }) => id === groupId);
    if (!group || group.kind !== 'cloud') throw new ProcurementError('unknown-group');
    if (!Number.isSafeInteger(units) || units < 1 || !Array.isArray(windowIds) || !windowIds.length ||
        new Set(windowIds).size !== windowIds.length) throw new ProcurementError('invalid-command');
    for (const windowId of windowIds) {
      const index = windowIndex.get(windowId);
      if (index === undefined || index < completed.length) throw new ProcurementError('invalid-window');
      const committed = reservations.filter((row) => row.groupId === groupId && row.windowIds.includes(windowId))
        .reduce((sum, row) => sum + row.units, 0);
      if (units > group.units - committed) throw new ProcurementError('reservation-limit');
    }
    const reservation = Object.freeze({ id: commandId, groupId, units,
      windowIds: Object.freeze([...windowIds].sort((left, right) => windowIndex.get(left)! - windowIndex.get(right)!)),
      totalMinor: (BigInt(group.reservedUnitPriceMinor) * BigInt(units) * BigInt(windowIds.length)).toString(),
    });
    reservations.push(reservation);
    return { type: 'reserved', reservation };
  }

  function prioritize(jobs: readonly ComputeJob[]) {
    const ordered = sortJobs(scenario, content, jobs);
    if (ordered.some(({ id }) => executedJobs.has(id))) throw new ProcurementError('job-already-executed');
    return ordered;
  }

  function run(action: Extract<ProcurementAction, { type: 'run-compute-window' }>): ProcurementEvent {
    const window = nextWindow();
    if (!window || window.id !== action.windowId) throw new ProcurementError('invalid-window');
    const result = executeWindow(scenario, content, window, prioritize(action.jobs), purchases, reservations, ledger);
    ledger = result.ledger;
    completed.push(result.receipt);
    for (const job of result.receipt.assignments) {
      if (job.status === 'allocated') executedJobs.add(job.jobId);
    }
    day = window.day;
    return { type: 'window-completed', window: result.receipt };
  }

  function apply(id: string, action: ProcurementAction): ProcurementEvent {
    switch (action?.type) {
      case 'purchase-hardware': return purchase(id, action);
      case 'reserve-compute': return reserve(id, action);
      case 'run-compute-window': return run(action);
      default: throw new ProcurementError('invalid-command');
    }
  }

  return {
    read() {
      return { day, revision, shock, contentVersion: content.contentVersion, nextWindow: nextWindow() ?? null, journal: ledger.entries,
        balance: balanceSheet(ledger, day), reservations: [...reservations], windows: [...completed],
        purchases: purchases.map((purchase) => ({ ...purchase,
          status: day >= purchase.installedDay ? 'installed' : day >= purchase.arrivalDay ? 'delivered' : 'ordered' })),
      };
    },
    preview(windowId: string, jobs: readonly ComputeJob[]) {
      const index = windowIndex.get(windowId);
      if (index === undefined || index < completed.length) throw new ProcurementError('invalid-window');
      return forecastWindow(scenario, content, content.windows[index], prioritize(jobs), purchases, reservations);
    },
    /** Quotes a purchase and lists compatible alternatives with dates and costs before committing cash. */
    previewPurchase(action: Extract<ProcurementAction, { type: 'purchase-hardware' }>) {
      const quote = pricePurchase(action);
      const familyId = content.hardwareOffers.find(({ id }) => id === quote.offerId)!.hardwareFamilyId;
      const cash = BigInt(balanceSheet(ledger, action.day).cash);
      const alternatives = content.hardwareOffers.flatMap((offer) => {
        if (offer.id === quote.offerId || offer.hardwareFamilyId !== familyId) return [];
        const ordered = purchases.filter(({ offerId }) => offerId === offer.id).reduce((sum, { units }) => sum + units, 0);
        if (offer.units - ordered < action.units) return [];
        const other = pricePurchase({ ...action, offerId: offer.id });
        return [{ ...other, affordable: BigInt(other.costMinor) <= cash }];
      });
      return { quote, affordable: BigInt(quote.costMinor) <= cash, alternatives };
    },
    /** Returns accepted commands for replay. Rejections cannot alter the domain state. */
    commandLog(): readonly ProcurementCommand[] {
      return accepted.map((entry) => JSON.parse(entry) as ProcurementCommand);
    },
    submit(command: ProcurementCommand): Outcome {
      if (!command || command.version !== 1 || typeof command.id !== 'string' ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(command.id) || !Number.isSafeInteger(command.expectedRevision)) {
        return reject(revision, 'invalid-command');
      }
      const signature = encode(command.action);
      const previous = receipts.get(command.id);
      if (previous) return previous.signature === signature ? previous.outcome : reject(revision, 'command-conflict');
      let outcome: Outcome;
      try {
        if (command.expectedRevision !== revision) throw new ProcurementError('stale-revision');
        const entry = encode(command);
        const event = Object.freeze(apply(command.id, command.action));
        revision += 1;
        accepted.push(entry);
        outcome = Object.freeze({ status: 'accepted', revision, event });
      } catch (error) {
        if (!(error instanceof ProcurementError)) throw error;
        outcome = reject(revision, error.code);
      }
      receipts.set(command.id, { signature, outcome });
      return outcome;
    },
  };
}

/** Rebuilds committed orders and window receipts by executing accepted commands from the same founding seed. */
export function replayProcurement(options: ProcurementSessionOptions, commands: readonly ProcurementCommand[]) {
  const session = createProcurementSession(options);
  let expected: number = options.founding.revision;
  for (const command of commands) {
    if (command.expectedRevision !== expected) throw new RangeError('Invalid compute command log');
    const outcome = session.submit(command);
    if (outcome.status !== 'accepted' || outcome.revision !== expected + 1) throw new RangeError('Invalid compute command log');
    expected = outcome.revision;
  }
  return session;
}
