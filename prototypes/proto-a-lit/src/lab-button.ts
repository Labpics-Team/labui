import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

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
 * (label-*/fill-*/border-*/surface-*). It NEVER hardcodes a hex and NEVER
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

@customElement('lab-button')
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
      /* Resolved from --lab-* by the [type][kind] selectors below. */
      background-color: var(--_bg, transparent);
      color: var(--_fg, var(--lab-label-primary));
      border-color: var(--_bd, transparent);
    }

    /* Icon-only: square, no text padding asymmetry. */
    :host([icon]) button {
      width: var(--_min);
      padding: 0;
      aspect-ratio: 1;
    }

    /* ---- type=accent ---------------------------------------------------- */
    /* Roles read straight from the --lab-* contract — no hex fallbacks in the
       component. Every role is supplied by the active theme variable set. */
    :host([type='accent'][kind='fill']) button {
      --_bg: var(--lab-fill-accent);
      --_fg: var(--lab-label-on-accent);
    }
    :host([type='accent'][kind='tinted']) button {
      --_bg: var(--lab-fill-accent-tinted);
      --_fg: var(--lab-label-accent);
    }
    :host([type='accent'][kind='border']) button {
      --_fg: var(--lab-label-accent);
      --_bd: var(--lab-border-accent);
    }
    :host([type='accent'][kind='ghost']) button {
      --_fg: var(--lab-label-accent);
    }

    /* ---- type=neutral --------------------------------------------------- */
    :host([type='neutral'][kind='fill']) button {
      --_bg: var(--lab-fill-neutral);
      --_fg: var(--lab-label-on-neutral);
    }
    :host([type='neutral'][kind='tinted']) button {
      --_bg: var(--lab-fill-neutral-tinted);
      --_fg: var(--lab-label-primary);
    }
    :host([type='neutral'][kind='border']) button {
      --_fg: var(--lab-label-primary);
      --_bd: var(--lab-border-neutral);
    }
    :host([type='neutral'][kind='ghost']) button {
      --_fg: var(--lab-label-primary);
    }

    /* ---- type=danger ---------------------------------------------------- */
    :host([type='danger'][kind='fill']) button {
      --_bg: var(--lab-fill-danger);
      --_fg: var(--lab-label-on-danger);
    }
    :host([type='danger'][kind='tinted']) button {
      --_bg: var(--lab-fill-danger-tinted);
      --_fg: var(--lab-label-danger);
    }
    :host([type='danger'][kind='border']) button {
      --_fg: var(--lab-label-danger);
      --_bd: var(--lab-border-danger);
    }
    :host([type='danger'][kind='ghost']) button {
      --_fg: var(--lab-label-danger);
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
      position: absolute;
      width: 1em;
      height: 1em;
      border: 0.125rem solid currentColor;
      border-right-color: transparent;
      border-radius: var(--lab-radius-full, 9999px);
      animation: spin 0.7s linear infinite;
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
    return html`
      <button
        type=${this.htmlType}
        ?disabled=${inactive}
        aria-busy=${this.loading ? 'true' : nothing}
        aria-disabled=${this.disabled ? 'true' : nothing}
      >
        ${this.loading ? html`<span class="spinner" aria-hidden="true"></span>` : nothing}
        <span class="label">
          <slot name="icon"></slot>
          ${this.icon ? nothing : html`<slot></slot>`}
        </span>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-button': LabButton;
  }
}
