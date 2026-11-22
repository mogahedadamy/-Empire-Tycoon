/** Chooses the next opening-mission decision from the last committed journey state. */
import type { Scenario } from '../../../../packages/content/src';
import type { JourneyAction, JourneyReadModel } from './types';

export type MissionStepId = 'found' | 'contract' | 'order' | 'arrival' | 'delivery-day' | 'ship' | 'next-trip' | 'done' | 'blocked';

export interface MissionStep {
  readonly id: MissionStepId;
  readonly phase: number;
  readonly action: JourneyAction | null;
}

/** The opening mission remains available until the first close or the end of the company. */
export function hasOpeningMission(model: JourneyReadModel, scenario: Scenario) {
  return model.lastClosedDay < scenario.calendar.firstCloseDay && model.evaluation.status === 'in-progress';
}

/** Resolves the proposed command and the amount for the guided shipment using real capacity. */
export function readMissionStep(model: JourneyReadModel, scenario: Scenario, fundingPlan: 'loan' | 'capital'): MissionStep {
  if (!model.founded) return { id: 'found', phase: 0, action: { type: 'found-company', fundingPlan } };

  const { offer, milestone } = model;
  const delivered = offer?.deliveredQuantity ?? 0;
  if (model.evaluation.deliveredOnTime) {
    return {
      id: 'done', phase: 4,
      action: milestone?.reason === 'monthly-close' ? { type: 'advance-through', day: milestone.targetDay } : null,
    };
  }
  if (!offer || offer.status === 'expired' || offer.status === 'late' || !model.distress.canOperate || model.pendingAlerts.length) {
    return { id: 'blocked', phase: delivered > 0 ? 3 : 1, action: null };
  }
  if (offer.status === 'offered') {
    return { id: 'contract', phase: 1, action: { type: 'accept-contract', offerId: offer.offerId } };
  }
  if (!model.supplyOrdered) return { id: 'order', phase: 2, action: { type: 'order-supply' } };
  if (milestone?.reason === 'supply-arrival' || milestone?.reason === 'delivery-window') {
    return {
      id: milestone.reason === 'supply-arrival' ? 'arrival' : 'delivery-day',
      phase: 2, action: { type: 'advance-through', day: milestone.targetDay },
    };
  }
  const quantity = Math.min(offer.quantity - delivered, Number(model.capacity.available));
  if (quantity > 0 && model.day >= scenario.contract.deliveryStartsDay && model.day <= offer.deliveryDueDay) {
    return { id: 'ship', phase: 3, action: { type: 'deliver', offerId: offer.offerId, quantity } };
  }
  if (model.canAdvance && delivered > 0 && model.day < offer.deliveryDueDay && Number(model.inventory.available) > 0) {
    return { id: 'next-trip', phase: 3, action: { type: 'advance', days: 1 } };
  }
  return { id: 'blocked', phase: 3, action: null };
}
