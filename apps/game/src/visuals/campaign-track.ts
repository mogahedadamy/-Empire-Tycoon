/** Renders the 45-day campaign chapter timeline and visual warehouse capacity meters. */
import { el, type Locale } from '../../../../packages/ui/src';
import { gameIcon, type GameIconName } from './icons';

const milestones = [
  { day: 1, ar: 'التأسيس', en: 'Found' },
  { day: 9, ar: 'التوريد', en: 'Stock' },
  { day: 18, ar: 'التسليم', en: 'Ship' },
  { day: 30, ar: 'الإقفال', en: 'Close' },
  { day: 45, ar: 'النهاية', en: 'Goal' },
] as const;

export function buildCampaignRibbon(day: number, totalDays: number, locale: Locale): HTMLElement {
  const clamped = Math.max(1, Math.min(totalDays, day));
  const pct = Math.round(((clamped - 1) / Math.max(1, totalDays - 1)) * 100);
  const track = el('div', 'campaign-track',
    el('div', 'campaign-track-fill'),
  );
  track.firstElementChild?.setAttribute('style', `inline-size: ${pct}%`);
  const pins = el('ol', 'campaign-pins',
    ...milestones.map((m) => {
      const done = day >= m.day;
      const active = day === m.day || (m.day === 30 && day >= 30 && day < 45);
      const item = el('li', `campaign-pin ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`,
        el('span', 'campaign-dot', ''),
        el('span', 'campaign-label', locale === 'ar' ? m.ar : m.en),
      );
      return item;
    }),
  );
  const fmt = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US');
  const title = locale === 'ar' ? 'مسار الحملة' : 'Campaign progress';
  const badge = locale === 'ar' ? `اليوم ${fmt.format(day)} / ${fmt.format(totalDays)}` : `Day ${fmt.format(day)} / ${fmt.format(totalDays)}`;
  return el('section', 'panel campaign-ribbon',
    el('div', 'campaign-ribbon-head',
      el('span', 'campaign-ribbon-title', gameIcon('trophy'), el('strong', '', title)),
      el('span', 'badge', badge),
    ),
    track,
    pins,
  );
}

export interface CapacityBarItem {
  readonly icon: GameIconName;
  readonly label: string;
  readonly value: number;
  readonly formatted: HTMLElement;
  readonly bottleneck?: boolean;
}

export function buildCapacityMeters(items: readonly CapacityBarItem[]): HTMLElement {
  const max = Math.max(1, ...items.map((item) => item.value));
  return el('div', 'capacity-meters',
    ...items.map((item) => {
      const pct = Math.max(8, Math.round((item.value / max) * 100));
      const fill = el('span', `capacity-meter-fill ${item.bottleneck ? 'is-bottleneck' : ''}`);
      fill.setAttribute('style', `inline-size: ${pct}%`);
      return el('div', `capacity-meter ${item.bottleneck ? 'capacity-meter-bottleneck' : ''}`,
        el('div', 'capacity-meter-head',
          el('span', 'capacity-meter-label', gameIcon(item.icon), item.label),
          item.formatted,
        ),
        el('div', 'capacity-meter-bar', fill),
      );
    }),
  );
}
