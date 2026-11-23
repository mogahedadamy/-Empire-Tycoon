/** Renders the Investing tab with live SVG sparklines, risk badges, dollar dividend previews, buyout bars, and real-estate payback. */
import {
  DIGITAL_ASSETS_CATALOG, propertyHourlyYieldBps, quoteDeltaBps, quoteMarketPrice,
  REAL_ESTATE_CATALOG, STOCKS_CATALOG, totalDividendsHourlyCents, totalRentHourlyCents,
  type EmpireState,
} from '../../../../packages/empire/src';
import { action, el, type Locale } from '../../../../packages/ui/src';
import { gameIcon } from '../visuals/icons';
import { formatHourly, formatPercentBps, formatUsd, formatUsdParen } from './format';
import { empireText } from './text';
import { buildProgressBar, buildSparklineSvg } from './visuals';

export type InvestingSubTab = 'shares' | 'real-estate' | 'digital';
export type DigitalFilter = 'hot' | 'gainers' | 'losers' | 'cap';

export interface InvestingViewState {
  subTab: InvestingSubTab;
  cheapFirst: boolean;
  digitalFilter: DigitalFilter;
}

export interface InvestingHandlers {
  onSubTab(tab: InvestingSubTab): void;
  onToggleRealEstateSort(): void;
  onDigitalFilter(filter: DigitalFilter): void;
  onBuyStock(id: string, qty: number): void;
  onSellStockAll(id: string): void;
  onBuyRealEstate(id: string): void;
  onBuyDigital(id: string, cents: bigint): void;
  onSellDigitalAll(id: string): void;
}

function riskBadge(volatilityBps: number, locale: Locale): HTMLElement {
  const ar = locale === 'ar';
  if (volatilityBps >= 750) {
    return el('span', 'risk-pill risk-high', ar ? 'مخاطرة عالية' : 'High Risk');
  }
  if (volatilityBps >= 500) {
    return el('span', 'risk-pill risk-med', ar ? 'مخاطرة متوسطة' : 'Med Risk');
  }
  return el('span', 'risk-pill risk-low', ar ? 'مخاطرة منخفضة' : 'Low Risk');
}

export function renderInvestingTab(
  state: EmpireState,
  ui: InvestingViewState,
  locale: Locale,
  handlers: InvestingHandlers,
): HTMLElement {
  const t = empireText(locale);
  const segments = el('div', 'segmented-tabs', ...([
    ['shares', t.subShares],
    ['real-estate', t.subRealEstate],
    ['digital', t.subDigital],
  ] as const).map(([key, label]) => {
    const btn = action(label, () => handlers.onSubTab(key), `seg-btn ${ui.subTab === key ? 'is-active' : ''}`);
    btn.setAttribute('aria-pressed', String(ui.subTab === key));
    btn.dataset.investSub = key;
    return btn;
  }));

  let body: HTMLElement;
  if (ui.subTab === 'shares') body = renderShares(state, locale, handlers);
  else if (ui.subTab === 'real-estate') body = renderRealEstate(state, ui.cheapFirst, locale, handlers);
  else body = renderDigitalAssets(state, ui.digitalFilter, locale, handlers);

  return el('div', 'empire-view investing-view', segments, body);
}

function renderShares(state: EmpireState, locale: Locale, handlers: InvestingHandlers): HTMLElement {
  const t = empireText(locale);
  const ar = locale === 'ar';
  const boughtOut = STOCKS_CATALOG.filter((s) => (state.stocks[s.id]?.shares ?? 0) >= s.totalShares).length;
  const divHourly = totalDividendsHourlyCents(state);

  const summary = el('section', 'panel invest-summary-card',
    el('div', 'panel-heading',
      el('strong', 'title-with-icon', gameIcon('profit'), t.sharesSummary),
      el('span', 'badge nowrap-badge', `${t.boughtOut}: ${boughtOut}/${STOCKS_CATALOG.length}`),
    ),
    el('span', 'invest-big-metric', formatHourly(divHourly, locale, true)),
  );

  const rows = STOCKS_CATALOG.map((stock) => {
    const price = quoteMarketPrice(stock.basePriceCents, stock.volatilityBps, stock.phase, state.marketTick);
    const delta = quoteDeltaBps(stock.basePriceCents, stock.volatilityBps, stock.phase, state.marketTick);
    const divPerShareCents = (price * BigInt(stock.dividendBpsPerHour)) / 10_000n;
    const owned = state.stocks[stock.id]?.shares ?? 0;
    const rem = stock.totalShares - owned;
    const ownershipPct = Math.round((owned / stock.totalShares) * 100);
    const can1 = rem >= 1 && state.balanceCents >= price;
    const can10 = rem >= 10 && state.balanceCents >= price * 10n;
    const sparkline = buildSparklineSvg(stock.basePriceCents, stock.volatilityBps, stock.phase, state.marketTick, delta >= 0);

    const b1Label = `${t.buy1} ${formatUsdParen(price)}`;
    const b1 = action(b1Label, () => handlers.onBuyStock(stock.id, 1), can1 ? 'primary' : 'secondary');
    b1.disabled = !can1;
    b1.dataset.buyStock = stock.id;
    const b10 = action(`${t.buy10} ${formatUsdParen(price * 10n)}`, () => handlers.onBuyStock(stock.id, 10), can10 ? 'primary' : 'secondary');
    b10.disabled = !can10;
    const sell = owned > 0 ? action(`${t.sellAll} (${owned})`, () => handlers.onSellStockAll(stock.id), 'secondary') : null;

    return el('article', 'panel market-row-card',
      el('div', 'market-row-top',
        el('div', 'market-id',
          el('span', 'ticker-pill', stock.ticker),
          el('div', '',
            el('strong', '', stock.name[locale]),
            el('div', 'stock-badges-row',
              el('span', 'muted small-meta', stock.sector[locale]),
              riskBadge(stock.volatilityBps, locale),
            ),
          ),
        ),
        el('div', 'market-price-col',
          el('bdi', 'market-price', formatUsd(price)),
          el('span', `delta-pill ${delta >= 0 ? 'is-up' : 'is-down'}`, `${delta >= 0 ? '▲' : '▼'} ${formatPercentBps(delta)}`),
        ),
      ),
      el('div', 'market-chart-row',
        sparkline,
        el('div', 'market-yield-box',
          el('span', 'yield-cash-pill', ar ? `توزيع السهم: ${formatHourly(divPerShareCents, locale, true)}` : `Div: ${formatHourly(divPerShareCents, locale, true)}`),
          el('span', 'muted small-meta', `${t.dividendYield}: \u2066${(stock.dividendBpsPerHour / 100).toFixed(2)}%\u2069`),
        ),
      ),
      el('div', 'ownership-track',
        el('div', 'panel-heading',
          el('span', 'muted small-meta', `${t.ownedShares}: \u2066${owned}/${stock.totalShares}\u2069`),
          el('span', 'small-meta', `${ownershipPct}%`),
        ),
        buildProgressBar(ownershipPct, ownershipPct >= 100 ? 'gold' : 'emerald'),
      ),
      el('div', 'market-actions', b1, b10, sell),
    );
  });

  return el('div', 'invest-stack', summary, ...rows);
}

function renderRealEstate(state: EmpireState, cheapFirst: boolean, locale: Locale, handlers: InvestingHandlers): HTMLElement {
  const t = empireText(locale);
  const ar = locale === 'ar';
  const rentHourly = totalRentHourlyCents(state);
  const sortBtn = action(cheapFirst ? t.sortCheap : t.sortExpensive, handlers.onToggleRealEstateSort, 'secondary sort-pill');
  sortBtn.dataset.sortRealEstate = '';

  const summary = el('section', 'panel invest-summary-card',
    el('div', 'panel-heading',
      el('strong', 'title-with-icon', gameIcon('warehouse'), t.realEstateSummary),
      el('span', 'badge nowrap-badge', `${t.ownedCount}: ${state.properties.length}/${REAL_ESTATE_CATALOG.length}`),
    ),
    el('div', 'panel-heading',
      el('span', 'invest-big-metric', formatHourly(rentHourly, locale, true)),
      sortBtn,
    ),
  );

  const sorted = [...REAL_ESTATE_CATALOG].sort((a, b) =>
    cheapFirst ? Number(a.priceCents - b.priceCents) : Number(b.priceCents - a.priceCents),
  );

  const cards = sorted.map((prop) => {
    const owned = state.properties.includes(prop.id);
    const canAfford = !owned && state.balanceCents >= prop.priceCents;
    const roiBps = propertyHourlyYieldBps(prop);
    const paybackHours = Math.max(1, Math.round(Number(prop.priceCents) / Math.max(1, Number(prop.hourlyRentCents))));
    const img = el('img', 'biz-art');
    img.src = `${import.meta.env.BASE_URL}${prop.art}`;
    img.alt = '';
    img.width = 560;
    img.height = 373;

    const btn = owned
      ? el('span', 'badge owned-pill', t.ownedBadge)
      : (() => {
        const b = action(`${t.buyProperty} · \u2066${formatUsd(prop.priceCents, true)}\u2069`, () => handlers.onBuyRealEstate(prop.id), canAfford ? 'primary' : 'secondary');
        b.disabled = !canAfford;
        b.dataset.buyProperty = prop.id;
        return b;
      })();

    return el('article', 'panel property-card',
      el('div', 'sector-launch-media',
        img,
        el('span', 'media-pill media-pill-active', `${t.rentPerHour}: \u2066+${formatUsd(prop.hourlyRentCents, true)}\u2069`),
      ),
      el('div', 'sector-launch-body',
        el('div', 'panel-heading',
          el('strong', '', prop.name[locale]),
          el('span', 'roi-pill', `${t.roiLabel} \u2066${(roiBps / 100).toFixed(2)}%\u2069`),
        ),
        el('span', 'muted small-meta', `${prop.location[locale]} · ${ar ? `استرداد السعر ~${paybackHours} ساعة` : `Payback ~${paybackHours}h`}`),
        btn,
      ),
    );
  });

  return el('div', 'invest-stack', summary, el('div', 'sector-launch-grid', ...cards));
}

function renderDigitalAssets(state: EmpireState, filter: DigitalFilter, locale: Locale, handlers: InvestingHandlers): HTMLElement {
  const t = empireText(locale);
  const filters = el('div', 'filter-row', ...([
    ['hot', t.filterHot],
    ['gainers', t.filterGainers],
    ['losers', t.filterLosers],
    ['cap', t.filterCap],
  ] as const).map(([key, label]) => {
    const btn = action(label, () => handlers.onDigitalFilter(key), `filter-chip ${filter === key ? 'is-active' : ''}`);
    btn.dataset.digitalFilter = key;
    return btn;
  }));

  const rowsData = DIGITAL_ASSETS_CATALOG.map((asset) => ({
    asset,
    price: quoteMarketPrice(asset.basePriceCents, asset.volatilityBps, asset.phase, state.marketTick),
    delta: quoteDeltaBps(asset.basePriceCents, asset.volatilityBps, asset.phase, state.marketTick),
  }));
  if (filter === 'gainers') rowsData.sort((a, b) => b.delta - a.delta);
  else if (filter === 'losers') rowsData.sort((a, b) => a.delta - b.delta);
  else if (filter === 'cap') rowsData.sort((a, b) => b.asset.marketCapBillions - a.asset.marketCapBillions);

  const cards = rowsData.map(({ asset, price, delta }) => {
    const holding = state.digitalAssets[asset.id];
    const valueCents = holding ? (price * holding.unitsMilli) / 1_000n : 0n;
    const quarterSpend = state.balanceCents / 4n;
    const sparkline = buildSparklineSvg(asset.basePriceCents, asset.volatilityBps, asset.phase, state.marketTick, delta >= 0);

    const b100 = action(t.buy100, () => handlers.onBuyDigital(asset.id, 10_000n), state.balanceCents >= 10_000n ? 'primary' : 'secondary');
    b100.disabled = state.balanceCents < 10_000n;
    b100.dataset.buyDigital = asset.id;
    const bQ = action(t.buyQuarter, () => handlers.onBuyDigital(asset.id, quarterSpend), quarterSpend >= 10_000n ? 'primary' : 'secondary');
    bQ.disabled = quarterSpend < 10_000n;
    const sell = holding ? action(`${t.sellAll} ${formatUsdParen(valueCents)}`, () => handlers.onSellDigitalAll(asset.id), 'secondary') : null;

    return el('article', 'panel market-row-card',
      el('div', 'market-row-top',
        el('div', 'market-id',
          el('span', 'ticker-pill ticker-digital', asset.symbol),
          el('div', '',
            el('strong', '', asset.name[locale]),
            el('div', 'stock-badges-row',
              el('span', 'muted small-meta', `Cap $${asset.marketCapBillions}B`),
              riskBadge(asset.volatilityBps, locale),
            ),
          ),
        ),
        el('div', 'market-price-col',
          el('bdi', 'market-price', formatUsd(price)),
          el('span', `delta-pill ${delta >= 0 ? 'is-up' : 'is-down'}`, `${delta >= 0 ? '▲' : '▼'} ${formatPercentBps(delta)}`),
        ),
      ),
      el('div', 'market-chart-row',
        sparkline,
        holding
          ? el('span', 'yield-cash-pill', `${t.holdingValue}: \u2066${formatUsd(valueCents)}\u2069`)
          : el('span', 'muted small-meta', locale === 'ar' ? 'تداول فوري على مدار الساعة' : '24/7 Spot Liquidity'),
      ),
      el('div', 'market-actions', b100, bQ, sell),
    );
  });

  return el('div', 'invest-stack',
    el('section', 'panel invest-summary-card', el('strong', 'title-with-icon', gameIcon('bolt'), t.digitalSummary), filters),
    ...cards,
  );
}
