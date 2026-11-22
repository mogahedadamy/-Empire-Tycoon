/** Checks shipped market metadata and the authored rule validation boundary. */
import { expect, it } from 'vitest';
import authored from '../../packages/content/data/wadi-produce-market.json';
import { loadMarketScenario, parseMarketScenario } from '../../packages/content/src';

it('loads the versioned fictional produce market without changing founding scenarios', () => {
  const scenario = loadMarketScenario(authored.id);
  expect(scenario).toMatchObject({
    schemaVersion: 1, rulesetVersion: 1, contentVersion: 1, seed: 202627,
    market: { productId: 'produce-box', regionId: 'wadi-al-marsa', currency: 'GAME' },
  });
  expect(Object.isFrozen(scenario.market.buyers[0])).toBe(true);
  expect(() => loadMarketScenario('missing-market')).toThrow('Unknown market');
});

it('rejects duplicate buyers, excessive odds, inconsistent limits, and invalid score weights', () => {
  const getMarket = () => structuredClone(authored);
  const duplicate = getMarket();
  duplicate.market.buyers.push(duplicate.market.buyers[0]);
  expect(() => parseMarketScenario(duplicate)).toThrow(/market\.buyers.*unique/);
  const excessive = getMarket();
  excessive.market.shocks[0].chanceBps = 10_000;
  expect(() => parseMarketScenario(excessive)).toThrow(/market\.shocks.*probabilities/);
  const demand = getMarket();
  demand.market.buyers[0].maxDemandUnits = 20;
  expect(() => parseMarketScenario(demand)).toThrow(/market\.buyers\[0\]\.baseDemandUnits/);
  const weights = getMarket();
  weights.market.weights.reliabilityBps += 1;
  expect(() => parseMarketScenario(weights)).toThrow(/market\.weights.*sum/);
});
