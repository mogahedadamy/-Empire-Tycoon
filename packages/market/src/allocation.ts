/** Clears a day in stable buyer and score order under market, buyer, and seller limits. */
import { parseMinorUnits } from '../../finance/src';
import { compareMarketIds, computeMarketConditions, selectMarketShock } from './conditions';
import type {
  MarketBuyer, MarketDay, MarketDayInput, MarketDecision, MarketDecisionReason, MarketOffer, MarketRules, MarketScore,
} from './types';

const scale = 10_000n;
const idFormat = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface Supply {
  readonly offer: MarketOffer;
  readonly price: bigint;
  remaining: number;
}

function prepareSupplies(offers: readonly MarketOffer[], supplyBps: number): Supply[] {
  const ids = new Set<string>();
  const companies = new Set<string>();
  return [...offers].sort(compareMarketIds).map((offer) => {
    const { id, companyId, stockUnits, capacityUnits, leadDays, qualityBps, reliabilityBps } = offer;
    if (typeof id !== 'string' || typeof companyId !== 'string' || !idFormat.test(id) || !idFormat.test(companyId)) {
      throw new RangeError('Expected lowercase offer and company IDs');
    }
    if (ids.has(id) || companies.has(companyId)) throw new RangeError(`Duplicate market offer or company: ${id}`);
    ids.add(id);
    companies.add(companyId);
    const price = parseMinorUnits(offer.unitPriceMinor);
    if (price <= 0n || [stockUnits, capacityUnits, leadDays].some((n) => !Number.isSafeInteger(n) || n < 0) ||
        [qualityBps, reliabilityBps].some((n) => !Number.isSafeInteger(n) || n < 0 || n > Number(scale))) {
      throw new RangeError(`Invalid price, supply, or service rating in market offer: ${id}`);
    }
    const available = BigInt(Math.min(stockUnits, capacityUnits));
    return { offer, price, remaining: Number(available * BigInt(supplyBps) / scale) };
  });
}

function rejectReason(buyer: MarketBuyer, supply: Supply, budget: bigint): MarketDecisionReason | null {
  if (supply.offer.qualityBps < buyer.minQualityBps) return 'quality-below-minimum';
  if (supply.offer.leadDays > buyer.maxLeadDays) return 'outside-delivery-window';
  if (supply.price > budget) return 'price-above-budget';
  if (supply.remaining === 0) return 'no-supply';
  return null;
}

function scoreOffer(supply: Supply, reference: bigint, demand: number, weights: MarketRules['weights']): MarketScore {
  const priceBps = Number(reference * scale / (reference + supply.price));
  const { qualityBps, reliabilityBps } = supply.offer;
  const availabilityBps = Number(BigInt(Math.min(supply.remaining, demand)) * scale / BigInt(demand));
  const total = priceBps * weights.priceBps + qualityBps * weights.qualityBps +
    reliabilityBps * weights.reliabilityBps + availabilityBps * weights.availabilityBps;
  return Object.freeze({ priceBps, qualityBps, reliabilityBps, availabilityBps, total });
}

/** Clears validated scenario rules and a single round of offers. Throws on invalid or duplicate offers. */
export function clearMarketDay(rules: MarketRules, input: MarketDayInput): MarketDay {
  if (!Number.isSafeInteger(input.day) || input.day < 1) throw new RangeError('Expected a positive market day');
  const conditions = computeMarketConditions(rules, selectMarketShock(rules, input.randomUint32));
  const reference = BigInt(conditions.referencePriceMinor);
  const supplies = prepareSupplies(input.offers, conditions.supplyBps);
  const buyers = new Map(rules.buyers.map((buyer) => [buyer.id, buyer]));
  const decisions: MarketDecision[] = [];
  let marketRemaining = conditions.demandUnits;
  let totalAwardValue = 0n;

  for (const { buyerId, units } of conditions.buyerDemand) {
    const buyer = buyers.get(buyerId)!;
    const budget = BigInt(buyer.maxUnitPriceMinor);
    const beforeBuyer = Math.min(units, marketRemaining);
    let buyerRemaining = beforeBuyer;
    const ranked: { supply: Supply; score: MarketScore }[] = [];

    for (const supply of supplies) {
      const reason = rejectReason(buyer, supply, budget);
      if (reason || beforeBuyer === 0) {
        decisions.push(decision(buyerId, supply, buyerRemaining, 0, null,
          reason ?? (units === 0 ? 'no-buyer-demand' : 'market-cap-reached')));
      } else {
        ranked.push({ supply, score: scoreOffer(supply, reference, beforeBuyer, rules.weights) });
      }
    }

    ranked.sort((a, b) => b.score.total - a.score.total || compareMarketIds(a.supply.offer, b.supply.offer));
    for (const { supply, score } of ranked) {
      const awarded = Math.min(supply.remaining, buyerRemaining);
      const reason = awarded === 0 ? 'higher-ranked-offer-filled-demand'
        : awarded < buyerRemaining ? 'available-supply-limited-award' : 'awarded';
      decisions.push(decision(buyerId, supply, buyerRemaining, awarded, score, reason));
      supply.remaining -= awarded;
      buyerRemaining -= awarded;
      marketRemaining -= awarded;
      totalAwardValue += BigInt(awarded) * supply.price;
    }
  }

  const allocatedUnits = conditions.demandUnits - marketRemaining;
  const volume = BigInt(allocatedUnits);
  return Object.freeze({
    marketId: rules.id, day: input.day, currency: rules.currency,
    conditions, allocatedUnits, unmetUnits: marketRemaining,
    averageAwardPriceMinor: volume === 0n ? null : ((totalAwardValue + volume / 2n) / volume).toString(),
    decisions: Object.freeze(decisions),
  });
}

function decision(
  buyerId: string, supply: Supply, demandRemainingBefore: number, awardedUnits: number,
  score: MarketScore | null, reason: MarketDecisionReason,
): MarketDecision {
  const { id, companyId, unitPriceMinor } = supply.offer;
  return Object.freeze({
    buyerId, offerId: id, companyId, unitPriceMinor, availableUnits: supply.remaining,
    demandRemainingBefore, awardedUnits, score, reason,
  });
}
