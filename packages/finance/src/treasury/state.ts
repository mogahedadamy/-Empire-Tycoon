/** Applies finance commands without publishing partial changes to the company ledger. */
import type { Ledger } from '../ledger';
import { closeMonth } from './close';
import { disburse } from './loans';
import { accrueExpense, payExpense } from './obligations';
import { FinanceError, type ClosePolicy, type FinanceCommand, type FinanceResult, type FinanceState } from './types';
import { normalizeCommand, normalizePolicy } from './validation';

/** Starts treasury records for a company, using its current ledger and fixed monthly terms. */
export function createFinanceState(ledger: Ledger, closePolicy: ClosePolicy): FinanceState {
  return Object.freeze({
    companyId: ledger.companyId, currency: ledger.currency, day: 0,
    closePolicy: normalizePolicy(closePolicy),
    loans: Object.freeze([]), obligations: Object.freeze([]),
    closes: Object.freeze([]), commands: Object.freeze([]),
  });
}

function stage(state: FinanceState, ledger: Ledger, command: FinanceCommand) {
  switch (command.type) {
    case 'disburse-loan':
      return disburse(ledger, state, command);
    case 'accrue-obligation':
      return accrueExpense(ledger, state, command);
    case 'pay-obligation':
      return payExpense(ledger, state, command);
    case 'close-month':
      return closeMonth(ledger, state, command.day);
  }
}

/**
 * Applies a finance command against the current company ledger. Commit the returned pair together.
 * Exact retries preserve the current pair. A rejected command publishes no changes.
 */
export function applyFinanceCommand(state: FinanceState, ledger: Ledger, input: FinanceCommand): FinanceResult {
  if (state.companyId !== ledger.companyId || state.currency !== ledger.currency) {
    throw new FinanceError('scope-mismatch');
  }

  const command = normalizeCommand(input);
  const matching = state.commands.find(({ id }) => id === command.id);
  if (matching) {
    if (JSON.stringify(command) !== JSON.stringify(matching)) throw new FinanceError('conflict');
    return Object.freeze({ state, ledger });
  }

  const closedDay = state.closes.at(-1)?.throughDay ?? 0;
  if (command.day <= closedDay) {
    throw new FinanceError(command.type === 'close-month' ? 'already-closed' : 'period-closed');
  }
  if (command.day < state.day) throw new FinanceError('past-day');

  const { ledger: nextLedger, ...changes } = stage(state, ledger, command);
  return Object.freeze({
    state: Object.freeze({
      ...state, ...changes, day: command.day, commands: Object.freeze([...state.commands, command]),
    }),
    ledger: nextLedger,
  });
}
