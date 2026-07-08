/**
 * `<lab-kbd>` — a single keyboard key, rendered as a raised, monospaced cap.
 *
 * Axes (the Figma Kbd model — 8 variants are size × the raised-key styling):
 *   - size: s | m | l   (cap dimensions; the key text comes from the default slot)
 *
 * Kbd is PRESENTATIONAL — it has no interaction state a machine would own (no
 * open/value/pressed/roving/typeahead). It is static typography in a styled box,
 * so per core-CONTRACT §1 it legitimately opts out of the Zag seam and extends
 * `LabElement` only for the shared base conventions. (craft-arch: no onion for a
 * key cap.)
 *
 * Semantics: the real `<kbd>` element carries the "keyboard input" meaning to
 * assistive tech for free — the host slots its content into a `<kbd>`, never a
 * `<span>` dressed as one.
 *
 * Token contract (core-CONTRACT §2): consumes ONLY semantic --lab-* roles +
 * dimension tokens. The cap surface is the neutral tinted fill; the rim is the
 * neutral base border; the "raised" depth is the shadow stack
 * (`--lab-fx-shadow-*`). No hex, no primitive, no colour fallback.
 */
import { type TemplateResult, css, html } from 'lit';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';

/** Cap size. */
export type LabKbdSize = 's' | 'm' | 'l';

export class LabKbd extends LabElement {
  static override properties = {
    size: { reflect: true },
  };

  declare size: LabKbdSize;

  constructor() {
    super();
    this.size = 'm';
  }

  static override styles = css`
    :host {
      --_radius: ${litVar('--lab-radius-control', '0.5rem')};
      --_font: ${litVar('--lab-font-size-xs', '0.8333rem')};
      --_pad-x: ${litVar('--lab-space-sm', '0.5rem')};
      --_min: 1.5rem;

      display: inline-flex;
      vertical-align: middle;
    }

    :host([size='s']) {
      --_font: ${litVar('--lab-font-size-xxs', '0.6944rem')};
      --_pad-x: ${litVar('--lab-space-xs', '0.25rem')};
      --_min: 1.25rem;
    }
    :host([size='l']) {
      --_font: ${litVar('--lab-font-size-md', '1rem')};
      --_pad-x: ${litVar('--lab-space-md', '1rem')};
      --_min: 2rem;
    }

    kbd {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: var(--_min);
      min-height: var(--_min);
      padding-inline: var(--_pad-x);
      border-radius: var(--_radius);
      /* The raised cap: a neutral tinted surface, a neutral base rim, and a thin
         bottom-biased shadow so the key reads as standing above the page. */
      background-color: ${litVar('--lab-fill-neutral-tinted')};
      border: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-neutral')};
      box-shadow: var(--lab-elevation-resting);
      color: ${litVar('--lab-label-primary')};
      font-family: ${litVar('--lab-font-family-mono')};
      font-size: var(--_font);
      line-height: 1;
      font-weight: ${litVar('--lab-font-weight-semibold', '600')};
      white-space: nowrap;
    }
  `;

  override render(): TemplateResult {
    return html`
      <kbd part="key"><slot></slot></kbd>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-kbd': LabKbd;
  }
}

// Idempotent registration (core-CONTRACT §7).
if (typeof customElements !== 'undefined' && !customElements.get('lab-kbd')) {
  customElements.define('lab-kbd', LabKbd);
}
