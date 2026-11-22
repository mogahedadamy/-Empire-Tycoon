/** Application-facing read and decision port. Domain sessions retain all write authority. */
import type { Scenario } from '../../../../packages/content/src';
import { balanceSheet, directCashFlow, forecastLiquidity, incomeStatement } from '../../../../packages/finance/src';
import { readInventory, readSalesStatus, type SalesSessionCommand } from '../../../../packages/operations/src';
import { readLiquidityInput } from '../../../../packages/simulation/src';
import type { SaveProgress } from '../../../../packages/storage/src';
import { companyCheckpoint } from './checkpoint';

export interface CompanyCommand {
  readonly request: SalesSessionCommand;
  readonly expectedRevision: number;
}

export function createCompanyHost(scenario: Scenario, saved?: SaveProgress<CompanyCommand>) {
  const { session, treasury, scope, offerId } = companyCheckpoint(scenario);
  const commands: CompanyCommand[] = [];

  function submit(request: SalesSessionCommand, expectedRevision: number) {
    const revision = session.snapshot().revision;
    const receipt = session.submit(request, expectedRevision);
    if (receipt.status === 'accepted' && session.snapshot().revision > revision) {
      // Keep the recorded request independent of a caller-owned object.
      commands.push({ request: JSON.parse(JSON.stringify(request)) as SalesSessionCommand, expectedRevision });
    }
    return receipt;
  }

  function capture(): SaveProgress<CompanyCommand> {
    const sales = session.snapshot();
    return {
      checkpoint: {
        revision: sales.revision, day: sales.day, randomState: scenario.seed,
        state: JSON.stringify({ sales, treasury }),
      },
      commands: commands.map((command) => JSON.parse(JSON.stringify(command)) as CompanyCommand),
    };
  }

  if (saved) {
    for (const { request, expectedRevision } of saved.commands) {
      if (session.snapshot().revision !== expectedRevision || submit(request, expectedRevision).status !== 'accepted') {
        throw new RangeError('The saved command log could not be replayed');
      }
    }
    const actual = capture().checkpoint;
    const expected = saved.checkpoint;
    if (actual.day !== expected.day || actual.revision !== expected.revision ||
        actual.randomState !== expected.randomState || actual.state !== expected.state) {
      throw new RangeError('The saved checkpoint differs from replay');
    }
  }

  function read() {
    const snapshot = session.snapshot();
    const { day, ledger } = snapshot;
    const period = { fromDay: scenario.calendar.startDay, throughDay: day };
    const { offers, invoices } = readSalesStatus(snapshot, day);
    const offer = offers.find((item) => item.offerId === offerId)!;
    const inventory = readInventory(snapshot.inventory, scope);
    const balance = balanceSheet(ledger, day);
    const cashFlow = directCashFlow(ledger, period);
    const journal = Object.freeze(ledger.entries.filter((item) => item.day <= day));
    const capacity = session.capacity(offerId, day);
    const liquidity = forecastLiquidity(readLiquidityInput({
      ledger, treasury, sales: snapshot, day,
      policy: { pessimisticDelayDays: 5, optimisticEarlyDays: 7, defaultGraceDays: 3 },
    }));
    return {
      day, revision: snapshot.revision, offer, invoices, inventory, capacity, balance,
      income: incomeStatement(ledger, period), cashFlow, liquidity, journal,
      cashEntries: journal.filter((item) => item.lines.some((line) => line.account === 'cash')),
      canAdvance: day < offer.deliveryDueDay,
    };
  }

  function preview(quantity: number) {
    const snapshot = session.snapshot();
    const offer = snapshot.offers.find((item) => item.offerId === offerId)!;
    const { available } = session.capacity(offerId, snapshot.day);
    const remaining = offer.quantity - offer.deliveredQuantity;
    const max = Number(available < BigInt(remaining) ? available : BigInt(remaining));
    const validQuantity = Number.isSafeInteger(quantity) && quantity >= 1;
    return Object.freeze({
      day: snapshot.day, revision: snapshot.revision, quantity, max, remaining,
      priceMinor: offer.unitPriceMinor,
      amountMinor: validQuantity ? (BigInt(offer.unitPriceMinor) * BigInt(quantity)).toString() : '0',
      valid: validQuantity && quantity <= max && snapshot.day >= offer.deliveryStartsDay &&
        snapshot.day <= offer.deliveryDueDay,
    });
  }

  function confirm(decision: ReturnType<typeof preview>) {
    // The request proposes a quantity only. The owning session uses its own prices, capacity and revision.
    const { day, quantity, revision } = decision;
    const receipt = submit({ domain: 'sales', command: {
      id: `review:${revision}:${quantity}`, type: 'deliver', day, offerId, quantity,
    } }, revision);
    if (receipt.status === 'rejected' && receipt.code === 'stale-revision') {
      return { status: 'review', previous: decision, current: preview(quantity) } as const;
    }
    return receipt;
  }

  function advance() {
    const snapshot = session.snapshot();
    if (snapshot.day >= scenario.contract.deliveryDueDay) return;
    const day = snapshot.day + 1;
    return submit({ domain: 'inventory', command: {
      id: `inventory-day:${day}`, type: 'age', day,
    } }, snapshot.revision);
  }

  return { read, preview, confirm, advance, capture };
}

export type CompanyHost = ReturnType<typeof createCompanyHost>;
export type CompanyRead = ReturnType<CompanyHost['read']>;
export type DeliveryPreview = ReturnType<CompanyHost['preview']>;
