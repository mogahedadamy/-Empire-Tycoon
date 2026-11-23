/** Renders the Single-Shell FinTech frame: 5-tab persistent Bottom Navigation Bar and Level-3 pushed sub-screen header. */
import { affordableSectorsCount, type EmpireState } from '../../../../packages/empire/src';
import { action, applyLocale, el, type Locale } from '../../../../packages/ui/src';
import { gameIcon, type GameIconName } from '../visuals/icons';
import { formatUsd } from './format';
import { empireText } from './text';

export type RootTab = 'investing' | 'business' | 'earnings' | 'items' | 'profile';

export type SubScreen =
  | null
  | { readonly type: 'start-business' }
  | { readonly type: 'manage-company'; readonly companyId: string }
  | { readonly type: 'forbes' };

export interface EmpireShellOptions {
  root: HTMLElement;
  locale: Locale;
  state: EmpireState;
  tab: RootTab;
  subScreen: SubScreen;
  offlineEarnedCents: bigint | null;
  content: HTMLElement;
  onSelectTab(tab: RootTab): void;
  onBack(): void;
  onToggleLanguage(): void;
  onDismissOffline(): void;
}

const navDefs: readonly { id: RootTab; icon: GameIconName; key: 'navInvesting' | 'navBusiness' | 'navEarnings' | 'navItems' | 'navProfile' }[] = [
  { id: 'investing', icon: 'profit', key: 'navInvesting' },
  { id: 'business', icon: 'warehouse', key: 'navBusiness' },
  { id: 'earnings', icon: 'coins', key: 'navEarnings' },
  { id: 'items', icon: 'trophy', key: 'navItems' },
  { id: 'profile', icon: 'worker', key: 'navProfile' },
];

function subScreenTitle(sub: Exclude<SubScreen, null>, t: ReturnType<typeof empireText>): string {
  if (sub.type === 'start-business') return t.chooseSectorTitle;
  if (sub.type === 'manage-company') return t.manageCompany;
  return t.forbesTitle;
}

function rootTitle(tab: RootTab, t: ReturnType<typeof empireText>): string {
  const map: Record<RootTab, string> = {
    investing: t.investingTitle,
    business: t.businessTitle,
    earnings: t.brand,
    items: t.itemsTitle,
    profile: t.profileTitle,
  };
  return map[tab];
}

export function renderEmpireShell(options: EmpireShellOptions) {
  const { root, locale, state, tab, subScreen, offlineEarnedCents, content } = options;
  applyLocale(document.documentElement, locale);
  const t = empireText(locale);
  const isSub = subScreen !== null;

  const balancePill = el('span', 'header-balance-pill',
    el('span', 'header-balance-label', t.balance),
    el('bdi', 'header-balance-val', formatUsd(state.balanceCents, true)),
  );
  balancePill.querySelector('.header-balance-val')?.setAttribute('dir', 'ltr');
  balancePill.querySelector('.header-balance-val')?.setAttribute('data-live-balance', 'compact');

  let header: HTMLElement;
  if (isSub) {
    const backBtn = action(locale === 'ar' ? `→ ${t.back}` : `← ${t.back}`, options.onBack, 'secondary empire-back-btn');
    backBtn.dataset.empireBack = '';
    const title = el('h1', 'empire-header-title', subScreenTitle(subScreen, t));
    title.id = 'empire-title';
    header = el('header', 'empire-topbar is-subscreen', backBtn, title, balancePill);
  } else {
    const langBtn = action(t.language, options.onToggleLanguage, 'language empire-lang-btn');
    langBtn.lang = locale === 'ar' ? 'en' : 'ar';
    const title = el('h1', 'empire-header-title', rootTitle(tab, t));
    title.id = 'empire-title';
    header = el('header', 'empire-topbar',
      el('div', 'empire-topbar-start',
        tab === 'earnings' ? el('span', 'empire-logo-mark', '$') : null,
        title,
      ),
      tab === 'earnings' ? langBtn : balancePill,
    );
  }

  const offlineBanner = offlineEarnedCents && offlineEarnedCents > 0n
    ? el('section', 'panel offline-toast',
      el('div', '',
        el('strong', '', t.offlineTitle),
        el('p', 'muted', t.offlineEarned, ' ', el('bdi', 'offline-amount', formatUsd(offlineEarnedCents))),
      ),
      action(t.dismiss, options.onDismissOffline, 'primary'),
    )
    : null;

  const affordableCount = affordableSectorsCount(state);
  const bottomNav = isSub ? null : (() => {
    const nav = el('nav', 'bottom-nav');
    nav.setAttribute('aria-label', t.brand);
    for (const item of navDefs) {
      const isCenter = item.id === 'earnings';
      const active = tab === item.id;
      const btn = el('button', `bottom-nav-item ${isCenter ? 'is-center' : ''} ${active ? 'is-active' : ''}`,
        isCenter
          ? el('span', 'center-fab', '$')
          : el('span', 'bottom-nav-icon', gameIcon(item.icon)),
        el('span', 'bottom-nav-label', t[item.key]),
        item.id === 'business' && affordableCount > 0 && !active ? el('span', 'nav-alert-dot', '') : null,
      );
      btn.type = 'button';
      btn.dataset.navTab = item.id;
      if (active) btn.setAttribute('aria-current', 'page');
      btn.addEventListener('click', () => options.onSelectTab(item.id));
      nav.append(btn);
    }
    return nav;
  })();

  const shell = el('div', `empire-shell ${isSub ? 'has-subscreen' : 'has-bottom-nav'}`,
    header,
    el('main', 'empire-main', offlineBanner, content),
    bottomNav,
  );
  shell.dataset.empireTab = tab;
  if (subScreen) shell.dataset.empireSubscreen = subScreen.type;
  root.replaceChildren(shell);
}
