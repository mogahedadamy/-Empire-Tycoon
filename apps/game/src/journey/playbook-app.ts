/** Presents authored campaign chapters and independent free-play rounds on the phone. */
import '../theme.css';
import '../layout.css';
import '../components.css';
import '../projects/style.css';
import { difficultyIds, playbookRuns, type Difficulty, type PlayMode } from '../../../../packages/content/src';
import { action, applyLocale, el, type Locale } from '../../../../packages/ui/src';
import { industrySelectionLink } from '../projects/navigation';

const root = document.querySelector<HTMLElement>('#app')!;
let locale: Locale = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ar';
let difficulty: Difficulty = 'supported';

const ar = {
  title: 'الحملة واللعب الحر', intro: 'اختر مستوى الصعوبة، ثم ابدأ جولة جديدة أو ارجع إلى تقدمك في الجولة نفسها.',
  difficulty: 'مستوى الصعوبة', supported: 'مدعوم', standard: 'قياسي', expert: 'خبير',
  supportedHint: 'خطوات موجهة ورأس مال أكبر وتحصيل أسرع.', standardHint: 'شروط السيناريو المرجعية وتخطيط مستقل.',
  expertHint: 'نقد أقل وفائدة أعلى وتأخر أطول في التحصيل.',
  campaign: 'فصول الحملة', sandbox: 'اللعب الحر', sandboxHint: 'ابدأ جولة مستقلة تمتد إلى اليوم 60، واحفظ تقدمك فيها منفصلًا.',
  language: 'English',
};
const en: typeof ar = {
  title: 'Campaign and free play', intro: 'Pick a difficulty, then start a new run or return to your progress in that run.',
  difficulty: 'Difficulty', supported: 'Supported', standard: 'Standard', expert: 'Expert',
  supportedHint: 'Guided steps, more opening capital and faster collection.', standardHint: 'Reference terms and independent planning.',
  expertHint: 'Less opening capital, higher interest and a longer collection delay.',
  campaign: 'Campaign chapters', sandbox: 'Free play', sandboxHint: 'Start an independent run through Day 60, with its own save.',
  language: 'العربية',
};

function render() {
  applyLocale(document.documentElement, locale);
  const l = locale === 'ar' ? ar : en;
  const switchLanguage = action(l.language, () => {
    locale = locale === 'ar' ? 'en' : 'ar';
    render();
    root.querySelector<HTMLElement>('.language')?.focus();
  }, 'language');
  switchLanguage.lang = locale === 'ar' ? 'en' : 'ar';
  const levels = el('fieldset', 'plans project-options', el('legend', '', l.difficulty));
  for (const level of difficultyIds) {
    const input = el('input', '');
    input.type = 'radio'; input.name = 'difficulty'; input.value = level; input.checked = difficulty === level;
    input.addEventListener('change', () => {
      difficulty = level;
      render();
      root.querySelector<HTMLElement>('input[name="difficulty"]:checked')?.focus({ preventScroll: true });
    });
    levels.append(el('label', 'plan', input, el('span', '', el('strong', '', l[level]), el('small', '', l[`${level}Hint`]))));
  }
  function runs(mode: PlayMode) {
    return playbookRuns.filter((run) => run.mode === mode && run.difficulty === difficulty).map((run) => {
      const query = new URLSearchParams({ scenario: run.scenario.id });
      if (locale === 'en') query.set('lang', locale);
      const link = el('a', 'industry-option', el('strong', '', run.title[locale]), el('p', '', run.summary[locale]));
      link.href = `?${query}`;
      link.dataset.playbookRun = run.scenario.id;
      return link;
    });
  }
  root.replaceChildren(el('main', 'operations-projects',
    el('header', 'project-header', el('strong', '', 'Empire Tycoon'), industrySelectionLink(locale, 'project-back'), switchLanguage),
    el('div', 'project-content',
      el('section', 'project-heading', el('h1', '', l.title), el('p', '', l.intro)), el('section', 'panel', levels),
      el('h2', '', l.campaign), el('div', 'industry-grid', ...runs('campaign')),
      el('h2', '', l.sandbox), el('p', 'muted', l.sandboxHint), el('div', 'industry-grid', ...runs('sandbox')),
    ),
  ));
}

render();
