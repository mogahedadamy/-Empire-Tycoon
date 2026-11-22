/** Native DOM components for labels, decisions, figures and keyboard focus. */
type Child = Node | string | null;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, className: string, ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children.filter((child): child is Node | string => child !== null));
  return node;
}

export function action(label: string, onClick: () => void, variant = 'primary') {
  const button = el('button', `button ${variant}`, label);
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

export function figure(value: string, unit?: string) {
  return el('span', 'figure', el('bdi', '', value), unit ? el('small', '', unit) : null);
}

export function detailRows(rows: readonly (readonly [string, Child])[]) {
  return el('dl', 'detail-rows', ...rows.map(([label, value]) =>
    el('div', '', el('dt', '', label), el('dd', '', value)),
  ));
}

export function notice(title: string, body: string, tone: 'warning' | 'success' | 'error' = 'warning') {
  return el('div', `notice ${tone}`, el('strong', '', title), el('p', '', body));
}

/** Moves keyboard and screen-reader focus to a new view heading. */
export function focusHeading(heading: HTMLElement) {
  heading.tabIndex = -1;
  heading.focus();
}
