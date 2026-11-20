/** Framework-owned slot fragments keep their DOM and a native projection boundary.
 * Only geometry explicitly supplied by the receiving component crosses it.
 * The local reset prevents one component's geometry leaking into nested slots.
 */
export const slotProjectionShadow = `<style>
:host { display: contents; --lab-slot-inline-size: initial; --lab-slot-block-size: initial; }
::slotted(*) { inline-size: var(--lab-slot-inline-size, revert-layer); block-size: var(--lab-slot-block-size, revert-layer); }
</style><slot></slot>`;

export const slotProjectionShadowHtml = `<template shadowrootmode="open">${slotProjectionShadow}</template>`;

/** Same dimensions for direct elements and roots of a framework slot fragment. */
export function slotSizeCss(selector: string, inlineSize: string, blockSize?: string): string {
  return `${selector} {
  --lab-slot-inline-size: ${inlineSize};
  --lab-slot-block-size: ${blockSize ?? 'initial'};
  inline-size: var(--lab-slot-inline-size);
  ${blockSize === undefined ? '' : 'block-size: var(--lab-slot-block-size);'}
}`;
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
