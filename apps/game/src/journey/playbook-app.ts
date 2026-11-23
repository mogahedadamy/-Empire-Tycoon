/** Presents a compact, goal-first launcher for campaign chapters and independent free play. */
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
  title: 'الحملة واللعب الحر',
  intro: 'ابدأ رحلتك الموجهة أو اختر فصلًا بصعوبة مخصّصة وحفظ مستقل لكل جولة.',
  recommendedTag: 'بداية مقترحة للاعب الجديد',
  recommendedTitle: 'أسّس شركتك وسلّم أول طلب',
  recommendedBody: 'ابدأ شركة توزيع أغذية برأس مال ميسّر وخطوات موجهة حتى إقفال الشهر الأول وقرار التوسع.',
  recommendedAction: 'ابدأ الآن (مدعوم)',
  difficulty: 'مستوى الصعوبة', supported: 'مدعوم', standard: 'قياسي', expert: 'خبير',
  supportedHint: 'خطوات موجهة ورأس مال أكبر وتحصيل أسرع.',
  standardHint: 'شروط السيناريو المرجعية وتخطيط مستقل.',
  expertHint: 'نقد أقل وفائدة أعلى وتأخر أطول في التحصيل.',
  campaign: 'فصول الحملة',
  campaignTag: 'فصل حملة · ٤٥ يومًا',
  sandbox: 'اللعب الحر',
  sandboxTag: 'لعب حر · ٦٠ يومًا · حفظ مستقل',
  sandboxHint: 'جولة مفتوحة تمتد إلى اليوم ٦٠ بحفظ منفصل تمامًا عن فصول الحملة.',
  guided: 'موجه',
  independent: 'مستقل',
  language: 'English',
};
const en: typeof ar = {
  title: 'Campaign and free play',
  intro: 'Start the guided first-order chapter, or pick a difficulty and independent run.',
  recommendedTag: 'Recommended start',
  recommendedTitle: 'Found your company & deliver your first order',
  recommendedBody: 'Open a food distributor with guided steps through your first delivery, Month 1 close, and expansion trade-off.',
  recommendedAction: 'Start now (Supported)',
  difficulty: 'Difficulty', supported: 'Supported', standard: 'Standard', expert: 'Expert',
  supportedHint: 'Guided steps, more opening capital and faster collection.',
  standardHint: 'Reference terms and independent planning.',
  expertHint: 'Less opening capital, higher interest and a longer collection delay.',
  campaign: 'Campaign chapters',
  campaignTag: 'Campaign · 45 days',
  sandbox: 'Free play',
  sandboxTag: 'Free play · 60 days · Separate save',
  sandboxHint: 'Independent 60-day run with its own isolated save slot.',
  guided: 'Guided',
  independent: 'Independent',
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

  const quickStart = el('a', 'button primary industry-selection', l.recommendedAction);
  quickStart.href = locale === 'en' ? '?lang=en' : '?';
  const recommended = el('section', 'panel playbook-featured',
    el('span', 'scope-tag scope-tag-campaign', l.recommendedTag),
    el('h2', '', l.recommendedTitle),
    el('p', 'muted', l.recommendedBody),
    quickStart,
  );

  const levels = el('fieldset', 'playbook-levels', el('legend', '', l.difficulty));
  for (const level of difficultyIds) {
    const input = el('input', '');
    input.type = 'radio'; input.name = 'difficulty'; input.value = level; input.checked = difficulty === level;
    input.addEventListener('change', () => {
      difficulty = level;
      render();
      root.querySelector<HTMLElement>('input[name="difficulty"]:checked')?.focus({ preventScroll: true });
    });
    levels.append(el('label', 'plan playbook-level', input, el('strong', '', l[level])));
  }
  const activeHint = el('p', 'muted playbook-level-hint', l[`${difficulty}Hint`]);

  function runs(mode: PlayMode) {
    return playbookRuns.filter((run) => run.mode === mode && run.difficulty === difficulty).map((run) => {
      const query = new URLSearchParams({ scenario: run.scenario.id });
      if (locale === 'en') query.set('lang', locale);
      const modeTag = el('span', `scope-tag ${mode === 'campaign' ? 'scope-tag-campaign' : ''}`,
        mode === 'campaign' ? l.campaignTag : l.sandboxTag);
      const guideTag = el('span', 'scope-tag', run.guided ? l.guided : l.independent);
      const link = el('a', 'industry-option playbook-run-card',
        el('div', 'industry-option-head', el('strong', '', run.title[locale]), el('div', 'playbook-tags', modeTag, guideTag)),
        el('p', '', run.summary[locale]),
      );
      link.href = `?${query}`;
      link.dataset.playbookRun = run.scenario.id;
      return link;
    });
  }

  const brand = locale === 'ar' ? 'إمبراطورية الأعمال' : 'Empire Tycoon';
  root.replaceChildren(el('main', 'operations-projects',
    el('header', 'project-header', el('strong', '', brand), industrySelectionLink(locale, 'project-back'), switchLanguage),
    el('div', 'project-content',
      el('section', 'project-heading', el('h1', '', l.title), el('p', '', l.intro)),
      recommended,
      el('section', 'panel playbook-selector', levels, activeHint),
      el('h2', 'playbook-section-title', l.campaign),
      el('div', 'industry-grid', ...runs('campaign')),
      el('h2', 'playbook-section-title', l.sandbox),
      el('p', 'muted', l.sandboxHint),
      el('div', 'industry-grid', ...runs('sandbox')),
    ),
  ));
}

render();
