/** Terms, invoices and the contracts transaction boundary. */
import type { Ledger } from '../../../finance/src';
import type { InventoryCommand, InventoryErrorCode, InventoryState, StockScope } from '../inventory/types';
import type { WorkforceCommand, WorkforceErrorCode, WorkforceState } from '../workforce/types';

export interface SalesTerms extends StockScope {
  readonly offerId: string;
  readonly customerId: string;
  readonly quantity: number;
  readonly unitPriceMinor: string;
  readonly offerExpiresDay: number;
  readonly deliveryStartsDay: number;
  readonly deliveryDueDay: number;
  readonly paymentDueDay: number;
  readonly earlyPaymentDiscountBps: number;
}

export interface SalesOffer extends SalesTerms {
  readonly offeredDay: number;
  readonly acceptedDay: number | null;
  readonly cancelledDay: number | null;
  readonly deliveredQuantity: number;
}

export interface Invoice {
  readonly id: string;
  readonly contractId: string;
  readonly customerId: string;
  readonly issueDay: number;
  readonly dueDay: number;
  readonly quantity: number;
  readonly amountMinor: string;
  readonly salesEntryId: string;
  readonly stockEntryId: string;
  readonly payment: {
    readonly day: number;
    readonly cashMinor: string;
    readonly discountMinor: string;
    readonly journalEntryId: string;
  } | null;
}

export type SalesCommand = { readonly id: string; readonly day: number } & (
  | ({ readonly type: 'offer' } & SalesTerms)
  | { readonly type: 'accept'; readonly offerId: string }
  | { readonly type: 'cancel'; readonly offerId: string }
  | { readonly type: 'reserve'; readonly offerId: string; readonly quantity: number }
  | { readonly type: 'deliver'; readonly offerId: string; readonly quantity: number }
  | { readonly type: 'collect'; readonly invoiceId: string; readonly mode: 'due' | 'early' }
);

/** The contract owner writes reservations and deliveries. External stock commands handle receipts and aging. */
export type SalesSessionCommand =
  | { readonly domain: 'sales'; readonly command: SalesCommand }
  | {
      readonly domain: 'inventory';
      readonly command: Extract<InventoryCommand, { type: 'order' | 'receive' | 'age' }>;
    }
  | { readonly domain: 'workforce'; readonly command: WorkforceCommand };

export interface SalesSessionOptions {
  readonly inventory: InventoryState;
  readonly workforce: WorkforceState;
  readonly ledger: Ledger;
  readonly dailyEquipment: number;
  readonly dailyShipping: number;
}

export interface SalesSnapshot {
  readonly revision: number;
  readonly day: number;
  readonly offers: readonly SalesOffer[];
  readonly invoices: readonly Invoice[];
  readonly inventory: InventoryState;
  readonly workforce: WorkforceState;
  readonly ledger: Ledger;
}

export type SalesErrorCode = InventoryErrorCode | WorkforceErrorCode |
  'stale-revision' | 'unknown-offer' | 'offer-expired' | 'already-accepted' |
  'contract-not-open' | 'outside-delivery-window' | 'exceeds-contract' | 'capacity-exceeded' |
  'unknown-invoice' | 'invoice-paid' | 'invoice-not-due' | 'early-payment-unavailable';

export type SalesReceipt = { readonly commandId: string; readonly revision: number } & (
  | { readonly status: 'accepted'; readonly invoiceId?: string }
  | { readonly status: 'rejected'; readonly code: SalesErrorCode }
);

export class SalesError extends Error {
  constructor(readonly code: SalesErrorCode) {
    super(code);
    this.name = 'SalesError';
  }
}
