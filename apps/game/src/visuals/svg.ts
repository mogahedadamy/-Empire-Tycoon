/** Builds accessible decorative SVG nodes in both real browsers and lightweight Node DOM harnesses. */
const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl(
  tag: string,
  attrs: Record<string, string | number>,
  ...children: (Node | string | null | undefined)[]
): HTMLElement {
  const node = typeof document.createElementNS === 'function'
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child !== null && child !== undefined) node.append(child);
  }
  return node as unknown as HTMLElement;
}
