/**
 * `<lab-badge>` — a small pill that labels or counts, carrying a sentiment.
 *
 * Axes (the Figma Badge model — 30 variants: Color × Type × Disabled):
 *   - color: neutral | brand | danger | warning | success | info
 *            | static-dark | static-light   (the sentiment / accent role family)
 *   - type:  fill | tinted                  (opaque sentiment surface vs. low-alpha tint)
 *   - disabled: dimmed, non-interactive presentation (boolean)
 *
 * Badge is PRESENTATIONAL — it has no interaction state a machine would own (no
 * open/value/pressed/roving/typeahead). It is a static label, so per
 * core-CONTRACT §1 it legitimately opts out of the Zag seam and extends
 * `LabElement` only for the shared base conventions. (craft-arch: no onion for a
 * pill.)
 *
 * Semantics: a badge that merely labels is decorative text; the default slot
 * carries its content and the host adds no role. When a badge conveys status
 * that is not otherwise in the text, the consumer supplies an accessible name
 * (aria-label / visually-hidden text) — the element never fakes one.
 *
 * Token contract (core-CONTRACT §2): consumes ONLY semantic --lab-* roles +
 * dimension tokens through `litVar`. Fill surfaces read the opaque sentiment
 * primitive (via the `-strong` border role, the only opaque sentiment surface in
 * the contract) paired with the Badge contrast-label roles; tinted surfaces read
 * the `--lab-fill-{family}-primary` @12 tint paired with the matching
 * `--lab-label-{family}-primary`. No hex, no primitive, no colour fallback.
 */
import { type TemplateResult, css, html } from 'lit';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';

/** Sentiment / accent colour family the badge paints from. */
export type LabBadgeColor =
  | 'neutral'
  | 'brand'
  | 'danger'
  | 'warning'
  | 'success'
  | 'info'
  | 'static-dark'
  | 'static-light';
/** Surface treatment: opaque fill vs. low-alpha tint. */
export type LabBadgeType = 'fill' | 'tinted';

export class LabBadge extends LabElement {
  static override properties = {
    color: { reflect: true },
    type: { reflect: true },
    disabled: { type: Boolean, reflect: true },
  };

  declare color: LabBadgeColor;
  declare type: LabBadgeType;
  declare disabled: boolean;

  constructor() {
    super();
    this.color = 'neutral';
    this.type = 'fill';
    this.disabled = false;
  }

  static override styles = css`
    :host {
      --_radius: ${litVar('--lab-radius-full', '9999px')};
      --_font: ${litVar('--lab-font-size-xs', '0.8333rem')};
      --_pad-x: ${litVar('--lab-space-sm', '0.5rem')};
      --_pad-y: ${litVar('--lab-space-xs', '0.25rem')};
      --_gap: ${litVar('--lab-space-xs', '0.25rem')};

      display: inline-flex;
      vertical-align: middle;
    }

    .badge {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--_gap);
      min-height: ${litVar('--lab-size-control-l', '1.25rem')};
      padding: var(--_pad-y) var(--_pad-x);
      border-radius: var(--_radius);
      font: inherit;
      font-size: var(--_font);
      line-height: ${litVar('--lab-line-height-md', '1.5')};
      font-weight: ${litVar('--lab-font-weight-semibold', '600')};
      white-space: nowrap;
      /* Base surface; the [color][type] rules set the longhands directly (the
         proto-A var()->var() shadow-boundary note — no intermediate --_bg). */
      background-color: transparent;
      color: ${litVar('--lab-label-primary')};
    }

    /* The dot/icon slot: a small indicator that inherits the label colour. */
    ::slotted([slot='dot']) {
      display: inline-block;
      width: 0.5em;
      height: 0.5em;
      border-radius: ${litVar('--lab-radius-full', '9999px')};
      background-color: currentColor;
      flex: none;
    }

    /* ── type=fill: opaque sentiment surface + contrast label ──────────────── */
    /* The opaque sentiment surface is the -strong border primitive (the only
       full-opacity sentiment colour the role contract exposes). The on-fill
       label is the Badge contrast-label pairing role. */
    :host([type='fill'][color='neutral']) .badge {
      background-color: ${litVar('--lab-fill-neutral')};
      color: ${litVar('--lab-label-on-neutral')};
    }
    :host([type='fill'][color='brand']) .badge {
      background-color: ${litVar('--lab-badge-fill-brand')};
      color: ${litVar('--lab-badge-label-on-brand')};
    }
    :host([type='fill'][color='danger']) .badge {
      background-color: ${litVar('--lab-badge-fill-danger')};
      color: ${litVar('--lab-badge-label-on-danger')};
    }
    :host([type='fill'][color='warning']) .badge {
      background-color: ${litVar('--lab-badge-fill-warning')};
      color: ${litVar('--lab-badge-label-on-warning')};
    }
    :host([type='fill'][color='success']) .badge {
      background-color: ${litVar('--lab-badge-fill-success')};
      color: ${litVar('--lab-badge-label-on-success')};
    }
    :host([type='fill'][color='info']) .badge {
      background-color: ${litVar('--lab-badge-fill-info')};
      color: ${litVar('--lab-badge-label-on-info')};
    }
    :host([type='fill'][color='static-dark']) .badge {
      background-color: ${litVar('--lab-badge-fill-static-dark')};
      color: ${litVar('--lab-badge-label-on-static-dark')};
    }
    :host([type='fill'][color='static-light']) .badge {
      background-color: ${litVar('--lab-badge-fill-static-light')};
      color: ${litVar('--lab-badge-label-on-static-light')};
    }

    /* ── type=tinted: low-alpha sentiment tint + sentiment label ───────────── */
    :host([type='tinted'][color='neutral']) .badge {
      background-color: ${litVar('--lab-fill-primary')};
      color: ${litVar('--lab-label-primary')};
    }
    :host([type='tinted'][color='brand']) .badge {
      background-color: ${litVar('--lab-fill-brand-primary')};
      color: ${litVar('--lab-label-brand-primary')};
    }
    :host([type='tinted'][color='danger']) .badge {
      background-color: ${litVar('--lab-fill-danger-primary')};
      color: ${litVar('--lab-label-danger-primary')};
    }
    :host([type='tinted'][color='warning']) .badge {
      background-color: ${litVar('--lab-fill-warning-primary')};
      color: ${litVar('--lab-label-warning-primary')};
    }
    :host([type='tinted'][color='success']) .badge {
      background-color: ${litVar('--lab-fill-success-primary')};
      color: ${litVar('--lab-label-success-primary')};
    }
    :host([type='tinted'][color='info']) .badge {
      background-color: ${litVar('--lab-fill-info-primary')};
      color: ${litVar('--lab-label-info-primary')};
    }
    /* Tinted static: полупрозрачный семейный тинт — лейбл СЕМЕЙНЫЙ примитив
       (канон Figma и React-близнеца); перекрёстные label-on-* — только для
       НЕПРОЗРАЧНЫХ fill-заливок закона пары. */
    :host([type='tinted'][color='static-dark']) .badge {
      background-color: ${litVar('--lab-fill-static-dark-primary')};
      color: ${litVar('--lab-label-static-dark-primary')};
    }
    :host([type='tinted'][color='static-light']) .badge {
      background-color: ${litVar('--lab-fill-static-light-primary')};
      color: ${litVar('--lab-label-static-light-primary')};
    }

    /* ── disabled: a dimmed, non-interactive presentation ──────────────────── */
    :host([disabled]) .badge {
      opacity: 0.45;
    }
  `;

  override render(): TemplateResult {
    return html`
      <span class="badge" part="badge">
        <slot name="dot"></slot>
        <slot></slot>
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-badge': LabBadge;
  }
}

// Idempotent registration (core-CONTRACT §7) — safe to import across module
// instances on both the SSR and client paths.
if (typeof customElements !== 'undefined' && !customElements.get('lab-badge')) {
  customElements.define('lab-badge', LabBadge);
}
