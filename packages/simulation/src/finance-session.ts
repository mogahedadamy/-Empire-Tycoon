/** Connects finance closing to the clock's monthly phase using a per-advance draft. */
import { applyFinanceCommand, FinanceError, type FinanceResult } from '../../finance/src';
import { createSimulationSession, type SessionOptions, type StagedAdvance } from './session';

export interface FinancialSimulationOptions extends Omit<SessionOptions, 'prepareAdvance'> {
  readonly finance: FinanceResult;
}

/**
 * Starts a day-one clock that runs the finance closing rule after each 30-day month.
 * Finance and clock changes publish together after the entire advance succeeds.
 */
export function createFinancialSimulation(options: FinancialSimulationOptions) {
  const { finance, ...clockOptions } = options;
  if (finance.state.companyId !== finance.ledger.companyId || finance.state.currency !== finance.ledger.currency) {
    throw new FinanceError('scope-mismatch');
  }
  if (finance.state.closes.length) throw new FinanceError('already-closed');

  let current: FinanceResult = Object.freeze({ ...finance });

  function prepareAdvance(): StagedAdvance {
    let draft = current;
    return {
      schedule({ day, phase }) {
        if (phase !== 'month-end') return [];

        return [{
          id: 'finance-month-end',
          virtualTime: Number.MAX_SAFE_INTEGER,
          sequence: Number.MAX_SAFE_INTEGER,
          run() {
            draft = applyFinanceCommand(draft.state, draft.ledger, {
              id: `finance-month-end:${day}`, day, type: 'close-month',
            });
          },
        }];
      },
      commit() {
        current = draft;
      },
    };
  }

  const session = createSimulationSession({ ...clockOptions, prepareAdvance });
  return { ...session, financeSnapshot: () => current };
}
