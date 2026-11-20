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
import { type TemplateResult, css, html, unsafeCSS } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import { buttonFillCss } from './fill.js';
import { slotSizeCss } from '../../slot-projection.js';

/** Semantic intent of the action. */
export type LabButtonType = 'accent' | 'neutral' | 'danger';
/** Surface treatment. Separation is by surface, never by a border on top. */
export type LabButtonKind = 'fill' | 'tinted' | 'border' | 'ghost';
/** Control size. */
export type LabButtonSize = 's' | 'm' | 'l';
/** HTML type of the internal button in Shadow DOM. */
export type LabButtonHtmlType = 'button' | 'submit' | 'reset';

interface LabButtonInteractionTarget {
  readonly current: HTMLButtonElement | null;
  readonly subscribe: (listener: (target: HTMLButtonElement | null) => void) => () => void;
}

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

  private nativeTarget: HTMLButtonElement | null = null;
  private readonly targetListeners = new Set<(target: HTMLButtonElement | null) => void>();
  /** Компоненты используют настоящий control без знания устройства Shadow DOM. */
  readonly interactionTarget: LabButtonInteractionTarget;

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
    const owner = this;
    this.interactionTarget = Object.freeze({
      get current(): HTMLButtonElement | null {
        return owner.nativeTarget;
      },
      subscribe(listener: (target: HTMLButtonElement | null) => void): () => void {
        owner.targetListeners.add(listener);
        try {
          listener(owner.nativeTarget);
        } catch (error) {
          owner.targetListeners.delete(listener);
          throw error;
        }
        return () => owner.targetListeners.delete(listener);
      },
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }
  override updated(): void {
    if (this.isConnected) this.publishInteractionTarget(this.renderRoot.querySelector('button'));
  }
  override disconnectedCallback(): void {
    try {
      this.publishInteractionTarget(null);
    } finally {
      super.disconnectedCallback();
    }
  }
  private publishInteractionTarget(target: HTMLButtonElement | null): void {
    this.nativeTarget = target;
    const failures: unknown[] = [];
    for (const listener of [...this.targetListeners]) {
      if (!this.targetListeners.has(listener)) continue;
      try {
        listener(target);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, 'LabButton interaction target');
  }

  static override styles = css`
    :host {
      --_radius: ${litVar('--lab-radius-button-m')};
      --_font: ${litVar('--lab-font-size-button-m')};
      --_line: ${litVar('--lab-line-height-button-m')};
      --_tracking: ${litVar('--lab-letter-spacing-button-m')};
      --_pad-x: ${litVar('--lab-space-button-m-x')};
      --_pad-y: ${litVar('--lab-space-button-m-y')};
      --_min: ${litVar('--lab-size-button-m')};
      --_icon: ${litVar('--lab-size-button-m-icon')};
      --_description-weight: var(--lab-font-weight-button-m-description);
      --_description-tracking: var(--lab-letter-spacing-button-m-description);
      --_description-accent-plain: var(--lab-state-button-m-description-accent-plain-opacity);
      display: inline-flex;
      vertical-align: middle;
    }

    :host([size='s']) {
      --_radius: ${litVar('--lab-radius-button-s')};
      --_font: ${litVar('--lab-font-size-button-s')};
      --_line: ${litVar('--lab-line-height-button-s')};
      --_tracking: ${litVar('--lab-letter-spacing-button-s')};
      --_pad-x: ${litVar('--lab-space-button-s-x')};
      --_pad-y: ${litVar('--lab-space-button-s-y')};
      --_min: ${litVar('--lab-size-button-s')};
      --_icon: ${litVar('--lab-size-button-s-icon')};
      --_description-weight: var(--lab-font-weight-button-s-description);
      --_description-tracking: var(--lab-letter-spacing-button-s-description);
      --_description-accent-plain: var(--lab-state-button-s-description-accent-plain-opacity);
    }

    :host([size='l']) {
      --_radius: ${litVar('--lab-radius-button-l')};
      --_font: ${litVar('--lab-font-size-button-l')};
      --_line: ${litVar('--lab-line-height-button-l')};
      --_tracking: ${litVar('--lab-letter-spacing-button-l')};
      --_pad-x: ${litVar('--lab-space-button-l-x')};
      --_pad-y: ${litVar('--lab-space-button-l-y')};
      --_min: ${litVar('--lab-size-button-l')};
      --_icon: ${litVar('--lab-size-button-l-icon')};
      --_description-weight: var(--lab-font-weight-button-l-description);
      --_description-tracking: var(--lab-letter-spacing-button-l-description);
      --_description-accent-plain: var(--lab-state-button-l-description-accent-plain-opacity);
    }

    button {
      box-sizing: border-box;
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      width: 100%;
      min-height: var(--_min);
      padding: calc(var(--_pad-y) - var(--lab-stroke-hairline)) calc(var(--_pad-x) - var(--lab-stroke-hairline));
      border-radius: var(--_radius);
      border: ${litVar('--lab-stroke-hairline')} solid transparent;
      font: inherit;
      font-size: var(--_font);
      line-height: var(--_line);
      letter-spacing: var(--_tracking);
      font-weight: ${litVar('--lab-font-weight-button')};
      cursor: pointer;
      transition:
        background-color var(--lab-motion-transition-duration) var(--lab-motion-transition-easing),
        border-color var(--lab-motion-transition-duration) var(--lab-motion-transition-easing),
        color var(--lab-motion-transition-duration) var(--lab-motion-transition-easing);
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

    ${unsafeCSS(buttonFillCss(":host([kind='fill']) button", ":host([kind='fill']) button:hover:not(:disabled)", ":host([kind='fill']) button:active:not(:disabled)"))}

    .label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--lab-space-button-label-gap);
      min-height: var(--_icon);
      padding-inline: var(--lab-space-button-label-x);
    }
    .label[hidden] { display: none; }
    :host([icon]) .label { display: none; }
    slot[name='description'] {
      color: color-mix(in srgb, currentColor var(--lab-state-button-description-opacity), transparent);
      font-weight: var(--_description-weight);
      letter-spacing: var(--_description-tracking);
    }
    :host([type='accent'][kind='border']) slot[name='description'],
    :host([type='accent'][kind='ghost']) slot[name='description'] {
      color: color-mix(in srgb, currentColor var(--_description-accent-plain), transparent);
    }
    ${unsafeCSS(slotSizeCss("::slotted([slot='icon']), ::slotted([slot='icon-end'])", 'var(--_icon)', 'var(--_icon)'))}
    ::slotted([slot='icon']), ::slotted([slot='icon-end']) { flex: none; }

:host([type='accent']) { --_hover-fill: var(--lab-fill-brand-tertiary); --_pressed-fill: var(--lab-fill-brand-primary); --_rest-border: var(--lab-border-brand-soft); --_pressed-border: var(--lab-border-brand-base); }
:host([type='neutral']) { --_hover-fill: var(--lab-fill-quaternary); --_pressed-fill: var(--lab-fill-tertiary); --_rest-border: var(--lab-border-soft); --_pressed-border: var(--lab-border-base); }
:host([type='danger']) { --_hover-fill: var(--lab-fill-danger-tertiary); --_pressed-fill: var(--lab-fill-danger-primary); --_rest-border: var(--lab-border-danger-soft); --_pressed-border: var(--lab-border-danger-base); }
:host([type][kind='border']) button { border-color: var(--_rest-border); }
:host([kind='tinted']) button:hover:not(:disabled),
:host([kind='border']) button:hover:not(:disabled),
:host([kind='ghost']) button:hover:not(:disabled) { background-color: var(--_hover-fill); }
:host([kind='tinted']) button:active:not(:disabled) { background-color: var(--_pressed-fill); }
:host([kind='border']) button:active:not(:disabled),
:host([kind='ghost']) button:active:not(:disabled) { background-color: transparent; }
:host([kind='border']) button:active:not(:disabled) { border-color: var(--_pressed-border); }
    button:focus-visible {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: ${litVar('--lab-focus-ring-offset')};
    }

    /* ── disabled ──────────────────────────────────────────────────────── */
    :host([type][kind]) button:disabled {
      cursor: not-allowed;
      background-color: var(--lab-fill-quaternary);
      background-image: none;
      box-shadow: none;
      color: var(--lab-label-quaternary);
      opacity: 1;
      filter: none;
    }


    :host([type][kind='border']) button:disabled,
    :host([type][kind='ghost']) button:disabled { background-color: transparent; }
    :host([type][kind='border']) button:disabled { border-color: var(--lab-border-soft); }
    :host([type='neutral']:not([kind='fill'])) slot[name='description'] { color: var(--lab-label-secondary); }
    :host([type][kind]) button:disabled slot[name='description'] { color: inherit; }


    /* ── loading: spinner replaces the label without collapsing layout ──── */
    :host([loading]) button {
      cursor: progress;
    }
    :host([loading]) slot[name='icon'], :host([loading]) slot[name='icon-end'] {
      visibility: hidden;
    }
    .main { display: inline-flex; align-items: center; justify-content: center; position: relative; min-width: var(--_icon); }
    :host([loading]) .main {
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
      width: var(--_icon);
      height: var(--_icon);
      color: var(--lab-label-quaternary);
      background: currentColor;
      mask: var(--lab-shape-loader) center / contain no-repeat;
      animation: spin var(--lab-motion-loader-period) var(--lab-motion-loader-steps) infinite;
    }
    :host([loading]) .spinner {
      display: block;
    }
    .icon-spinner { display: none !important; }
    :host([icon][loading]) .icon-spinner { display: block !important; }
    :host([loading]) button[data-empty-label] .icon-spinner { display: block !important; }

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
    const hasLabel = this.hasDefaultSlotContent() || !!this.querySelector?.('[slot="description"]');
    const iconOnly = this.icon || !hasLabel;
    const innerAriaLabel = iconOnly && this.ariaLabel ? this.ariaLabel : undefined;
    return html`
      <button
        type=${this.htmlType}
        ?data-empty-label=${!hasLabel}
        ?disabled=${inactive}
        aria-label=${ifDefined(innerAriaLabel)}
        aria-busy=${ifDefined(this.loading ? 'true' : undefined)}
        aria-disabled=${ifDefined(this.disabled ? 'true' : undefined)}
      >
        <span class="spinner icon-spinner" aria-hidden="true"></span>
        <slot name="icon" aria-hidden="true"></slot>
        <span class="label" ?hidden=${!hasLabel || this.icon} aria-hidden=${ifDefined(iconOnly ? 'true' : undefined)}>
          <span class="main"><slot @slotchange=${this.onSlotChange}></slot><span class="spinner" aria-hidden="true"></span></span>
          <slot name="description" @slotchange=${this.onSlotChange}></slot>
        </span>
        <slot name="icon-end" aria-hidden="true"></slot>
      </button>
    `;
  }

  private readonly onSlotChange = () => this.requestUpdate();
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
