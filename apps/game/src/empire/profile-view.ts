/** Renders the Profile tab: Fortune Net Worth, 6-segment Wealth Bar, Forbes ranking, Stats, and Campaign bridge. */
import {
  computeForbesRank, computeWealth, FORBES_LIST, type EmpireState,
} from '../../../../packages/empire/src';
import { action, detailRows, el, type Locale } from '../../../../packages/ui/src';
import { gameIcon } from '../visuals/icons';
import { formatUsd, formatUsdExact } from './format';
import { empireText } from './text';

export interface ProfileHandlers {
  onOpenForbes(): void;
  onToggleLanguage(): void;
  onResetEmpire(): void;
}

export function renderProfileTab(state: EmpireState, locale: Locale, handlers: ProfileHandlers): HTMLElement {
  const t = empireText(locale);
  const wealth = computeWealth(state);
  const rank = computeForbesRank(wealth.fortuneCents);

  const buckets = [
    { key: 'cash', label: t.bucketCash, value: wealth.balanceCents, color: '#155d50' },
    { key: 'biz', label: t.bucketBiz, value: wealth.businessesCents, color: '#2259a8' },
    { key: 'stocks', label: t.bucketStocks, value: wealth.stocksCents, color: '#d49a38' },
    { key: 're', label: t.bucketRealEstate, value: wealth.realEstateCents, color: '#8f5a38' },
    { key: 'da', label: t.bucketDigital, value: wealth.digitalAssetsCents, color: '#6b4ba8' },
    { key: 'lux', label: t.bucketLuxury, value: wealth.luxuryCents, color: '#b4486b' },
  ];

  const totalForBar = wealth.fortuneCents > 0n ? wealth.fortuneCents : 1n;
  const bar = el('div', 'wealth-bar', ...buckets.map((b) => {
    const pct = wealth.fortuneCents > 0n ? Number((b.value * 1000n) / totalForBar) / 10 : 0;
    const seg = el('span', 'wealth-seg');
    seg.setAttribute('style', `inline-size: ${pct}%; background: ${b.color}`);
    return seg;
  }));

  const legend = el('div', 'wealth-legend', ...buckets.map((b) =>
    el('div', 'wealth-legend-item',
      el('span', 'wealth-dot', ''),
      el('span', 'muted', b.label),
      el('bdi', 'wealth-val', formatUsd(b.value, true)),
    ),
  ));
  buckets.forEach((b, idx) => {
    legend.children[idx]?.querySelector('.wealth-dot')?.setAttribute('style', `background: ${b.color}`);
  });

  const fortuneCard = el('section', 'panel fortune-card',
    el('span', 'muted', t.fortune),
    el('bdi', 'fortune-amount', formatUsdExact(wealth.fortuneCents)),
    el('span', 'muted small-meta', t.wealthMix),
    bar,
    legend,
  );
  fortuneCard.querySelector('.fortune-amount')?.setAttribute('dir', 'ltr');

  // Forbes rank button
  const forbesCard = el('button', 'panel forbes-banner',
    el('div', 'forbes-banner-left',
      gameIcon('trophy', 'forbes-icon'),
      el('div', '',
        el('strong', '', t.forbesTitle),
        el('span', 'muted small-meta', `${t.yourRank}: #${rank}`),
      ),
    ),
    el('span', 'badge forbes-rank-pill', `#${rank}`),
  );
  forbesCard.type = 'button';
  forbesCard.dataset.openForbes = '';
  forbesCard.addEventListener('click', handlers.onOpenForbes);

  // Statistics panel
  const statsPanel = el('section', 'panel stats-card',
    el('h2', 'title-with-icon', gameIcon('ledger'), t.statsTitle),
    detailRows([
      [t.statTap, el('bdi', '', formatUsd(state.stats.tapEarnedCents, true))],
      [t.statBiz, el('bdi', '', formatUsd(state.stats.businessEarnedCents, true))],
      [t.statDiv, el('bdi', '', formatUsd(state.stats.dividendsEarnedCents, true))],
      [t.statRent, el('bdi', '', formatUsd(state.stats.rentEarnedCents, true))],
      [t.statTrade, el('bdi', '', formatUsd(state.stats.tradingProfitCents, true))],
      [t.statTotalTaps, el('bdi', '', String(state.stats.totalTaps))],
    ]),
  );

  // Classic 45-Day Campaign & Playbook Bridge
  const bigOrderLink = el('a', 'button primary industry-selection', t.openBigOrder);
  bigOrderLink.href = `?mode=mission&lang=${locale}`;
  const playbookLink = el('a', 'button secondary industry-selection', t.openPlaybook);
  playbookLink.href = `?playbook=1&lang=${locale}`;
  const classicPanel = el('section', 'panel classic-bridge-card',
    el('h2', 'title-with-icon', gameIcon('contract'), t.classicModeTitle),
    el('p', 'muted', t.classicModeBody),
    el('div', 'actions panel-actions', bigOrderLink, playbookLink),
  );

  // Settings & auto-save footer
  const langBtn = action(t.language, handlers.onToggleLanguage, 'language');
  langBtn.lang = locale === 'ar' ? 'en' : 'ar';
  const resetBtn = action(t.resetEmpire, handlers.onResetEmpire, 'secondary');
  resetBtn.dataset.resetEmpire = '';

  const settings = el('section', 'panel profile-settings',
    el('span', 'muted small-meta', `✓ ${t.savedLocally}`),
    el('div', 'actions', langBtn, resetBtn),
  );

  return el('div', 'empire-view profile-view', fortuneCard, forbesCard, statsPanel, classicPanel, settings);
}

/** Pushed sub-screen (Level 3): Forbes World's Richest live leaderboard with player's live rank. */
export function renderForbesView(state: EmpireState, locale: Locale): HTMLElement {
  const t = empireText(locale);
  const wealth = computeWealth(state);
  const entries = [
    ...FORBES_LIST.map((f) => ({
      name: f.name[locale],
      industry: f.industry[locale],
      fortuneCents: f.fortuneCents,
      isPlayer: false,
    })),
    {
      name: t.youLabel,
      industry: `${state.companies.length} ${t.myCompanies}`,
      fortuneCents: wealth.fortuneCents,
      isPlayer: true,
    },
  ].sort((a, b) => (b.fortuneCents > a.fortuneCents ? 1 : b.fortuneCents < a.fortuneCents ? -1 : 0));

  const list = el('ol', 'forbes-list', ...entries.map((entry, idx) =>
    el('li', `panel forbes-row ${entry.isPlayer ? 'is-player' : ''}`,
      el('span', 'forbes-num', `#${idx + 1}`),
      el('div', 'forbes-row-copy',
        el('strong', '', entry.name),
        el('span', 'muted small-meta', entry.industry),
      ),
      el('bdi', 'forbes-val', formatUsd(entry.fortuneCents, true)),
    ),
  ));

  return el('div', 'empire-view subscreen-view', list);
}
