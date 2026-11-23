/** Renders the Sovereign Luxury Showroom with bespoke SVG illustrations, rarity tiers, prestige points, and non-wrapping counters. */
import { LUXURY_ITEMS_CATALOG, type EmpireState, type ItemCategory } from '../../../../packages/empire/src';
import { action, el, type Locale } from '../../../../packages/ui/src';
import { gameIcon } from '../visuals/icons';
import { formatUsd } from './format';
import { empireText } from './text';
import { buildLuxuryIllustration, buildProgressBar, itemRarityInfo } from './visuals';

export interface ItemsHandlers {
  onSelectCategory(cat: ItemCategory): void;
  onBuyItem(id: string): void;
}

export function renderItemsTab(
  state: EmpireState,
  activeCat: ItemCategory,
  locale: Locale,
  handlers: ItemsHandlers,
): HTMLElement {
  const t = empireText(locale);
  const ar = locale === 'ar';
  const ownedTotal = state.items.length;
  const totalCatalog = LUXURY_ITEMS_CATALOG.length;
  const completionPct = Math.round((ownedTotal / totalCatalog) * 100);

  const header = el('section', 'panel items-hero',
    el('div', 'panel-heading',
      el('h2', 'title-with-icon', gameIcon('trophy'), t.itemsTitle),
      el('span', 'badge nowrap-badge', `${ownedTotal} / ${totalCatalog}`),
    ),
    el('p', 'muted', t.itemsIntro),
    buildProgressBar(completionPct, 'gold'),
  );

  const cats: readonly [ItemCategory, string][] = [
    ['cars', t.catCars],
    ['aircraft', t.catAircraft],
    ['yachts', t.catYachts],
    ['collections', t.catCollections],
    ['residence', t.catResidence],
  ];

  const pills = el('div', 'filter-row', ...cats.map(([cat, label]) => {
    const inCat = LUXURY_ITEMS_CATALOG.filter((i) => i.category === cat);
    const ownedInCat = inCat.filter((i) => state.items.includes(i.id)).length;
    const btn = action(`${label} (${ownedInCat}/${inCat.length})`, () => handlers.onSelectCategory(cat),
      `filter-chip ${activeCat === cat ? 'is-active' : ''}`);
    btn.dataset.itemCat = cat;
    return btn;
  }));

  const cards = LUXURY_ITEMS_CATALOG.filter((item) => item.category === activeCat).map((item) => {
    const owned = state.items.includes(item.id);
    const canAfford = !owned && state.balanceCents >= item.priceCents;
    const rarity = itemRarityInfo(item.priceCents, locale);
    const artwork = buildLuxuryIllustration(item.category, rarity.tier);
    const pct = owned ? 100 : Math.min(100, Number((state.balanceCents * 100n) / item.priceCents));

    const btn = owned
      ? el('span', 'badge owned-pill', t.ownedBadge)
      : (() => {
        const b = action(`${t.buyItem} · \u2066${formatUsd(item.priceCents, true)}\u2069`, () => handlers.onBuyItem(item.id), canAfford ? 'primary' : 'secondary');
        b.disabled = !canAfford;
        b.dataset.buyItem = item.id;
        return b;
      })();

    return el('article', `panel luxury-item-card rarity-${rarity.tier} ${owned ? 'is-owned' : ''}`,
      el('div', 'luxury-showroom-banner',
        artwork,
        el('div', 'luxury-showroom-tags',
          el('span', `rarity-pill rarity-pill-${rarity.tier}`, rarity.label),
          el('span', 'prestige-pill', `★ \u2066+${rarity.prestige}\u2069 ${ar ? 'هيبة' : 'Prestige'}`),
        ),
      ),
      el('div', 'luxury-item-head',
        el('div', 'luxury-item-copy',
          el('strong', '', item.name[locale]),
          el('span', 'muted small-meta', item.detail[locale]),
        ),
        el('bdi', 'sector-cost-tag', formatUsd(item.priceCents, true)),
      ),
      buildProgressBar(pct, owned || canAfford ? 'gold' : 'emerald'),
      btn,
    );
  });

  return el('div', 'empire-view items-view', header, pills, el('div', 'invest-stack', ...cards));
}
