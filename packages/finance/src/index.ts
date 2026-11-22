/** Public API for exact money arithmetic, journal posting and financial statements. */
export { chartOfAccounts } from './accounts';
export type { AccountGroup, AccountId } from './accounts';
export { directCashFlow } from './cash-flow';
export type { CashFlowCategory, JournalEntry, JournalEntryInput, JournalLine, ReversalInput, Side } from './journal';
export { Ledger } from './ledger';
export type { LedgerScope } from './ledger';
export { applyBasisPoints, parseMinorUnits } from './money';
export { balanceSheet, incomeStatement } from './statements';
export type { ReportingPeriod } from './statements';

export { applyFinanceCommand, createFinanceState } from './treasury/state';
export { FinanceError } from './treasury/types';
export type {
  ClosePolicy, FinanceCommand, FinanceErrorCode, FinanceResult, FinanceState, Loan, LoanTerms,
  MonthlyClose, Obligation, ObligationKind, OperatingObligation, PrincipalInstallment,
} from './treasury/types';

export { forecastLiquidity } from './liquidity/forecast';
export { liquidityHorizonDays } from './liquidity/projection';
export { reviewDistress } from './liquidity/distress';
export type { DistressAction, DistressCase, DistressCause, DistressStage } from './liquidity/distress';
export type {
  ApprovedCredit, LiquidityAlert, LiquidityGap, LiquidityInput, LiquidityPolicy, LiquidityProjection,
  LiquiditySource, ProjectedMovement, ScheduledCashFlow,
} from './liquidity/types';
