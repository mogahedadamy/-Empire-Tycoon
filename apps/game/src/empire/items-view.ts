/** Renders the Items luxury showroom with Zeigarnik completion counters and Fortune preservation. */
import { LUXURY_ITEMS_CATALOG, type EmpireState, type ItemCategory } from '../../../../packages/empire/src';
import { action, el, type Locale } from '../../../../packages/ui/src';
import { gameIcon, type GameIconName } from '../visuals/icons';
import { formatUsd } from './format';
import { empireText } from './text';

export interface ItemsHandlers {
  onSelectCategory(cat: ItemCategory): void;
  onBuyItem(id: string): void;
}

const categoryIcon: Record<ItemCategory, GameIconName> = {
  cars: 'truck',
  aircraft: 'bolt',
  yachts: 'shield',
  collections: 'star',
  residence: 'warehouse',
};

export function renderItemsTab(
  state: EmpireState,
  activeCat: ItemCategory,
  locale: Locale,
  handlers: ItemsHandlers,
): HTMLElement {
  const t = empireText(locale);
  const ownedTotal = state.items.length;
  const totalCatalog = LUXURY_ITEMS_CATALOG.length;

  const header = el('section', 'panel items-hero',
    el('div', 'panel-heading',
      el('h2', 'title-with-icon', gameIcon('trophy'), t.itemsTitle),
      el('span', 'badge', `${ownedTotal} / ${totalCatalog}`),
    ),
    el('p', 'muted', t.itemsIntro),
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
    const btn = owned
      ? el('span', 'badge owned-pill', t.ownedBadge)
      : (() => {
        const b = action(`${t.buyItem} · ${formatUsd(item.priceCents, true)}`, () => handlers.onBuyItem(item.id), canAfford ? 'primary' : 'secondary');
        b.disabled = !canAfford;
        b.dataset.buyItem = item.id;
        return b;
      })();

    return el('article', `panel luxury-item-card ${owned ? 'is-owned' : ''}`,
      el('div', 'luxury-item-head',
        el('span', 'luxury-emblem', gameIcon(categoryIcon[item.category])),
        el('div', 'luxury-item-copy',
          el('strong', '', item.name[locale]),
          el('span', 'muted small-meta', item.detail[locale]),
        ),
        el('bdi', 'sector-cost-tag', formatUsd(item.priceCents, true)),
      ),
      btn,
    );
  });

  return el('div', 'empire-view items-view', header, pills, el('div', 'invest-stack', ...cards));
}
