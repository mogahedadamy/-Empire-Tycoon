/** Runs one financial policy through the actual market, session clock, and double-entry ledger. */
import { loadMarketScenario, loadScenario, type Difficulty } from '../../packages/content/src';
import { simulationProtocolVersion } from '../../packages/contracts/src';
import { applyBasisPoints, balanceSheet, incomeStatement, Ledger, type AccountId, type CashFlowCategory, type JournalLine } from '../../packages/finance/src';
import { clearMarketDay, type MarketOffer } from '../../packages/market/src';
import { createSimulationSession } from '../../packages/simulation/src';
import { horizon, type Policy, type Stress } from './fixture';

const market = loadMarketScenario('wadi-produce-market').market;
const rival: MarketOffer = {
  id: 'coast-offer', companyId: 'coastal-produce', unitPriceMinor: '8100', stockUnits: 66,
  capacityUnits: 55, leadDays: 1, qualityBps: 8400, reliabilityBps: 8400,
};
const sessionId = 'solo-balance';
const companyId = 'player';
const unitCost = 4_200n;

function post(ledger: Ledger, day: number, sourceId: string, debit: AccountId, credit: AccountId,
  total: bigint, cashFlow: CashFlowCategory = 'operating') {
  if (total === 0n) return ledger;
  const amount = total.toString();
  function line(account: AccountId, side: JournalLine['side']): JournalLine {
    return account === 'cash' ? { account, side, amount, cashFlow } : { account, side, amount };
  }
  return ledger.post([{ id: `${day}:${sourceId}`, day, sourceId, lines: [line(debit, 'debit'), line(credit, 'credit')] }]);
}

function marketUnderStress(stress: Stress) {
  if (stress !== 'demand-slump') return market;
  return { ...market, buyers: market.buyers.map((buyer) => ({ ...buyer, baseDemandUnits: Math.floor(buyer.baseDemandUnits / 2) })) };
}

interface Invoice {
  readonly dueDay: number | null;
  readonly amount: bigint;
}

/** Uses fixed inputs and exactly one seeded market draw per closed day. */
export function runBalanceTrial(difficulty: Difficulty, stress: Stress, policy: Policy, seed: number) {
  const scenario = loadScenario(`campaign-harbor-supply-${difficulty}`);
  const capital = BigInt(scenario.opening.capitalMinor) / 7n;
  const expansion = stress === 'financed-expansion' && policy.loan > 0n;
  const loan = policy.loan + (expansion ? 420_000n : 0n);
  const capacity = policy.capacity + (expansion ? 15 : 0);
  const target = policy.stock + (expansion ? 20 : 0);
  let ledger = Ledger.open({ companyId, currency: market.currency });
  ledger = post(ledger, 1, 'capital', 'cash', 'contributedCapital', capital, 'financing');
  ledger = post(ledger, 1, 'loan', 'cash', 'loanPrincipal', loan, 'financing');
  if (expansion) ledger = post(ledger, 1, 'equipment', 'equipment', 'cash', 360_000n, 'investing');
  const rules = marketUnderStress(stress);
  let stock = 0;
  let invoices: Invoice[] = [];
  let soldUnits = 0;
  let supplyBlockedDays = 0;
  let unpaidDays = 0;
  let lowestCash = BigInt(balanceSheet(ledger, 1).cash);
  const shockDays: Array<string | null> = [];

  const host = createSimulationSession({ seed, sessionId, schedule: ({ day, phase }) => phase === 'market-alerts' ? [{
    id: 'daily-balance', virtualTime: 0, sequence: 0,
    run(draw) {
      const collection = invoices.filter(({ dueDay }) => dueDay === day).reduce((sum, invoice) => sum + invoice.amount, 0n);
      invoices = invoices.filter(({ dueDay }) => dueDay !== day);
      ledger = post(ledger, day, 'collect', 'cash', 'receivables', collection);

      const cash = BigInt(balanceSheet(ledger, day).cash);
      const dailyExpense = policy.dailyExpense + (expansion ? 2_500n : 0n);
      const paid = cash >= dailyExpense;
      if (!paid) unpaidDays += 1;
      ledger = post(ledger, day, 'operating', 'payrollExpense', paid ? 'cash' : 'payrollPayable', dailyExpense);
      const budget = BigInt(balanceSheet(ledger, day).cash) - policy.reserve;
      const desired = Math.max(0, target - stock);
      const sourceCap = stress === 'supplier-loss' && day >= 8 && day <= 15 ? 6 : target;
      const affordable = budget > 0n ? budget / unitCost : 0n;
      const purchases = Math.min(desired, sourceCap, Number(affordable));
      if (purchases < Math.min(desired, sourceCap)) supplyBlockedDays += 1;
      ledger = post(ledger, day, 'stock', 'inventory', 'cash', BigInt(purchases) * unitCost);
      stock += purchases;

      const player: MarketOffer = {
        id: 'player-offer', companyId, unitPriceMinor: policy.price, stockUnits: stock, capacityUnits: capacity,
        leadDays: 1, qualityBps: 8800, reliabilityBps: 9150,
      };
      const result = clearMarketDay(rules, { day, offers: [player, rival], randomUint32: draw() });
      shockDays.push(result.conditions.shockId);
      let revenue = 0n;
      let quantity = 0;
      for (const decision of result.decisions) {
        if (decision.companyId !== companyId || decision.awardedUnits === 0) continue;
        const amount = BigInt(decision.awardedUnits) * BigInt(decision.unitPriceMinor);
        const defaulted = stress === 'customer-loss' && decision.buyerId === 'city-grocers' && day >= 9 && day <= 14;
        invoices.push({ amount, dueDay: defaulted ? null : day + scenario.postClose.customerDelayDays });
        revenue += amount;
        quantity += decision.awardedUnits;
      }
      ledger = post(ledger, day, 'sale', 'receivables', 'sales', revenue);
      ledger = post(ledger, day, 'cost-of-sales', 'costOfSales', 'inventory', BigInt(quantity) * unitCost);
      stock -= quantity;
      soldUnits += quantity;
      const atClose = BigInt(balanceSheet(ledger, day).cash);
      if (atClose < lowestCash) lowestCash = atClose;
    },
  }] : [] });
  const result = host.handle({
    version: simulationProtocolVersion, type: 'command', sessionId, commandId: 'sample-month',
    expectedRevision: 0, payload: { type: 'advance', days: horizon },
  });
  if (result.type !== 'result' || result.outcome.status !== 'accepted') throw new Error('Balance sample did not advance');
  const interest = applyBasisPoints(loan, scenario.opening.loanMonthlyInterestBps);
  ledger = post(ledger, horizon, 'loan-interest', 'interestExpense', 'interestPayable', interest);
  const balance = balanceSheet(ledger, horizon);
  const income = incomeStatement(ledger, { fromDay: 1, throughDay: horizon });
  return { difficulty, stress, policy: policy.id, seed, shockDays, soldUnits, remainingStock: stock, supplyBlockedDays, unpaidDays,
    capitalMinor: capital.toString(), cashMinor: balance.cash, netIncomeMinor: income.netIncome,
    lowestCashMinor: lowestCash.toString(), outstandingMinor: invoices.reduce((sum, invoice) => sum + invoice.amount, 0n).toString(),
    defaultedMinor: invoices.filter(({ dueDay }) => dueDay === null).reduce((sum, invoice) => sum + invoice.amount, 0n).toString(),
    debtMinor: loan.toString(), journalEntries: ledger.entries.length,
  };
}
