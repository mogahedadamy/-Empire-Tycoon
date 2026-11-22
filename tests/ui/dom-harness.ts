/** Lightweight DOM environment for running real UI components in Node Vitest without extra deps. */
type Listener = (event: { type: string; target?: unknown }) => void;

function toCamel(attr: string) {
  return attr.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

function toKebab(prop: string) {
  return prop.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
}

export class FakeElement {
  readonly tagName: string;
  readonly attributes = new Map<string, string>();
  readonly children: (FakeElement | string)[] = [];
  readonly listeners = new Map<string, { fn: Listener; once?: boolean }[]>();
  readonly style = { values: new Map<string, string>(), setProperty(k: string, v: string) { this.values.set(k, v); } };
  parentNode: FakeElement | null = null;
  type = '';
  value = '';
  name = '';
  checked = false;
  disabled = false;
  hidden = false;
  dir = '';
  lang = '';
  min = '';
  step = '';
  inputMode = '';
  htmlFor = '';
  scope = '';
  href = '';
  src = '';
  alt = '';
  width = 0;
  height = 0;
  max = 0;
  tabIndex = 0;
  open = false;
  readonly dataset: Record<string, string>;
  readonly classList: { add: (...names: string[]) => void; contains: (name: string) => boolean };

  constructor(tag: string, private readonly env: FakeDomEnv) {
    this.tagName = tag.toUpperCase();
    this.dataset = new Proxy<Record<string, string>>({}, {
      get: (_, prop: string) => this.attributes.get(`data-${toKebab(prop)}`),
      set: (_, prop: string, val: string) => { this.attributes.set(`data-${toKebab(prop)}`, String(val)); return true; },
    });
    this.classList = {
      add: (...names) => {
        const set = new Set((this.attributes.get('class') ?? '').split(/\s+/).filter(Boolean));
        for (const name of names) set.add(name);
        this.attributes.set('class', [...set].join(' '));
      },
      contains: (name) => (this.attributes.get('class') ?? '').split(/\s+/).includes(name),
    };
  }

  get className() { return this.attributes.get('class') ?? ''; }
  set className(val: string) { this.attributes.set('class', val); }
  get id() { return this.attributes.get('id') ?? ''; }
  set id(val: string) { this.attributes.set('id', val); }
  get isConnected() { let cur: FakeElement | null = this; while (cur) { if (cur === this.env.root) return true; cur = cur.parentNode; } return false; }
  get childElementCount() { return this.children.filter((c): c is FakeElement => c instanceof FakeElement).length; }
  get firstElementChild(): FakeElement | null { return this.children.find((c): c is FakeElement => c instanceof FakeElement) ?? null; }

  get textContent(): string {
    return this.children.map((c) => typeof c === 'string' ? c : c.textContent).join('');
  }
  set textContent(val: string) {
    for (const c of this.children) if (c instanceof FakeElement) c.parentNode = null;
    this.children.length = 0;
    if (val) this.children.push(val);
  }

  setAttribute(name: string, val: string) {
    this.attributes.set(name, String(val));
    if (name === 'dir') this.dir = String(val);
    if (name === 'lang') this.lang = String(val);
  }
  getAttribute(name: string) {
    if (name === 'dir' && this.dir) return this.dir;
    if (name === 'lang' && this.lang) return this.lang;
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string) { return this.attributes.has(name); }

  append(...nodes: (FakeElement | string)[]) {
    for (const node of nodes) {
      if (node instanceof FakeElement) { node.remove(); node.parentNode = this; }
      this.children.push(node);
    }
  }
  prepend(...nodes: (FakeElement | string)[]) {
    for (const node of [...nodes].reverse()) {
      if (node instanceof FakeElement) { node.remove(); node.parentNode = this; }
      this.children.unshift(node);
    }
  }
  replaceChildren(...nodes: (FakeElement | string)[]) {
    for (const c of this.children) if (c instanceof FakeElement) c.parentNode = null;
    this.children.length = 0;
    this.append(...nodes);
  }
  remove() {
    if (!this.parentNode) return;
    const idx = this.parentNode.children.indexOf(this);
    if (idx >= 0) this.parentNode.children.splice(idx, 1);
    this.parentNode = null;
  }

  addEventListener(type: string, fn: Listener, opts?: { once?: boolean }) {
    const list = this.listeners.get(type) ?? [];
    list.push({ fn, once: opts?.once });
    this.listeners.set(type, list);
  }
  removeEventListener(type: string, fn: Listener) {
    const list = this.listeners.get(type);
    if (list) this.listeners.set(type, list.filter((entry) => entry.fn !== fn));
  }
  dispatchEvent(event: { type: string }) {
    const list = [...(this.listeners.get(event.type) ?? [])];
    for (const entry of list) {
      if (entry.once) this.removeEventListener(event.type, entry.fn);
      entry.fn({ ...event, target: this });
    }
    return true;
  }

  click() {
    if (this.disabled) return;
    if (this.tagName === 'INPUT' && this.type === 'radio') {
      this.checked = true;
      this.dispatchEvent({ type: 'change' });
      return;
    }
    this.dispatchEvent({ type: 'click' });
  }
  input(val: string) {
    this.value = val;
    this.dispatchEvent({ type: 'input' });
  }
  focus() { this.env.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent({ type: 'close' }); }

  matchesSimple(part: string): boolean {
    const tokens = part.match(/(?:#[\w-]+|\.[\w-]+|\[[^\]]+\]|[a-zA-Z0-9-]+)/g) ?? [];
    for (const token of tokens) {
      if (token.startsWith('#')) { if (this.id !== token.slice(1)) return false; }
      else if (token.startsWith('.')) { if (!this.classList.contains(token.slice(1))) return false; }
      else if (token.startsWith('[')) {
        const match = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(token);
        if (!match) return false;
        const [, attr, expected] = match;
        const actual = attr.startsWith('data-') ? this.dataset[toCamel(attr.slice(5))] : this.getAttribute(attr);
        if (expected === undefined) { if (actual === null || actual === undefined) return false; }
        else if (actual !== expected) return false;
      } else if (this.tagName !== token.toUpperCase()) return false;
    }
    return tokens.length > 0;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const groups = selector.split(',').map((s) => s.trim().split(/\s+/)).filter((g) => g.length > 0);
    const out: FakeElement[] = [];
    const matchesChain = (el: FakeElement, chain: string[]): boolean => {
      if (!el.matchesSimple(chain[chain.length - 1])) return false;
      if (chain.length === 1) return true;
      let ancestor = el.parentNode;
      while (ancestor) {
        if (matchesChain(ancestor, chain.slice(0, -1))) return true;
        ancestor = ancestor.parentNode;
      }
      return false;
    };
    const walk = (node: FakeElement) => {
      for (const child of node.children) {
        if (!(child instanceof FakeElement)) continue;
        if (groups.some((chain) => matchesChain(child, chain))) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

export class FakeDomEnv {
  readonly documentElement: FakeElement;
  readonly root: FakeElement;
  readonly live: FakeElement;
  activeElement: FakeElement | null = null;
  hidden = false;
  private readonly docListeners = new Map<string, Listener[]>();
  private readonly winListeners = new Map<string, Listener[]>();

  constructor() {
    this.documentElement = new FakeElement('html', this);
    this.root = new FakeElement('div', this);
    this.live = new FakeElement('div', this);
  }

  install() {
    const prev = { document: globalThis.document, window: globalThis.window, HTMLElement: globalThis.HTMLElement };
    const env = this;
    Object.assign(globalThis, {
      HTMLElement: FakeElement,
      document: {
        documentElement: env.documentElement,
        get activeElement() { return env.activeElement; },
        get hidden() { return env.hidden; },
        createElement: (tag: string) => new FakeElement(tag, env),
        addEventListener: (t: string, fn: Listener) => { (env.docListeners.get(t) ?? env.docListeners.set(t, []).get(t)!).push(fn); },
        removeEventListener: (t: string, fn: Listener) => { env.docListeners.set(t, (env.docListeners.get(t) ?? []).filter((f) => f !== fn)); },
      },
      window: {
        scrollTo: () => {},
        addEventListener: (t: string, fn: Listener) => { (env.winListeners.get(t) ?? env.winListeners.set(t, []).get(t)!).push(fn); },
        removeEventListener: (t: string, fn: Listener) => { env.winListeners.set(t, (env.winListeners.get(t) ?? []).filter((f) => f !== fn)); },
      },
    });
    return () => Object.assign(globalThis, prev);
  }
}
