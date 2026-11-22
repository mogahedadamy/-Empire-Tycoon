/** Composes accessible company views over the local business read and decision port. */
import { loadScenario } from '../../../../packages/content/src';
import { action, applyLocale, el, focusHeading, type Locale } from '../../../../packages/ui/src';
import { contracts, type DeliveryDecision } from './contracts';
import { financeView, journalDialog, type Statement } from './finance';
import { createCompanyHost } from './host';
import { company, overview, type ForecastMode } from './overview';
import { labels } from './view-tools';
import '../theme.css';
import '../layout.css';
import '../components.css';
import './company.css';

type Screen = 'overview' | 'business' | 'contracts' | 'finance';
const screens: Screen[] = ['overview', 'business', 'contracts', 'finance'];
const host = createCompanyHost(loadScenario('big-order'));
const root = document.querySelector<HTMLElement>('#app')!;
const live = document.querySelector<HTMLElement>('#announcements')!;

let screen: Screen = 'overview';
let locale: Locale = 'ar';
let scenarioMode: ForecastMode = 'baseline';
let statement: Statement = 'income';
let account: string | null = null;
let quantity = String(host.preview(1).max || 1);
let decision: DeliveryDecision = { type: 'idle' };

function focus(id: string) {
  const item = root.querySelector<HTMLElement>(id);
  if (item) focusHeading(item);
}

function navigate(next: Screen, target = '#page-title') {
  screen = next;
  render();
  window.scrollTo(0, 0);
  focus(target);
}

function showJournal(id: string) {
  const entry = host.read().journal.find((item) => item.id === id);
  if (!entry) return;
  const previous = document.activeElement;
  const dialog = journalDialog(entry, labels(locale));
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
  }, { once: true });
  root.append(dialog);
  dialog.showModal();
  dialog.querySelector('button')?.focus();
}

function changeQuantity(value: string) {
  quantity = value;
  if (decision.type !== 'preview' && decision.type !== 'rejected') return;
  decision = { type: 'idle' };
  root.querySelector('.delivery-details')?.remove();
  const control = root.querySelector<HTMLElement>('[data-delivery-action]');
  if (control) control.textContent = labels(locale).c.preview;
}

function submitDecision() {
  if (decision.type === 'pending') return;
  if (decision.type !== 'preview' || !decision.preview.valid) {
    decision = { type: 'preview', preview: host.preview(Number(quantity)) };
    render();
    focus('#delivery-title');
    return;
  }

  const preview = decision.preview;
  decision = { type: 'pending' };
  live.textContent = labels(locale).c.pending;
  render();
  requestAnimationFrame(() => {
    const receipt = host.confirm(preview);
    const c = labels(locale).c;
    if (receipt.status === 'review') {
      decision = { type: 'preview', preview: receipt.current, previous: receipt.previous };
      live.textContent = c.previewChanged;
    } else if (receipt.status === 'accepted' && receipt.invoiceId) {
      decision = { type: 'accepted', invoiceId: receipt.invoiceId };
      live.textContent = c.accepted;
      quantity = String(host.preview(1).max || 1);
    } else {
      decision = { type: 'rejected' };
      live.textContent = c.rejected;
    }
    render();
    if (screen === 'contracts') focus('#delivery-title');
  });
}

function renderScreen(model: ReturnType<typeof host.read>, strings: ReturnType<typeof labels>) {
  switch (screen) {
    case 'overview': return overview(model, strings, {
      mode: scenarioMode, openEntry: showJournal,
      select(mode) {
        scenarioMode = mode;
        render();
        root.querySelector<HTMLElement>(`[data-mode="${mode}"]`)?.focus();
      },
      traceCash() {
        statement = 'flow';
        account = 'cash';
        navigate('finance', '#journal-title');
      },
      openInvoices: () => navigate('contracts', '#invoices h2'),
    });
    case 'business': return company(model, strings);
    case 'contracts': return contracts(model, strings, {
      quantity, decision, changeQuantity, submitDecision, openEntry: showJournal,
    });
    case 'finance': return financeView(model, strings, {
      statement, account, openEntry: showJournal,
      selectStatement(id) {
        statement = id;
        account = null;
        render();
        root.querySelector<HTMLElement>(`[data-statement="${id}"]`)?.focus();
      },
      selectAccount(id) {
        account = id;
        render();
        focus('#journal-title');
      },
    });
  }
}

function render() {
  const model = host.read();
  const strings = labels(locale);
  const { c, day } = strings;
  applyLocale(document.documentElement, locale);
  const nav = el('nav', 'navigation company-nav');
  nav.setAttribute('aria-label', c.navigation);
  const symbols = { overview: '◫', business: '◇', contracts: '≡', finance: '∷' };
  for (const page of screens) {
    const button = action(c[page], () => navigate(page), 'nav-item');
    const icon = el('span', 'nav-mark', symbols[page]);
    icon.setAttribute('aria-hidden', 'true');
    button.prepend(icon);
    if (screen === page) button.setAttribute('aria-current', 'page');
    nav.append(button);
  }

  const language = action(c.otherLanguage, () => {
    locale = locale === 'ar' ? 'en' : 'ar';
    render();
    root.querySelector<HTMLElement>('.language')?.focus();
  }, 'language');
  language.setAttribute('aria-label', c.language);
  language.lang = locale === 'ar' ? 'en' : 'ar';
  const next = action(c.nextDay, () => {
    host.advance();
    render();
    const control = root.querySelector<HTMLButtonElement>('[data-next-day]');
    if (control?.disabled) focus('#page-title');
    else control?.focus();
    live.textContent = `${c.day} ${host.read().day}`;
  }, 'secondary');
  next.dataset.nextDay = '';
  next.disabled = !model.canAdvance || decision.type === 'pending';
  const title = el('h1', '', c[`${screen}Title`]);
  title.id = 'page-title';
  root.replaceChildren(
    el('aside', 'sidebar',
      el('div', 'brand', el('span', 'brand-mark', 'ET'), el('div', '', el('strong', '', c.brand), el('small', '', c.studio))),
      nav,
    ),
    el('main', `workspace company-workspace ${screen === 'contracts' ? 'with-decision' : ''}`,
      el('header', 'topbar',
        el('div', 'breadcrumb', el('span', '', c.company), day(model.day)),
        el('div', 'top-actions', next, language),
      ),
      el('div', 'content company-content',
        el('header', 'view-header company-header', el('span', 'badge', c.checkpoint), title),
        renderScreen(model, strings),
      ),
    ),
  );
}

render();
