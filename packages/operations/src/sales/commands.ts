/** Stages the commercial lifecycle without mutating the published snapshot. */
import { applyInventoryCommand } from '../inventory/state';
import { applyWorkforceCommand } from '../workforce/state';
import { cancelContract, deliverContract, reserveContract } from './fulfillment';
import { collectInvoice } from './receivables';
import {
  SalesError, type SalesCommand, type SalesOffer, type SalesSessionCommand, type SalesSnapshot,
} from './types';

type Staged = {
  readonly changes: Partial<SalesSnapshot>;
  readonly invoiceId?: string;
};

export function findOffer(snapshot: SalesSnapshot, id: string): SalesOffer {
  const offer = snapshot.offers.find(({ offerId }) => offerId === id);
  if (!offer) throw new SalesError('unknown-offer');
  return offer;
}

function replaceOffer(snapshot: SalesSnapshot, offer: SalesOffer) {
  return Object.freeze(snapshot.offers.map((item) => item.offerId === offer.offerId ? offer : item));
}

function ensureOpen(offer: SalesOffer) {
  if (offer.acceptedDay === null || offer.cancelledDay !== null || offer.deliveredQuantity === offer.quantity) {
    throw new SalesError('contract-not-open');
  }
}

function stageSale(
  snapshot: SalesSnapshot, command: SalesCommand, limits: { equipment: number; shipping: number },
): Staged {
  if (command.type === 'offer') {
    if (snapshot.offers.some(({ offerId }) => offerId === command.offerId)) throw new SalesError('conflict');
    const { type: _type, id: _id, day, ...terms } = command;
    const offer = Object.freeze({
      ...terms, offeredDay: day, acceptedDay: null, cancelledDay: null, deliveredQuantity: 0,
    });
    return { changes: { offers: Object.freeze([...snapshot.offers, offer]) } };
  }

  if (command.type === 'collect') {
    const invoice = snapshot.invoices.find(({ id }) => id === command.invoiceId);
    if (!invoice) throw new SalesError('unknown-invoice');
    const settled = collectInvoice(snapshot.ledger, findOffer(snapshot, invoice.contractId), invoice, command);
    return {
      changes: {
        ledger: settled.ledger,
        invoices: Object.freeze(snapshot.invoices.map((item) => item === invoice ? settled.invoice : item)),
      },
      invoiceId: invoice.id,
    };
  }

  const offer = findOffer(snapshot, command.offerId);
  if (command.type === 'accept') {
    if (offer.cancelledDay !== null) throw new SalesError('contract-not-open');
    if (offer.acceptedDay !== null) throw new SalesError('already-accepted');
    if (command.day > offer.offerExpiresDay) throw new SalesError('offer-expired');
    return { changes: { offers: replaceOffer(snapshot, Object.freeze({ ...offer, acceptedDay: command.day })) } };
  }

  ensureOpen(offer);
  if (command.type === 'cancel') {
    const inventory = cancelContract(snapshot, offer, command);
    return {
      changes: { inventory, offers: replaceOffer(snapshot, Object.freeze({ ...offer, cancelledDay: command.day })) },
    };
  }
  if (command.type === 'reserve') return { changes: reserveContract(snapshot, offer, command) };

  const delivery = deliverContract(snapshot, offer, command, limits);
  return {
    changes: {
      inventory: delivery.inventory,
      ledger: delivery.ledger,
      offers: replaceOffer(snapshot, delivery.offer),
      invoices: Object.freeze([...snapshot.invoices, delivery.invoice]),
    },
    invoiceId: delivery.invoice.id,
  };
}

export function stageCommand(
  snapshot: SalesSnapshot, request: SalesSessionCommand, limits: { equipment: number; shipping: number },
): Staged {
  switch (request.domain) {
    case 'sales':
      return stageSale(snapshot, request.command, limits);
    case 'inventory': {
      const result = applyInventoryCommand(snapshot.inventory, snapshot.ledger, request.command);
      return { changes: { inventory: result.state, ledger: result.ledger } };
    }
    case 'workforce': {
      const result = applyWorkforceCommand(snapshot.workforce, snapshot.ledger, request.command);
      return { changes: { workforce: result.state, ledger: result.ledger } };
    }
  }
}
