/** Unit tests for the unified USD Empire Tycoon investor portfolio domain. */
import { describe, expect, it } from 'vitest';
import {
  activateTapBoost, advanceEmpireTime, boostCompany, buyDigitalAsset, buyLuxuryItem,
  buyRealEstate, buyStock, companyHourlyIncomeCents, computeForbesRank, computeWealth,
  createInitialEmpire, deserializeEmpire, foundCompany, getTapTier, mergeHolding,
  propertyHourlyYieldBps, REAL_ESTATE_CATALOG, sellCompany, sellDigitalAssetAll, sellStock,
  serializeEmpire, setCompanyStrategy, tapEarn, tapValueCents, totalHourlyIncomeCents,
  upgradeCompany, upgradeTapLevel,
} from '../../packages/empire/src';

describe('unified USD investor empire engine', () => {
  it('starts at $0.00 with $1.00 per tap, boosts 3x, and upgrades at $500.00', () => {
    const t0 = 1_000_000;
    let state = createInitialEmpire(t0);
    expect(state.balanceCents).toBe(0n);
    expect(tapValueCents(state, t0)).toBe(100n); // $1.00
    expect(getTapTier(1).upgradeCostCents).toBe(50_000n); // $500.00

    // Cannot upgrade or found a business at $0.00.
    expect(upgradeTapLevel(state).tapLevel).toBe(1);
    expect(foundCompany(state, 'food', t0).company).toBeNull();

    // Tap once -> $1.00.
    const first = tapEarn(state, t0);
    state = first.state;
    expect(first.earnedCents).toBe(100n);
    expect(state.balanceCents).toBe(100n);

    // Focus sprint -> $3.00 per tap.
    state = activateTapBoost(state, t0);
    expect(tapValueCents(state, t0 + 1_000)).toBe(300n);

    // Reaching $500.00 unlocks Level 2 ($2.00 per tap).
    state = { ...state, balanceCents: 50_000n };
    state = upgradeTapLevel(state);
    expect(state.tapLevel).toBe(2);
    expect(state.balanceCents).toBe(0n);
    expect(tapValueCents(state, t0 + 30_000)).toBe(200n);
  });

  it('founds companies from earned USD, streams passive income, upgrades, merges, and restructures', () => {
    const t0 = 2_000_000;
    let state = { ...createInitialEmpire(t0), balanceCents: 2_500_000n }; // $25,000
    const res = foundCompany(state, 'food', t0);
    expect(res.company).not.toBeNull();
    state = res.state;
    expect(state.balanceCents).toBe(2_250_000n); // $2,500 deducted
    const id = res.company!.id;

    // Strategy switch increases hourly income (+20%).
    const baseHourly = companyHourlyIncomeCents(state.companies[0], t0, false);
    state = setCompanyStrategy(state, id, 'harbor-contracts');
    const stratHourly = companyHourlyIncomeCents(state.companies[0], t0, false);
    expect(stratHourly).toBe((baseHourly * 12_000n) / 10_000n);

    // Operations push boosts +30% and 1 hour of elapsed time accrues exact passive USD.
    state = boostCompany(state, id, t0);
    const boostedHourly = totalHourlyIncomeCents(state, t0 + 1_000);
    const afterHour = advanceEmpireTime(state, t0 + 3_600_000);
    expect(afterHour.accruedCents).toBe(boostedHourly);
    expect(afterHour.state.balanceCents).toBe(state.balanceCents + boostedHourly);

    // Upgrade & Holding Merger (+40% once 3 companies are Lv 3+).
    state = { ...afterHour.state, balanceCents: 50_000_000n };
    state = foundCompany(state, 'manufacturing', t0 + 10).state;
    state = foundCompany(state, 'logistics', t0 + 20).state;
    for (const co of state.companies) {
      state = upgradeCompany(state, co.id);
      state = upgradeCompany(state, co.id);
    }
    state = mergeHolding(state);
    expect(state.holdingMerged).toBe(true);

    // Selling a company recovers 75% of invested capital.
    const invested = state.companies[0].investedCents;
    const beforeSell = state.balanceCents;
    state = sellCompany(state, id);
    expect(state.balanceCents).toBe(beforeSell + (invested * 75n) / 100n);
  });

  it('tracks investing, real-estate ROI, luxury Fortune preservation, Forbes rank, and codec roundtrip', () => {
    const t0 = 5_000_000;
    let state = { ...createInitialEmpire(t0), balanceCents: 30_000_000n }; // $300,000
    state = buyStock(state, 'st-sunbul', 10);
    expect(state.stocks['st-sunbul']?.shares).toBe(10);

    const studio = REAL_ESTATE_CATALOG[0];
    expect(propertyHourlyYieldBps(studio)).toBeGreaterThan(0);
    state = buyRealEstate(state, studio.id);
    expect(state.properties).toContain(studio.id);

    state = buyDigitalAsset(state, 'da-mars', 100_000n);
    expect(state.digitalAssets['da-mars']?.unitsMilli).toBeGreaterThan(0n);

    // Buying a luxury item reduces cash balance but preserves Total Net Worth (Fortune) 100%!
    const beforeLuxury = computeWealth(state);
    state = buyLuxuryItem(state, 'it-car-1');
    const afterLuxury = computeWealth(state);
    expect(afterLuxury.balanceCents).toBeLessThan(beforeLuxury.balanceCents);
    expect(afterLuxury.fortuneCents).toBe(beforeLuxury.fortuneCents);
    expect(afterLuxury.luxuryCents).toBe(4_500_000n);
    expect(computeForbesRank(afterLuxury.fortuneCents)).toBeLessThanOrEqual(8);

    // Sell stock and digital asset cleanly.
    state = sellStock(state, 'st-sunbul', 10);
    state = sellDigitalAssetAll(state, 'da-mars');
    expect(state.stocks['st-sunbul']).toBeUndefined();
    expect(state.digitalAssets['da-mars']).toBeUndefined();

    // Lossless JSON bigint roundtrip.
    const roundtrip = deserializeEmpire(serializeEmpire(state), t0);
    expect(roundtrip).toEqual(state);
  });
});
