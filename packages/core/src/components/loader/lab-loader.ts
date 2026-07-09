/**
 * `<lab-loader>` — an indeterminate spinner that announces a busy state.
 *
 * Axes (the Figma Loader model — 4 variants are the size ladder):
 *   - size: s | m | l   (spinner diameter; stroke scales with it)
 *
 * Loader is PRESENTATIONAL — it has no interaction state a machine would own (no
 * open/value/pressed/roving/typeahead). It is a CSS animation in a box, so per
 * core-CONTRACT §1 it legitimately opts out of the Zag seam and extends
 * `LabElement` only for the shared base conventions. (craft-arch: no onion for a
 * spinner.)
 *
 * HONESTY (owner's iron rule on stop-gaps): this loader is INDETERMINATE only.
 * It does not take a `value`/`percent` prop, because nothing here would feed it a
 * real figure — a progress number with no source is a fake. A true determinate
 * progress bar (with a value bound to actual work) is a separate component
 * (Progress, a later chapter), not a flag bolted on here.
 *
 * a11y: the host carries role="status" and aria-busy="true" so assistive tech
 * announces an in-progress operation; the visible spinner is aria-hidden (it is
 * decoration). The accessible name is the `label` attribute (default
 * "Loading…"), reflected into a visually-hidden live region. Honoring
 * `prefers-reduced-motion`, the spin is stilled to a static ring.
 *
 * Token contract (core-CONTRACT §2): the ring is drawn from `currentColor`, so
 * the consumer sets the colour with a semantic --lab-* role on (or above) the
 * element; the radius reads `--lab-radius-full`. No hex, no primitive.
 */
import { type TemplateResult, css, html } from 'lit';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';

/** Spinner size. */
export type LabLoaderSize = 's' | 'm' | 'l';

export class LabLoader extends LabElement {
  static override properties = {
    size: { reflect: true },
    label: {},
  };

  declare size: LabLoaderSize;
  declare label: string;

  constructor() {
    super();
    this.size = 'm';
    this.label = 'Loading…';
  }

  static override styles = css`
    :host {
      --_diameter: ${litVar('--lab-size-control-xl', '1.5rem')};
      --_stroke: ${litVar('--lab-size-loader-stroke-m', '0.1875rem')};

      display: inline-flex;
      vertical-align: middle;
      /* The ring inherits the host's text colour; a consumer paints it by setting
         color via a --lab-* role on or above the loader. */
      color: inherit;
    }

    :host([size='s']) {
      --_diameter: ${litVar('--lab-size-control-m', '1rem')};
      --_stroke: ${litVar('--lab-size-loader-stroke-s', '0.125rem')};
    }
    :host([size='l']) {
      --_diameter: ${litVar('--lab-size-control-h-m', '2.5rem')};
      --_stroke: ${litVar('--lab-size-loader-stroke-l', '0.25rem')};
    }

    .spinner {
      box-sizing: border-box;
      width: var(--_diameter);
      height: var(--_diameter);
      border: var(--_stroke) solid currentColor;
      border-right-color: transparent;
      border-radius: ${litVar('--lab-radius-full', '9999px')};
      animation: spin 0.7s linear infinite;
    }

    /* Visually-hidden accessible name, kept in a live region the host announces. */
    .label {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation-duration: 0s;
      }
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;

  override render(): TemplateResult {
    return html`
      <span class="spinner" part="spinner" aria-hidden="true"></span>
      <span class="label">${this.label}</span>
    `;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // The host IS the status region: it announces a busy state to assistive tech.
    // Set on the host (not a child) so the role survives slotting and SSR.
    if (!this.hasAttribute('role')) this.setAttribute('role', 'status');
    this.setAttribute('aria-busy', 'true');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-loader': LabLoader;
  }
}

// Idempotent registration (core-CONTRACT §7).
if (typeof customElements !== 'undefined' && !customElements.get('lab-loader')) {
  customElements.define('lab-loader', LabLoader);
}
