/** Supplies repeatable offers for the authored Wadi Al Marsa produce market. */
import { loadMarketScenario } from '../../packages/content/src';
import type { MarketOffer } from '../../packages/market/src';

export const scenario = loadMarketScenario('wadi-produce-market');
export const sanabel = {
  id: 'sanabel-offer', companyId: 'sanabel-al-wadi', unitPriceMinor: '7500',
  stockUnits: 90, capacityUnits: 60, leadDays: 2, qualityBps: 9000, reliabilityBps: 9400,
} satisfies MarketOffer;
export const rival = {
  id: 'rival-offer', companyId: 'coastal-produce', unitPriceMinor: '7700',
  stockUnits: 120, capacityUnits: 100, leadDays: 1, qualityBps: 8400, reliabilityBps: 8200,
} satisfies MarketOffer;
export const budget = {
  id: 'budget-offer', companyId: 'discount-harvest', unitPriceMinor: '6900',
  stockUnits: 90, capacityUnits: 100, leadDays: 2, qualityBps: 6400, reliabilityBps: 9800,
} satisfies MarketOffer;
export const offers = [sanabel, rival, budget] as const;
export const noShock = 0xffffffff;
