/** Read-only finance inputs and serializable 30-day liquidity projections. */
export type LiquiditySource = 'invoice' | 'payroll' | 'rent' | 'utilities' | 'principal' | 'interest' | 'tax' | 'purchase';

export interface ScheduledCashFlow {
  readonly id: string;
  readonly source: LiquiditySource;
  readonly partyId: string;
  readonly dueDay: number;
  readonly amountMinor: string;
  readonly journalEntryId?: string;
  readonly earlyPaymentDiscountBps?: number;
  /** False marks a planned payment with no current payable or accepted purchase. */
  readonly committed?: boolean;
}

export interface ApprovedCredit {
  readonly facilityId: string;
  readonly partyId: string;
  readonly availableMinor: string;
  readonly availableDay: number;
}

export interface LiquidityPolicy {
  readonly pessimisticDelayDays: number;
  readonly optimisticEarlyDays: number;
  readonly defaultGraceDays: number;
}

export interface LiquidityInput {
  readonly companyId: string;
  readonly currency: string;
  readonly day: number;
  readonly cashMinor: string;
  readonly flows: readonly ScheduledCashFlow[];
  readonly policy: LiquidityPolicy;
  readonly credit?: ApprovedCredit;
}

export interface ProjectedMovement {
  readonly id: string;
  readonly source: LiquiditySource | 'credit';
  readonly partyId: string;
  readonly dueDay: number;
  readonly projectedDay: number;
  readonly amountMinor: string;
  readonly direction: 'in' | 'out';
  readonly discountMinor: string;
  readonly journalEntryId?: string;
}

export interface LiquidityGap {
  readonly day: number;
  readonly amountMinor: string;
  readonly partyId: string;
  readonly sourceId: string;
  readonly reason: LiquiditySource | 'opening-cash';
  readonly dueDay: number;
}

export interface LiquidityProjection {
  readonly days: readonly { readonly day: number; readonly cashMinor: string }[];
  readonly movements: readonly ProjectedMovement[];
  readonly firstShortfall: LiquidityGap | null;
  readonly minimumCashMinor: string;
}

export interface LiquidityAlert {
  readonly code: 'invoice-overdue' | 'payroll-before-collection' | 'projected-shortfall';
  readonly id: string;
  readonly partyId: string;
  readonly source: LiquiditySource | 'opening-cash';
  readonly dueDay: number;
  readonly amountMinor: string;
  readonly relatedId?: string;
}
