/** Derives daily market conditions and a read-only range from authored shock probabilities. */
import { applyBasisPoints, parseMinorUnits } from '../../finance/src';
import type { MarketConditions, MarketRules, MarketShock } from './types';

const basisPoints = 10_000;

export function compareMarketIds<T extends { readonly id: string }>(left: T, right: T) {
  return left.id < right.id ? -1 : Number(left.id > right.id);
}

export function selectMarketShock(rules: MarketRules, randomUint32: number) {
  if (!Number.isInteger(randomUint32) || randomUint32 < 0 || randomUint32 > 0xffffffff) {
    throw new RangeError('Expected an unsigned 32-bit market draw');
  }
  let ticket = Math.floor(randomUint32 * basisPoints / 0x100000000);
  for (const shock of [...rules.shocks].sort(compareMarketIds)) {
    if (ticket < shock.chanceBps) return shock;
    ticket -= shock.chanceBps;
  }
  return null;
}

export function computeMarketConditions(rules: MarketRules, shock: MarketShock | null): MarketConditions {
  const reference = parseMinorUnits(rules.referencePriceMinor);
  const shockedPrice = applyBasisPoints(reference, shock?.priceBps ?? basisPoints);
  const effectivePrice = shockedPrice > 0n ? shockedPrice : 1n;
  const elasticity = BigInt(rules.priceElasticityBps);
  // Base demand moves in the opposite direction of the relative price change.
  const priceImpact = (effectivePrice - reference) * elasticity / reference;
  const priceDemandBps = BigInt(basisPoints) - priceImpact;
  const priceFactor = priceDemandBps > 0n ? priceDemandBps : 0n;
  const volumeFactor = BigInt(shock?.demandBps ?? basisPoints);
  const scale = BigInt(basisPoints) ** 2n;

  let demandUnits = 0;
  const buyerDemand = [...rules.buyers].sort(compareMarketIds).map((buyer) => {
    const projected = (BigInt(buyer.baseDemandUnits) * volumeFactor * priceFactor + scale / 2n) / scale;
    const units = projected > BigInt(buyer.maxDemandUnits) ? buyer.maxDemandUnits : Number(projected);
    demandUnits += Math.min(units, rules.maxDemandUnits - demandUnits);
    return Object.freeze({ buyerId: buyer.id, units });
  });
  return Object.freeze({
    shockId: shock?.id ?? null, referencePriceMinor: effectivePrice.toString(), demandUnits,
    supplyBps: shock?.supplyBps ?? basisPoints, buyerDemand: Object.freeze(buyerDemand),
  });
}

/** Lists attainable conditions and ranges without advancing the clock or consuming randomness. */
export function forecastMarket(rules: MarketRules) {
  const baseline = computeMarketConditions(rules, null);
  const shocks = [...rules.shocks].sort(compareMarketIds);
  const noShockChanceBps = basisPoints - shocks.reduce((total, shock) => total + shock.chanceBps, 0);
  const scenarios = shocks.map((shock) => Object.freeze({
    chanceBps: shock.chanceBps, conditions: computeMarketConditions(rules, shock),
  }));
  if (noShockChanceBps > 0) scenarios.unshift(Object.freeze({ chanceBps: noShockChanceBps, conditions: baseline }));

  let minDemand = Number.MAX_SAFE_INTEGER;
  let maxDemand = 0;
  let minPrice: bigint | undefined;
  let maxPrice = 0n;
  for (const { conditions } of scenarios) {
    minDemand = Math.min(minDemand, conditions.demandUnits);
    maxDemand = Math.max(maxDemand, conditions.demandUnits);
    const price = BigInt(conditions.referencePriceMinor);
    if (minPrice === undefined || price < minPrice) minPrice = price;
    if (price > maxPrice) maxPrice = price;
  }
  return Object.freeze({
    baseline,
    scenarios: Object.freeze(scenarios),
    demandUnits: Object.freeze({ min: minDemand, max: maxDemand }),
    referencePriceMinor: Object.freeze({ min: minPrice!.toString(), max: maxPrice.toString() }),
  });
}
