/** AAA visual generators: live SVG market sparklines, bespoke luxury showroom art, wealth tiers, and opportunity radar. */
import {
  BUSINESS_SECTORS, FORBES_LIST, getTapTier, LUXURY_ITEMS_CATALOG,
  quoteMarketPrice, REAL_ESTATE_CATALOG, STOCKS_CATALOG,
  type EmpireState, type ItemCategory,
} from '../../../../packages/empire/src';
import { el, type Locale } from '../../../../packages/ui/src';
import { svgEl } from '../visuals/svg';
import { formatUsd } from './format';

export interface WealthTierInfo {
  readonly index: number;
  readonly title: string;
  readonly badge: string;
  readonly nextThresholdCents: bigint | null;
  readonly progressPct: number;
  readonly prestigeScore: number;
}

const wealthTiers = [
  { minCents: 0n, ar: 'مستثمر ناشئ', en: 'Seed Hustler', badge: 'I' },
  { minCents: 250_000n, ar: 'مؤسس أعمال', en: 'Venture Founder', badge: 'II' },
  { minCents: 5_000_000n, ar: 'قطب الميناء', en: 'Harbor Baron', badge: 'III' },
  { minCents: 100_000_000n, ar: 'رئيس تكتل قابض', en: 'Holding Magnate', badge: 'IV' },
  { minCents: 10_000_000_000n, ar: 'إمبراطور السيادة', en: 'Sovereign Tycoon', badge: 'V' },
] as const;

export function computeWealthTier(state: EmpireState, fortuneCents: bigint, locale: Locale): WealthTierInfo {
  let idx = 0;
  for (let i = 0; i < wealthTiers.length; i += 1) {
    if (fortuneCents >= wealthTiers[i].minCents) idx = i;
  }
  const current = wealthTiers[idx];
  const next = wealthTiers[idx + 1] ?? null;
  const progressPct = next
    ? Math.min(100, Math.max(0, Number(((fortuneCents - current.minCents) * 100n) / (next.minCents - current.minCents))))
    : 100;
  const prestigeScore =
    state.tapLevel * 15 +
    state.companies.reduce((sum, c) => sum + c.level * 40, 0) +
    (state.holdingMerged ? 500 : 0) +
    state.properties.length * 65 +
    state.items.length * 120;
  return {
    index: idx + 1,
    title: locale === 'ar' ? current.ar : current.en,
    badge: current.badge,
    nextThresholdCents: next ? next.minCents : null,
    progressPct,
    prestigeScore,
  };
}

/** Builds a 12-point deterministic SVG area+line sparkline chart for a stock or digital asset. */
export function buildSparklineSvg(
  baseCents: bigint,
  volatilityBps: number,
  phase: number,
  currentTick: number,
  isUp: boolean,
): HTMLElement {
  const count = 12;
  const values: number[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const t = Math.max(0, currentTick - i);
    values.push(Number(quoteMarketPrice(baseCents, volatilityBps, phase, t)));
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const w = 132;
  const h = 38;
  const pts = values.map((v, idx) => {
    const x = Math.round((idx / (count - 1)) * (w - 8) + 4);
    const y = Math.round(h - 5 - ((v - min) / span) * (h - 10));
    return `${x},${y}`;
  });
  const stroke = isUp ? '#157a58' : '#b8332a';
  const fill = isUp ? 'rgba(21, 122, 88, 0.15)' : 'rgba(184, 51, 42, 0.14)';
  const lastPt = pts[pts.length - 1].split(',');
  const areaPoints = `4,${h - 2} ${pts.join(' ')} ${w - 4},${h - 2}`;

  return svgEl('svg', {
    class: 'market-sparkline',
    viewBox: `0 0 ${w} ${h}`,
    width: w,
    height: h,
    'aria-hidden': 'true',
    focusable: 'false',
  },
    svgEl('polygon', { points: areaPoints, fill }),
    svgEl('polyline', {
      points: pts.join(' '),
      fill: 'none',
      stroke,
      'stroke-width': 2.2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
    svgEl('circle', { cx: lastPt[0], cy: lastPt[1], r: 3, fill: stroke }),
  );
}

export function itemRarityInfo(priceCents: bigint, locale: Locale): { tier: 'rare' | 'sovereign' | 'mythic'; label: string; prestige: number } {
  if (priceCents >= 400_000_000n) {
    return { tier: 'mythic', label: locale === 'ar' ? 'أسطوري · Mythic' : 'Mythic Tier', prestige: 350 };
  }
  if (priceCents >= 60_000_000n) {
    return { tier: 'sovereign', label: locale === 'ar' ? 'ملكي · Sovereign' : 'Sovereign Tier', prestige: 180 };
  }
  return { tier: 'rare', label: locale === 'ar' ? 'نادر · Rare' : 'Rare Edition', prestige: 85 };
}

/** Builds a bespoke illustrated SVG showroom silhouette for each luxury category. */
export function buildLuxuryIllustration(category: ItemCategory, tier: 'rare' | 'sovereign' | 'mythic'): HTMLElement {
  const accent = tier === 'mythic' ? '#f3b659' : tier === 'sovereign' ? '#e5c883' : '#7ad1a8';
  const bg = tier === 'mythic' ? '#231626' : tier === 'sovereign' ? '#132436' : '#112b23';
  const shapes: HTMLElement[] = [
    svgEl('rect', { x: 0, y: 0, width: 120, height: 68, rx: 12, fill: bg }),
    svgEl('circle', { cx: 96, cy: 18, r: 18, fill: accent, opacity: 0.14 }),
  ];

  if (category === 'cars') {
    shapes.push(
      svgEl('path', { d: 'M14 46 L26 30 L56 26 L86 30 L106 40 L106 48 L14 48 Z', fill: accent, opacity: 0.25 }),
      svgEl('path', { d: 'M14 46 L28 31 L58 27 L84 31 L104 40 L104 47 L14 47 Z', fill: 'none', stroke: accent, 'stroke-width': 2.2 }),
      svgEl('circle', { cx: 32, cy: 48, r: 7, fill: '#0c1814', stroke: accent, 'stroke-width': 2.2 }),
      svgEl('circle', { cx: 86, cy: 48, r: 7, fill: '#0c1814', stroke: accent, 'stroke-width': 2.2 }),
    );
  } else if (category === 'aircraft') {
    shapes.push(
      svgEl('path', { d: 'M14 40 L52 34 L72 16 L80 16 L68 34 L104 31 L98 39 L66 41 L52 54 L44 54 L53 41 L18 44 Z', fill: accent, opacity: 0.85 }),
    );
  } else if (category === 'yachts') {
    shapes.push(
      svgEl('path', { d: 'M12 44 H106 L94 54 H22 Z', fill: accent }),
      svgEl('path', { d: 'M28 42 L38 28 H78 L88 42 Z', fill: 'none', stroke: accent, 'stroke-width': 2 }),
      svgEl('path', { d: 'M8 58 Q36 53 64 58 T112 58', fill: 'none', stroke: '#79b8c7', 'stroke-width': 1.8 }),
    );
  } else if (category === 'collections') {
    shapes.push(
      svgEl('rect', { x: 30, y: 14, width: 60, height: 40, rx: 6, fill: 'none', stroke: accent, 'stroke-width': 2.2 }),
      svgEl('circle', { cx: 60, cy: 34, r: 12, fill: accent, opacity: 0.3, stroke: accent, 'stroke-width': 1.8 }),
      svgEl('path', { d: 'M55 34 L59 38 L67 29', fill: 'none', stroke: accent, 'stroke-width': 2 }),
    );
  } else {
    shapes.push(
      svgEl('polygon', { points: '24,34 60,14 96,34', fill: accent, opacity: 0.35, stroke: accent, 'stroke-width': 2 }),
      svgEl('rect', { x: 32, y: 34, width: 56, height: 22, fill: 'none', stroke: accent, 'stroke-width': 2 }),
      svgEl('line', { x1: 50, y1: 34, x2: 50, y2: 56, stroke: accent, 'stroke-width': 1.8 }),
      svgEl('line', { x1: 70, y1: 34, x2: 70, y2: 56, stroke: accent, 'stroke-width': 1.8 }),
    );
  }

  return svgEl('svg', {
    class: 'showroom-art-svg',
    viewBox: '0 0 120 68',
    width: 120,
    height: 68,
    'aria-hidden': 'true',
    focusable: 'false',
  }, ...shapes);
}

export interface NextOpportunity {
  readonly title: string;
  readonly subtitle: string;
  readonly targetCents: bigint;
  readonly pct: number;
  readonly ready: boolean;
  readonly targetTab: 'investing' | 'business' | 'items';
}

/** Finds the most motivating next empire milestone based on the player's current balance & portfolio. */
export function computeNextOpportunity(state: EmpireState, locale: Locale): NextOpportunity {
  const ar = locale === 'ar';
  // 1. If player owns no companies yet, spotlight founding Sanabel Food Distribution ($2,500)
  if (state.companies.length === 0) {
    const food = BUSINESS_SECTORS[0];
    const pct = Math.min(100, Number((state.balanceCents * 100n) / food.startupCostCents));
    return {
      title: ar ? `هدف التأسيس الأول: ${food.companyName.ar}` : `First Venture: ${food.companyName.en}`,
      subtitle: ar
        ? `تمنحك دخلًا تلقائيًا \u2066+${formatUsd(food.baseHourlyCents, true)}\u2069 / ساعة`
        : `Streams +${formatUsd(food.baseHourlyCents, true)}/hr passive cashflow`,
      targetCents: food.startupCostCents,
      pct,
      ready: state.balanceCents >= food.startupCostCents,
      targetTab: 'business',
    };
  }
  // 2. If player owns no real estate yet, spotlight first harbor property ($8,000)
  if (state.properties.length === 0) {
    const prop = REAL_ESTATE_CATALOG[0];
    const pct = Math.min(100, Number((state.balanceCents * 100n) / prop.priceCents));
    return {
      title: ar ? `أول أصل عقاري: ${prop.name.ar}` : `First Property: ${prop.name.en}`,
      subtitle: ar
        ? `إيجار مضمون \u2066+${formatUsd(prop.hourlyRentCents, true)}\u2069 / ساعة`
        : `Guaranteed rent +${formatUsd(prop.hourlyRentCents, true)}/hr`,
      targetCents: prop.priceCents,
      pct,
      ready: state.balanceCents >= prop.priceCents,
      targetTab: 'investing',
    };
  }
  // 3. Next unowned business sector or luxury milestone
  const ownedSectors = new Set(state.companies.map((c) => c.sector));
  const nextSector = BUSINESS_SECTORS.find((s) => !ownedSectors.has(s.id)) ?? BUSINESS_SECTORS[BUSINESS_SECTORS.length - 1];
  const pct = Math.min(100, Number((state.balanceCents * 100n) / nextSector.startupCostCents));
  return {
    title: ar ? `التوسع القادم: ${nextSector.companyName.ar}` : `Next Expansion: ${nextSector.companyName.en}`,
    subtitle: ar
      ? `يرفع دخلك بـ \u2066+${formatUsd(nextSector.baseHourlyCents, true)}\u2069 / ساعة`
      : `Adds +${formatUsd(nextSector.baseHourlyCents, true)}/hr to your empire`,
    targetCents: nextSector.startupCostCents,
    pct,
    ready: state.balanceCents >= nextSector.startupCostCents,
    targetTab: 'business',
  };
}

export interface AchievementBadge {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly unlocked: boolean;
}

export function computeAchievements(state: EmpireState, fortuneCents: bigint, locale: Locale): readonly AchievementBadge[] {
  const ar = locale === 'ar';
  const hasStock = Object.values(state.stocks).some((s) => s.shares > 0);
  const boughtOut = STOCKS_CATALOG.some((s) => (state.stocks[s.id]?.shares ?? 0) >= s.totalShares);
  return [
    {
      id: 'first-upgrade',
      title: ar ? 'الشرارة الأولى' : 'First Spark',
      detail: ar ? 'ترقية مستوى النقر الأول \u2066($ 500)\u2069' : 'Unlock Level 2 Tap Power ($500)',
      unlocked: state.tapLevel >= 2 || fortuneCents >= 50_000n,
    },
    {
      id: 'first-company',
      title: ar ? 'مؤسس وادي المرسى' : 'Harbor Founder',
      detail: ar ? 'تأسيس أول شركة تشغيلية' : 'Launch your first operating company',
      unlocked: state.companies.length >= 1,
    },
    {
      id: 'market-player',
      title: ar ? 'مستثمر البورصة' : 'Exchange Investor',
      detail: ar ? 'امتلاك أسهم وعقار مدرّ للدخل' : 'Own dividend stocks & income property',
      unlocked: hasStock && state.properties.length >= 1,
    },
    {
      id: 'corporate-raider',
      title: ar ? 'الاستحواذ الكامل' : 'Corporate Buyout',
      detail: ar ? 'شراء 100% من أسهم شركة مدرجة' : 'Acquire 100% of a listed company',
      unlocked: boughtOut,
    },
    {
      id: 'holding-merger',
      title: ar ? 'التكتل القابض' : 'Holding Conglomerate',
      detail: ar ? 'دمج 3 شركات في مجموعة قابضة' : 'Execute the Empire Holding Merger',
      unlocked: state.holdingMerged,
    },
    {
      id: 'millionaire',
      title: ar ? 'نادي المليون دولار' : 'Million Dollar Club',
      detail: ar ? 'الوصول إلى ثروة $1,000,000' : 'Reach $1,000,000 Total Net Worth',
      unlocked: fortuneCents >= 100_000_000n,
    },
  ];
}

export function findNextForbesRival(fortuneCents: bigint, locale: Locale) {
  const sorted = [...FORBES_LIST].sort((a, b) => (a.fortuneCents > b.fortuneCents ? 1 : -1));
  const next = sorted.find((entry) => entry.fortuneCents > fortuneCents);
  if (!next) return null;
  const pct = Math.min(100, Number((fortuneCents * 100n) / next.fortuneCents));
  return {
    name: next.name[locale],
    industry: next.industry[locale],
    fortuneCents: next.fortuneCents,
    gapCents: next.fortuneCents - fortuneCents,
    pct,
  };
}

export function buildProgressBar(pct: number, tone: 'emerald' | 'gold' | 'blue' = 'emerald'): HTMLElement {
  const fill = el('span', `aaa-bar-fill aaa-bar-${tone}`);
  fill.setAttribute('style', `inline-size: ${Math.max(0, Math.min(100, pct))}%`);
  return el('div', 'aaa-bar', fill);
}

export function getNextTapPreview(tapLevel: number) {
  return getTapTier(tapLevel + 1);
}
