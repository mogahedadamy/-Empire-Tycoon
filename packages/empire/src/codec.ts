/** Lossless JSON codec for EmpireState bigints with safe fallback on corrupt payloads. */
import { createInitialEmpire } from './engine';
import type { AssetHolding, EmpireState, OwnedCompany, StockHolding } from './types';

function toBigInt(value: unknown, fallback = 0n): bigint {
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  return fallback;
}

export function serializeEmpire(state: EmpireState): string {
  const payload = {
    version: state.version,
    cardLast4: state.cardLast4,
    balanceCents: state.balanceCents.toString(),
    tapLevel: state.tapLevel,
    tapBoostUntilMs: state.tapBoostUntilMs,
    tapBoostCooldownUntilMs: state.tapBoostCooldownUntilMs,
    holdingMerged: state.holdingMerged,
    marketTick: state.marketTick,
    lastTickMs: state.lastTickMs,
    properties: [...state.properties],
    items: [...state.items],
    companies: state.companies.map((c) => ({
      ...c,
      investedCents: c.investedCents.toString(),
    })),
    stocks: Object.fromEntries(
      Object.entries(state.stocks).map(([k, v]) => [k, { shares: v.shares, avgCostCents: v.avgCostCents.toString() }]),
    ),
    digitalAssets: Object.fromEntries(
      Object.entries(state.digitalAssets).map(([k, v]) => [k, { unitsMilli: v.unitsMilli.toString(), avgCostCents: v.avgCostCents.toString() }]),
    ),
    stats: {
      tapEarnedCents: state.stats.tapEarnedCents.toString(),
      businessEarnedCents: state.stats.businessEarnedCents.toString(),
      dividendsEarnedCents: state.stats.dividendsEarnedCents.toString(),
      rentEarnedCents: state.stats.rentEarnedCents.toString(),
      tradingProfitCents: state.stats.tradingProfitCents.toString(),
      totalTaps: state.stats.totalTaps,
    },
  };
  return JSON.stringify(payload);
}

export function deserializeEmpire(raw: string, fallbackNowMs: number): EmpireState {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || data.version !== 1) return createInitialEmpire(fallbackNowMs);
    const companies: OwnedCompany[] = Array.isArray(data.companies)
      ? data.companies.map((c: Record<string, unknown>) => ({
        id: String(c.id ?? ''),
        sector: c.sector as OwnedCompany['sector'],
        level: Math.max(1, Number(c.level ?? 1)),
        strategyId: String(c.strategyId ?? ''),
        investedCents: toBigInt(c.investedCents),
        openedAtMs: Number(c.openedAtMs ?? fallbackNowMs),
        boostUntilMs: Number(c.boostUntilMs ?? 0),
      })).filter((c) => c.id.length > 0)
      : [];
    const stocks: Record<string, StockHolding> = {};
    if (data.stocks && typeof data.stocks === 'object') {
      for (const [k, v] of Object.entries(data.stocks as Record<string, Record<string, unknown>>)) {
        const shares = Math.max(0, Number(v?.shares ?? 0));
        if (shares > 0) stocks[k] = { shares, avgCostCents: toBigInt(v?.avgCostCents) };
      }
    }
    const digitalAssets: Record<string, AssetHolding> = {};
    if (data.digitalAssets && typeof data.digitalAssets === 'object') {
      for (const [k, v] of Object.entries(data.digitalAssets as Record<string, Record<string, unknown>>)) {
        const unitsMilli = toBigInt(v?.unitsMilli);
        if (unitsMilli > 0n) digitalAssets[k] = { unitsMilli, avgCostCents: toBigInt(v?.avgCostCents) };
      }
    }
    const st = (data.stats ?? {}) as Record<string, unknown>;
    return {
      version: 1,
      cardLast4: typeof data.cardLast4 === 'string' ? data.cardLast4 : '7439',
      balanceCents: toBigInt(data.balanceCents),
      tapLevel: Math.max(1, Number(data.tapLevel ?? 1)),
      tapBoostUntilMs: Number(data.tapBoostUntilMs ?? 0),
      tapBoostCooldownUntilMs: Number(data.tapBoostCooldownUntilMs ?? 0),
      companies,
      holdingMerged: Boolean(data.holdingMerged),
      stocks,
      properties: Array.isArray(data.properties) ? data.properties.map(String) : [],
      digitalAssets,
      items: Array.isArray(data.items) ? data.items.map(String) : [],
      marketTick: Math.max(0, Number(data.marketTick ?? 0)),
      lastTickMs: Number(data.lastTickMs ?? fallbackNowMs),
      stats: {
        tapEarnedCents: toBigInt(st.tapEarnedCents),
        businessEarnedCents: toBigInt(st.businessEarnedCents),
        dividendsEarnedCents: toBigInt(st.dividendsEarnedCents),
        rentEarnedCents: toBigInt(st.rentEarnedCents),
        tradingProfitCents: toBigInt(st.tradingProfitCents),
        totalTaps: Math.max(0, Number(st.totalTaps ?? 0)),
      },
    };
  } catch {
    return createInitialEmpire(fallbackNowMs);
  }
}
