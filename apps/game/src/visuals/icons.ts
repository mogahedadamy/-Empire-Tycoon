/** Provides crisp, decorative inline SVG game icons for HUDs, navigation, and decision cards. */
import { svgEl } from './svg';

export type GameIconName =
  | 'overview'
  | 'warehouse'
  | 'contract'
  | 'ledger'
  | 'coins'
  | 'invoice'
  | 'profit'
  | 'crate'
  | 'truck'
  | 'shield'
  | 'bank'
  | 'bolt'
  | 'clock'
  | 'star'
  | 'trophy'
  | 'alert'
  | 'worker'
  | 'gear';

const paths: Record<GameIconName, string[]> = {
  overview: [
    'M4 13a8 8 0 1 1 16 0v5H4z',
    'M12 13l4-4',
    'M9 18h6',
  ],
  warehouse: [
    'M3 10l9-6 9 6v10H3z',
    'M8 20v-7h8v7',
    'M8 16h8',
  ],
  contract: [
    'M6 3h9l4 4v14H6z',
    'M15 3v4h4',
    'M9 11h6',
    'M9 15h4',
    'M14 17l2 2 3-3',
  ],
  ledger: [
    'M4 5h16v14H4z',
    'M9 5v14',
    'M12 9h5',
    'M12 13h5',
    'M6.5 9h0.5',
    'M6.5 13h0.5',
  ],
  coins: [
    'M12 5c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z',
    'M4 8v4c0 1.7 3.6 3 8 3s8-1.3 8-3V8',
    'M4 12v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4',
  ],
  invoice: [
    'M6 3h12v18l-3-2-3 2-3-2-3 2z',
    'M9 8h6',
    'M9 12h6',
    'M9 16h3',
  ],
  profit: [
    'M4 18h16',
    'M6 15l4-4 3 2 5-6',
    'M15 7h3v3',
  ],
  crate: [
    'M4 7l8-4 8 4v10l-8 4-8-4z',
    'M4 7l8 4 8-4',
    'M12 11v10',
  ],
  truck: [
    'M2 7h12v9H2z',
    'M14 10h4l3 3v3h-7z',
    'M6 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M17 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  shield: [
    'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z',
    'M9.5 12l1.8 1.8 3.5-3.8',
  ],
  bank: [
    'M3 9l9-5 9 5z',
    'M5 9v8',
    'M10 9v8',
    'M14 9v8',
    'M19 9v8',
    'M3 20h18',
  ],
  bolt: [
    'M13 2L5 13h6l-1 9 9-12h-6z',
  ],
  clock: [
    'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
    'M12 8v4l3 2',
  ],
  star: [
    'M12 3l2.6 5.4 6 .8-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.3-4.2 6-.8z',
  ],
  trophy: [
    'M7 4h10v5a5 5 0 0 1-10 0z',
    'M7 6H4v2a3 3 0 0 0 3 3',
    'M17 6h3v2a3 3 0 0 1-3 3',
    'M12 14v4',
    'M8 20h8',
  ],
  alert: [
    'M12 3l9 16H3z',
    'M12 9v4',
    'M12 16h0.1',
  ],
  worker: [
    'M12 7a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    'M5 20a7 7 0 0 1 14 0',
  ],
  gear: [
    'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    'M12 3v2',
    'M12 19v2',
    'M3 12h2',
    'M19 12h2',
    'M5.6 5.6l1.5 1.5',
    'M16.9 16.9l1.5 1.5',
    'M18.4 5.6l-1.5 1.5',
    'M7.1 16.9l-1.5 1.5',
  ],
};

export function gameIcon(name: GameIconName, className = ''): HTMLElement {
  return svgEl(
    'svg',
    {
      class: `game-icon ${className}`.trim(),
      viewBox: '0 0 24 24',
      width: 20,
      height: 20,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    ...paths[name].map((d) => svgEl('path', { d })),
  );
}

export function starRank(count: 1 | 2 | 3): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'star-rank';
  wrap.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i += 1) wrap.append(gameIcon('star', 'star-filled'));
  return wrap;
}
