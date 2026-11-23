/** Exact USD ($) money formatting with RTL-safe <bdi> isolation and compact large-value tiers. */
import { el, type Locale } from '../../../../packages/ui/src';

const exactUsd = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeUsd = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

/** Formats exact USD cents as `$ 1,234.56` (or compact `$ 12.45M` above $1M when requested). */
export function formatUsd(cents: bigint, compact = false): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const sign = negative ? '-' : '';
  if (compact && abs >= 100_000_000n) {
    const dollars = Number(abs) / 100;
    if (dollars >= 1_000_000_000_000) return `${sign}$ ${(dollars / 1e12).toFixed(2)}T`;
    if (dollars >= 1_000_000_000) return `${sign}$ ${(dollars / 1e9).toFixed(2)}B`;
    if (dollars >= 1_000_000) return `${sign}$ ${(dollars / 1e6).toFixed(2)}M`;
  }
  const dollarsWhole = abs / 100n;
  const rem = Number(abs % 100n);
  if (abs >= 10_000_000n && rem === 0) return `${sign}$ ${wholeUsd.format(dollarsWhole)}`;
  const decimal = `${wholeUsd.format(dollarsWhole)}.${String(rem).padStart(2, '0')}`;
  return `${sign}$ ${decimal}`;
}

export function formatUsdExact(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const dollars = Number(abs) / 100;
  return `${negative ? '-' : ''}$ ${exactUsd.format(dollars)}`;
}

export function usdNode(cents: bigint, compact = false): HTMLElement {
  const node = el('bdi', 'usd-value', formatUsd(cents, compact));
  node.dir = 'ltr';
  return node;
}

export function formatHourly(cents: bigint, locale: Locale, plus = false): string {
  const amt = `${plus ? '+' : ''}${formatUsd(cents, true)}`;
  return locale === 'ar' ? `\u2066${amt}\u2069 / ساعة` : `${amt}/hr`;
}

export function formatUsdParen(cents: bigint, compact = true): string {
  return `\u2066(${formatUsd(cents, compact)})\u2069`;
}

export function formatPercentBps(bps: number): string {
  const sign = bps > 0 ? '+' : '';
  return `\u2066${sign}${(bps / 100).toFixed(2)}%\u2069`;
}
