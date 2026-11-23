/** Renders the center Earnings tab: Neo-Bank USD card, $1-base tap pad, $500+ upgrade bar, and focus sprint. */
import {
  getTapTier, tapValueCents, totalHourlyIncomeCents, type EmpireState,
} from '../../../../packages/empire/src';
import { action, el, type Locale } from '../../../../packages/ui/src';
import { gameIcon } from '../visuals/icons';
import { formatHourly, formatUsd, formatUsdExact } from './format';
import { empireText } from './text';

export interface EarningsHandlers {
  onTap(event: MouseEvent): void;
  onUpgradeTap(): void;
  onActivateBoost(): void;
}

export function renderEarningsTab(state: EmpireState, nowMs: number, locale: Locale, handlers: EarningsHandlers): HTMLElement {
  const t = empireText(locale);
  const tier = getTapTier(state.tapLevel);
  const nextTier = tier.upgradeCostCents !== null ? getTapTier(state.tapLevel + 1) : null;
  const tapVal = tapValueCents(state, nowMs);
  const hourly = totalHourlyIncomeCents(state, nowMs);
  const upgradeCost = tier.upgradeCostCents;
  const pct = upgradeCost ? Math.min(100, Number((state.balanceCents * 100n) / upgradeCost)) : 100;
  const canUpgrade = upgradeCost !== null && state.balanceCents >= upgradeCost;

  const balanceEl = el('bdi', 'bank-balance', formatUsdExact(state.balanceCents));
  balanceEl.dir = 'ltr';
  balanceEl.dataset.liveBalance = 'exact';

  const hourlyEl = el('span', 'bank-hourly-val', formatHourly(hourly, locale));
  hourlyEl.dataset.liveHourly = '';

  const tapValBdi = el('bdi', '', formatUsdExact(tapVal));
  tapValBdi.dir = 'ltr';
  const card = el('section', 'bank-card',
    el('div', 'bank-card-top',
      el('span', 'bank-chip', ''),
      el('span', 'bank-brand', t.bankName),
      el('span', 'bank-digits', el('bdi', '', `•••• ${state.cardLast4}`)),
    ),
    el('div', 'bank-card-balance',
      el('span', 'bank-label', t.balance),
      balanceEl,
    ),
    el('div', 'bank-card-foot',
      el('div', 'bank-foot-metric',
        el('span', 'bank-foot-label', t.perHour),
        hourlyEl,
      ),
      el('div', 'bank-foot-pill',
        gameIcon('coins'),
        tapValBdi,
        el('span', '', ` ${t.perTap}`),
      ),
    ),
  );

  // Boost / Focus Sprint ribbon attached under card (non-ad strategic sprint)
  const boostActive = nowMs < state.tapBoostUntilMs;
  const boostCooling = !boostActive && nowMs < state.tapBoostCooldownUntilMs;
  const boostLeft = boostActive
    ? Math.ceil((state.tapBoostUntilMs - nowMs) / 1000)
    : boostCooling ? Math.ceil((state.tapBoostCooldownUntilMs - nowMs) / 1000) : 0;
  const boostLabel = boostActive
    ? `${t.boostActive} ${boostLeft}${t.seconds}`
    : boostCooling
      ? `${t.boostCooldown} ${boostLeft}${t.seconds}`
      : t.boostReady;
  const boostBtn = action(boostLabel, handlers.onActivateBoost, `sprint-ribbon ${boostActive ? 'is-active' : ''}`);
  boostBtn.prepend(gameIcon('bolt'));
  boostBtn.dataset.tapBoost = '';
  boostBtn.disabled = boostActive || boostCooling;

  // Tap progress bar & upgrade button ($500 first milestone -> multiplying tap levels)
  const fill = el('div', 'upgrade-bar-fill');
  fill.setAttribute('style', `inline-size: ${pct}%`);
  fill.dataset.liveProgressFill = '';

  const targetLabel = el('bdi', 'upgrade-target', upgradeCost !== null ? formatUsd(upgradeCost) : t.maxLevel);
  targetLabel.dir = 'ltr';

  const upgradeBtnText = upgradeCost !== null && nextTier
    ? `${t.upgradeTap} · \u2066${formatUsd(upgradeCost)}\u2069 → \u2066${formatUsd(nextTier.perTapCents)}\u2069`
    : t.maxLevel;
  const upgradeBtn = action(upgradeBtnText, handlers.onUpgradeTap, `upgrade-tap-btn ${canUpgrade ? 'primary' : 'secondary'}`);
  upgradeBtn.dataset.upgradeTap = '';
  upgradeBtn.disabled = !canUpgrade;

  const progressBox = el('section', 'panel tap-progress-card',
    el('div', 'tap-progress-head',
      el('span', 'tap-level-badge', `${t.level} ${state.tapLevel}`),
      el('span', 'tap-progress-meta',
        el('span', 'live-pct', `${pct}%`),
        ' · ',
        targetLabel,
      ),
    ),
    el('div', 'upgrade-bar', fill),
    upgradeBtn,
  );
  progressBox.querySelector('.live-pct')?.setAttribute('data-live-progress-pct', '');

  // Large interactive Tap Arena
  const gainBdi = el('bdi', 'tap-arena-gain', `+${formatUsdExact(tapVal)}`);
  gainBdi.dir = 'ltr';
  const tapBtn = el('button', 'tap-arena',
    el('span', 'tap-arena-ring',
      el('span', 'tap-arena-dollar', '$'),
    ),
    el('strong', 'tap-arena-title', t.tapPrompt),
    el('span', 'tap-arena-sub',
      gainBdi,
      ' · ',
      t.tapHint,
    ),
  );
  tapBtn.type = 'button';
  tapBtn.dataset.tapEarn = '';
  tapBtn.addEventListener('click', handlers.onTap);

  const stage = el('div', 'tap-stage', tapBtn);
  stage.dataset.tapStage = '';

  return el('div', 'empire-view earnings-view', card, boostBtn, progressBox, stage);
}

/** Updates live balance, progress bar, and upgrade button state in-place without tearing down the tap pad. */
export function patchEarningsLive(root: HTMLElement, state: EmpireState, nowMs: number, locale: Locale) {
  const tier = getTapTier(state.tapLevel);
  const upgradeCost = tier.upgradeCostCents;
  const pct = upgradeCost ? Math.min(100, Number((state.balanceCents * 100n) / upgradeCost)) : 100;
  const canUpgrade = upgradeCost !== null && state.balanceCents >= upgradeCost;
  const hourly = totalHourlyIncomeCents(state, nowMs);

  for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-live-balance="exact"]'))) {
    node.textContent = formatUsdExact(state.balanceCents);
  }
  for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-live-balance="compact"]'))) {
    node.textContent = formatUsd(state.balanceCents, true);
  }
  for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-live-hourly]'))) {
    node.textContent = formatHourly(hourly, locale);
  }
  const fill = root.querySelector<HTMLElement>('[data-live-progress-fill]');
  if (fill) fill.style.inlineSize = `${pct}%`;
  const pctNode = root.querySelector<HTMLElement>('[data-live-progress-pct]');
  if (pctNode) pctNode.textContent = `${pct}%`;
  const upBtn = root.querySelector<HTMLButtonElement>('[data-upgrade-tap]');
  if (upBtn) {
    upBtn.disabled = !canUpgrade;
    upBtn.classList.toggle('primary', canUpgrade);
    upBtn.classList.toggle('secondary', !canUpgrade);
  }
}
