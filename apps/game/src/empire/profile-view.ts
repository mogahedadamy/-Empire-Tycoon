/** Renders the Profile tab: Sovereign Dossier, Skill Capital, 6-Asset Wealth Bar, Next Forbes Rival, and Achievements Grid. */
import {
  computeForbesRank, computeWealth, FORBES_LIST, getTapTier, type EmpireState,
} from '../../../../packages/empire/src';
import { action, detailRows, el, type Locale } from '../../../../packages/ui/src';
import { gameIcon } from '../visuals/icons';
import { formatUsd, formatUsdExact, formatUsdParen } from './format';
import { empireText } from './text';
import {
  buildProgressBar, computeAchievements, computeWealthTier, findNextForbesRival,
} from './visuals';

export interface ProfileHandlers {
  onOpenForbes(): void;
  onToggleLanguage(): void;
  onResetEmpire(): void;
}

export function renderProfileTab(state: EmpireState, locale: Locale, handlers: ProfileHandlers): HTMLElement {
  const t = empireText(locale);
  const ar = locale === 'ar';
  const wealth = computeWealth(state);
  const rank = computeForbesRank(wealth.fortuneCents);
  const status = computeWealthTier(state, wealth.fortuneCents, locale);
  const tapTier = getTapTier(state.tapLevel);
  const nextRival = findNextForbesRival(wealth.fortuneCents, locale);
  const achievements = computeAchievements(state, wealth.fortuneCents, locale);

  // 1. Sovereign Identity & Status Dossier (celebrates Wealth Tier, Prestige, and Permanent Tap Skill Power)
  const dossier = el('section', 'bank-card dossier-card',
    el('div', 'panel-heading',
      el('span', 'bank-tier-pill', `${status.badge} · ${status.title}`),
      el('span', 'prestige-pill', `★ ${status.prestigeScore} ${ar ? 'نقطة هيبة' : 'Prestige'}`),
    ),
    el('div', 'bank-card-balance',
      el('span', 'bank-label', t.fortune),
      el('bdi', 'bank-balance', formatUsdExact(wealth.fortuneCents)),
    ),
    el('div', 'dossier-skill-strip',
      el('span', '', ar ? `قوة الصفقات المكتسبة: المستوى ${state.tapLevel}` : `Deal Power: Level ${state.tapLevel}`),
      el('bdi', 'wealth-val', `${formatUsdExact(tapTier.perTapCents)} ${t.perTap}`),
    ),
    status.nextThresholdCents ? el('div', 'dossier-next-tier',
      el('div', 'panel-heading',
        el('span', 'bank-foot-label', ar ? 'التقدم نحو المرتبة التالية' : 'Next Wealth Tier'),
        el('bdi', 'bank-foot-label wealth-val', formatUsd(status.nextThresholdCents, true)),
      ),
      buildProgressBar(status.progressPct, 'gold'),
    ) : null,
  );

  // 2. 6-Segment Wealth Breakdown
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
    el('strong', 'title-with-icon', gameIcon('profit'), t.wealthMix),
    bar,
    legend,
  );

  // 3. Forbes Banner + Next Rival Target
  const forbesCard = el('button', 'panel forbes-banner',
    el('div', 'forbes-banner-main',
      el('div', 'forbes-banner-left',
        gameIcon('trophy', 'forbes-icon'),
        el('div', '',
          el('strong', '', t.forbesTitle),
          el('span', 'muted small-meta', `${t.yourRank}: #${rank}`),
        ),
      ),
      el('span', 'badge forbes-rank-pill', `#${rank}`),
    ),
    nextRival ? el('div', 'forbes-rival-strip',
      el('span', 'small-meta', ar
        ? `المنافس القادم: ${nextRival.name} ${formatUsdParen(nextRival.fortuneCents)}`
        : `Next rival: ${nextRival.name} ${formatUsdParen(nextRival.fortuneCents)}`),
      buildProgressBar(nextRival.pct, 'gold'),
    ) : null,
  );
  forbesCard.type = 'button';
  forbesCard.dataset.openForbes = '';
  forbesCard.addEventListener('click', handlers.onOpenForbes);

  // 4. Empire Achievements Grid
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const achievementsPanel = el('section', 'panel achievements-card',
    el('div', 'panel-heading',
      el('h2', 'title-with-icon', gameIcon('star'), ar ? 'أوسمة الإمبراطورية' : 'Empire Milestones'),
      el('span', 'badge nowrap-badge', `${unlockedCount} / ${achievements.length}`),
    ),
    el('div', 'achievements-grid', ...achievements.map((ach) =>
      el('div', `achievement-tile ${ach.unlocked ? 'is-unlocked' : 'is-locked'}`,
        el('span', 'achievement-mark', ach.unlocked ? '★' : '☆'),
        el('div', '',
          el('strong', '', ach.title),
          el('span', 'muted small-meta', ach.detail),
        ),
      ),
    )),
  );

  // 5. Statistics panel
  const statsPanel = el('section', 'panel stats-card',
    el('h2', 'title-with-icon', gameIcon('ledger'), t.statsTitle),
    detailRows([
      [t.statTap, el('bdi', 'wealth-val', formatUsd(state.stats.tapEarnedCents, true))],
      [t.statBiz, el('bdi', 'wealth-val', formatUsd(state.stats.businessEarnedCents, true))],
      [t.statDiv, el('bdi', 'wealth-val', formatUsd(state.stats.dividendsEarnedCents, true))],
      [t.statRent, el('bdi', 'wealth-val', formatUsd(state.stats.rentEarnedCents, true))],
      [t.statTrade, el('bdi', 'wealth-val', formatUsd(state.stats.tradingProfitCents, true))],
      [t.statTotalTaps, el('bdi', '', String(state.stats.totalTaps))],
    ]),
  );

  // 6. Classic 45-Day Campaign & Playbook Bridge + Settings
  const bigOrderLink = el('a', 'button primary industry-selection', t.openBigOrder);
  bigOrderLink.href = `?mode=mission&lang=${locale}`;
  const playbookLink = el('a', 'button secondary industry-selection', t.openPlaybook);
  playbookLink.href = `?playbook=1&lang=${locale}`;
  const classicPanel = el('section', 'panel classic-bridge-card',
    el('h2', 'title-with-icon', gameIcon('contract'), t.classicModeTitle),
    el('p', 'muted', t.classicModeBody),
    el('div', 'actions panel-actions', bigOrderLink, playbookLink),
  );

  const langBtn = action(t.language, handlers.onToggleLanguage, 'language');
  langBtn.lang = locale === 'ar' ? 'en' : 'ar';
  const resetBtn = action(t.resetEmpire, handlers.onResetEmpire, 'secondary');
  resetBtn.dataset.resetEmpire = '';

  const settings = el('section', 'panel profile-settings',
    el('span', 'muted small-meta', `✓ ${t.savedLocally}`),
    el('div', 'actions', langBtn, resetBtn),
  );

  return el('div', 'empire-view profile-view', dossier, fortuneCard, forbesCard, achievementsPanel, statsPanel, classicPanel, settings);
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
