/** Loads and validates authored rules for a seedable fictional commodity market. */
import wadiProduce from '../data/wadi-produce-market.json';
import type { MarketBuyer, MarketRules, MarketShock } from '../../market/src';
import { id, integer, invalid, money, section } from './fields';

function array(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) return invalid(path, 'expected an array');
  return value;
}

function uniqueIds<T extends { id: string }>(items: T[], path: string): readonly T[] {
  if (new Set(items.map((item) => item.id)).size !== items.length) invalid(path, 'expected unique IDs');
  return Object.freeze(items);
}

function buyer(value: unknown, index: number): MarketBuyer {
  const path = `market.buyers[${index}]`;
  const data = section(value, path);
  const maxDemandUnits = integer(data.maxDemandUnits, `${path}.maxDemandUnits`);
  return Object.freeze({
    id: id(data.id, `${path}.id`),
    baseDemandUnits: integer(data.baseDemandUnits, `${path}.baseDemandUnits`, 0, maxDemandUnits),
    maxDemandUnits,
    minQualityBps: integer(data.minQualityBps, `${path}.minQualityBps`, 0, 10_000),
    maxLeadDays: integer(data.maxLeadDays, `${path}.maxLeadDays`, 0),
    maxUnitPriceMinor: money(data.maxUnitPriceMinor, `${path}.maxUnitPriceMinor`),
  });
}

function shock(value: unknown, index: number): MarketShock {
  const path = `market.shocks[${index}]`;
  const data = section(value, path);
  return Object.freeze({
    id: id(data.id, `${path}.id`),
    chanceBps: integer(data.chanceBps, `${path}.chanceBps`, 1, 10_000),
    demandBps: integer(data.demandBps, `${path}.demandBps`, 0, 20_000),
    supplyBps: integer(data.supplyBps, `${path}.supplyBps`, 0, 10_000),
    priceBps: integer(data.priceBps, `${path}.priceBps`, 1, 20_000),
  });
}

function weights(value: unknown): MarketRules['weights'] {
  const path = 'market.weights';
  const data = section(value, path);
  const decoded = {
    priceBps: integer(data.priceBps, `${path}.priceBps`, 1, 10_000),
    qualityBps: integer(data.qualityBps, `${path}.qualityBps`, 1, 10_000),
    reliabilityBps: integer(data.reliabilityBps, `${path}.reliabilityBps`, 1, 10_000),
    availabilityBps: integer(data.availabilityBps, `${path}.availabilityBps`, 1, 10_000),
  };
  if (Object.values(decoded).reduce((sum, weight) => sum + weight, 0) !== 10_000) {
    invalid(path, 'weights must sum to 10000 basis points');
  }
  return Object.freeze(decoded);
}

function decodeMarket(value: unknown): MarketRules {
  const data = section(value, 'market');
  const buyers = uniqueIds(array(data.buyers, 'market.buyers').map(buyer), 'market.buyers');
  if (!buyers.length) invalid('market.buyers', 'expected at least one buyer');
  const shocks = uniqueIds(array(data.shocks, 'market.shocks').map(shock), 'market.shocks');
  if (shocks.reduce((sum, item) => sum + item.chanceBps, 0) > 10_000) {
    invalid('market.shocks', 'shock probabilities exceed 10000 basis points');
  }

  if (data.currency !== 'GAME') invalid('market.currency', 'expected the fictional GAME currency');
  return Object.freeze({
    id: id(data.id, 'market.id'),
    productId: id(data.productId, 'market.productId'),
    regionId: id(data.regionId, 'market.regionId'),
    currency: data.currency,
    referencePriceMinor: money(data.referencePriceMinor, 'market.referencePriceMinor'),
    maxDemandUnits: integer(data.maxDemandUnits, 'market.maxDemandUnits', 0),
    priceElasticityBps: integer(data.priceElasticityBps, 'market.priceElasticityBps', 0, 10_000),
    reliabilityObservationBps: integer(data.reliabilityObservationBps, 'market.reliabilityObservationBps', 1, 10_000),
    weights: weights(data.weights), buyers, shocks,
  });
}

/** Parses market content from JSON, rejecting invalid quantities, odds, and weights at their paths. */
export function parseMarketScenario(input: unknown) {
  const data = section(input, 'marketScenario');
  return Object.freeze({
    schemaVersion: integer(data.schemaVersion, 'schemaVersion', 1, 1),
    rulesetVersion: integer(data.rulesetVersion, 'rulesetVersion', 1, 1),
    contentVersion: integer(data.contentVersion, 'contentVersion'),
    id: id(data.id, 'id'),
    seed: integer(data.seed, 'seed', 0, 0xffffffff),
    market: decodeMarket(data.market),
  });
}

/** Loads the shipped produce market and its replay seed. Throws for an unknown scenario ID. */
export function loadMarketScenario(scenarioId: string) {
  if (scenarioId !== wadiProduce.id) throw new RangeError(`Unknown market scenario: ${scenarioId}`);
  return parseMarketScenario(wadiProduce);
}
