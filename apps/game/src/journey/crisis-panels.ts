/** Renders alerts, decision-first Day 31 trade-offs, crisis containment, and final report. */
import { applyBasisPoints } from '../../../../packages/finance/src';
import { action, detailRows, el, notice } from '../../../../packages/ui/src';
import { dataTable } from '../company/view-tools';
import { gameIcon } from '../visuals/icons';
import type { JourneyLabels } from './text';
import type { JourneyReadModel } from './types';

export interface CrisisPanelActions {
  busy: boolean;
  canWrite: boolean;
  ackAlert(alertId: string): void;
  approveRestock(): void;
  deferRestock(): void;
  collectEarly(): void;
  drawRescueLoan(): void;
  payObligation(obligationId: string): void;
  endCompany(): void;
  startNewRun(): void;
}

export function buildAlerts(model: JourneyReadModel, labels: JourneyLabels, options: CrisisPanelActions) {
  if (model.pendingAlerts.length === 0) return null;
  const { c, day } = labels;
  return el('section', 'view-stack pending-alerts', ...model.pendingAlerts.map((alert) => {
    const key = `alert_${alert.code.replace(/-/g, '_')}` as keyof typeof c;
    const text = key in c ? c[key] : alert.code;
    const tone = alert.code === 'company-default' || alert.code === 'payment-shortfall' ? 'error' : 'warning';
    const ack = action(c.ackAlertAction, () => options.ackAlert(alert.id), 'secondary');
    ack.dataset.ackAlert = alert.code;
    ack.disabled = options.busy || !options.canWrite;
    return el('div', `notice ${tone} alert-card`,
      el('div', '', el('strong', '', text), el('p', '', day(alert.day))),
      ack,
    );
  }));
}

export function buildPostClosePanel(model: JourneyReadModel, labels: JourneyLabels, options: CrisisPanelActions) {
  if (model.day < 31 || model.restockChoice !== 'pending' || !model.distress.canOperate) return null;
  const { c, format, money, qty, day } = labels;
  const { restockTerms } = model;
  const cash = BigInt(model.balance.cash);
  const cost = BigInt(restockTerms.totalCostMinor);
  const rent = BigInt(restockTerms.rentAmountMinor);
  const affordable = cash >= cost;
  const afterBuy = cash - cost;
  const buyGap = rent > afterBuy ? rent - afterBuy : 0n;
  const deferCovered = cash >= rent;

  const buyOutcome = !affordable
    ? c.restockInsufficient
    : buyGap > 0n
      ? c.buyOutcomeShortfall.replace('{cash}', format.money(afterBuy)).replace('{gap}', format.money(buyGap))
      : c.buyOutcomeCovered.replace('{cash}', format.money(afterBuy));
  const deferOutcome = (deferCovered ? c.deferOutcomeCovered : c.deferOutcomeShortfall)
    .replace('{cash}', format.money(cash));

  const buy = action(c.restockAction, options.approveRestock);
  buy.dataset.approveRestock = '';
  buy.disabled = options.busy || !options.canWrite;
  const defer = action(c.deferRestockAction, options.deferRestock, 'secondary');
  defer.dataset.deferRestock = '';
  defer.disabled = options.busy || !options.canWrite;

  const buyCard = el('article', 'tradeoff-choice tradeoff-choice-risk',
    el('div', 'tradeoff-head', el('strong', 'title-with-icon', gameIcon('crate'), c.restockOptionTitle), money(restockTerms.totalCostMinor)),
    el('p', `choice-outcome ${!affordable || buyGap > 0n ? 'choice-outcome-warn' : 'choice-outcome-safe'}`, buyOutcome),
    buy,
  );
  const deferCard = el('article', 'tradeoff-choice tradeoff-choice-safe',
    el('div', 'tradeoff-head', el('strong', 'title-with-icon', gameIcon('shield'), c.deferOptionTitle), el('span', 'muted tradeoff-cost-free', c.noCashCost)),
    el('p', `choice-outcome ${deferCovered ? 'choice-outcome-safe' : 'choice-outcome-warn'}`, deferOutcome),
    defer,
  );

  return el('section', 'panel decision-card decision-priority',
    el('div', 'panel-heading', el('h2', 'title-with-icon', gameIcon('crate'), c.postCloseTitle), el('span', 'badge badge-warn', qty(restockTerms.quantity))),
    el('div', 'tradeoff-facts',
      el('span', '', c.cashAvailableNow, ': ', money(model.balance.cash)),
      el('span', '', c.rentDueLabel, ': ', money(restockTerms.rentAmountMinor), ' · ', day(restockTerms.rentDueDay)),
    ),
    el('div', 'tradeoff-grid', buyCard, deferCard),
  );
}

function compactMeta(rows: Array<[string, HTMLElement]>) {
  return el('dl', 'containment-meta',
    ...rows.map(([label, value]) => el('div', '', el('dt', '', label), el('dd', '', value))),
  );
}

export function buildDiagnosisPanel(model: JourneyReadModel, labels: JourneyLabels, options: CrisisPanelActions) {
  const { c, format, money, day, party } = labels;
  const { distress, earlyCollectionSummary, rescueLoanTerms } = model;
  const dueUnpaid = model.obligations.filter((ob) => !ob.payment && model.day >= ob.dueDay);
  const show = distress.stage !== 'healthy' || dueUnpaid.length > 0 || (model.day >= 31 && earlyCollectionSummary.available);
  if (!show) return null;

  const cash = BigInt(model.balance.cash);
  const rentNeed = BigInt(distress.cause?.amountMinor ?? '0');
  const stageKey = `stage_${distress.stage.replace(/-/g, '_')}` as keyof typeof c;
  const badgeTone = distress.stage === 'default' || distress.stage === 'payment-shortfall' || distress.stage === 'ended'
    ? 'badge-danger' : distress.stage === 'warning' ? 'badge-warn' : '';
  const causeStrip = distress.cause ? el('dl', 'cause-strip',
    el('div', '', el('dt', '', c.causeParty), el('dd', '', party(distress.cause.partyId))),
    el('div', '', el('dt', '', c.causeReason), el('dd', '', distress.cause.source === 'opening-cash' ? c.cash : c[distress.cause.source])),
    el('div', '', el('dt', '', c.causeAmount), el('dd', '', money(distress.cause.amountMinor))),
    el('div', '', el('dt', '', c.causeDeadline), el('dd', '', day(distress.cause.responseByDay))),
  ) : null;

  const cards = el('div', 'containment-grid');
  if (distress.canOperate && earlyCollectionSummary.available) {
    const btn = action(c.earlyCollectAction, options.collectEarly);
    btn.dataset.collectEarly = '';
    btn.disabled = options.busy || !options.canWrite;
    const covers = BigInt(earlyCollectionSummary.cashMinor) >= rentNeed;
    cards.append(el('article', 'containment-card',
      el('p', 'choice-outcome choice-outcome-safe title-with-icon', gameIcon('bolt'), covers ? c.coversRentNow : c.earlyCollectDetail),
      compactMeta([
        [c.earlyCollectDetail, money(earlyCollectionSummary.cashMinor)],
        [c.earlyDiscountCost, money(earlyCollectionSummary.discountMinor)],
      ]),
      btn,
    ));
  }
  if (distress.canOperate && model.day >= 31 && !model.rescueLoanTaken) {
    const monthly = applyBasisPoints(BigInt(rescueLoanTerms.principalMinor), rescueLoanTerms.monthlyInterestBps).toString();
    const btn = action(c.rescueLoanAction, options.drawRescueLoan, 'secondary');
    btn.dataset.drawRescueLoan = '';
    btn.disabled = options.busy || !options.canWrite;
    cards.append(el('article', 'containment-card',
      el('p', 'choice-outcome choice-outcome-warn title-with-icon', gameIcon('bank'), c.addsDebtNote),
      compactMeta([
        [c.rescueLoanDetail, money(rescueLoanTerms.principalMinor)],
        [c.rescueMonthlyInterest, money(monthly)],
      ]),
      btn,
    ));
  }
  for (const ob of dueUnpaid) {
    if (!distress.canOperate) break;
    const obAmount = BigInt(ob.amountMinor);
    const gap = obAmount > cash ? obAmount - cash : 0n;
    const btn = action(c.payObligationAction, () => options.payObligation(ob.id), 'secondary');
    btn.dataset.payObligation = ob.id;
    btn.disabled = options.busy || !options.canWrite;
    cards.append(el('article', 'containment-card',
      el('div', 'tradeoff-head',
        el('strong', '', `${c[ob.kind]} · ${c[ob.status]}`),
        el('span', `choice-outcome ${gap > 0n ? 'choice-outcome-warn' : 'choice-outcome-safe'}`,
          gap > 0n ? c.payStillShort.replace('{gap}', format.money(gap)) : c.payCoveredNow),
      ),
      compactMeta([[c.amount, money(ob.amountMinor)], [c.payDue, day(ob.dueDay)]]),
      btn,
    ));
  }
  if (distress.stage === 'default') {
    const endBtn = action(c.endCompanyAction, options.endCompany, 'danger');
    endBtn.dataset.endCompany = '';
    endBtn.disabled = options.busy || !options.canWrite;
    cards.append(el('article', 'containment-card', el('strong', '', c.stage_default), endBtn));
  }

  const section = el('section', 'panel diagnosis-panel decision-priority',
    el('div', 'panel-heading', el('h2', 'title-with-icon', gameIcon('alert'), c.diagnosisTitle), el('span', `badge ${badgeTone}`, c[stageKey])),
    causeStrip,
    cards.childElementCount ? cards : null,
  );
  section.dataset.distressStage = distress.stage;
  return section;
}

export function buildEvaluationReport(model: JourneyReadModel, labels: JourneyLabels, options: CrisisPanelActions) {
  if (model.evaluation.status === 'in-progress') return null;
  const { c } = labels;
  const evalKey = `eval_${model.evaluation.status.replace(/-/g, '_')}` as keyof typeof c;
  const tone = model.evaluation.status === 'succeeded' ? 'success' : 'error';
  const restart = action(c.newRun, options.startNewRun);
  restart.dataset.newRun = '';
  return el('section', 'panel report-panel',
    el('h2', 'title-with-icon', gameIcon('trophy'), c.reportTitle),
    notice(c.reportTitle, c[evalKey], tone),
    detailRows([
      [c.objDelivery, model.evaluation.deliveredOnTime ? c.passed : c.failed],
      [c.objPayroll, model.evaluation.payrollPaidOnTime ? c.passed : c.failed],
      [c.objCash, model.evaluation.cashNonNegative ? c.passed : c.failed],
      [c.objSolvent, model.evaluation.solvent ? c.passed : c.failed],
    ]),
    el('div', 'actions panel-actions', restart),
  );
}

export function buildDecisionLog(model: JourneyReadModel, labels: JourneyLabels) {
  if (model.decisions.length === 0) return null;
  const { c, money, day } = labels;
  const rows = model.decisions.map((item) => {
    const key = `decision_${item.kind.replace(/-/g, '_')}` as keyof typeof c;
    return [c[key], day(item.day), money(item.costMinor), money(item.liquidityProtectionMinor), money(item.debtAddedMinor)];
  });
  return el('section', 'panel',
    el('h2', '', c.decisionsTitle),
    dataTable(c.decisionsTitle, [c.account, c.day, c.decisionCost, c.decisionProtection, c.decisionDebt], rows),
  );
}
