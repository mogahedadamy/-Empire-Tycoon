/** Orchestrates the Big Order journey session over the revision-checked Worker client and storage. */
import { loadScenario, type Scenario } from '../../../../packages/content/src';
import type { WorkerTransport } from '../../../../packages/contracts/src';
import { focusHeading, type Locale } from '../../../../packages/ui/src';
import { journalDialog } from '../company/finance';
import { saveMessage } from '../company/save-notice';
import type { SaveNotice } from '../company/storage';
import { labels as companyLabels } from '../company/view-tools';
import type { FundingPlan } from '../preview-model';
import { bindGameLifecycle } from '../platform/lifecycle';
import type { JourneyPerformance } from '../platform/performance';
import { companyView } from './company-view';
import { journeyContractsView, type JourneyDeliveryState } from './contracts-view';
import { journeyFinanceView, type ReportPeriod, type StatementTab } from './finance-view';
import { renderWorkerBanner, type JourneyScreen, type WorkerBannerState } from './guidance';
import { missionCopy } from './mission-copy';
import { hasOpeningMission } from './mission-step';
import { renderOpeningMission } from './mission-view';
import { journeyOverview, type ForecastMode } from './overview-view';
import { setupView } from './setup-view';
import { renderJourneyShell } from './shell';
import { openJourneyStorage, type JourneyStorage } from './storage';
import { journeyLabels } from './text';
import type { JourneyAction, JourneyOutcome, JourneyReadModel } from './types';
import { createBrowserWorkerTransport, createJourneyWorkerClient, type JourneyWorkerClient } from './worker-client';

export interface MountJourneyOptions {
  readonly root: HTMLElement;
  readonly live: HTMLElement;
  readonly initialScenarioId?: string;
  readonly entryMode?: 'mission' | 'management';
  readonly performance?: JourneyPerformance;
  readonly createTransport?: () => WorkerTransport;
  readonly openStorage?: (scenario: Scenario, report: (notice: SaveNotice) => void) => Promise<JourneyStorage>;
}

const mutatingSelector = '[data-advance-one], [data-advance-milestone], [data-found-company], ' +
  '[data-sign-contract], [data-order-supply], [data-approve-restock], [data-defer-restock], ' +
  '[data-collect-early], [data-draw-rescue-loan], [data-pay-obligation], [data-collect-due], ' +
  '[data-end-company], [data-ack-alert]';

export async function mountJourneyApp(options: MountJourneyOptions) {
  const { root, live, performance } = options;
  const createTransport = options.createTransport ?? createBrowserWorkerTransport;
  const openStorage = options.openStorage ?? openJourneyStorage;

  let scenarioId = options.initialScenarioId ?? 'big-order';
  let scenario = loadScenario(scenarioId);
  let locale: Locale = 'ar';
  let screen: JourneyScreen = 'overview';
  let management = options.entryMode === 'management';
  let selectedPlan: FundingPlan = 'loan';
  let guidanceSkipped = false;
  let forecastMode: ForecastMode = 'baseline';
  let statement: StatementTab = 'income';
  let reportPeriod: ReportPeriod = 'month-1';
  let account: string | null = null;
  let quantity = '50';
  let delivery: JourneyDeliveryState = { type: 'idle' };
  let commandNotice: { tone: 'error' | 'warning'; text: string } | null = null;
  let saveNotice: SaveNotice = { kind: 'saved' };
  let workerBanner: WorkerBannerState = { busy: false, ack: null, progress: null };

  let storage!: JourneyStorage;
  let client!: JourneyWorkerClient;
  let model!: JourneyReadModel;
  const inMission = () => !management && hasOpeningMission(model, scenario);

  function focus(selector: string) {
    const item = root.querySelector<HTMLElement>(selector);
    if (item) focusHeading(item);
  }

  function updateSaveStatus() {
    const status = root.querySelector<HTMLElement>('.save-status');
    if (!status) return;
    status.setAttribute('role', 'status');
    status.dataset.state = saveNotice.kind;
    status.textContent = inMission() && saveNotice.kind === 'saved' ? missionCopy(locale).saved : saveMessage(locale, saveNotice);
  }

  function updateWorkerStatus() {
    const missionStatus = root.querySelector<HTMLElement>('.mission-worker');
    if (missionStatus) {
      const working = workerBanner.busy ? missionCopy(locale).working : '';
      if (missionStatus.textContent !== working) missionStatus.textContent = working;
      const primary = root.querySelector<HTMLButtonElement>('[data-mission-action]');
      if (primary) primary.disabled = workerBanner.busy || !storage.canWrite();
      return;
    }
    const banner = root.querySelector<HTMLElement>('.worker-banner');
    if (!banner) return;
    renderWorkerBanner(banner, workerBanner, journeyLabels(locale));
    const disabled = workerBanner.busy || !storage.canWrite();
    root.querySelectorAll<HTMLButtonElement>(mutatingSelector).forEach((button) => { button.disabled = disabled; });
  }

  async function bootScenario(nextScenarioId: string, resetExisting = false) {
    if (resetExisting && storage) await storage.reset();
    client?.dispose();
    scenarioId = nextScenarioId;
    scenario = loadScenario(scenarioId);
    storage = await openStorage(scenario, (next) => { saveNotice = next; updateSaveStatus(); });
    saveNotice = storage.notice;
    client = createJourneyWorkerClient(createTransport(), `journey:${scenario.id}`, {
      onAck(ack) {
        workerBanner = { busy: true, ack, progress: null };
        live.textContent = inMission() ? '' : journeyLabels(locale).c.workerAck;
        updateWorkerStatus();
        performance?.acknowledge();
      },
      onProgress(progress) {
        workerBanner = { busy: true, ack: workerBanner.ack, progress };
        updateWorkerStatus();
      },
      onCommitted(nextModel, saveProgress) {
        model = nextModel;
        storage.commit(saveProgress);
      },
    });
    model = await client.init(scenario.id, storage.initialProgress);
    storage.commit(client.currentSave());
    delivery = { type: 'idle' };
    commandNotice = null;
    screen = 'overview';
    const maxPreview = await client.previewDelivery(1);
    quantity = String(maxPreview.max || Math.min(scenario.opening.dailyHandlingCapacity, scenario.contract.quantity));
    render();
  }

  async function dispatch(actionPayload: JourneyAction) {
    if (workerBanner.busy || !storage.canWrite()) return;
    const startedInMission = inMission();
    commandNotice = null;
    performance?.start(actionPayload, model);
    workerBanner = { busy: true, ack: null, progress: null };
    updateWorkerStatus();
    try {
      const { outcome, model: nextModel } = await client.command(actionPayload);
      model = nextModel;
      performance?.finish(model);
      const strings = journeyLabels(locale);
      if (outcome.status === 'rejected') {
        const text = outcome.code === 'insufficient-cash' && outcome.shortfallMinor
          ? `${strings.c.shortfallRejected} ${strings.format.money(BigInt(outcome.shortfallMinor))} ${strings.c.unit}`
          : startedInMission ? missionCopy(locale).retry : `${strings.c.commandRejected} ${outcome.code}`;
        commandNotice = { tone: 'error', text };
        live.textContent = text;
      } else if (!startedInMission) {
        live.textContent = `${strings.c.day} ${model.day}`;
      }
    } catch (error) {
      if (!startedInMission) throw error;
      const text = missionCopy(locale).retry;
      commandNotice = { tone: 'error', text };
      live.textContent = text;
    } finally {
      workerBanner = { busy: false, ack: null, progress: null };
      render();
      if (startedInMission && !management) focus(inMission() ? '#mission-step-title' : '#page-title');
    }
  }

  function showJournal(id: string) {
    const entry = model.journal.find((item) => item.id === id);
    if (!entry) return;
    const previous = document.activeElement;
    const dialog = journalDialog(entry, companyLabels(locale));
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    }, { once: true });
    root.append(dialog);
    dialog.showModal();
    dialog.querySelector('button')?.focus();
  }

  function navigate(next: JourneyScreen, target = '#page-title') {
    screen = next;
    render();
    window.scrollTo?.(0, 0);
    focus(target);
  }

  function reviewCash(target = '#journal-title') {
    statement = 'flow';
    reportPeriod = 'cumulative';
    account = 'cash';
    navigate('finance', target);
  }

  async function submitDelivery() {
    if (workerBanner.busy || delivery.type === 'pending' || !storage.canWrite()) return;
    if (delivery.type !== 'preview' || !delivery.preview.valid) {
      delivery = { type: 'preview', preview: await client.previewDelivery(Number(quantity)) };
      render();
      focus('#delivery-title');
      return;
    }
    const prev = delivery.preview;
    delivery = { type: 'pending' };
    workerBanner = { busy: true, ack: null, progress: null };
    render();
    try {
      const action: JourneyAction = { type: 'deliver', offerId: scenario.contract.id, quantity: prev.quantity };
      performance?.start(action, model);
      const { outcome, model: nextModel } = await client.command(action, prev.revision);
      model = nextModel;
      performance?.finish(model);
      const { c } = journeyLabels(locale);
      if (outcome.status === 'rejected' && outcome.code === 'stale-revision') {
        delivery = { type: 'preview', preview: await client.previewDelivery(prev.quantity), previous: prev };
        live.textContent = c.previewChanged;
      } else if (outcome.status === 'accepted' && outcome.invoiceId) {
        delivery = { type: 'accepted', invoiceId: outcome.invoiceId };
        live.textContent = c.accepted;
        quantity = String((await client.previewDelivery(1)).max || 1);
      } else {
        delivery = { type: 'rejected' };
        live.textContent = c.rejected;
      }
    } finally {
      workerBanner = { busy: false, ack: null, progress: null };
      render();
      if (screen === 'contracts') focus('#delivery-title');
    }
  }

  function renderActiveScreen(strings: ReturnType<typeof journeyLabels>) {
    if (!model.founded) {
      return setupView(strings, {
        scenario, scenarioId, plan: selectedPlan, guidanceSkipped, busy: workerBanner.busy,
        selectScenario(id) { void bootScenario(id); },
        selectPlan(plan) { selectedPlan = plan; render(); },
        selectGuidance(skipped) { guidanceSkipped = skipped; render(); },
        found() { void dispatch({ type: 'found-company', fundingPlan: selectedPlan }); },
      });
    }
    switch (screen) {
      case 'overview': return journeyOverview(model, strings, {
        mode: forecastMode, busy: workerBanner.busy, canWrite: storage.canWrite(),
        selectMode(mode) { forecastMode = mode; render(); root.querySelector<HTMLElement>(`[data-mode="${mode}"]`)?.focus(); },
        traceCash: reviewCash,
        openInvoices() { navigate('contracts', '#invoices h2'); },
        openEntry: showJournal,
        ackAlert(alertId) { void dispatch({ type: 'resolve-alert', alertId }); },
        approveRestock() { void dispatch({ type: 'approve-restock' }); },
        deferRestock() { void dispatch({ type: 'defer-restock' }); },
        collectEarly() { void dispatch({ type: 'collect-early' }); },
        drawRescueLoan() { void dispatch({ type: 'draw-rescue-loan' }); },
        payObligation(obligationId) { void dispatch({ type: 'pay-obligation', obligationId }); },
        endCompany() { void dispatch({ type: 'end-company' }); },
        startNewRun() { void bootScenario(scenarioId, true); },
      });
      case 'business': return companyView(model, strings, {
        scenario, busy: workerBanner.busy, canWrite: storage.canWrite(),
        orderSupply() { void dispatch({ type: 'order-supply' }); },
        payObligation(obligationId) { void dispatch({ type: 'pay-obligation', obligationId }); },
        openEntry: showJournal,
      });
      case 'contracts': return journeyContractsView(model, strings, {
        quantity, decision: delivery, busy: workerBanner.busy, canWrite: storage.canWrite(),
        signContract(offerId) { void dispatch({ type: 'accept-contract', offerId }); },
        changeQuantity(value) {
          quantity = value;
          if (delivery.type !== 'preview' && delivery.type !== 'rejected') return;
          delivery = { type: 'idle' };
          root.querySelector('.delivery-details')?.remove();
          const btn = root.querySelector<HTMLElement>('[data-delivery-action]');
          if (btn) btn.textContent = journeyLabels(locale).c.preview;
        },
        submitDelivery() { void submitDelivery(); },
        collectDue(invoiceId) { void dispatch({ type: 'collect-due', invoiceId }); },
        openEntry: showJournal,
      });
      case 'finance': return journeyFinanceView(model, strings, {
        statement, period: reportPeriod, account, openEntry: showJournal,
        selectStatement(id) { statement = id; account = null; render(); root.querySelector<HTMLElement>(`[data-statement="${id}"]`)?.focus(); },
        selectPeriod(id) { reportPeriod = id; render(); root.querySelector<HTMLElement>(`[data-period="${id}"]`)?.focus(); },
        selectAccount(id) { account = id; render(); focus('#journal-title'); },
      });
    }
  }

  function render() {
    const strings = journeyLabels(locale);
    if (inMission()) {
      renderOpeningMission({
        root, locale, labels: strings, scenario, model, plan: selectedPlan, busy: workerBanner.busy,
        canWrite: storage.canWrite(), error: commandNotice?.text ?? null,
        dispatch(command) { void dispatch(command); },
        manage(next) {
          management = true;
          if (next === 'finance') reviewCash('#page-title');
          else navigate(next ?? 'overview');
        },
        toggleLanguage,
      });
    } else renderJourneyShell({
      root, locale, screen, model, strings, busy: workerBanner.busy,
      canWrite: storage.canWrite(), guidanceSkipped, commandNotice,
      activeScreen: renderActiveScreen(strings),
      navigate: (next) => navigate(next),
      advanceMilestone: (day) => { void dispatch({ type: 'advance-through', day }); },
      advanceOne: () => { void dispatch({ type: 'advance', days: 1 }); },
      toggleGuidance: () => { guidanceSkipped = !guidanceSkipped; render(); },
      toggleLanguage,
      returnToMission: hasOpeningMission(model, scenario) ? () => {
        management = false;
        render();
        window.scrollTo?.(0, 0);
        focus('#mission-goal');
      } : undefined,
    });
    updateSaveStatus();
    updateWorkerStatus();
  }

  function toggleLanguage() {
    locale = locale === 'ar' ? 'en' : 'ar';
    render();
    root.querySelector<HTMLElement>('.language')?.focus();
  }

  root.textContent = 'جارٍ فتح رحلة الطلب الكبير…';
  await bootScenario(scenarioId);
  performance?.opened(model);

  const unbindLifecycle = bindGameLifecycle({
    background() { storage.commit(client.currentSave()); },
    foreground() { storage.foreground(); storage.commit(client.currentSave()); },
  });

  return {
    getModel: () => model,
    getClient: () => client,
    flushSave: () => storage.flush(),
    dispose() {
      unbindLifecycle();
      client?.dispose();
      storage?.close();
    },
  };
}
