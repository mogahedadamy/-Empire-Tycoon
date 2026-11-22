/** Mounts the scenario preview, retaining plan and receipt state across views and languages. */
import { loadScenario } from '../../../packages/content/src';
import { action, applyLocale, el, focusHeading, type Locale } from '../../../packages/ui/src';
import { copy } from './copy';
import { previewModel, type FundingPlan } from './preview-model';
import { contractView, financeView, setupView, type Confirmation, type View } from './views';
import './theme.css';
import './layout.css';
import './components.css';

const scenario = loadScenario('big-order');
const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing game root');
const root = app;
const announcements = document.querySelector<HTMLElement>('#announcements');
if (!announcements) throw new Error('Missing game announcements');
const live = announcements;

const views = { setup: setupView, finance: financeView, contract: contractView };
const modes: View[] = ['setup', 'finance', 'contract'];
let view: View = 'setup';
let locale: Locale = 'ar';
let plan: FundingPlan = 'loan';
let confirmation: Confirmation = 'idle';
let receipt = '';
let confirmationRequest: symbol | undefined;

function navigate(next: View) {
  if (view === next) return;
  view = next;
  render();
  window.scrollTo(0, 0);
  focusHeading(root.querySelector<HTMLElement>('h1')!);
}

function showConfirmation() {
  if (confirmation === 'pending' || confirmation === 'confirmed') return;

  const c = copy[locale];
  const dialog = el('dialog', 'confirmation-dialog', el('h2', '', c.dialogTitle), el('p', '', c.dialogText));
  dialog.querySelector('h2')!.id = 'confirmation-title';
  dialog.setAttribute('aria-labelledby', 'confirmation-title');
  const originalTrigger = root.querySelector<HTMLButtonElement>('[data-confirm]');
  const cancel = action(c.cancel, () => dialog.close(), 'secondary');
  const confirm = action(c.proceed, () => {
    if (confirmation === 'pending') return;
    confirmation = 'pending';
    const request = Symbol();
    confirmationRequest = request;
    live.textContent = c.pending;
    dialog.close();
    render();
    focusHeading(root.querySelector<HTMLElement>('h1')!);

    // This preview uses a local acknowledgement. Live commands are part of the playable slice.
    window.requestAnimationFrame(() => {
      if (confirmationRequest !== request) return;
      confirmationRequest = undefined;
      receipt = scenario.contract.id;
      confirmation = 'confirmed';
      const active = document.activeElement;
      const navIndex = Array.from(root.querySelectorAll('.nav-item')).indexOf(active!);
      render();
      live.textContent = copy[locale].confirmed;
      if (navIndex >= 0) root.querySelectorAll<HTMLElement>('.nav-item')[navIndex]?.focus();
      else if (active?.classList.contains('language')) root.querySelector<HTMLElement>('.language')?.focus();
      else if (view === 'contract') focusHeading(root.querySelector<HTMLElement>('h1')!);
    });
  });
  dialog.append(el('div', 'actions', cancel, confirm));
  dialog.addEventListener('close', () => {
    dialog.remove();
    originalTrigger?.focus();
  }, { once: true });
  root.append(dialog);
  dialog.showModal();
  cancel.focus();
}

function render() {
  const c = copy[locale];
  applyLocale(document.documentElement, locale);
  const nav = el('nav', 'navigation');
  nav.setAttribute('aria-label', c.navigation);
  const marks = { setup: '＋', finance: '◫', contract: '≡' };
  for (const page of modes) {
    const item = action(c[page], () => navigate(page), 'nav-item');
    const mark = el('span', 'nav-mark', marks[page]);
    mark.setAttribute('aria-hidden', 'true');
    item.prepend(mark);
    if (page === view) item.setAttribute('aria-current', 'step');
    nav.append(item);
  }

  const language = action(c.otherLanguage, () => {
    locale = locale === 'ar' ? 'en' : 'ar';
    render();
    root.querySelector<HTMLButtonElement>('.language')?.focus();
  }, 'language');
  language.setAttribute('aria-label', c.language);
  language.lang = locale === 'ar' ? 'en' : 'ar';
  const title = { setup: c.setupTitle, finance: c.financeTitle, contract: c.contractTitle };
  const intro = { setup: c.setupIntro, finance: c.financeIntro, contract: c.contractIntro };
  const mark = el('span', 'brand-mark', 'ET');
  mark.lang = 'en';
  mark.setAttribute('aria-hidden', 'true');

  root.replaceChildren(
    el('aside', 'sidebar',
      el('div', 'brand', mark, el('div', '', el('strong', '', c.brand), el('small', '', c.studio))),
      nav,
    ),
    el('main', 'workspace',
      el('header', 'topbar', el('div', 'breadcrumb', el('span', '', c.scenario), el('span', '', c[view])), language),
      el('div', 'content',
        el('div', 'view-header', el('span', 'badge', c.prototype), el('h1', '', title[view]), el('p', '', intro[view])),
        views[view]({
          copy: c, locale, scenario, model: previewModel(scenario, plan), plan, confirmation, receipt,
          navigate,
          select(next) {
            if (plan !== next) {
              plan = next;
              confirmation = 'idle';
              confirmationRequest = undefined;
              live.textContent = '';
              receipt = '';
              render();
              root.querySelector<HTMLInputElement>('input[name="funding"]:checked')?.focus();
            }
          },
          confirm: showConfirmation,
        }),
      ),
    ),
  );
}

render();
