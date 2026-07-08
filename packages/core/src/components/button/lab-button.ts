/**
 * `<lab-button>` — the first production LabUI component and the EXEMPLAR every
 * other one is cloned from.
 *
 * Axes (the Figma model, 1:1 onto attributes — see core-CONTRACT §3):
 *   - type:  accent | neutral | danger      (semantic intent of the action)
 *   - kind:  fill | tinted | border | ghost   (surface treatment)
 *   - size:  s | m | l
 *   - icon:  square, icon-only mode (boolean)
 *   - loading: spinner shown without collapsing layout (boolean)
 *   - disabled: non-interactive (boolean)
 *   - htmlType: native button type — button | submit | reset
 *
 * State axes (default / hover / pressed / focus / loading / disabled) are NOT
 * consumer-set: hover/active/focus-visible are native CSS pseudo-states on the
 * real `<button>`; loading/disabled are the two reflected inputs above.
 *
 * Behaviors seam — a deliberate, documented exception to core-CONTRACT §1:
 * a Button has NO interaction state a state machine would own (no open/value/
 * pressed lifecycle, no roving focus, no typeahead). A native `<button>` already
 * carries the correct role, keyboard activation (Enter/Space), and focus. Wiring
 * a Zag machine here would add a dependency and a render cycle to reflect state
 * the platform already owns — machinery for a checkbox the platform ships. So
 * this element extends `LabElement` (for `delegatesFocus` + the shared base
 * conventions) but does NOT call `runMachine`. The seam stays available for
 * components that need it; Button honestly opts out. (craft-arch: do not build
 * an onion for a button.)
 *
 * Token contract (core-CONTRACT §2): the element consumes ONLY semantic --lab-*
 * roles + dimension tokens through `litVar`. No hex, no primitive, no colour
 * fallback. A theme is a different binding of those roles on an ancestor — the
 * element never knows which theme is active.
 *
 * SSR (core-CONTRACT §7): the spinner is ALWAYS present (hidden by CSS when not
 * loading), and optional attributes use `ifDefined`, so `@lit-labs/ssr` emits a
 * meaningful, styled `<button>` in the declarative shadow DOM before any JS.
 */
import { type TemplateResult, css, html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';

/** Semantic intent of the action. */
export type LabButtonType = 'accent' | 'neutral' | 'danger';
/** Surface treatment. Separation is by surface, never by a border on top. */
export type LabButtonKind = 'fill' | 'tinted' | 'border' | 'ghost';
/** Control size. */
export type LabButtonSize = 's' | 'm' | 'l';
/** Native button behaviour inside a form. */
export type LabButtonHtmlType = 'button' | 'submit' | 'reset';

export class LabButton extends LabElement {
  static override properties = {
    type: { reflect: true },
    kind: { reflect: true },
    size: { reflect: true },
    icon: { type: Boolean, reflect: true },
    loading: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    htmlType: { attribute: 'html-type' },
    /**
     * Accessible name for the icon-only case (WCAG 4.1.2). A consumer's
     * `aria-label` on the host does NOT cross the shadow boundary onto the inner
     * `<button>`, so without this property an icon-only button (empty default
     * slot, decorative icon) would render with NO accessible name. Declaring it
     * here lets Lit capture the host attribute and `render()` forward it. Not
     * reflected — the source of truth is the inner button's attribute, set in
     * `render()`; reflecting it back would duplicate the name onto the host.
     * Parity with the React twin, whose `aria-label` reaches the native button
     * via `{...rest}` (ADR-0001 — one prop, both renderers).
     */
    ariaLabel: { attribute: 'aria-label' },
  };

  declare type: LabButtonType;
  declare kind: LabButtonKind;
  declare size: LabButtonSize;
  declare icon: boolean;
  declare loading: boolean;
  declare disabled: boolean;
  declare htmlType: LabButtonHtmlType;
  declare ariaLabel: string | null;

  constructor() {
    super();
    this.type = 'accent';
    this.kind = 'fill';
    this.size = 'm';
    this.icon = false;
    this.loading = false;
    this.disabled = false;
    this.htmlType = 'button';
    this.ariaLabel = null;
  }

  static override styles = css`
    :host {
      /* Size knobs the size axis maps onto. Dimension tokens may carry a literal
         fallback so the control is usable before tokens load (css.ts rule);
         colour roles below never do. */
      --_radius: ${litVar('--lab-radius-control', '0.5rem')};
      --_font: ${litVar('--lab-font-size-md', '1rem')};
      --_pad-x: ${litVar('--lab-space-md', '1rem')};
      --_pad-y: ${litVar('--lab-space-sm', '0.5rem')};
      --_gap: ${litVar('--lab-space-sm', '0.5rem')};
      --_min: 2.5rem;

      display: inline-flex;
      vertical-align: middle;
    }

    :host([size='s']) {
      --_font: ${litVar('--lab-font-size-xs', '0.8333rem')};
      --_pad-x: ${litVar('--lab-space-sm', '0.5rem')};
      --_pad-y: ${litVar('--lab-space-xs', '0.25rem')};
      --_min: 2rem;
    }
    :host([size='l']) {
      --_font: ${litVar('--lab-font-size-lg', '1.2rem')};
      --_pad-x: ${litVar('--lab-space-lg', '1.5rem')};
      --_pad-y: ${litVar('--lab-space-md', '1rem')};
      --_min: 3rem;
    }

    button {
      box-sizing: border-box;
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--_gap);
      width: 100%;
      min-height: var(--_min);
      padding: var(--_pad-y) var(--_pad-x);
      border-radius: var(--_radius);
      border: ${litVar('--lab-stroke-hairline')} solid transparent;
      font: inherit;
      font-size: var(--_font);
      line-height: ${litVar('--lab-line-height-md', '1.5')};
      font-weight: ${litVar('--lab-font-weight-semibold', '600')};
      cursor: pointer;
      transition:
        background-color 120ms ease,
        border-color 120ms ease,
        color 120ms ease;
      /* Base surface. The [type][kind] rules below set the longhands DIRECTLY
         (not via an intermediate --_bg custom property): a var()->var() chain
         across the shadow boundary fails to re-invalidate in Chromium when the
         theme role set is swapped, so the paint would go stale (proto-A note). */
      background-color: transparent;
      color: ${litVar('--lab-label-primary')};
      border-color: transparent;
    }

    /* Icon-only: square, centred, no text padding asymmetry. */
    :host([icon]) button {
      width: var(--_min);
      padding: 0;
      aspect-ratio: 1;
    }

    /* ── type=accent ───────────────────────────────────────────────────── */
    :host([type='accent'][kind='fill']) button {
      background-color: ${litVar('--lab-fill-accent')};
      color: ${litVar('--lab-label-on-accent')};
    }
    :host([type='accent'][kind='tinted']) button {
      background-color: ${litVar('--lab-fill-accent-tinted')};
      color: ${litVar('--lab-label-accent')};
    }
    :host([type='accent'][kind='border']) button {
      color: ${litVar('--lab-label-accent')};
      border-color: ${litVar('--lab-border-accent')};
    }
    :host([type='accent'][kind='ghost']) button {
      color: ${litVar('--lab-label-accent')};
    }

    /* ── type=neutral ──────────────────────────────────────────────────── */
    :host([type='neutral'][kind='fill']) button {
      background-color: ${litVar('--lab-fill-neutral')};
      color: ${litVar('--lab-label-on-neutral')};
    }
    :host([type='neutral'][kind='tinted']) button {
      background-color: ${litVar('--lab-fill-primary')};
      color: ${litVar('--lab-label-primary')};
    }
    :host([type='neutral'][kind='border']) button {
      color: ${litVar('--lab-label-primary')};
      border-color: ${litVar('--lab-border-base')};
    }
    :host([type='neutral'][kind='ghost']) button {
      color: ${litVar('--lab-label-primary')};
    }

    /* ── type=danger ───────────────────────────────────────────────────── */
    :host([type='danger'][kind='fill']) button {
      background-color: ${litVar('--lab-fill-danger')};
      color: ${litVar('--lab-label-on-danger')};
    }
    :host([type='danger'][kind='tinted']) button {
      background-color: ${litVar('--lab-fill-danger-tinted')};
      color: ${litVar('--lab-label-danger')};
    }
    :host([type='danger'][kind='border']) button {
      color: ${litVar('--lab-label-danger')};
      border-color: ${litVar('--lab-border-danger')};
    }
    :host([type='danger'][kind='ghost']) button {
      color: ${litVar('--lab-label-danger')};
    }

    /* ── interactive states (hover / active / focus) ───────────────────── */
    /* Паттерн стейт-оверлеев #109 — см. button.css (React-близнец): роль
       покоя + color-mix к тинту рецепта D под @supports; fallback ниже. */
    @supports (color: color-mix(in oklab, red, blue)) {
    :host([type='accent'][kind='fill']) button:hover:not(:disabled) {
      background-color: color-mix(in oklab, ${litVar('--lab-fill-accent')}, black ${litVar('--lab-state-hover', '8%')});
    }
    :host([type='accent'][kind='fill']) button:active:not(:disabled) {
      background-color: color-mix(in oklab, ${litVar('--lab-fill-accent')}, black ${litVar('--lab-state-pressed', '14%')});
    }
    :host([type='accent'][kind='tinted']) button:hover:not(:disabled) {
      background-color: color-mix(in oklab, ${litVar('--lab-fill-accent-tinted')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-hover', '8%')});
    }
    :host([type='accent'][kind='tinted']) button:active:not(:disabled) {
      background-color: color-mix(in oklab, ${litVar('--lab-fill-accent-tinted')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-pressed', '14%')});
    }
    :host([type='accent'][kind='border']) button:hover:not(:disabled) {
      color: color-mix(in oklab, ${litVar('--lab-label-accent')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-hover', '8%')});
      border-color: color-mix(in oklab, ${litVar('--lab-border-accent')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-hover', '8%')});
    }
    :host([type='accent'][kind='border']) button:active:not(:disabled) {
      color: color-mix(in oklab, ${litVar('--lab-label-accent')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-pressed', '14%')});
      border-color: color-mix(in oklab, ${litVar('--lab-border-accent')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-pressed', '14%')});
    }
    :host([type='accent'][kind='ghost']) button:hover:not(:disabled) {
      color: color-mix(in oklab, ${litVar('--lab-label-accent')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-hover', '8%')});
    }
    :host([type='accent'][kind='ghost']) button:active:not(:disabled) {
      color: color-mix(in oklab, ${litVar('--lab-label-accent')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-pressed', '14%')});
    }
    :host([type='neutral'][kind='fill']) button:hover:not(:disabled) {
      background-color: color-mix(in oklab, ${litVar('--lab-fill-neutral')}, black ${litVar('--lab-state-hover', '8%')});
    }
    :host([type='neutral'][kind='fill']) button:active:not(:disabled) {
      background-color: color-mix(in oklab, ${litVar('--lab-fill-neutral')}, black ${litVar('--lab-state-pressed', '14%')});
    }
    :host([type='neutral'][kind='tinted']) button:hover:not(:disabled) {
      background-color: color-mix(in oklab, ${litVar('--lab-fill-primary')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-hover', '8%')});
    }
    :host([type='neutral'][kind='tinted']) button:active:not(:disabled) {
      background-color: color-mix(in oklab, ${litVar('--lab-fill-primary')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-pressed', '14%')});
    }
    :host([type='neutral'][kind='border']) button:hover:not(:disabled) {
      color: color-mix(in oklab, ${litVar('--lab-label-primary')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-hover', '8%')});
      border-color: color-mix(in oklab, ${litVar('--lab-border-base')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-hover', '8%')});
    }
    :host([type='neutral'][kind='border']) button:active:not(:disabled) {
      color: color-mix(in oklab, ${litVar('--lab-label-primary')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-pressed', '14%')});
      border-color: color-mix(in oklab, ${litVar('--lab-border-base')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-pressed', '14%')});
    }
    :host([type='neutral'][kind='ghost']) button:hover:not(:disabled) {
      color: color-mix(in oklab, ${litVar('--lab-label-primary')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-hover', '8%')});
    }
    :host([type='neutral'][kind='ghost']) button:active:not(:disabled) {
      color: color-mix(in oklab, ${litVar('--lab-label-primary')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-pressed', '14%')});
    }
    :host([type='danger'][kind='fill']) button:hover:not(:disabled) {
      background-color: color-mix(in oklab, ${litVar('--lab-fill-danger')}, black ${litVar('--lab-state-hover', '8%')});
    }
    :host([type='danger'][kind='fill']) button:active:not(:disabled) {
      background-color: color-mix(in oklab, ${litVar('--lab-fill-danger')}, black ${litVar('--lab-state-pressed', '14%')});
    }
    :host([type='danger'][kind='tinted']) button:hover:not(:disabled) {
      background-color: color-mix(in oklab, ${litVar('--lab-fill-danger-tinted')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-hover', '8%')});
    }
    :host([type='danger'][kind='tinted']) button:active:not(:disabled) {
      background-color: color-mix(in oklab, ${litVar('--lab-fill-danger-tinted')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-pressed', '14%')});
    }
    :host([type='danger'][kind='border']) button:hover:not(:disabled) {
      color: color-mix(in oklab, ${litVar('--lab-label-danger')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-hover', '8%')});
      border-color: color-mix(in oklab, ${litVar('--lab-border-danger')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-hover', '8%')});
    }
    :host([type='danger'][kind='border']) button:active:not(:disabled) {
      color: color-mix(in oklab, ${litVar('--lab-label-danger')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-pressed', '14%')});
      border-color: color-mix(in oklab, ${litVar('--lab-border-danger')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-pressed', '14%')});
    }
    :host([type='danger'][kind='ghost']) button:hover:not(:disabled) {
      color: color-mix(in oklab, ${litVar('--lab-label-danger')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-hover', '8%')});
    }
    :host([type='danger'][kind='ghost']) button:active:not(:disabled) {
      color: color-mix(in oklab, ${litVar('--lab-label-danger')}, ${litVar('--lab-label-primary')} ${litVar('--lab-state-pressed', '14%')});
    }
    }
    /* Fallback без мёртвого hover: k = (1−p)^3 — ΔL-эквивалент микса к
       чёрному (вывод — в button.css React-близнеца). Disabled гасится ниже
       каскадом (filter: none). */
    @supports not (color: color-mix(in oklab, red, blue)) {
      button:hover {
        filter: brightness(0.7787);
      }
      button:active {
        filter: brightness(0.6361);
      }
    }
    button:focus-visible {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: ${litVar('--lab-focus-ring-offset')};
    }

    /* ── disabled ──────────────────────────────────────────────────────── */
    :host([disabled]) button,
    button[disabled] {
      cursor: not-allowed;
      opacity: 0.45;
      filter: none;
    }

    /* ── loading: spinner replaces the label without collapsing layout ──── */
    :host([loading]) button {
      cursor: progress;
    }
    .label {
      display: inline-flex;
      align-items: center;
      gap: var(--_gap);
    }
    :host([loading]) .label {
      /* color: transparent — see button.css (React twin) for the full WCAG
         4.1.2 rationale: neither visibility:hidden NOR opacity:0 is safe here
         (WebKit drops opacity:0 content from its a11y tree too), so only a
         paint-level change (colour) may be used to visually hide the label
         while keeping it the button's accessible name on every engine. */
      color: transparent;
    }
    .spinner {
      display: none;
      position: absolute;
      width: 1em;
      height: 1em;
      border: ${litVar('--lab-stroke-thick')} solid currentColor;
      border-right-color: transparent;
      border-radius: ${litVar('--lab-radius-full', '9999px')};
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
  `;

  override render(): TemplateResult {
    // Loading OR disabled blocks interaction. SSR-safe: ifDefined keeps absent
    // attributes out of the attribute position (no bare `nothing`), and the
    // spinner is always present (CSS hides it) so @lit-labs/ssr never sees a
    // conditional child template.
    const inactive = this.disabled || this.loading;
    // ACCESSIBLE NAME (WCAG 4.1.2). A button with a visible default-slot label is
    // named by that text — the platform computes the name from the slotted content,
    // so no aria-label is wanted (one would silently override the visible label).
    // An ICON-ONLY button has an empty default slot, so the projected text gives no
    // name; the consumer's host `aria-label` is the only name source and MUST be
    // forwarded onto the inner <button>. We forward it only in that icon-only case,
    // and mark the (decorative) icon slot aria-hidden then so it cannot contribute a
    // competing name. Mirrors the React twin ⇒ both renderers resolve the SAME name.
    const iconOnly = !this.hasDefaultSlotContent();
    const innerAriaLabel = iconOnly && this.ariaLabel ? this.ariaLabel : undefined;
    return html`
      <button
        type=${this.htmlType}
        ?disabled=${inactive}
        aria-label=${ifDefined(innerAriaLabel)}
        aria-busy=${ifDefined(this.loading ? 'true' : undefined)}
        aria-disabled=${ifDefined(this.disabled ? 'true' : undefined)}
      >
        <span class="spinner" aria-hidden="true"></span>
        <span class="label">
          <slot name="icon" aria-hidden=${ifDefined(innerAriaLabel ? 'true' : undefined)}></slot>
          <slot></slot>
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

// Idempotent registration: Lit SSR and client bundles can import this module
// across module-instance boundaries; an unguarded define then throws. The guard
// makes the side-effect import safe to repeat (core-CONTRACT §7).
if (typeof customElements !== 'undefined' && !customElements.get('lab-button')) {
  customElements.define('lab-button', LabButton);
}
