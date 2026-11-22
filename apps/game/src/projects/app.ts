/** Runs the independent starter-project screens and commits decisions through a verified save. */
import '../theme.css';
import '../layout.css';
import '../components.css';
import './style.css';
import { action, applyLocale, el, focusHeading, type Locale } from '../../../../packages/ui/src';
import { createProjectClient } from './client';
import { defaultChoice, isProject, projects, type Project, type ProjectChoice, type ProjectReceipt } from './model';
import { industrySelectionLink, projectHref } from './navigation';
import { openProjectSave } from './save';
import { projectText } from './text';
import { projectConfirmButton, renderProjectReceipt, renderProjectTerms } from './views';

const params = new URLSearchParams(location.search);
const root = document.querySelector<HTMLElement>('#app')!;
let locale: Locale = params.get('lang') === 'en' ? 'en' : 'ar';

function shell(content: HTMLElement, render: () => void, back: boolean) {
  applyLocale(document.documentElement, locale);
  const l = projectText(locale);
  const language = action(l.language, () => {
    locale = locale === 'ar' ? 'en' : 'ar';
    render();
    root.querySelector<HTMLElement>('.language')?.focus();
  }, 'language');
  language.lang = locale === 'ar' ? 'en' : 'ar';
  const main = el('main', 'operations-projects', el('header', 'project-header', el('strong', '', 'Empire Tycoon'),
    back ? industrySelectionLink(locale, 'project-back') : null, language), content);
  root.replaceChildren(main);
}

function showIndustries() {
  const l = projectText(locale);
  const photo = el('img', 'scene-image');
  photo.src = `${import.meta.env.BASE_URL}images/produce-terminal.webp`;
  photo.alt = '';
  photo.width = 1120;
  photo.height = 747;
  const cards = (['food', ...projects] as const).map((project) => {
    const link = el('a', 'industry-option', el('h2', '', l[project]), el('p', '', l[`${project}Goal`]));
    link.href = projectHref(project, locale);
    link.dataset.industry = project;
    return link;
  });
  const hero = el('section', 'project-hero', photo, el('div', '', el('h1', '', l.choose), el('p', '', l.intro)));
  shell(el('div', 'project-content', hero, el('div', 'industry-grid', ...cards)), showIndustries, false);
}

async function showProject(project: Project) {
  const quote = createProjectClient();
  let choice = defaultChoice(project);
  let receipt: ProjectReceipt | null = null;
  let store: Awaited<ReturnType<typeof openProjectSave>> | undefined;
  let phase: 'loading' | 'ready' | 'saving' | 'saved' | 'error' | 'saveFailed' = 'loading';
  let request = 0;

  function render() {
    const l = projectText(locale);
    const active = document.activeElement;
    const activeInput = active instanceof HTMLInputElement ? { name: active.name, value: active.value } : null;
    const locked = !store || Boolean(store.choice) || phase === 'saving' || phase === 'saved';
    const status = el('p', 'project-status', phase === 'ready' ? '' : phase === 'error' ? l.unavailable : l[phase]);
    status.dataset.projectState = phase;
    status.setAttribute('role', 'status');
    const result = receipt ? renderProjectReceipt(receipt, choice, locale, phase === 'saved') : null;
    const button = phase === 'saved' ? null : projectConfirmButton(choice, l,
      !receipt || !store || (phase !== 'ready' && phase !== 'saveFailed'), () => { void confirm(); });
    shell(el('div', 'project-content',
      el('section', 'project-heading', el('h1', '', l[project]), el('p', '', l[`${project}Goal`])),
      el('section', 'panel project-choice', renderProjectTerms(choice, locale, locked, (next) => { void refresh(next); })),
      status, result, button,
    ), render, true);
    if (activeInput) {
      Array.from(root.querySelectorAll<HTMLInputElement>('input'))
        .find(({ name, value }) => name === activeInput.name && value === activeInput.value)?.focus({ preventScroll: true });
    }
  }

  async function refresh(next: ProjectChoice, restored = false) {
    choice = next;
    receipt = null;
    phase = 'loading';
    const id = ++request;
    render();
    const result = await quote(next);
    if (id !== request) return;
    receipt = result;
    phase = result ? restored ? 'saved' : 'ready' : 'error';
    render();
  }

  async function confirm() {
    if ((phase !== 'ready' && phase !== 'saveFailed') || !store || !receipt) return;
    phase = 'saving';
    render();
    try {
      await store.commit(choice, receipt);
      phase = 'saved';
    } catch {
      phase = 'saveFailed';
    }
    render();
    const heading = root.querySelector<HTMLElement>('#project-receipt-title');
    if (heading && phase === 'saved') focusHeading(heading);
  }

  render();
  try {
    store = await openProjectSave(project);
    await refresh(store.choice ?? choice, Boolean(store.choice));
  } catch {
    phase = 'error';
    render();
  }
}

const project = params.get('industry');
if (isProject(project)) void showProject(project);
else showIndustries();
