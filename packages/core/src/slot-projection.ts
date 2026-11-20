/** Root styles explicitly supported across framework-owned slot fragments. */
const slotProperties = [
  'inline-size',
  'block-size',
  'min-inline-size',
  'max-inline-size',
  'display',
  'flex',
  'margin-inline-start',
  'margin-inline-end',
  'border-radius',
  'background',
] as const;

type SlotStyles = Partial<Record<(typeof slotProperties)[number], string>>;

/** Frameworks keep their DOM; only explicitly supplied root styles cross.
 * The local reset prevents those styles leaking into nested independent slots.
 * display:contents is structural: a projected display value belongs to the roots.
 */
export const slotProjectionShadow = `<style>
:host { display: contents !important; ${slotProperties.map((property) => `--lab-slot-${property}: initial;`).join(' ')} }
::slotted(*) { ${slotProperties.map((property) => `${property}: var(--lab-slot-${property}, revert-layer);`).join(' ')} }
</style><slot></slot>`;

export const slotProjectionShadowHtml = `<template shadowrootmode="open">${slotProjectionShadow}</template>`;

/** One declaration styles direct elements and projected fragment roots alike. */
export function slotStyleCss(selector: string, styles: SlotStyles): string {
  return `${selector} {
  ${Object.entries(styles)
    .map(
      ([property, value]) =>
        `--lab-slot-${property}: ${value}; ${property}: var(--lab-slot-${property});`,
    )
    .join('\n  ')}
}`;
}

/** Same dimensions for direct elements and roots of a framework slot fragment. */
export function slotSizeCss(selector: string, inlineSize: string, blockSize?: string): string {
  return slotStyleCss(selector, {
    'inline-size': inlineSize,
    ...(blockSize === undefined ? {} : { 'block-size': blockSize }),
  });
}

/** A named adapter slot may contain framework-owned projection fragments.
 * Resolve their roots without moving nodes or walking inside actual controls.
 */
export function projectedSlotNodes(slot: HTMLSlotElement | null): Node[] {
  const roots = (node: Node): Node[] =>
    node instanceof Element && node.localName === 'lab-slot'
      ? Array.from(node.childNodes)
          .filter((child) => !(child instanceof Element) || child.localName !== 'template')
          .flatMap(roots)
      : [node];
  return (slot?.assignedNodes({ flatten: true }) ?? []).flatMap(roots);
}

export function projectedSlotElements(slot: HTMLSlotElement | null): Element[] {
  return projectedSlotNodes(slot).filter((node): node is Element => node instanceof Element);
}

/** Called by a receiving element, after the browser/SSR environment exists. */
export function ensureSlotProjection(): void {
  if (typeof customElements === 'undefined' || customElements.get('lab-slot')) return;
  customElements.define(
    'lab-slot',
    class extends HTMLElement {
      constructor() {
        super();
        if (!this.shadowRoot) this.attachShadow({ mode: 'open' }).innerHTML = slotProjectionShadow;
      }
    },
  );
}
