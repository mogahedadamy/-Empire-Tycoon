/** Renders the responsive shell chrome, topbar controls, guidance strip, and worker status container. */
import { action, applyLocale, el, notice, type Locale } from '../../../../packages/ui/src';
import { guidanceBar, type JourneyScreen } from './guidance';
import type { JourneyLabels } from './text';
import type { JourneyReadModel } from './types';

const screens: JourneyScreen[] = ['overview', 'business', 'contracts', 'finance'];

function milestoneLabel(reason: NonNullable<JourneyReadModel['milestone']>['reason'], c: JourneyLabels['c']) {
  const map = {
    'supply-arrival': c.milestoneSupply,
    'delivery-window': c.milestoneDelivery,
    'monthly-close': c.milestoneClose,
    'rent-due': c.milestoneRent,
    'overdue-review': c.milestoneOverdue,
    'scenario-end': c.milestoneEnd,
  };
  return map[reason];
}

export interface ShellOptions {
  root: HTMLElement;
  locale: Locale;
  screen: JourneyScreen;
  model: JourneyReadModel;
  strings: JourneyLabels;
  busy: boolean;
  canWrite: boolean;
  guidanceSkipped: boolean;
  commandNotice: { tone: 'error' | 'warning'; text: string } | null;
  activeScreen: HTMLElement;
  navigate(screen: JourneyScreen): void;
  advanceMilestone(targetDay: number): void;
  advanceOne(): void;
  toggleGuidance(): void;
  toggleLanguage(): void;
}

/** Replaces the mounted shell tree while preserving ARIA landmarks and responsive classes. */
export function renderJourneyShell(options: ShellOptions) {
  const { root, locale, screen, model, strings, busy, canWrite, guidanceSkipped, commandNotice } = options;
  const { c, day, format } = strings;
  applyLocale(document.documentElement, locale);

  const nav = el('nav', 'navigation company-nav');
  nav.setAttribute('aria-label', c.navigation);
  const symbols = { overview: '◫', business: '◇', contracts: '≡', finance: '∷' };
  for (const page of screens) {
    const button = action(c[page], () => options.navigate(page), 'nav-item');
    const icon = el('span', 'nav-mark', symbols[page]);
    icon.setAttribute('aria-hidden', 'true');
    button.prepend(icon);
    button.disabled = !model.founded;
    if (model.founded && screen === page) button.setAttribute('aria-current', 'page');
    nav.append(button);
  }

  const topActions = el('div', 'top-actions');
  if (model.founded && model.milestone) {
    const target = model.milestone;
    const ms = action(
      `${c.advanceMilestone}: ${milestoneLabel(target.reason, c)} (${format.number(target.days)})`,
      () => options.advanceMilestone(target.targetDay),
    );
    ms.dataset.advanceMilestone = target.reason;
    ms.disabled = busy || !model.canAdvance || !canWrite;
    topActions.append(ms);
  }
  if (model.founded) {
    const next = action(c.advanceOne, options.advanceOne, 'secondary');
    next.dataset.advanceOne = '';
    next.disabled = busy || !model.canAdvance || !canWrite;
    topActions.append(next);

    const guideToggle = action(guidanceSkipped ? c.showGuidance : c.skipGuidance, options.toggleGuidance, 'secondary');
    guideToggle.dataset.toggleGuidance = '';
    topActions.append(guideToggle);
  }
  const language = action(c.otherLanguage, options.toggleLanguage, 'language');
  language.setAttribute('aria-label', c.language);
  language.lang = locale === 'ar' ? 'en' : 'ar';
  topActions.append(language);

  const title = el('h1', '', model.founded ? c[`${screen}Title`] : c.setupTitle);
  title.id = 'page-title';
  const workerEl = el('div', 'worker-banner');
  workerEl.setAttribute('role', 'status');
  workerEl.setAttribute('aria-live', 'polite');

  const guideEl = guidanceBar(model, strings, {
    currentScreen: screen, skipped: guidanceSkipped,
    onSkip: options.toggleGuidance,
    onNavigate: options.navigate,
  });

  root.replaceChildren(
    el('aside', 'sidebar',
      el('div', 'brand', el('span', 'brand-mark', 'ET'), el('div', '', el('strong', '', c.brand), el('small', '', c.studio))),
      nav,
    ),
    el('main', `workspace company-workspace ${model.founded && screen === 'contracts' ? 'with-decision' : ''}`,
      el('header', 'topbar',
        el('div', 'breadcrumb', el('span', '', c.company), day(model.day),
          el('span', 'rev-pill', `${c.workerRevision} `, el('bdi', '', format.number(model.revision)))),
        topActions,
      ),
      el('div', 'content company-content',
        el('header', 'view-header company-header', el('span', 'badge', c.journeyBadge), title,
          model.founded ? null : el('p', '', c.setupIntro)),
        el('p', 'save-status', ''),
        workerEl,
        commandNotice ? notice(c.review, commandNotice.text, commandNotice.tone) : null,
        guideEl,
        options.activeScreen,
      ),
    ),
  );
}
