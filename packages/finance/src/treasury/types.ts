/** Finance terms, dated obligations and immutable close records. */
import type { Ledger } from '../ledger';

export interface ClosePolicy {
  readonly monthlyUtilitiesMinor: string;
  readonly monthlyDepreciationMinor: string;
  readonly incomeTaxBps: number;
  readonly utilitiesDueAfterCloseDays: number;
  readonly taxDueAfterCloseDays: number;
}

export interface PrincipalInstallment {
  readonly dueDay: number;
  readonly amountMinor: string;
}

export interface LoanTerms {
  readonly loanId: string;
  readonly principalMinor: string;
  readonly monthlyInterestBps: number;
  readonly interestDueAfterCloseDays: number;
  readonly installments: readonly PrincipalInstallment[];
}

export interface Loan extends LoanTerms {
  readonly disbursedDay: number;
  readonly journalEntryId: string;
}

export type OperatingObligation = 'rent' | 'utilities';
export type ObligationKind = OperatingObligation | 'interest' | 'principal' | 'tax';

export interface Obligation {
  readonly id: string;
  readonly kind: ObligationKind;
  readonly amountMinor: string;
  readonly recognizedDay: number;
  readonly dueDay: number;
  readonly accrualEntryId: string;
  readonly loanId?: string;
  readonly payment: { readonly day: number; readonly journalEntryId: string } | null;
}

export interface MonthlyClose {
  readonly fromDay: number;
  readonly throughDay: number;
  readonly utilitiesMinor: string;
  readonly depreciationMinor: string;
  readonly interestMinor: string;
  readonly taxMinor: string;
  readonly journalEntryIds: readonly string[];
}

export type FinanceCommand = { readonly id: string; readonly day: number } & (
  | ({ readonly type: 'disburse-loan' } & LoanTerms)
  | {
      readonly type: 'accrue-obligation';
      readonly obligationId: string;
      readonly kind: OperatingObligation;
      readonly dueDay: number;
      readonly amountMinor: string;
    }
  | { readonly type: 'pay-obligation'; readonly obligationId: string }
  | { readonly type: 'close-month' }
);

export interface FinanceState {
  readonly companyId: string;
  readonly currency: string;
  readonly day: number;
  readonly closePolicy: ClosePolicy;
  readonly loans: readonly Loan[];
  readonly obligations: readonly Obligation[];
  readonly closes: readonly MonthlyClose[];
  readonly commands: readonly FinanceCommand[];
}

export interface FinanceResult {
  readonly state: FinanceState;
  readonly ledger: Ledger;
}

export type FinanceErrorCode =
  | 'invalid-command' | 'scope-mismatch' | 'conflict' | 'past-day' | 'journal-conflict'
  | 'period-closed' | 'invalid-close-day' | 'already-closed'
  | 'unknown-obligation' | 'already-paid' | 'not-due' | 'payment-order' | 'insufficient-cash';

export class FinanceError extends Error {
  constructor(readonly code: FinanceErrorCode, readonly shortfallMinor?: string) {
    super(code);
    this.name = 'FinanceError';
  }
}
