/** Renders the terms that distinguish every founding path and the confirmed day-one receipt. */
import type { AiFoundingQuote, AiFoundingReceipt } from '../../../../packages/ai-industry/src';
import type { AiFoundingPath } from '../../../../packages/content/src/ai';
import { createFormatters, detailRows, el, figure, type Locale } from '../../../../packages/ui/src';
import { aiText } from './text';

function display(locale: Locale) {
  const text = aiText(locale);
  const fmt = createFormatters(locale);
  return {
    text,
    money: (minor: string) => figure(fmt.money(BigInt(minor)), text.unit),
    day: (day: number) => el('span', '', text.day + ' ', el('bdi', '', fmt.number(day))),
    days: (days: number) => figure(fmt.number(days), text.days),
  };
}

export function foundingOptions(
  quotes: readonly AiFoundingQuote[], locale: Locale, selected: AiFoundingPath | null, locked: boolean,
  onPick: (id: AiFoundingPath) => void, selectedPanel: HTMLElement | null,
) {
  const { text, money, day, days } = display(locale);
  const field = el('fieldset', 'ai-paths', el('legend', '', text.options));
  for (const quote of quotes) {
    const radio = el('input', '');
    radio.type = 'radio';
    radio.name = 'ai-path';
    radio.value = quote.pathId;
    radio.checked = selected === quote.pathId;
    radio.disabled = locked;
    radio.addEventListener('change', () => onPick(quote.pathId));
    field.append(el('section', 'panel ai-path', el('label', 'ai-path-label', radio, el('strong', '', quote.name[locale])),
      detailRows([
        [text.buyer, quote.buyer[locale]], [text.business, text[quote.billing]], [text.startup, money(quote.startupCostMinor)],
        [text.commitment, el('span', 'ai-commitment', money(quote.dailyCommitmentMinor), ' ' + text.daily + ' ',
          days(quote.commitmentDays))],
        [text.collection, day(quote.firstCollectionDay)],
      ]),
      el('p', 'ai-dependency', el('strong', '', text.dependency), ' ', quote.dependency[locale]),
      radio.checked ? selectedPanel : null,
    ));
  }
  return field;
}

export function foundingSummary(quote: AiFoundingQuote, locale: Locale, receipt: AiFoundingReceipt | null) {
  const { text, money, day } = display(locale);
  const title = el('h2', '', receipt ? text.receipt : quote.name[locale]);
  title.id = 'ai-summary-title';
  const details = el('details', 'project-materials', el('summary', '', text.detail), detailRows([
    [text.supplier, quote.supplier[locale] + ' · ' + quote.region[locale]],
    [text.capacity, text[quote.capacityPlan]], [text.hardware, el('bdi', '', quote.hardwareFamilyId)],
    [text.weights, text[quote.weightAccess]],
  ]));
  const settledTerms = receipt ? [
    [text.startup, money(quote.startupCostMinor)], [text.buyer, quote.buyer[locale]], [text.collection, day(quote.firstCollectionDay)],
  ] as const : [];
  return el('section', 'panel ai-summary', title, receipt ? el('p', '', quote.name[locale]) : null, detailRows([
    [text.capital, money(quote.founderCapitalMinor)],
    ...settledTerms,
    [text.cash, money(receipt?.balance.cash ?? quote.openingCashMinor)],
    [text.commitment, money(quote.totalCommitmentMinor)],
    [text.afterCommitment, money(quote.cashAfterCommitmentMinor)],
  ]), receipt ? el('p', 'ai-dependency', el('strong', '', text.dependency), ' ', quote.dependency[locale]) : null, details);
}
