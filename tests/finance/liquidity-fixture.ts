/** Composes real sales, payroll and treasury records for the reference pressure scenario. */
import { applyFinanceCommand, createFinanceState, type FinanceResult } from '../../packages/finance/src';
import { readLiquidityInput } from '../../packages/simulation/src';
import { addShift, deliver, signedSale, submit } from '../operations/sales-fixture';
import { accrue, pay } from '../operations/workforce-fixture';
import { transaction } from './fixture';
import { close, loan, policy, scenario } from './treasury-fixture';

export const forecastPolicy = { pessimisticDelayDays: 5, optimisticEarlyDays: 7, defaultGraceDays: 3 };
export const rentId = 'pressure-rent';

export function liquidityScenario(pressure = false) {
  const session = signedSale();
  addShift(session, 'additional', deliver.day);
  submit(session, { domain: 'sales', command: { ...deliver, quantity: 70 } });
  if (pressure) {
    submit(session, { domain: 'workforce', command: accrue });
    submit(session, { domain: 'workforce', command: pay });
  }

  const sales = session.snapshot();
  const deposit = scenario.opening.rentalDepositMinor;
  const equipment = scenario.opening.equipmentMinor;
  const installed = sales.ledger.post([
    transaction('deposit', 1,
      { account: 'rentalDeposits', side: 'debit', amount: deposit },
      { account: 'cash', side: 'credit', amount: deposit, cashFlow: 'operating' }),
    transaction('equipment', 1,
      { account: 'equipment', side: 'debit', amount: equipment },
      { account: 'cash', side: 'credit', amount: equipment, cashFlow: 'investing' }),
  ]);

  let finance = applyFinanceCommand(createFinanceState(installed, {
    ...policy, utilitiesDueAfterCloseDays: 4,
  }), installed, { ...loan, interestDueAfterCloseDays: 4 });

  if (pressure) {
    finance = applyFinanceCommand(finance.state, finance.ledger, close);
    const purchased = finance.ledger.post([transaction('pressure-purchase', 31,
      { account: 'inventory', side: 'debit', amount: '2500000' },
      { account: 'cash', side: 'credit', amount: '2500000', cashFlow: 'operating' })]);
    finance = applyFinanceCommand(finance.state, purchased, {
      id: 'rent', day: 31, type: 'accrue-obligation', kind: 'rent', obligationId: rentId,
      dueDay: 32, amountMinor: '220000',
    });
  }

  return {
    finance, sales,
    read(day: number, actual: FinanceResult = finance) {
      return readLiquidityInput({
        sales, day, policy: forecastPolicy, ledger: actual.ledger, treasury: actual.state,
      });
    },
  };
}
