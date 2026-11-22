/** Links the existing setup and project hub to the campaign and free-play selector. */
import { el, type Locale } from '../../../../packages/ui/src';

export function playbookLink(locale: Locale, variant = 'secondary') {
  const link = el('a', `button ${variant} industry-selection`, locale === 'ar' ? 'الحملة واللعب الحر' : 'Campaign and free play');
  link.href = locale === 'ar' ? '?playbook=1' : '?playbook=1&lang=en';
  link.dataset.openPlaybook = '';
  return link;
}
