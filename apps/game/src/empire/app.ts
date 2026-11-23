/** Mounts and drives the Single-Shell Empire Tycoon Investor Super-App with 60fps tapping and auto-save. */
import '../theme.css';
import '../components.css';
import '../visuals/game-feel.css';
import './shell.css';
import './views.css';
import { App as CapacitorApp } from '@capacitor/app';
import {
  activateTapBoost, advanceEmpireTime, boostCompany, buyDigitalAsset, buyLuxuryItem, buyRealEstate,
  buyStock, createInitialEmpire, foundCompany, mergeHolding, sellCompany, sellDigitalAssetAll,
  sellStock, setCompanyStrategy, tapEarn, upgradeCompany, upgradeTapLevel,
  type EmpireState, type ItemCategory, type SectorId,
} from '../../../../packages/empire/src';
import { type Locale } from '../../../../packages/ui/src';
import { renderBusinessTab, renderManageCompanyView, renderStartBusinessView } from './business-view';
import { patchEarningsLive, renderEarningsTab } from './earnings-view';
import { formatUsdExact } from './format';
import { renderInvestingTab, type InvestingViewState } from './investing-view';
import { renderItemsTab } from './items-view';
import { renderForbesView, renderProfileTab } from './profile-view';
import { renderEmpireShell, type RootTab, type SubScreen } from './shell';
import { createEmpirePersistence, type EmpirePersistence } from './storage';
import { empireText } from './text';

const root = document.querySelector<HTMLElement>('#app')!;
const params = new URLSearchParams(location.search);

let locale: Locale = params.get('lang') === 'en' ? 'en' : 'ar';
let state: EmpireState = createInitialEmpire(Date.now());
let tab: RootTab = 'earnings';
let subScreen: SubScreen = null;
let investingUi: InvestingViewState = { subTab: 'shares', cheapFirst: true, digitalFilter: 'hot' };
let itemCategory: ItemCategory = 'cars';
let offlineEarnedCents: bigint | null = null;
let persistence: EmpirePersistence | null = null;
let saveTimer: number | null = null;

function scheduleSave(immediate = false) {
  if (!persistence) return;
  if (immediate) {
    if (saveTimer !== null) { window.clearTimeout(saveTimer); saveTimer = null; }
    void persistence.save(state);
    return;
  }
  if (saveTimer !== null) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    if (persistence) void persistence.save(state);
  }, 800);
}

function spawnTapBurst(event: MouseEvent, cents: bigint) {
  const stage = root.querySelector<HTMLElement>('[data-tap-stage]');
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const x = event.clientX ? event.clientX - rect.left : rect.width / 2;
  const y = event.clientY ? event.clientY - rect.top : rect.height * 0.4;
  const burst = document.createElement('span');
  burst.className = 'tap-burst';
  burst.dir = 'ltr';
  burst.textContent = `+${formatUsdExact(cents)}`;
  burst.style.left = `${Math.max(24, Math.min(rect.width - 24, x))}px`;
  burst.style.top = `${Math.max(16, Math.min(rect.height - 16, y))}px`;
  stage.append(burst);
  window.setTimeout(() => burst.remove(), 650);
}

function handleBack(): boolean {
  if (subScreen !== null) {
    subScreen = null;
    render();
    return true;
  }
  if (tab !== 'earnings') {
    tab = 'earnings';
    render();
    return true;
  }
  return false;
}

function buildContent(nowMs: number): HTMLElement {
  const bizHandlers = {
    onOpenStartBusiness: () => { subScreen = { type: 'start-business' }; render(); },
    onOpenCompany: (companyId: string) => { subScreen = { type: 'manage-company', companyId }; render(); },
    onFoundCompany: (sector: SectorId) => {
      const res = foundCompany(state, sector, Date.now());
      if (!res.company) return;
      state = res.state;
      subScreen = { type: 'manage-company', companyId: res.company.id };
      scheduleSave(true);
      render();
    },
    onUpgradeCompany: (companyId: string) => {
      state = upgradeCompany(state, companyId);
      scheduleSave(true);
      render();
    },
    onSetStrategy: (companyId: string, strategyId: string) => {
      state = setCompanyStrategy(state, companyId, strategyId);
      scheduleSave(true);
      render();
    },
    onBoostCompany: (companyId: string) => {
      state = boostCompany(state, companyId, Date.now());
      scheduleSave(true);
      render();
    },
    onSellCompany: (companyId: string) => {
      state = sellCompany(state, companyId);
      subScreen = null;
      scheduleSave(true);
      render();
    },
    onMergeHolding: () => {
      state = mergeHolding(state);
      scheduleSave(true);
      render();
    },
  };

  if (subScreen?.type === 'start-business') return renderStartBusinessView(state, locale, bizHandlers);
  if (subScreen?.type === 'manage-company') {
    const targetId = subScreen.companyId;
    const co = state.companies.find((c) => c.id === targetId);
    if (co) return renderManageCompanyView(state, co, nowMs, locale, bizHandlers);
    subScreen = null;
  }
  if (subScreen?.type === 'forbes') return renderForbesView(state, locale);

  if (tab === 'earnings') {
    return renderEarningsTab(state, nowMs, locale, {
      onTap: (event) => {
        const now = Date.now();
        const res = tapEarn(state, now);
        state = res.state;
        spawnTapBurst(event, res.earnedCents);
        patchEarningsLive(root, state, now, locale);
        scheduleSave();
      },
      onUpgradeTap: () => {
        state = upgradeTapLevel(state);
        scheduleSave(true);
        render();
      },
      onActivateBoost: () => {
        state = activateTapBoost(state, Date.now());
        scheduleSave(true);
        render();
      },
    });
  }

  if (tab === 'business') return renderBusinessTab(state, nowMs, locale, bizHandlers);

  if (tab === 'investing') {
    return renderInvestingTab(state, investingUi, locale, {
      onSubTab: (subTab) => { investingUi = { ...investingUi, subTab }; render(); },
      onToggleRealEstateSort: () => { investingUi = { ...investingUi, cheapFirst: !investingUi.cheapFirst }; render(); },
      onDigitalFilter: (digitalFilter) => { investingUi = { ...investingUi, digitalFilter }; render(); },
      onBuyStock: (id, qty) => { state = buyStock(state, id, qty); scheduleSave(true); render(); },
      onSellStockAll: (id) => {
        const owned = state.stocks[id]?.shares ?? 0;
        if (owned > 0) { state = sellStock(state, id, owned); scheduleSave(true); render(); }
      },
      onBuyRealEstate: (id) => { state = buyRealEstate(state, id); scheduleSave(true); render(); },
      onBuyDigital: (id, cents) => { state = buyDigitalAsset(state, id, cents); scheduleSave(true); render(); },
      onSellDigitalAll: (id) => { state = sellDigitalAssetAll(state, id); scheduleSave(true); render(); },
    });
  }

  if (tab === 'items') {
    return renderItemsTab(state, itemCategory, locale, {
      onSelectCategory: (cat) => { itemCategory = cat; render(); },
      onBuyItem: (id) => { state = buyLuxuryItem(state, id); scheduleSave(true); render(); },
    });
  }

  return renderProfileTab(state, locale, {
    onOpenForbes: () => { subScreen = { type: 'forbes' }; render(); },
    onToggleLanguage: () => { locale = locale === 'ar' ? 'en' : 'ar'; render(); },
    onResetEmpire: () => {
      if (!window.confirm(empireText(locale).resetConfirm)) return;
      void (async () => {
        const now = Date.now();
        state = persistence ? await persistence.reset(now) : createInitialEmpire(now);
        offlineEarnedCents = null;
        tab = 'earnings';
        subScreen = null;
        render();
      })();
    },
  });
}

function render() {
  const nowMs = Date.now();
  renderEmpireShell({
    root,
    locale,
    state,
    tab,
    subScreen,
    offlineEarnedCents,
    content: buildContent(nowMs),
    onSelectTab: (next) => { tab = next; subScreen = null; render(); },
    onBack: () => { handleBack(); },
    onToggleLanguage: () => { locale = locale === 'ar' ? 'en' : 'ar'; render(); },
    onDismissOffline: () => { offlineEarnedCents = null; render(); },
  });
}

async function start() {
  persistence = await createEmpirePersistence();
  const now = Date.now();
  const loaded = await persistence.load(now);
  const caught = advanceEmpireTime(loaded, now);
  state = caught.state;
  if (caught.accruedCents >= 100n && now - loaded.lastTickMs > 15_000) {
    offlineEarnedCents = caught.accruedCents;
  }
  render();

  let lastBoostState = now < state.tapBoostUntilMs || now < state.tapBoostCooldownUntilMs;
  let lastMarketTick = state.marketTick;
  window.setInterval(() => {
    const tickNow = Date.now();
    const res = advanceEmpireTime(state, tickNow);
    state = res.state;
    const boostState = tickNow < state.tapBoostUntilMs || tickNow < state.tapBoostCooldownUntilMs;
    const marketChanged = state.marketTick !== lastMarketTick;
    if (res.accruedCents > 0n) scheduleSave();
    if ((tab === 'investing' && marketChanged) || (tab === 'earnings' && (boostState !== lastBoostState || boostState))) {
      lastBoostState = boostState;
      lastMarketTick = state.marketTick;
      render();
    } else {
      lastBoostState = boostState;
      lastMarketTick = state.marketTick;
      patchEarningsLive(root, state, tickNow, locale);
    }
  }, 500);

  window.addEventListener('pagehide', () => scheduleSave(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') scheduleSave(true);
  });
  try {
    void CapacitorApp.addListener('backButton', () => { handleBack(); });
  } catch {
    // Web browser environment without native Android bridge.
  }
}

void start();
