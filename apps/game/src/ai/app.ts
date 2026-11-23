/** Connects the phone-sized AI founding decision to its worker and versioned local save. */
import '../theme.css';
import '../layout.css';
import '../components.css';
import '../projects/style.css';
import './style.css';
import { createAiFoundingRepository, type AiFoundingCommand, type AiFoundingQuote, type AiFoundingReceipt } from '../../../../packages/ai-industry/src';
import { loadAiScenario, type AiFoundingPath } from '../../../../packages/content/src/ai';
import { SaveError } from '../../../../packages/storage/src';
import { openIndexedDbSaveStore } from '../../../../packages/storage/web/indexed-db';
import { action, applyLocale, createFormatters, el, focusHeading, type Locale } from '../../../../packages/ui/src';
import { createWorkerQuery } from '../platform/worker-query';
import { industrySelectionLink, projectHref } from '../projects/navigation';
import { aiText } from './text';
import { foundingOptions, foundingSummary } from './views';
import type { AiAnswer, AiQuery } from './worker';

const scenario = loadAiScenario();
const root = document.querySelector<HTMLElement>('#app')!;
let locale: Locale = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ar';
let quotes: readonly AiFoundingQuote[] = [];
let selected: AiFoundingPath | null = null;
let receipt: AiFoundingReceipt | null = null;
let phase: 'loading' | 'ready' | 'saving' | 'saved' | 'error' | 'saveFailed' | 'conflict' = 'loading';

function aiNextSteps(l: ReturnType<typeof aiText>) {
  const food = el('a', 'button primary industry-selection', l.continueFood);
  food.href = projectHref('food', locale);
  food.dataset.continueCampaign = 'food';
  const others = el('a', 'button secondary industry-selection', l.otherSectors);
  others.href = projectHref('choose', locale);
  return el('section', 'panel project-next-steps',
    el('h2', '', l.nextTitle),
    el('p', 'muted', l.nextBody),
    el('div', 'actions panel-actions', food, others),
  );
}

function render() {
  applyLocale(document.documentElement, locale);
  const l = aiText(locale);
  const language = action(locale === 'ar' ? 'English' : 'العربية', () => {
    locale = locale === 'ar' ? 'en' : 'ar';
    render();
    root.querySelector<HTMLElement>('.language')?.focus();
  }, 'language');
  language.lang = locale === 'ar' ? 'en' : 'ar';

  const current = receipt?.quote ?? quotes.find(({ pathId }) => pathId === selected);
  const status = el('p', 'project-status', phase === 'ready' ? '' : l[phase]);
  status.dataset.aiState = phase;
  status.dataset.projectState = phase === 'conflict' ? 'error' : phase;
  status.setAttribute('role', 'status');

  const button = action(l.confirm, () => { void confirm(); });
  button.dataset.confirmAi = '';
  button.disabled = phase !== 'ready' && phase !== 'saveFailed';
  const summary = current ? foundingSummary(current, locale, receipt) : null;
  const selectedPanel = summary && !receipt ? el('div', 'ai-decision', summary, button) : null;
  const day = createFormatters(locale).number(scenario.opportunityExpiresDay);
  const brand = locale === 'ar' ? 'إمبراطورية الأعمال' : 'Empire Tycoon';
  root.replaceChildren(el('main', 'operations-projects',
    el('header', 'project-header', el('strong', '', brand), industrySelectionLink(locale, 'project-back'), language),
    el('div', 'project-content',
      el('section', 'project-heading',
        el('span', 'scope-tag scope-tag-dark', l.scope),
        el('h1', '', scenario.title[locale]),
        receipt ? null : el('p', '', l.intro.replace('{day}', day)),
      ),
      status,
      quotes.length && !receipt ? foundingOptions(quotes, locale, selected,
        phase === 'saving' || phase === 'conflict' || phase === 'error', pick, selectedPanel) : null,
      receipt ? summary : null,
      receipt ? aiNextSteps(l) : null,
    ),
  ));
}

function pick(pathId: AiFoundingPath) {
  selected = pathId;
  render();
  root.querySelector<HTMLInputElement>('input[name="ai-path"]:checked')?.focus({ preventScroll: true });
}

let query: ReturnType<typeof createWorkerQuery<AiQuery, AiAnswer>>;
let repository: ReturnType<typeof createAiFoundingRepository>;

async function confirm() {
  if (!selected || (phase !== 'ready' && phase !== 'saveFailed')) return;
  const command: AiFoundingCommand = { type: 'found-ai-company', pathId: selected };
  phase = 'saving';
  render();
  const answer = await query(command);
  if (answer?.type !== 'founded') {
    phase = 'error';
    render();
    return;
  }
  try {
    await repository.confirm(command, answer.receipt);
    receipt = answer.receipt;
    phase = 'saved';
  } catch (error) {
    phase = error instanceof SaveError && error.code === 'write-conflict' ? 'conflict' : 'saveFailed';
  }
  render();
  const heading = root.querySelector<HTMLElement>('#ai-summary-title');
  if (heading && receipt) focusHeading(heading);
}

async function open() {
  render();
  try {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    query = createWorkerQuery<AiQuery, AiAnswer>(worker);
    const db = await openIndexedDbSaveStore(indexedDB, 'empire-tycoon-solo');
    repository = createAiFoundingRepository(scenario, db, () => new Date().toISOString());
    const saved = await repository.load();
    if (saved) {
      const answer = await query(saved);
      if (answer?.type !== 'founded') throw new Error('AI receipt unavailable');
      receipt = answer.receipt;
      phase = 'saved';
    } else {
      const answer = await query({ type: 'compare' });
      if (answer?.type !== 'comparison') throw new Error('AI comparison unavailable');
      quotes = answer.quotes;
      phase = 'ready';
    }
  } catch {
    phase = 'error';
  }
  render();
}

void open();
