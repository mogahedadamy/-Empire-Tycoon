/** Small, reload-safe links between project selection and the original journey. */
import { el, type Locale } from '../../../../packages/ui/src';
import { projectText } from './text';

export function projectHref(industry: string, locale: Locale) {
  const params = new URLSearchParams();
  if (industry !== 'food') params.set('industry', industry);
  if (locale === 'en') params.set('lang', locale);
  return `?${params}`;
}

export function industrySelectionLink(locale: Locale, variant: string) {
  const link = el('a', `button ${variant} industry-selection`, projectText(locale).choose);
  link.href = projectHref('choose', locale);
  link.dataset.chooseIndustry = '';
  return link;
}
