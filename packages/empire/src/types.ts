/** Core headless types for the unified Empire Tycoon investor portfolio in exact USD cents. */
export type SectorId = 'food' | 'manufacturing' | 'logistics' | 'property' | 'ai';

export type ItemCategory = 'cars' | 'aircraft' | 'yachts' | 'collections' | 'residence';

export interface Bilingual {
  readonly ar: string;
  readonly en: string;
}

export interface TapTier {
  readonly level: number;
  readonly perTapCents: bigint;
  readonly upgradeCostCents: bigint | null;
}

export interface SectorStrategy {
  readonly id: string;
  readonly title: Bilingual;
  readonly summary: Bilingual;
  readonly incomeBps: number;
}

export interface BusinessSectorDef {
  readonly id: SectorId;
  readonly name: Bilingual;
  readonly companyName: Bilingual;
  readonly tagline: Bilingual;
  readonly art: string;
  readonly startupCostCents: bigint;
  readonly baseHourlyCents: bigint;
  readonly upgradeBaseCents: bigint;
  readonly strategies: readonly SectorStrategy[];
  readonly deepSimulationHref?: string;
}

export interface StockDef {
  readonly id: string;
  readonly ticker: string;
  readonly name: Bilingual;
  readonly sector: Bilingual;
  readonly basePriceCents: bigint;
  readonly dividendBpsPerHour: number;
  readonly totalShares: number;
  readonly volatilityBps: number;
  readonly phase: number;
}

export interface RealEstateDef {
  readonly id: string;
  readonly name: Bilingual;
  readonly location: Bilingual;
  readonly priceCents: bigint;
  readonly hourlyRentCents: bigint;
  readonly art: string;
}

export interface DigitalAssetDef {
  readonly id: string;
  readonly symbol: string;
  readonly name: Bilingual;
  readonly basePriceCents: bigint;
  readonly volatilityBps: number;
  readonly phase: number;
  readonly marketCapBillions: number;
}

export interface LuxuryItemDef {
  readonly id: string;
  readonly category: ItemCategory;
  readonly name: Bilingual;
  readonly detail: Bilingual;
  readonly priceCents: bigint;
}

export interface ForbesEntry {
  readonly id: string;
  readonly name: Bilingual;
  readonly industry: Bilingual;
  readonly fortuneCents: bigint;
}

export interface OwnedCompany {
  readonly id: string;
  readonly sector: SectorId;
  readonly level: number;
  readonly strategyId: string;
  readonly investedCents: bigint;
  readonly openedAtMs: number;
  readonly boostUntilMs: number;
}

export interface StockHolding {
  readonly shares: number;
  readonly avgCostCents: bigint;
}

export interface AssetHolding {
  readonly unitsMilli: bigint;
  readonly avgCostCents: bigint;
}

export interface EmpireStats {
  readonly tapEarnedCents: bigint;
  readonly businessEarnedCents: bigint;
  readonly dividendsEarnedCents: bigint;
  readonly rentEarnedCents: bigint;
  readonly tradingProfitCents: bigint;
  readonly totalTaps: number;
}

export interface EmpireState {
  readonly version: 1;
  readonly cardLast4: string;
  readonly balanceCents: bigint;
  readonly tapLevel: number;
  readonly tapBoostUntilMs: number;
  readonly tapBoostCooldownUntilMs: number;
  readonly companies: readonly OwnedCompany[];
  readonly holdingMerged: boolean;
  readonly stocks: Readonly<Record<string, StockHolding>>;
  readonly properties: readonly string[];
  readonly digitalAssets: Readonly<Record<string, AssetHolding>>;
  readonly items: readonly string[];
  readonly marketTick: number;
  readonly stats: EmpireStats;
  readonly lastTickMs: number;
}

export interface WealthBreakdown {
  readonly fortuneCents: bigint;
  readonly balanceCents: bigint;
  readonly businessesCents: bigint;
  readonly stocksCents: bigint;
  readonly realEstateCents: bigint;
  readonly digitalAssetsCents: bigint;
  readonly luxuryCents: bigint;
}
