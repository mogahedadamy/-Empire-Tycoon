/** Combines shared company labels with journey-specific Arabic and English strings. */
import { createFormatters, el, figure, type Locale } from '../../../../packages/ui/src';
import { companyText } from '../company/text';
import { journeyAr } from './text-ar';
import { journeyEn } from './text-en';

export function journeyLabels(locale: Locale) {
  const c = { ...companyText(locale), ...(locale === 'ar' ? journeyAr : journeyEn) };
  const format = createFormatters(locale);
  return {
    c,
    locale,
    format,
    money: (amount: string) => figure(format.money(BigInt(amount)), c.unit),
    qty: (value: number | bigint | string) => figure(format.number(typeof value === 'string' ? BigInt(value) : value), c.boxes),
    day: (value: number) => el('span', '', c.day, ' ', el('bdi', '', format.number(value))),
    party: (id: string) => {
      const key = `party_${id}` as keyof typeof journeyAr;
      return key in c ? c[key] : id;
    },
  };
}

export type JourneyLabels = ReturnType<typeof journeyLabels>;
