import { css, html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

/**
 * LabUI Button — prototype A (Lit / Web Components).
 *
 * Covers the owner's Figma axes structurally (not all 432 renders):
 *   - type:   accent | neutral | danger      (semantic intent)
 *   - kind:   fill | tinted | border | ghost  (surface treatment)
 *   - size:   s | m | l
 *   - icon:   square icon-only mode (boolean)
 *   - state:  default / hover / pressed / loading / disabled / focus
 *             (hover/pressed/focus are CSS pseudo-states; loading/disabled
 *              are reflected attributes the host drives)
 *
 * Contract: the component consumes ONLY --lab-* semantic custom properties
 * (label, fill, border, surface roles). It NEVER hardcodes a hex and NEVER
 * knows about Light/Dark — themes are imitated by swapping the --lab-* set on
 * an ancestor (owner decision: "компонент о темах не знает"). Custom
 * properties pierce the shadow boundary, so the contract reaches inside.
 *
 * Separation is done by SURFACE (fill/tinted/ghost differ by background), not
 * by a border laid on top. Border is its own role, used only by kind="border"
 * as the shape outline — never as a separator (owner decision).
 */

export type LabButtonType = 'accent' | 'neutral' | 'danger';
export type LabButtonKind = 'fill' | 'tinted' | 'border' | 'ghost';
export type LabButtonSize = 's' | 'm' | 'l';

export class LabButton extends LitElement {
  /** Semantic intent of the action. */
  @property({ reflect: true }) type: LabButtonType = 'accent';

  /** Surface treatment. Separation is by surface, not by a border on top. */
  @property({ reflect: true }) kind: LabButtonKind = 'fill';

  /** Control size. */
  @property({ reflect: true }) size: LabButtonSize = 'm';

  /** Square, icon-only button. */
  @property({ type: Boolean, reflect: true }) icon = false;

  /** Shows a spinner and blocks interaction without collapsing layout. */
  @property({ type: Boolean, reflect: true }) loading = false;

  /** Disables the control. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Native button type. */
  @property() htmlType: 'button' | 'submit' | 'reset' = 'button';

  /** Focusing the host delegates to the inner native button (a11y). */
  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  static override styles = css`
    :host {
      /* Token-driven knobs the size axis maps onto. No literal hex anywhere. */
      --_radius: var(--lab-radius-control, 0.5rem);
      --_font: var(--lab-font-size-md, 1rem);
      --_pad-x: var(--lab-space-md, 1rem);
      --_pad-y: var(--lab-space-sm, 0.5rem);
      --_gap: var(--lab-space-sm, 0.5rem);
      --_min: 2.5rem;

      display: inline-flex;
      vertical-align: middle;
    }

    :host([size='s']) {
      --_font: var(--lab-font-size-xs, 0.8333rem);
      --_pad-x: var(--lab-space-sm, 0.5rem);
      --_pad-y: var(--lab-space-xs, 0.25rem);
      --_min: 2rem;
    }
    :host([size='l']) {
      --_font: var(--lab-font-size-lg, 1.2rem);
      --_pad-x: var(--lab-space-lg, 1.5rem);
      --_pad-y: var(--lab-space-md, 1rem);
      --_min: 3rem;
    }

    button {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--_gap);
      min-height: var(--_min);
      padding: var(--_pad-y) var(--_pad-x);
      border-radius: var(--_radius);
      border: 0.0625rem solid transparent;
      font: inherit;
      font-size: var(--_font);
      line-height: var(--lab-line-height-md, 1.5);
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      /* Defensive direction faster than the relaxing one (motion principle):
         this prototype keeps it simple — a single short transition. */
      transition:
        background-color 120ms ease,
        border-color 120ms ease,
        color 120ms ease;
      /* Base: transparent surface, primary label. The [type][kind] selectors
         below override these directly with the --lab-* role. We set the
         longhands directly (not via an intermediate --_bg custom property): a
         var()->var() chain across the shadow boundary fails to re-invalidate in
         Chromium when the theme set is swapped, so the paint would go stale. */
      background-color: transparent;
      color: var(--lab-label-primary);
      border-color: transparent;
    }

    /* Icon-only: square, no text padding asymmetry. */
    :host([icon]) button {
      width: var(--_min);
      padding: 0;
      aspect-ratio: 1;
    }

    /* ---- type=accent ---------------------------------------------------- */
    /* Roles read straight from the --lab-* contract — no hex fallbacks in the
       component. Every role is supplied by the active theme variable set.
       Longhands set directly so a theme swap repaints (see base note). */
    :host([type='accent'][kind='fill']) button {
      background-color: var(--lab-fill-accent);
      color: var(--lab-label-on-accent);
    }
    :host([type='accent'][kind='tinted']) button {
      background-color: var(--lab-fill-accent-tinted);
      color: var(--lab-label-accent);
    }
    :host([type='accent'][kind='border']) button {
      color: var(--lab-label-accent);
      border-color: var(--lab-border-accent);
    }
    :host([type='accent'][kind='ghost']) button {
      color: var(--lab-label-accent);
    }

    /* ---- type=neutral --------------------------------------------------- */
    :host([type='neutral'][kind='fill']) button {
      background-color: var(--lab-fill-neutral);
      color: var(--lab-label-on-neutral);
    }
    :host([type='neutral'][kind='tinted']) button {
      background-color: var(--lab-fill-neutral-tinted);
      color: var(--lab-label-primary);
    }
    :host([type='neutral'][kind='border']) button {
      color: var(--lab-label-primary);
      border-color: var(--lab-border-neutral);
    }
    :host([type='neutral'][kind='ghost']) button {
      color: var(--lab-label-primary);
    }

    /* ---- type=danger ---------------------------------------------------- */
    :host([type='danger'][kind='fill']) button {
      background-color: var(--lab-fill-danger);
      color: var(--lab-label-on-danger);
    }
    :host([type='danger'][kind='tinted']) button {
      background-color: var(--lab-fill-danger-tinted);
      color: var(--lab-label-danger);
    }
    :host([type='danger'][kind='border']) button {
      color: var(--lab-label-danger);
      border-color: var(--lab-border-danger);
    }
    :host([type='danger'][kind='ghost']) button {
      color: var(--lab-label-danger);
    }

    /* ---- interactive states (hover / active / focus) -------------------- */
    button:hover {
      filter: brightness(1.08);
    }
    button:active {
      filter: brightness(0.92);
    }
    button:focus-visible {
      outline: 0.125rem solid var(--lab-border-focus);
      outline-offset: 0.125rem;
    }

    /* ---- disabled ------------------------------------------------------- */
    :host([disabled]) button,
    button[disabled] {
      cursor: not-allowed;
      opacity: 0.45;
      filter: none;
    }

    /* ---- loading -------------------------------------------------------- */
    :host([loading]) button {
      cursor: progress;
    }
    .label {
      display: inline-flex;
      align-items: center;
      gap: var(--_gap);
    }
    :host([loading]) .label {
      visibility: hidden;
    }
    .spinner {
      display: none;
      position: absolute;
      width: 1em;
      height: 1em;
      border: 0.125rem solid currentColor;
      border-right-color: transparent;
      border-radius: var(--lab-radius-full, 9999px);
      animation: spin 0.7s linear infinite;
    }
    :host([loading]) .spinner {
      display: block;
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation-duration: 0s;
      }
      button {
        transition: none;
      }
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    button {
      position: relative;
    }
  `;

  override render() {
    const inactive = this.disabled || this.loading;
    // Bindings kept SSR-safe for @lit-labs/ssr: ifDefined for optional
    // attributes (no bare `nothing` in attribute position), and the spinner is
    // always present but hidden via CSS when not loading — avoids a conditional
    // child template that the SSR renderer mishandles.
    return html`
      <button
        type=${this.htmlType}
        ?disabled=${inactive}
        aria-busy=${ifDefined(this.loading ? 'true' : undefined)}
        aria-disabled=${ifDefined(this.disabled ? 'true' : undefined)}
      >
        <span class="spinner" aria-hidden="true"></span>
        <span class="label">
          <slot name="icon"></slot>
          <slot></slot>
        </span>
      </button>
    `;
  }
}

// Idempotent registration. Lit SSR and client bundles can import this module
// more than once across module-instance boundaries; an unguarded
// customElements.define then throws "name has already been used". The guard
// makes the side-effect import safe to repeat.
if (typeof customElements !== 'undefined' && !customElements.get('lab-button')) {
  customElements.define('lab-button', LabButton);
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-button': LabButton;
  }
}
