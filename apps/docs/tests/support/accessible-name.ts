import type { Locator } from '@playwright/test';

/**
 * Cross-browser accessible-name + a11y-visibility helpers for the hidden native
 * input that IS the a11y primitive of `<lab-switch>` / `<lab-checkbox>` (and their
 * React twins). We resolve the name the way an AT does — preferring an explicit
 * `aria-label`, else the `aria-labelledby` target's text — and we verify the input
 * is NOT buried in an `aria-hidden` subtree (which would erase the control from the
 * a11y tree entirely). Pure DOM, so it runs identically on Chromium AND WebKit
 * (CDP / page.accessibility are Chromium-only and unsuitable for a parity suite).
 *
 * The input lives in the Lit shadow root or the React light DOM; the caller passes
 * a locator that already resolves to that input. `evaluate` pierces shadow DOM.
 */

export interface A11yProbe {
  /** Computed accessible name (aria-label, else resolved aria-labelledby text). */
  name: string;
  /** True when the input (or any ancestor) is in an aria-hidden subtree. */
  ariaHidden: boolean;
  /** Whether every aria-labelledby idref resolves to an existing element. */
  labelledbyResolves: boolean;
  /** The input's own id (for uniqueness checks). */
  id: string;
  /** Native checked DOM property (the a11y checked state). */
  checked: boolean;
  /** Native indeterminate DOM property (a11y "mixed"). */
  indeterminate: boolean;
}

/** Compute the a11y probe for an `<input>` locator (shadow- or light-DOM). */
export function probeInput(input: Locator): Promise<A11yProbe> {
  return input.evaluate((el) => {
    const node = el as HTMLInputElement;
    const root = node.getRootNode() as Document | ShadowRoot;

    let ariaHidden = false;
    for (let cur: Element | null = node; cur; cur = cur.parentElement) {
      if (cur.getAttribute('aria-hidden') === 'true') {
        ariaHidden = true;
        break;
      }
    }

    const labelledby = (node.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
    const labelledbyResolves =
      labelledby.length > 0 && labelledby.every((id) => root.getElementById(id) != null);

    // Resolve the rendered text of a referenced element. In Lit the label part is
    // `<span class="label"><slot></slot></span>` — its own textContent is empty
    // because the real text is light-DOM content PROJECTED through the slot. The
    // browser's accessible-name computation follows that projection, so we resolve
    // a contained default <slot> to its assigned nodes' text (what a screen reader
    // actually announces). React has no slot, so plain textContent suffices.
    const renderedText = (el: Element | null): string => {
      if (!el) return '';
      const slot = el.querySelector('slot:not([name])');
      if (slot) {
        return (slot as HTMLSlotElement)
          .assignedNodes({ flatten: true })
          .map((n) => n.textContent ?? '')
          .join('')
          .trim();
      }
      return el.textContent?.trim() ?? '';
    };

    const ariaLabel = node.getAttribute('aria-label')?.trim();
    let name = ariaLabel ?? '';
    if (!name && labelledby.length > 0) {
      name = labelledby
        .map((id) => renderedText(root.getElementById(id)))
        .filter(Boolean)
        .join(' ');
    }

    return {
      name,
      ariaHidden,
      labelledbyResolves,
      id: node.id,
      checked: node.checked,
      indeterminate: node.indeterminate,
    };
  });
}

/** All hidden-input ids for a given Lit custom-element tag (shadow-pierced). */
export function litInputIds(locator: Locator, tag: string): Promise<string[]> {
  return locator.evaluate(
    (_root, t) =>
      Array.from(document.querySelectorAll(t)).map(
        (host) => (host as HTMLElement).shadowRoot?.querySelector('input')?.id ?? '',
      ),
    tag,
  );
}
