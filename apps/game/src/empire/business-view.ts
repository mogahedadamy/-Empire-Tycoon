/** Renders the Business root tab, Start-a-Business catalog, and Manage-Company sub-screen. */
import {
  BUSINESS_SECTORS, canMergeHolding, companyHourlyIncomeCents, companyUpgradeCostCents,
  getSectorDef, HOLDING_MERGE_COST_CENTS, MAX_COMPANIES, totalBusinessHourlyCents,
  type EmpireState, type OwnedCompany, type SectorId,
} from '../../../../packages/empire/src';
import { action, el, type Locale } from '../../../../packages/ui/src';
import { gameIcon } from '../visuals/icons';
import { formatHourly, formatUsd } from './format';
import { empireText } from './text';

export interface BusinessHandlers {
  onOpenStartBusiness(): void;
  onOpenCompany(companyId: string): void;
  onFoundCompany(sector: SectorId): void;
  onUpgradeCompany(companyId: string): void;
  onSetStrategy(companyId: string, strategyId: string): void;
  onBoostCompany(companyId: string): void;
  onSellCompany(companyId: string): void;
  onMergeHolding(): void;
}

function artThumb(art: string) {
  const img = el('img', 'biz-art');
  img.src = `${import.meta.env.BASE_URL}${art}`;
  img.alt = '';
  img.width = 560;
  img.height = 373;
  return img;
}

export function renderBusinessTab(state: EmpireState, nowMs: number, locale: Locale, handlers: BusinessHandlers): HTMLElement {
  const t = empireText(locale);
  const hourly = totalBusinessHourlyCents(state, nowMs);
  const hourlyVal = el('span', 'biz-hero-amount', formatHourly(hourly, locale));

  const startBtn = action(t.startBusiness, handlers.onOpenStartBusiness, 'primary biz-start-btn');
  startBtn.prepend(gameIcon('warehouse'));
  startBtn.dataset.openStartBusiness = '';
  startBtn.disabled = state.companies.length >= MAX_COMPANIES;

  const summary = el('section', 'panel biz-hero-card',
    el('div', 'biz-hero-head',
      el('span', 'muted', t.totalHourlyBusiness),
      el('span', 'badge', `${state.companies.length}/${MAX_COMPANIES}`),
    ),
    hourlyVal,
    startBtn,
  );

  // Holding Merger banner (unlocked once player grows portfolio)
  const mergeReady = canMergeHolding(state);
  const mergeBtn = action(`${t.holdingAction} (\u2066${formatUsd(HOLDING_MERGE_COST_CENTS, true)}\u2069)`, handlers.onMergeHolding, mergeReady ? 'primary' : 'secondary');
  mergeBtn.dataset.mergeHolding = '';
  mergeBtn.disabled = !mergeReady;
  const mergerCard = state.companies.length >= 2 ? el('section', 'panel holding-card',
    el('div', 'panel-heading',
      el('h2', 'title-with-icon', gameIcon('trophy'), t.holdingTitle),
      state.holdingMerged ? el('span', 'badge', t.holdingDone) : null,
    ),
    state.holdingMerged ? null : el('p', 'muted', t.holdingDesc),
    state.holdingMerged ? null : mergeBtn,
  ) : null;

  const listHeader = el('div', 'section-row-head',
    el('h2', '', `${t.myCompanies} (${state.companies.length}/${MAX_COMPANIES})`),
  );

  const list = state.companies.length === 0
    ? el('section', 'panel empty-state-card',
      gameIcon('warehouse', 'empty-icon'),
      el('strong', '', t.noCompaniesTitle),
      el('p', 'muted', t.noCompaniesBody),
    )
    : el('div', 'biz-list', ...state.companies.map((co) => {
      const def = getSectorDef(co.sector);
      const coHourly = companyHourlyIncomeCents(co, nowMs, state.holdingMerged);
      const boosted = nowMs < co.boostUntilMs;
      const card = el('button', 'owned-biz-card',
        artThumb(def.art),
        el('div', 'owned-biz-body',
          el('div', 'owned-biz-top',
            el('strong', '', def.companyName[locale]),
            el('span', 'badge', `${t.level} ${co.level}`),
          ),
          el('span', 'muted owned-biz-sector', def.name[locale]),
          el('div', 'owned-biz-foot',
            el('span', 'biz-income-pill', formatHourly(coHourly, locale)),
            boosted ? el('span', 'badge badge-boost', '+30%') : null,
          ),
        ),
      );
      card.type = 'button';
      card.dataset.manageCompany = co.id;
      card.addEventListener('click', () => handlers.onOpenCompany(co.id));
      return card;
    }));

  return el('div', 'empire-view business-view', summary, mergerCard, listHeader, list);
}

/** Pushed sub-screen (Level 3): Catalog of all 5 real Empire Tycoon business sectors with USD cost & affordability. */
export function renderStartBusinessView(state: EmpireState, locale: Locale, handlers: BusinessHandlers): HTMLElement {
  const t = empireText(locale);
  const full = state.companies.length >= MAX_COMPANIES;

  const cards = BUSINESS_SECTORS.map((sector) => {
    const canAfford = !full && state.balanceCents >= sector.startupCostCents;
    const costStr = `\u2066${formatUsd(sector.startupCostCents, true)}\u2069`;
    const label = full ? t.slotsFull : canAfford ? `${t.foundNow} · ${costStr}` : `${t.insufficientUsd} · ${costStr}`;
    const btn = action(label, () => handlers.onFoundCompany(sector.id), canAfford ? 'primary' : 'secondary');
    btn.dataset.foundSector = sector.id;
    btn.disabled = !canAfford;

    const costTag = el('bdi', 'sector-cost-tag', formatUsd(sector.startupCostCents, true));
    costTag.dir = 'ltr';

    return el('article', `panel sector-launch-card ${canAfford ? 'is-affordable' : 'is-locked'}`,
      el('div', 'sector-launch-media',
        artThumb(sector.art),
        el('span', `media-pill ${canAfford ? 'media-pill-active' : ''}`, formatHourly(sector.baseHourlyCents, locale)),
      ),
      el('div', 'sector-launch-body',
        el('div', 'panel-heading',
          el('h2', '', sector.name[locale]),
          costTag,
        ),
        el('p', 'muted', sector.tagline[locale]),
        btn,
      ),
    );
  });

  return el('div', 'empire-view subscreen-view',
    el('p', 'muted subscreen-intro', t.chooseSectorIntro),
    el('div', 'sector-launch-grid', ...cards),
  );
}

/** Pushed sub-screen (Level 3): Manage a single owned company (upgrade, strategy, +30% push, deep sim, sell). */
export function renderManageCompanyView(
  state: EmpireState,
  company: OwnedCompany,
  nowMs: number,
  locale: Locale,
  handlers: BusinessHandlers,
): HTMLElement {
  const t = empireText(locale);
  const def = getSectorDef(company.sector);
  const hourly = companyHourlyIncomeCents(company, nowMs, state.holdingMerged);
  const upgradeCost = companyUpgradeCostCents(company);
  const canUpgrade = company.level < 10 && state.balanceCents >= upgradeCost;
  const boostActive = nowMs < company.boostUntilMs;

  const hero = el('section', 'project-heading project-heading-art company-manage-hero',
    artThumb(def.art),
    el('span', 'media-pill', `${def.name[locale]} · ${t.level} ${company.level}/10`),
    el('h1', '', def.companyName[locale]),
    el('span', 'manage-hourly-hero', formatHourly(hourly, locale)),
  );

  const upBtn = action(
    company.level >= 10 ? t.maxLevel : `${t.upgradeCompany} ${company.level + 1} (${formatUsd(upgradeCost, true)})`,
    () => handlers.onUpgradeCompany(company.id),
    canUpgrade ? 'primary' : 'secondary',
  );
  upBtn.dataset.upgradeCompany = company.id;
  upBtn.disabled = !canUpgrade;

  const boostBtn = action(boostActive ? t.opsBoostActive : t.opsBoost, () => handlers.onBoostCompany(company.id), boostActive ? 'secondary' : 'primary');
  boostBtn.prepend(gameIcon('bolt'));
  boostBtn.dataset.boostCompany = company.id;
  boostBtn.disabled = boostActive;

  const strategyCards = def.strategies.map((strat) => {
    const active = company.strategyId === strat.id;
    const btn = el('button', `strategy-option ${active ? 'is-selected' : ''}`,
      el('div', 'panel-heading',
        el('strong', '', strat.title[locale]),
        el('span', 'badge', `+${Math.round((strat.incomeBps - 10_000) / 100)}%`),
      ),
      el('p', 'muted', strat.summary[locale]),
    );
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(active));
    btn.dataset.selectStrategy = strat.id;
    btn.addEventListener('click', () => handlers.onSetStrategy(company.id, strat.id));
    return btn;
  });

  const deepLink = def.deepSimulationHref ? (() => {
    const sep = def.deepSimulationHref.includes('?') ? '&' : '?';
    const a = el('a', 'button secondary industry-selection', t.deepSimBtn);
    a.href = `${def.deepSimulationHref}${sep}lang=${locale}`;
    a.dataset.openDeepSim = company.sector;
    return el('section', 'panel deep-sim-bridge',
      el('p', 'muted', t.deepSimHint),
      a,
    );
  })() : null;

  const sellBtn = action(t.sellCompany, () => handlers.onSellCompany(company.id), 'danger');
  sellBtn.dataset.sellCompany = company.id;

  return el('div', 'empire-view subscreen-view',
    hero,
    el('section', 'panel manage-actions-panel', upBtn, boostBtn),
    el('section', 'panel',
      el('h2', 'title-with-icon', gameIcon('gear'), t.strategyTitle),
      el('div', 'strategy-list', ...strategyCards),
    ),
    deepLink,
    el('div', 'sell-company-wrap', sellBtn),
  );
}
