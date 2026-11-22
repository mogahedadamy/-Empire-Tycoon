/** Shared serializable commands, read models, and preview types for the Big Order journey. */
import type { AdvanceProgress, DecisionAlert } from '../../../../packages/contracts/src';
import type {
  DistressCase, FinanceState, JournalEntry, LiquidityAlert, LiquidityProjection,
  Obligation, balanceSheet, directCashFlow, forecastLiquidity, incomeStatement,
} from '../../../../packages/finance/src';
import type { Invoice, PayrollRecord, PurchaseOrder, SalesOffer } from '../../../../packages/operations/src';

export type FundingPlan = 'loan' | 'capital';
export type RestockChoice = 'pending' | 'ordered' | 'deferred';

export type JourneyAction =
  | { readonly type: 'found-company'; readonly fundingPlan: FundingPlan }
  | { readonly type: 'accept-contract'; readonly offerId: string }
  | { readonly type: 'order-supply' }
  | { readonly type: 'deliver'; readonly offerId: string; readonly quantity: number }
  | { readonly type: 'advance'; readonly days: number }
  | { readonly type: 'advance-through'; readonly day: number }
  | { readonly type: 'approve-restock' }
  | { readonly type: 'defer-restock' }
  | { readonly type: 'collect-early' }
  | { readonly type: 'draw-rescue-loan' }
  | { readonly type: 'pay-obligation'; readonly obligationId: string }
  | { readonly type: 'collect-due'; readonly invoiceId?: string }
  | { readonly type: 'end-company' }
  | { readonly type: 'resolve-alert'; readonly alertId: string };

export interface JourneyCommandRecord {
  readonly commandId: string;
  readonly expectedRevision: number;
  readonly action: JourneyAction;
}

export type JourneyErrorCode =
  | 'stale-revision' | 'conflict' | 'not-founded' | 'already-founded' | 'company-ended'
  | 'decision-required' | 'invalid-target' | 'insufficient-cash' | 'restock-not-ready'
  | 'restock-already-decided' | 'no-early-invoices' | 'rescue-loan-taken' | 'no-due-invoices'
  | 'not-defaulted' | 'alert-not-pending' | 'order-already-placed' | 'offer-expired'
  | 'already-accepted' | 'contract-not-open' | 'outside-delivery-window' | 'exceeds-contract'
  | 'capacity-exceeded' | 'insufficient-stock' | 'unknown-obligation' | 'already-paid'
  | 'not-due' | 'payment-order' | 'invalid-command';

export type JourneyOutcome =
  | {
      readonly status: 'accepted';
      readonly commandId: string;
      readonly revision: number;
      readonly invoiceId?: string;
      readonly progress?: AdvanceProgress | null;
    }
  | {
      readonly status: 'rejected';
      readonly commandId: string;
      readonly revision: number;
      readonly code: JourneyErrorCode;
      readonly shortfallMinor?: string;
    };

export type JourneyPreviewRequest = { readonly type: 'delivery'; readonly quantity: number };

export interface JourneyDeliveryPreview {
  readonly day: number;
  readonly revision: number;
  readonly quantity: number;
  readonly max: number;
  readonly remaining: number;
  readonly priceMinor: string;
  readonly amountMinor: string;
  readonly valid: boolean;
}

export interface DecisionImpact {
  readonly id: string;
  readonly day: number;
  readonly kind: 'funding' | 'restock' | 'defer-restock' | 'early-collection' | 'rescue-loan' | 'end-company';
  readonly costMinor: string;
  readonly liquidityProtectionMinor: string;
  readonly debtAddedMinor: string;
}

export type GuidanceStepId =
  | 'found' | 'sign-contract' | 'order-supply' | 'advance-delivery' | 'deliver'
  | 'advance-close' | 'review-close' | 'resolve-shortfall' | 'review-overdue'
  | 'advance-end' | 'completed' | 'ended';

export interface JourneyMilestone {
  readonly targetDay: number;
  readonly days: number;
  readonly reason: 'supply-arrival' | 'delivery-window' | 'monthly-close' | 'rent-due' | 'overdue-review' | 'scenario-end';
}

export interface JourneyInventoryRead {
  readonly quantity: string;
  readonly reserved: string;
  readonly available: string;
  readonly valueMinor: string;
}

export interface JourneyCapacityRead {
  readonly available: string;
  readonly used: string;
  readonly limits: {
    readonly labor: string;
    readonly equipment: string;
    readonly shipping: string;
    readonly materials: string;
  };
  readonly limitingFactors: readonly string[];
}

export interface JourneyEvaluation {
  readonly status: 'in-progress' | 'succeeded' | 'failed-objectives' | 'ended-default';
  readonly deliveredOnTime: boolean;
  readonly payrollPaidOnTime: boolean;
  readonly cashNonNegative: boolean;
  readonly solvent: boolean;
}

export interface JourneyObligationRead extends Obligation {
  readonly status: 'open' | 'overdue' | 'paid';
}

export interface JourneyReadModel {
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly day: number;
  readonly lastClosedDay: number;
  readonly endDay: number;
  readonly revision: number;
  readonly founded: boolean;
  readonly fundingPlan: FundingPlan | null;
  readonly supplyOrdered: boolean;
  readonly restockChoice: RestockChoice;
  readonly rescueLoanTaken: boolean;
  readonly canAdvance: boolean;
  readonly offer: (SalesOffer & { readonly status: string }) | null;
  readonly invoices: readonly (Invoice & { readonly status: 'open' | 'overdue' | 'paid' })[];
  readonly orders: readonly PurchaseOrder[];
  readonly inventory: JourneyInventoryRead;
  readonly capacity: JourneyCapacityRead;
  readonly payroll: {
    readonly dueDay: number;
    readonly amountMinor: string;
    readonly record: PayrollRecord | null;
    readonly status: 'scheduled' | 'accrued' | 'paid' | 'overdue';
  };
  readonly obligations: readonly JourneyObligationRead[];
  readonly balance: ReturnType<typeof balanceSheet>;
  readonly income: ReturnType<typeof incomeStatement>;
  readonly monthOneBalance: ReturnType<typeof balanceSheet> | null;
  readonly monthOneIncome: ReturnType<typeof incomeStatement> | null;
  readonly monthTwoIncome: ReturnType<typeof incomeStatement> | null;
  readonly cashFlow: ReturnType<typeof directCashFlow>;
  readonly liquidity: ReturnType<typeof forecastLiquidity>;
  readonly distress: DistressCase;
  readonly journal: readonly JournalEntry[];
  readonly cashEntries: readonly JournalEntry[];
  readonly pendingAlerts: readonly DecisionAlert[];
  readonly decisions: readonly DecisionImpact[];
  readonly guidanceStep: GuidanceStepId;
  readonly milestone: JourneyMilestone | null;
  readonly evaluation: JourneyEvaluation;
  readonly restockTerms: {
    readonly quantity: number;
    readonly unitCostMinor: string;
    readonly totalCostMinor: string;
    readonly rentAmountMinor: string;
    readonly rentDueDay: number;
  };
  readonly rescueLoanTerms: {
    readonly principalMinor: string;
    readonly monthlyInterestBps: number;
    readonly dueDay: number;
  };
  readonly earlyCollectionSummary: {
    readonly available: boolean;
    readonly grossMinor: string;
    readonly discountMinor: string;
    readonly cashMinor: string;
  };
  readonly customerDelayDays: number;
}

export interface JourneyWorkerInit {
  readonly scenarioId: string;
  readonly saved?: {
    readonly checkpoint: {
      readonly revision: number;
      readonly day: number;
      readonly randomState: number;
      readonly state: string;
    };
    readonly commands: readonly JourneyCommandRecord[];
  };
}

export type JourneyLiquidityProjection = LiquidityProjection;
export type JourneyLiquidityAlert = LiquidityAlert;
export type JourneyTreasuryState = FinanceState;
