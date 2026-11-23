/** Renders a live illustrated SVG supply-and-delivery route diorama driven by game state. */
import { el, type Locale } from '../../../../packages/ui/src';
import { svgEl } from './svg';

export interface RouteBoardState {
  readonly locale: Locale;
  readonly founded: boolean;
  readonly contractSigned: boolean;
  readonly supplyOrdered: boolean;
  readonly stockOnHand: number;
  readonly stockCapacity: number;
  readonly delivered: number;
  readonly goal: number;
  readonly invoicesCount: number;
  readonly activeLeg: 'found' | 'contract' | 'supply' | 'warehouse' | 'shipping' | 'done';
  readonly dark?: boolean;
}

const labels = {
  ar: { farm: 'المزرعة', depot: 'مستودعك', market: 'السوق', crates: 'صندوق' },
  en: { farm: 'Farm', depot: 'Your Depot', market: 'Market', crates: 'cases' },
} as const;

function cratePile(x: number, y: number, count: number, color: string) {
  const g = svgEl('g', {});
  const capped = Math.max(0, Math.min(6, count));
  for (let i = 0; i < capped; i += 1) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    g.append(svgEl('rect', {
      x: x + col * 11,
      y: y - row * 9,
      width: 9,
      height: 7.5,
      rx: 1.5,
      fill: color,
      stroke: '#3c2a14',
      'stroke-width': 1,
    }));
  }
  return g;
}

function truckSprite(x: number, y: number, active: boolean) {
  return svgEl('g', { transform: `translate(${x}, ${y})` },
    svgEl('g', { class: active ? 'route-truck route-truck-moving' : 'route-truck' },
      svgEl('rect', { x: 0, y: 0, width: 24, height: 14, rx: 2.5, fill: '#fff8e9', stroke: '#17382c', 'stroke-width': 1.5 }),
      svgEl('rect', { x: 3, y: 4, width: 17, height: 3.5, rx: 1, fill: '#196455' }),
      svgEl('path', { d: 'M24 4h7l4 4v6h-11z', fill: '#edc583', stroke: '#17382c', 'stroke-width': 1.5 }),
      svgEl('circle', { cx: 7, cy: 15, r: 3.2, fill: '#142528' }),
      svgEl('circle', { cx: 28, cy: 15, r: 3.2, fill: '#142528' }),
    ),
  );
}

/** Builds a decorative, state-reactive supply chain board with crisp visual feedback. */
export function buildRouteBoard(state: RouteBoardState): HTMLElement {
  const l = labels[state.locale];
  const stockPiles = Math.ceil((Math.min(state.stockOnHand, state.stockCapacity) / Math.max(1, state.stockCapacity)) * 6);
  const marketPiles = Math.ceil((Math.min(state.delivered, state.goal) / Math.max(1, state.goal)) * 6);
  const supplyActive = state.activeLeg === 'supply';
  const shipActive = state.activeLeg === 'shipping' || state.activeLeg === 'warehouse';
  const leftTrackColor = state.supplyOrdered || state.stockOnHand > 0 ? '#edc583' : '#4a685b';
  const rightTrackColor = state.delivered > 0 || state.activeLeg === 'shipping' ? '#79c293' : '#4a685b';

  const truckX = state.activeLeg === 'supply'
    ? 92
    : state.activeLeg === 'warehouse'
      ? 186
      : state.activeLeg === 'shipping'
        ? (state.delivered > 0 ? 276 : 232)
        : state.activeLeg === 'done'
          ? 304
          : 156;

  const board = svgEl('svg', {
    class: 'route-board-svg',
    viewBox: '0 0 420 118',
    role: 'img',
    'aria-hidden': 'true',
    focusable: 'false',
  },
    // Sea & sky strip
    svgEl('rect', { x: 0, y: 0, width: 420, height: 118, rx: 14, fill: state.dark ? '#0f231c' : '#15342a' }),
    svgEl('path', { d: 'M0 78 Q105 68 210 78 T420 74 L420 118 L0 118 Z', fill: '#1a4236' }),
    svgEl('circle', { cx: 368, cy: 22, r: 12, fill: '#f3cb84', opacity: 0.25 }),
    // Coastal road paths
    svgEl('path', {
      d: 'M74 72 C112 72, 134 54, 178 68',
      fill: 'none',
      stroke: leftTrackColor,
      'stroke-width': 3.5,
      'stroke-dasharray': supplyActive ? '7 5' : 'none',
      class: supplyActive ? 'route-dash-animated' : '',
    }),
    svgEl('path', {
      d: 'M242 68 C278 54, 304 72, 344 72',
      fill: 'none',
      stroke: rightTrackColor,
      'stroke-width': 3.5,
      'stroke-dasharray': shipActive ? '7 5' : 'none',
      class: shipActive ? 'route-dash-animated' : '',
    }),
    // Node 1: Supplier Farm
    svgEl('g', { class: state.activeLeg === 'supply' ? 'route-node route-node-hot' : 'route-node' },
      svgEl('rect', { x: 18, y: 36, width: 58, height: 42, rx: 8, fill: '#224c3e', stroke: state.supplyOrdered ? '#edc583' : '#4a6d5f', 'stroke-width': 1.8 }),
      svgEl('polygon', { points: '14,42 47,20 80,42', fill: '#b87643' }),
      svgEl('rect', { x: 37, y: 54, width: 20, height: 24, rx: 2, fill: '#142d24' }),
      cratePile(22, 69, state.supplyOrdered ? 2 : 5, '#d89b52'),
    ),
    // Node 2: Player Warehouse
    svgEl('g', { class: state.activeLeg === 'found' || state.activeLeg === 'warehouse' ? 'route-node route-node-hot' : 'route-node' },
      svgEl('rect', { x: 170, y: 28, width: 80, height: 50, rx: 9, fill: state.founded ? '#265947' : '#1d3b31', stroke: state.founded ? '#edc583' : '#58786a', 'stroke-width': 2 }),
      svgEl('path', { d: 'M166 34h88l-8-14h-72z', fill: '#14382c', stroke: '#c9a66b', 'stroke-width': 1.3 }),
      svgEl('rect', { x: 184, y: 48, width: 52, height: 30, rx: 3, fill: '#112921' }),
      cratePile(192, 68, stockPiles, '#e3b261'),
    ),
    // Node 3: Customer Market
    svgEl('g', { class: state.activeLeg === 'contract' || state.activeLeg === 'done' ? 'route-node route-node-hot' : 'route-node' },
      svgEl('rect', { x: 342, y: 34, width: 60, height: 44, rx: 8, fill: '#224c3e', stroke: state.contractSigned ? '#83c798' : '#edc583', 'stroke-width': 1.8 }),
      svgEl('path', { d: 'M338 38h68l-6-12h-56z', fill: '#2c6857' }),
      svgEl('rect', { x: 354, y: 52, width: 36, height: 26, rx: 3, fill: '#132d25' }),
      cratePile(357, 68, marketPiles, '#83c798'),
      state.invoicesCount > 0
        ? svgEl('circle', { cx: 396, cy: 32, r: 9, fill: '#edc583', stroke: '#102b25', 'stroke-width': 1.5 })
        : null,
    ),
    // Animated delivery truck on route
    state.founded ? truckSprite(truckX, 57, supplyActive || shipActive) : null,
  );

  const fmt = new Intl.NumberFormat(state.locale === 'ar' ? 'ar-EG' : 'en-US');
  const legend = el('div', 'route-board-legend',
    el('span', '', l.farm),
    el('span', 'route-legend-center', `${l.depot} (`, el('bdi', '', fmt.format(state.stockOnHand)), ')'),
    el('span', '', `${l.market} (`, el('bdi', '', `${fmt.format(state.delivered)}/${fmt.format(state.goal)}`), ')'),
  );

  return el('div', `route-board ${state.dark ? 'route-board-dark' : ''}`, board, legend);
}
