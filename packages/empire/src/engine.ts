/** Pure headless transition engine for the unified Empire Tycoon investor portfolio. */
import {
  BUSINESS_SECTORS, COMPANY_BOOST_DURATION_MS, FORBES_LIST, getSectorDef, getTapTier,
  HOLDING_MERGE_COST_CENTS, HOLDING_MERGE_MIN_COMPANIES, HOLDING_MERGE_MIN_LEVEL,
  MAX_COMPANIES, MAX_OFFLINE_SECONDS, TAP_BOOST_COOLDOWN_MS, TAP_BOOST_DURATION_MS,
} from './catalog';
import { DIGITAL_ASSETS_CATALOG, LUXURY_ITEMS_CATALOG, quoteMarketPrice, REAL_ESTATE_CATALOG, STOCKS_CATALOG } from './markets';
import type { EmpireState, OwnedCompany, SectorId, WealthBreakdown } from './types';

export function createInitialEmpire(nowMs: number): EmpireState {
  return {
    version: 1,
    cardLast4: '7439',
    balanceCents: 0n,
    tapLevel: 1,
    tapBoostUntilMs: 0,
    tapBoostCooldownUntilMs: 0,
    companies: [],
    holdingMerged: false,
    stocks: {},
    properties: [],
    digitalAssets: {},
    items: [],
    marketTick: 0,
    stats: {
      tapEarnedCents: 0n,
      businessEarnedCents: 0n,
      dividendsEarnedCents: 0n,
      rentEarnedCents: 0n,
      tradingProfitCents: 0n,
      totalTaps: 0,
    },
    lastTickMs: nowMs,
  };
}

export function tapValueCents(state: EmpireState, nowMs: number): bigint {
  const base = getTapTier(state.tapLevel).perTapCents;
  return nowMs < state.tapBoostUntilMs ? base * 3n : base;
}

export function tapEarn(state: EmpireState, nowMs: number): { state: EmpireState; earnedCents: bigint } {
  const earnedCents = tapValueCents(state, nowMs);
  return {
    earnedCents,
    state: {
      ...state,
      balanceCents: state.balanceCents + earnedCents,
      stats: {
        ...state.stats,
        tapEarnedCents: state.stats.tapEarnedCents + earnedCents,
        totalTaps: state.stats.totalTaps + 1,
      },
    },
  };
}

export function activateTapBoost(state: EmpireState, nowMs: number): EmpireState {
  if (nowMs < state.tapBoostCooldownUntilMs || nowMs < state.tapBoostUntilMs) return state;
  const until = nowMs + TAP_BOOST_DURATION_MS;
  return { ...state, tapBoostUntilMs: until, tapBoostCooldownUntilMs: until + TAP_BOOST_COOLDOWN_MS };
}

export function upgradeTapLevel(state: EmpireState): EmpireState {
  const tier = getTapTier(state.tapLevel);
  if (tier.upgradeCostCents === null || state.balanceCents < tier.upgradeCostCents) return state;
  return {
    ...state,
    balanceCents: state.balanceCents - tier.upgradeCostCents,
    tapLevel: state.tapLevel + 1,
  };
}

export function companyUpgradeCostCents(company: OwnedCompany): bigint {
  const def = getSectorDef(company.sector);
  return def.upgradeBaseCents * BigInt(company.level) * BigInt(company.level + 1) / 2n;
}

export function companyHourlyIncomeCents(company: OwnedCompany, nowMs: number, holdingMerged: boolean): bigint {
  const def = getSectorDef(company.sector);
  const strat = def.strategies.find((s) => s.id === company.strategyId) ?? def.strategies[0];
  const levelMultiplier = BigInt(100 + (company.level - 1) * 75); // +75% per level
  let hourly = (def.baseHourlyCents * levelMultiplier * BigInt(strat.incomeBps)) / 1_000_000n;
  if (nowMs < company.boostUntilMs) hourly = (hourly * 13_000n) / 10_000n;
  if (holdingMerged) hourly = (hourly * 14_000n) / 10_000n;
  return hourly;
}

export function totalBusinessHourlyCents(state: EmpireState, nowMs: number): bigint {
  return state.companies.reduce((sum, co) => sum + companyHourlyIncomeCents(co, nowMs, state.holdingMerged), 0n);
}

export function totalDividendsHourlyCents(state: EmpireState): bigint {
  let sum = 0n;
  for (const def of STOCKS_CATALOG) {
    const holding = state.stocks[def.id];
    if (!holding || holding.shares <= 0) continue;
    const price = quoteMarketPrice(def.basePriceCents, def.volatilityBps, def.phase, state.marketTick);
    sum += (price * BigInt(holding.shares) * BigInt(def.dividendBpsPerHour)) / 10_000n;
  }
  return sum;
}

export function totalRentHourlyCents(state: EmpireState): bigint {
  let sum = 0n;
  for (const id of state.properties) {
    const def = REAL_ESTATE_CATALOG.find((p) => p.id === id);
    if (def) sum += def.hourlyRentCents;
  }
  return sum;
}

export function totalHourlyIncomeCents(state: EmpireState, nowMs: number): bigint {
  return totalBusinessHourlyCents(state, nowMs) + totalDividendsHourlyCents(state) + totalRentHourlyCents(state);
}

/** Accrues elapsed passive income in exact cents and advances market price ticks every 5 seconds. */
export function advanceEmpireTime(state: EmpireState, nowMs: number): { state: EmpireState; accruedCents: bigint } {
  const rawElapsedMs = Math.max(0, nowMs - state.lastTickMs);
  if (rawElapsedMs < 200) return { state, accruedCents: 0n };
  const clampedMs = Math.min(rawElapsedMs, MAX_OFFLINE_SECONDS * 1_000);
  const msBig = BigInt(clampedMs);
  const biz = (totalBusinessHourlyCents(state, nowMs) * msBig) / 3_600_000n;
  const div = (totalDividendsHourlyCents(state) * msBig) / 3_600_000n;
  const rent = (totalRentHourlyCents(state) * msBig) / 3_600_000n;
  const accruedCents = biz + div + rent;
  const tickStep = Math.floor(nowMs / 5_000) - Math.floor(state.lastTickMs / 5_000);
  const marketTick = tickStep > 0 ? state.marketTick + Math.min(tickStep, 60) : state.marketTick;
  return {
    accruedCents,
    state: {
      ...state,
      balanceCents: state.balanceCents + accruedCents,
      marketTick,
      lastTickMs: nowMs,
      stats: {
        ...state.stats,
        businessEarnedCents: state.stats.businessEarnedCents + biz,
        dividendsEarnedCents: state.stats.dividendsEarnedCents + div,
        rentEarnedCents: state.stats.rentEarnedCents + rent,
      },
    },
  };
}

export function foundCompany(state: EmpireState, sector: SectorId, nowMs: number): { state: EmpireState; company: OwnedCompany | null } {
  if (state.companies.length >= MAX_COMPANIES) return { state, company: null };
  const def = getSectorDef(sector);
  if (state.balanceCents < def.startupCostCents) return { state, company: null };
  const company: OwnedCompany = {
    id: `${sector}-${nowMs}-${state.companies.length + 1}`,
    sector,
    level: 1,
    strategyId: def.strategies[0].id,
    investedCents: def.startupCostCents,
    openedAtMs: nowMs,
    boostUntilMs: 0,
  };
  return {
    company,
    state: {
      ...state,
      balanceCents: state.balanceCents - def.startupCostCents,
      companies: [...state.companies, company],
    },
  };
}

export function upgradeCompany(state: EmpireState, companyId: string): EmpireState {
  const target = state.companies.find((c) => c.id === companyId);
  if (!target || target.level >= 10) return state;
  const cost = companyUpgradeCostCents(target);
  if (state.balanceCents < cost) return state;
  return {
    ...state,
    balanceCents: state.balanceCents - cost,
    companies: state.companies.map((c) => c.id === companyId
      ? { ...c, level: c.level + 1, investedCents: c.investedCents + cost }
      : c),
  };
}

export function setCompanyStrategy(state: EmpireState, companyId: string, strategyId: string): EmpireState {
  return {
    ...state,
    companies: state.companies.map((c) => {
      if (c.id !== companyId) return c;
      const def = getSectorDef(c.sector);
      return def.strategies.some((s) => s.id === strategyId) ? { ...c, strategyId } : c;
    }),
  };
}

export function boostCompany(state: EmpireState, companyId: string, nowMs: number): EmpireState {
  return {
    ...state,
    companies: state.companies.map((c) => c.id === companyId
      ? { ...c, boostUntilMs: nowMs + COMPANY_BOOST_DURATION_MS }
      : c),
  };
}

export function sellCompany(state: EmpireState, companyId: string): EmpireState {
  const target = state.companies.find((c) => c.id === companyId);
  if (!target) return state;
  const refund = (target.investedCents * 75n) / 100n;
  return {
    ...state,
    balanceCents: state.balanceCents + refund,
    companies: state.companies.filter((c) => c.id !== companyId),
  };
}

export function canMergeHolding(state: EmpireState): boolean {
  if (state.holdingMerged) return false;
  const eligible = state.companies.filter((c) => c.level >= HOLDING_MERGE_MIN_LEVEL).length;
  return eligible >= HOLDING_MERGE_MIN_COMPANIES && state.balanceCents >= HOLDING_MERGE_COST_CENTS;
}

export function mergeHolding(state: EmpireState): EmpireState {
  if (!canMergeHolding(state)) return state;
  return { ...state, balanceCents: state.balanceCents - HOLDING_MERGE_COST_CENTS, holdingMerged: true };
}

export function buyStock(state: EmpireState, stockId: string, qty: number): EmpireState {
  const def = STOCKS_CATALOG.find((s) => s.id === stockId);
  if (!def || qty < 1) return state;
  const existing = state.stocks[stockId] ?? { shares: 0, avgCostCents: 0n };
  const buyQty = Math.min(qty, def.totalShares - existing.shares);
  if (buyQty < 1) return state;
  const price = quoteMarketPrice(def.basePriceCents, def.volatilityBps, def.phase, state.marketTick);
  const cost = price * BigInt(buyQty);
  if (state.balanceCents < cost) return state;
  const nextShares = existing.shares + buyQty;
  const nextAvg = (existing.avgCostCents * BigInt(existing.shares) + cost) / BigInt(nextShares);
  return {
    ...state,
    balanceCents: state.balanceCents - cost,
    stocks: { ...state.stocks, [stockId]: { shares: nextShares, avgCostCents: nextAvg } },
  };
}

export function sellStock(state: EmpireState, stockId: string, qty: number): EmpireState {
  const def = STOCKS_CATALOG.find((s) => s.id === stockId);
  const existing = state.stocks[stockId];
  if (!def || !existing || existing.shares < 1 || qty < 1) return state;
  const sellQty = Math.min(qty, existing.shares);
  const price = quoteMarketPrice(def.basePriceCents, def.volatilityBps, def.phase, state.marketTick);
  const proceeds = price * BigInt(sellQty);
  const profit = proceeds - existing.avgCostCents * BigInt(sellQty);
  const remaining = existing.shares - sellQty;
  const nextStocks = { ...state.stocks };
  if (remaining > 0) nextStocks[stockId] = { shares: remaining, avgCostCents: existing.avgCostCents };
  else delete nextStocks[stockId];
  return {
    ...state,
    balanceCents: state.balanceCents + proceeds,
    stocks: nextStocks,
    stats: { ...state.stats, tradingProfitCents: state.stats.tradingProfitCents + profit },
  };
}

export function buyRealEstate(state: EmpireState, propertyId: string): EmpireState {
  const def = REAL_ESTATE_CATALOG.find((p) => p.id === propertyId);
  if (!def || state.properties.includes(propertyId) || state.balanceCents < def.priceCents) return state;
  return {
    ...state,
    balanceCents: state.balanceCents - def.priceCents,
    properties: [...state.properties, propertyId],
  };
}

export function buyDigitalAsset(state: EmpireState, assetId: string, spendCents: bigint): EmpireState {
  const def = DIGITAL_ASSETS_CATALOG.find((a) => a.id === assetId);
  if (!def || spendCents <= 0n || state.balanceCents < spendCents) return state;
  const price = quoteMarketPrice(def.basePriceCents, def.volatilityBps, def.phase, state.marketTick);
  if (price <= 0n) return state;
  const unitsMilli = (spendCents * 1_000n) / price;
  if (unitsMilli <= 0n) return state;
  const existing = state.digitalAssets[assetId] ?? { unitsMilli: 0n, avgCostCents: 0n };
  const totalUnits = existing.unitsMilli + unitsMilli;
  const nextAvg = ((existing.avgCostCents * existing.unitsMilli) / 1_000n + spendCents) * 1_000n / totalUnits;
  return {
    ...state,
    balanceCents: state.balanceCents - spendCents,
    digitalAssets: { ...state.digitalAssets, [assetId]: { unitsMilli: totalUnits, avgCostCents: nextAvg } },
  };
}

export function sellDigitalAssetAll(state: EmpireState, assetId: string): EmpireState {
  const def = DIGITAL_ASSETS_CATALOG.find((a) => a.id === assetId);
  const existing = state.digitalAssets[assetId];
  if (!def || !existing || existing.unitsMilli <= 0n) return state;
  const price = quoteMarketPrice(def.basePriceCents, def.volatilityBps, def.phase, state.marketTick);
  const proceeds = (price * existing.unitsMilli) / 1_000n;
  const costBasis = (existing.avgCostCents * existing.unitsMilli) / 1_000n;
  const nextAssets = { ...state.digitalAssets };
  delete nextAssets[assetId];
  return {
    ...state,
    balanceCents: state.balanceCents + proceeds,
    digitalAssets: nextAssets,
    stats: { ...state.stats, tradingProfitCents: state.stats.tradingProfitCents + (proceeds - costBasis) },
  };
}

export function buyLuxuryItem(state: EmpireState, itemId: string): EmpireState {
  const def = LUXURY_ITEMS_CATALOG.find((i) => i.id === itemId);
  if (!def || state.items.includes(itemId) || state.balanceCents < def.priceCents) return state;
  return {
    ...state,
    balanceCents: state.balanceCents - def.priceCents,
    items: [...state.items, itemId],
  };
}

export function computeWealth(state: EmpireState): WealthBreakdown {
  const businessesCents = state.companies.reduce((sum, c) => sum + c.investedCents, 0n);
  let stocksCents = 0n;
  for (const def of STOCKS_CATALOG) {
    const h = state.stocks[def.id];
    if (h) stocksCents += quoteMarketPrice(def.basePriceCents, def.volatilityBps, def.phase, state.marketTick) * BigInt(h.shares);
  }
  const realEstateCents = state.properties.reduce((sum, id) => sum + (REAL_ESTATE_CATALOG.find((p) => p.id === id)?.priceCents ?? 0n), 0n);
  let digitalAssetsCents = 0n;
  for (const def of DIGITAL_ASSETS_CATALOG) {
    const h = state.digitalAssets[def.id];
    if (h) digitalAssetsCents += (quoteMarketPrice(def.basePriceCents, def.volatilityBps, def.phase, state.marketTick) * h.unitsMilli) / 1_000n;
  }
  const luxuryCents = state.items.reduce((sum, id) => sum + (LUXURY_ITEMS_CATALOG.find((i) => i.id === id)?.priceCents ?? 0n), 0n);
  const fortuneCents = state.balanceCents + businessesCents + stocksCents + realEstateCents + digitalAssetsCents + luxuryCents;
  return { fortuneCents, balanceCents: state.balanceCents, businessesCents, stocksCents, realEstateCents, digitalAssetsCents, luxuryCents };
}

export function computeForbesRank(fortuneCents: bigint): number {
  const richer = FORBES_LIST.filter((entry) => entry.fortuneCents > fortuneCents).length;
  return richer + 1;
}

export function affordableSectorsCount(state: EmpireState): number {
  if (state.companies.length >= MAX_COMPANIES) return 0;
  return BUSINESS_SECTORS.filter((s) => state.balanceCents >= s.startupCostCents).length;
}
