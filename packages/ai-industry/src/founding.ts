/** Calculates the opening decision and posts its settled transactions through the shared game ledger. */
import type { AiFoundingPath, AiScenario } from '../../content/src/ai';
import { simulationProtocolVersion } from '../../contracts/src';
import { balanceSheet, Ledger } from '../../finance/src';
import { createSimulationSession } from '../../simulation/src';

export interface AiFoundingCommand {
  readonly type: 'found-ai-company';
  readonly pathId: AiFoundingPath;
}

function quote(scenario: AiScenario, path: AiScenario['paths'][number]) {
  const buyer = scenario.buyers.find(({ id }) => id === path.buyerId)!;
  const supplier = scenario.suppliers.find(({ id }) => id === path.supplierId)!;
  const region = scenario.regions.find(({ id }) => id === supplier.regionId)!;
  const weights = scenario.licenses.find(({ id }) => id === path.weightLicenseId)!;
  const remaining = BigInt(scenario.founderCapitalMinor) - BigInt(path.setupPayrollMinor);
  const commitment = BigInt(path.dailyCommitmentMinor) * BigInt(path.commitmentDays);

  return Object.freeze({
    pathId: path.id, name: path.name, dependency: path.dependency, buyer: buyer.name, billing: buyer.billing,
    supplier: supplier.name, region: region.name, capacityPlan: path.capacityPlan,
    hardwareFamilyId: path.hardwareFamilyId, dataLicenseId: path.dataLicenseId,
    weightLicenseId: weights.id, weightAccess: weights.access,
    founderCapitalMinor: scenario.founderCapitalMinor, startupCostMinor: path.setupPayrollMinor,
    openingCashMinor: remaining.toString(), dailyCommitmentMinor: path.dailyCommitmentMinor,
    commitmentDays: path.commitmentDays, totalCommitmentMinor: commitment.toString(),
    cashAfterCommitmentMinor: (remaining - commitment).toString(),
    firstServiceDay: path.serviceStartsDay, firstCollectionDay: path.serviceStartsDay + buyer.paymentTermsDays,
  });
}

/** Compares all authored routes using the same terms that founding will commit. */
export function quoteAiFounding(scenario: AiScenario) {
  return Object.freeze(scenario.paths.map((path) => quote(scenario, path)));
}

export type AiFoundingQuote = ReturnType<typeof quote>;

/** Starts one seeded company. Future supplier commitments remain visible as a projection until incurred. */
export function foundAiCompany(scenario: AiScenario, command: AiFoundingCommand) {
  if (command?.type !== 'found-ai-company') throw new RangeError('Unknown AI founding command');
  const path = scenario.paths.find(({ id }) => id === command.pathId);
  if (!path) throw new RangeError('Unknown AI founding path');
  const preview = quote(scenario, path);
  const companyId = 'ai-' + path.id;
  const session = createSimulationSession({ sessionId: companyId, seed: scenario.seed });
  const reply = session.handle({ version: simulationProtocolVersion, type: 'read', sessionId: companyId });
  if (reply.type !== 'snapshot') throw new Error('AI opening snapshot unavailable');
  const { openDay: day, randomState } = reply.snapshot;
  const ledger = Ledger.open({ companyId, currency: scenario.currency }).post([
    { id: 'founder-capital', day, sourceId: path.id, lines: [
      { account: 'cash', side: 'debit', amount: scenario.founderCapitalMinor, cashFlow: 'financing' },
      { account: 'contributedCapital', side: 'credit', amount: scenario.founderCapitalMinor },
    ] },
    { id: 'founding-payroll', day, sourceId: path.id, lines: [
      { account: 'payrollExpense', side: 'debit', amount: path.setupPayrollMinor },
      { account: 'cash', side: 'credit', amount: path.setupPayrollMinor, cashFlow: 'operating' },
    ] },
  ]);
  return Object.freeze({
    scenarioId: scenario.id, rulesetVersion: scenario.rulesetVersion, contentVersion: scenario.contentVersion,
    companyId, currency: scenario.currency, day, revision: 1, randomState, pathId: path.id,
    quote: preview, balance: balanceSheet(ledger, day), entries: ledger.entries,
  });
}

export type AiFoundingReceipt = ReturnType<typeof foundAiCompany>;
