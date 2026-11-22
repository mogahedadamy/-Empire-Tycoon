/** Serializable inputs and decisions for a daily market in one product and region. */
export interface MarketBuyer {
  readonly id: string;
  readonly baseDemandUnits: number;
  readonly maxDemandUnits: number;
  readonly minQualityBps: number;
  readonly maxLeadDays: number;
  readonly maxUnitPriceMinor: string;
}

export interface MarketShock {
  readonly id: string;
  readonly chanceBps: number;
  readonly demandBps: number;
  readonly supplyBps: number;
  readonly priceBps: number;
}

export interface MarketRules {
  readonly id: string;
  readonly productId: string;
  readonly regionId: string;
  readonly currency: string;
  readonly referencePriceMinor: string;
  readonly maxDemandUnits: number;
  readonly priceElasticityBps: number;
  readonly reliabilityObservationBps: number;
  readonly weights: {
    readonly priceBps: number;
    readonly qualityBps: number;
    readonly reliabilityBps: number;
    readonly availabilityBps: number;
  };
  readonly buyers: readonly MarketBuyer[];
  readonly shocks: readonly MarketShock[];
}

export interface MarketOffer {
  readonly id: string;
  readonly companyId: string;
  readonly unitPriceMinor: string;
  readonly stockUnits: number;
  readonly capacityUnits: number;
  readonly leadDays: number;
  readonly qualityBps: number;
  readonly reliabilityBps: number;
}

export interface MarketConditions {
  readonly shockId: string | null;
  readonly referencePriceMinor: string;
  readonly demandUnits: number;
  readonly supplyBps: number;
  readonly buyerDemand: readonly { readonly buyerId: string; readonly units: number }[];
}

export interface MarketScore {
  readonly priceBps: number;
  readonly qualityBps: number;
  readonly reliabilityBps: number;
  readonly availabilityBps: number;
  /** Weighted sum before division, so rounding never changes ranking. */
  readonly total: number;
}

export type MarketDecisionReason =
  | 'quality-below-minimum' | 'outside-delivery-window' | 'price-above-budget' | 'no-supply'
  | 'no-buyer-demand' | 'market-cap-reached' | 'higher-ranked-offer-filled-demand'
  | 'available-supply-limited-award' | 'awarded';

export interface MarketDecision {
  readonly buyerId: string;
  readonly offerId: string;
  readonly companyId: string;
  readonly unitPriceMinor: string;
  readonly availableUnits: number;
  readonly demandRemainingBefore: number;
  readonly awardedUnits: number;
  readonly score: MarketScore | null;
  readonly reason: MarketDecisionReason;
}

export interface MarketDayInput {
  readonly day: number;
  /** One unsigned 32-bit draw from the host's persisted deterministic stream. */
  readonly randomUint32: number;
  /** One active offer per company for this product, region, and day. */
  readonly offers: readonly MarketOffer[];
}

export interface MarketDay {
  readonly marketId: string;
  readonly day: number;
  readonly currency: string;
  readonly conditions: MarketConditions;
  readonly allocatedUnits: number;
  readonly unmetUnits: number;
  readonly averageAwardPriceMinor: string | null;
  readonly decisions: readonly MarketDecision[];
}
