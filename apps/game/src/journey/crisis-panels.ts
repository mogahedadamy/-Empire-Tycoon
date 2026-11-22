/** Renders alerts, Day 31 post-close decision, crisis diagnosis/containment, and journey report. */
import { applyBasisPoints } from '../../../../packages/finance/src';
import { action, detailRows, el, notice } from '../../../../packages/ui/src';
import { dataTable } from '../company/view-tools';
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
  const { c, money, qty, day } = labels;
  const { restockTerms } = model;
  const affordable = BigInt(model.balance.cash) >= BigInt(restockTerms.totalCostMinor);
  const buy = action(c.restockAction, options.approveRestock);
  buy.dataset.approveRestock = '';
  buy.disabled = options.busy || !options.canWrite;
  const defer = action(c.deferRestockAction, options.deferRestock, 'secondary');
  defer.dataset.deferRestock = '';
  defer.disabled = options.busy || !options.canWrite;
  return el('section', 'panel decision-card',
    el('h2', '', c.postCloseTitle),
    el('p', 'muted', c.postCloseIntro),
    detailRows([
      [c.orderQty, qty(restockTerms.quantity)],
      [c.restockCost, money(restockTerms.totalCostMinor)],
      [c.rentDueLabel, el('span', 'dates', day(restockTerms.rentDueDay), ' · ', money(restockTerms.rentAmountMinor))],
    ]),
    affordable ? null : el('p', 'field-error', c.restockInsufficient),
    el('div', 'actions panel-actions', buy, defer),
  );
}

export function buildDiagnosisPanel(model: JourneyReadModel, labels: JourneyLabels, options: CrisisPanelActions) {
  const { c, money, day, party } = labels;
  const { distress, earlyCollectionSummary, rescueLoanTerms } = model;
  const dueUnpaid = model.obligations.filter((ob) => !ob.payment && model.day >= ob.dueDay);
  const show = distress.stage !== 'healthy' || dueUnpaid.length > 0 || (model.day >= 31 && earlyCollectionSummary.available);
  if (!show) return null;

  const stageKey = `stage_${distress.stage.replace(/-/g, '_')}` as keyof typeof c;
  const badgeTone = distress.stage === 'default' || distress.stage === 'payment-shortfall' || distress.stage === 'ended'
    ? 'badge-danger' : distress.stage === 'warning' ? 'badge-warn' : '';
  const causeRows = distress.cause ? detailRows([
    [c.causeParty, party(distress.cause.partyId)],
    [c.causeReason, distress.cause.source === 'opening-cash' ? c.cash : c[distress.cause.source]],
    [c.causeAmount, money(distress.cause.amountMinor)],
    [c.causeDeadline, day(distress.cause.responseByDay)],
  ]) : null;

  const cards = el('div', 'containment-grid');
  if (distress.canOperate && earlyCollectionSummary.available) {
    const btn = action(c.earlyCollectAction, options.collectEarly);
    btn.dataset.collectEarly = '';
    btn.disabled = options.busy || !options.canWrite;
    cards.append(el('article', 'containment-card',
      el('strong', '', c.earlyCollectAction),
      detailRows([
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
      el('strong', '', c.rescueLoanAction),
      detailRows([
        [c.rescueLoanDetail, money(rescueLoanTerms.principalMinor)],
        [c.rescueMonthlyInterest, money(monthly)],
      ]),
      btn,
    ));
  }
  for (const ob of dueUnpaid) {
    if (!distress.canOperate) break;
    const btn = action(c.payObligationAction, () => options.payObligation(ob.id), 'secondary');
    btn.dataset.payObligation = ob.id;
    btn.disabled = options.busy || !options.canWrite;
    cards.append(el('article', 'containment-card',
      el('strong', '', `${c[ob.kind]} · ${c[ob.status]}`),
      detailRows([[c.amount, money(ob.amountMinor)], [c.payDue, day(ob.dueDay)]]),
      btn,
    ));
  }
  if (distress.stage === 'default') {
    const endBtn = action(c.endCompanyAction, options.endCompany, 'danger');
    endBtn.dataset.endCompany = '';
    endBtn.disabled = options.busy || !options.canWrite;
    cards.append(el('article', 'containment-card', el('strong', '', c.stage_default), endBtn));
  }

  const section = el('section', 'panel diagnosis-panel',
    el('div', 'panel-heading', el('h2', '', c.diagnosisTitle), el('span', `badge ${badgeTone}`, c[stageKey])),
    causeRows,
    cards.childElementCount ? cards : null,
  );
  section.dataset.distressStage = distress.stage;
  return section;
}

export function buildReportAndLog(model: JourneyReadModel, labels: JourneyLabels, options: CrisisPanelActions) {
  const { c, money, day } = labels;
  const blocks: HTMLElement[] = [];

  if (model.evaluation.status !== 'in-progress') {
    const evalKey = `eval_${model.evaluation.status.replace(/-/g, '_')}` as keyof typeof c;
    const tone = model.evaluation.status === 'succeeded' ? 'success' : 'error';
    const restart = action(c.newRun, options.startNewRun);
    restart.dataset.newRun = '';
    blocks.push(el('section', 'panel report-panel',
      el('h2', '', c.reportTitle),
      notice(c.reportTitle, c[evalKey], tone),
      detailRows([
        [c.objDelivery, model.evaluation.deliveredOnTime ? c.passed : c.failed],
        [c.objPayroll, model.evaluation.payrollPaidOnTime ? c.passed : c.failed],
        [c.objCash, model.evaluation.cashNonNegative ? c.passed : c.failed],
        [c.objSolvent, model.evaluation.solvent ? c.passed : c.failed],
      ]),
      el('div', 'actions panel-actions', restart),
    ));
  }

  if (model.decisions.length > 0) {
    const rows = model.decisions.map((item) => {
      const key = `decision_${item.kind.replace(/-/g, '_')}` as keyof typeof c;
      return [c[key], day(item.day), money(item.costMinor), money(item.liquidityProtectionMinor), money(item.debtAddedMinor)];
    });
    blocks.push(el('section', 'panel',
      el('h2', '', c.decisionsTitle),
      dataTable(c.decisionsTitle, [c.account, c.day, c.decisionCost, c.decisionProtection, c.decisionDebt], rows),
    ));
  }
  return blocks;
}
