/** Normalizes command and configuration data before comparing retries or posting. */
import { parseMinorUnits } from '../money';
import { FinanceError, type ClosePolicy, type FinanceCommand, type LoanTerms } from './types';

function invalid(): never {
  throw new FinanceError('invalid-command');
}

function identifier(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return invalid();
  return value;
}

function integer(value: unknown, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) return invalid();
  return value;
}

function money(value: unknown, minimum = 1n): string {
  try {
    if (parseMinorUnits(value) >= minimum) return value as string;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
  }
  return invalid();
}

export function dueAfter(day: number, delay: number): number {
  return integer(day + delay);
}

export function normalizePolicy(input: ClosePolicy): ClosePolicy {
  if (!input || typeof input !== 'object') return invalid();

  return Object.freeze({
    monthlyUtilitiesMinor: money(input.monthlyUtilitiesMinor, 0n),
    monthlyDepreciationMinor: money(input.monthlyDepreciationMinor, 0n),
    incomeTaxBps: integer(input.incomeTaxBps, 0, 10_000),
    utilitiesDueAfterCloseDays: integer(input.utilitiesDueAfterCloseDays),
    taxDueAfterCloseDays: integer(input.taxDueAfterCloseDays),
  });
}

function loanTerms(input: LoanTerms, day: number): LoanTerms {
  if (!Array.isArray(input.installments) || input.installments.length === 0) return invalid();

  const principalMinor = money(input.principalMinor);
  let total = 0n;
  let previousDueDay = day;
  const installments = Array.from(input.installments, (item) => {
    if (!item) return invalid();
    const { dueDay, amountMinor } = {
      dueDay: integer(item.dueDay, previousDueDay + 1),
      amountMinor: money(item.amountMinor),
    };
    previousDueDay = dueDay;
    total += BigInt(amountMinor);
    return Object.freeze({ dueDay, amountMinor });
  });
  if (total !== BigInt(principalMinor)) return invalid();

  return {
    loanId: identifier(input.loanId),
    principalMinor,
    monthlyInterestBps: integer(input.monthlyInterestBps, 0, 10_000),
    interestDueAfterCloseDays: integer(input.interestDueAfterCloseDays),
    installments: Object.freeze(installments),
  };
}

export function normalizeCommand(input: FinanceCommand): FinanceCommand {
  if (!input || typeof input !== 'object') return invalid();

  const common = { id: identifier(input.id), day: integer(input.day) };
  switch (input.type) {
    case 'disburse-loan':
      return Object.freeze({ ...common, type: input.type, ...loanTerms(input, common.day) });
    case 'accrue-obligation':
      if (input.kind !== 'rent' && input.kind !== 'utilities') return invalid();
      return Object.freeze({
        ...common, type: input.type, kind: input.kind, obligationId: identifier(input.obligationId),
        dueDay: integer(input.dueDay, common.day), amountMinor: money(input.amountMinor),
      });
    case 'pay-obligation':
      return Object.freeze({ ...common, type: input.type, obligationId: identifier(input.obligationId) });
    case 'close-month':
      return Object.freeze({ ...common, type: input.type });
    default:
      return invalid();
  }
}
