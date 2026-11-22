/** Shared locale, direction and exact formatting for the first experience. */
export type Locale = 'ar' | 'en';

export function createFormatters(locale: Locale) {
  const numberingSystem = locale === 'ar' ? 'arab' : 'latn';
  const number = new Intl.NumberFormat(locale, { numberingSystem });
  const decimal = new Intl.NumberFormat(locale, {
    numberingSystem, minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  return {
    number: (value: number | bigint) => number.format(value),
    money(minor: bigint) {
      const absolute = minor < 0n ? -minor : minor;
      const remainder = absolute % 100n;
      if (!remainder) return number.format(minor / 100n);

      // Format the whole part as bigint, then replace its fraction with the exact minor units.
      const fraction = decimal.formatToParts(Number(remainder) / 100).find((part) => part.type === 'fraction')!.value;
      const whole = minor < 0n ? -(absolute / 100n) : absolute / 100n;
      const signedWhole = minor < 0n && whole === 0n ? -0 : whole;
      return decimal.formatToParts(signedWhole)
        .map((part) => part.type === 'fraction' ? fraction : part.value)
        .join('');
    },
  };
}

export function applyLocale(root: HTMLElement, locale: Locale) {
  root.lang = locale;
  root.dir = locale === 'ar' ? 'rtl' : 'ltr';
}
