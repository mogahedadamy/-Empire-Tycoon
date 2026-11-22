/** Verifies contract priority, demand and supply limits, and traceable market decisions. */
import { expect, it } from 'vitest';
import { clearMarketDay, updateMarketReliability, type MarketDay } from '../../packages/market/src';
import { budget, noShock, offers, rival, sanabel, scenario } from './fixtures';

const rules = scenario.market;
const input = { day: 1, randomUint32: noShock, offers };

function awards(day: MarketDay, companyId: string) {
  return day.decisions.filter((entry) => entry.companyId === companyId && entry.awardedUnits > 0);
}

it('assigns bounded purchases with separate reasons for a partial award, a win, and rejection', () => {
  const day = clearMarketDay(rules, input);
  expect(day).toMatchObject({
    marketId: 'wadi-produce', currency: 'GAME', allocatedUnits: 100, unmetUnits: 0, averageAwardPriceMinor: '7580',
    conditions: { shockId: null, demandUnits: 100, referencePriceMinor: '8000' },
  });
  expect(day.decisions.filter(({ buyerId }) => buyerId === 'city-grocers')).toEqual([
    expect.objectContaining({ offerId: budget.id, reason: 'quality-below-minimum', awardedUnits: 0, score: null }),
    expect.objectContaining({ offerId: sanabel.id, reason: 'available-supply-limited-award', demandRemainingBefore: 70, awardedUnits: 60 }),
    expect.objectContaining({ offerId: rival.id, reason: 'awarded', demandRemainingBefore: 10, awardedUnits: 10 }),
  ]);
  expect(awards(day, rival.companyId).map(({ awardedUnits }) => awardedUnits)).toEqual([10, 30]);
  const awardedTo = (buyerId: string) => day.decisions.filter((entry) => entry.buyerId === buyerId)
    .reduce((sum, entry) => sum + entry.awardedUnits, 0);
  expect(awardedTo('city-grocers')).toBe(70);
  expect(awardedTo('harbor-shops')).toBe(30);
});

it('loses Sanabel its contract when only its reliability falls after a poor delivery', () => {
  const reliabilityBps = updateMarketReliability(sanabel.reliabilityBps,
    { promisedUnits: 100, onTimeAcceptedUnits: 10 }, rules.reliabilityObservationBps);
  expect(reliabilityBps).toBe(6880);
  const before = clearMarketDay(rules, input);
  const after = clearMarketDay(rules, { ...input, offers: [{ ...sanabel, reliabilityBps }, rival, budget] });
  expect(awards(before, sanabel.companyId)).toHaveLength(1);
  expect(awards(after, sanabel.companyId)).toHaveLength(0);
  expect(awards(after, rival.companyId).map(({ awardedUnits }) => awardedUnits)).toEqual([70, 30]);
  expect(after.decisions).toContainEqual(expect.objectContaining({
    buyerId: 'city-grocers', offerId: sanabel.id, reason: 'higher-ranked-offer-filled-demand',
    score: expect.objectContaining({ reliabilityBps }),
  }));
  expect(updateMarketReliability(reliabilityBps, { promisedUnits: 100, onTimeAcceptedUnits: 100 },
    rules.reliabilityObservationBps)).toBe(7816);
});

it('lets price decide between otherwise equal offers and has deterministic tie breaks', () => {
  const first = { ...sanabel, id: 'a-offer', companyId: 'a-company', stockUnits: 100, capacityUnits: 100 };
  const second = { ...first, id: 'z-offer', companyId: 'z-company' };
  const tied = clearMarketDay(rules, { ...input, offers: [second, first] });
  expect(awards(tied, first.companyId)).toHaveLength(2);
  expect(awards(tied, second.companyId)).toHaveLength(0);
  expect(clearMarketDay({ ...rules, buyers: [...rules.buyers].reverse() }, { ...input, offers: [first, second] })).toEqual(tied);

  const cheaper = clearMarketDay(rules, { ...input, offers: [first, { ...second, unitPriceMinor: '7300' }] });
  expect(awards(cheaper, first.companyId)).toHaveLength(0);
  expect(awards(cheaper, second.companyId)).toHaveLength(2);
});

it('respects buyer limits, both supply constraints, and market shocks without changing the submitted offers', () => {
  const stockLimited = { ...sanabel, stockUnits: 49, capacityUnits: 70 };
  const capacityLimited = { ...rival, stockUnits: 72, capacityUnits: 39 };
  const submitted = Object.freeze([Object.freeze(stockLimited), Object.freeze(capacityLimited)]);
  const shortage = clearMarketDay(rules, { ...input, offers: submitted, randomUint32: 0x40000000 });
  expect(shortage.conditions).toMatchObject({ shockId: 'harvest-shortfall', demandUnits: 100, supplyBps: 6500 });
  const sum = (companyId: string) => awards(shortage, companyId).reduce((count, entry) => count + entry.awardedUnits, 0);
  expect(sum(stockLimited.companyId)).toBe(31);
  expect(sum(capacityLimited.companyId)).toBe(25);
  expect(shortage).toMatchObject({ allocatedUnits: 56, unmetUnits: 44 });
  expect(submitted).toEqual([stockLimited, capacityLimited]);
  const festival = clearMarketDay({
    ...rules, maxDemandUnits: 120,
    buyers: rules.buyers.map((buyer) => ({ ...buyer, maxDemandUnits: buyer.baseDemandUnits })),
  }, { ...input, randomUint32: 0 });
  expect(festival.conditions.buyerDemand.map(({ units }) => units)).toEqual([70, 40]);
});

it('explains expensive, late, and unavailable offers', () => {
  const result = clearMarketDay(rules, {
    ...input,
    offers: [
      { ...sanabel, unitPriceMinor: '9000' }, { ...rival, leadDays: 4 }, { ...budget, qualityBps: 8500, stockUnits: 0 },
    ],
  });
  expect(result.allocatedUnits).toBe(0);
  expect(result.averageAwardPriceMinor).toBeNull();
  expect(result.decisions.map(({ reason }) => reason)).toEqual([
    'no-supply', 'outside-delivery-window', 'price-above-budget',
    'no-supply', 'outside-delivery-window', 'price-above-budget',
  ]);
});

it('keeps price and weighted totals exact above the safe integer range', () => {
  const price = '900719925474099300001';
  const exactRules = { ...rules, referencePriceMinor: price, buyers: rules.buyers.map((buyer) => ({ ...buyer, maxUnitPriceMinor: price })) };
  const day = clearMarketDay(exactRules, { ...input, offers: [{ ...sanabel, unitPriceMinor: price }] });
  expect(day.averageAwardPriceMinor).toBe(price);
  expect(awards(day, sanabel.companyId)[0].score?.priceBps).toBe(5000);
});

it('rejects invalid inputs and prevents duplicate bids from doubling company capacity', () => {
  expect(() => clearMarketDay(rules, { ...input, offers: [sanabel, { ...sanabel, id: 'duplicate-offer' }] })).toThrow('Duplicate');
  expect(() => clearMarketDay(rules, { ...input, offers: [{ ...sanabel, stockUnits: -1 }] })).toThrow('Invalid');
  expect(() => clearMarketDay(rules, { ...input, day: 0 })).toThrow('market day');
  expect(() => clearMarketDay(rules, { ...input, randomUint32: 0x100000000 })).toThrow('market draw');
  expect(() => updateMarketReliability(7000, { promisedUnits: 2, onTimeAcceptedUnits: 3 }, 3000)).toThrow('observation');
});
