import * as checkboxMachine from '@zag-js/checkbox';
/**
 * `<lab-checkbox>` — the production checkbox, CONSUMING the `@zag-js/checkbox`
 * machine through the Behaviors seam (core-CONTRACT §1, the inverse of Button).
 *
 * Axes (the Figma model — Type × Toggle(true/false/MIXED) × Size × State):
 *   - type:  accent | neutral | danger   (semantic intent of the CHECKED box)
 *   - size:  tiny | s | m | l
 *   - checked: machine-owned (reflected for CSS + SSR)
 *   - indeterminate: the HONEST third machine state (aria-checked="mixed") — NOT
 *     a faked visual; the machine carries `"indeterminate"` as a real value
 *   - defaultChecked: uncontrolled initial state (boolean | "indeterminate")
 *   - disabled: non-interactive
 *
 * Why a machine here, when Button opted out: a checkbox has THREE-state checked
 * lifecycle (`true` / `false` / `"indeterminate"`), `role` + `aria-checked`
 * (including `"mixed"`), Space activation, focus, and a hidden form input whose
 * `.indeterminate` DOM property the machine sets. Hand-rolling tri-state ARIA is
 * exactly the machinery Zag ships. So this element runs `@zag-js/checkbox`
 * through `ZagController` (DIP — injected `MachineModule`, no hand-written logic).
 *
 * Token contract (core-CONTRACT §2): ONLY semantic --lab-* roles. The checked /
 * mixed box fill is `--lab-fill-{accent|neutral|danger}`; the unchecked border is
 * `--lab-border-base`; the glyph is `--lab-label-on-{accent|neutral|danger}`.
 * No hex, no primitive, no invented role.
 */
import { type TemplateResult, css, html, svg } from 'lit';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';

/** Semantic intent of the checked box. */
export type LabCheckboxType = 'accent' | 'neutral' | 'danger';
/** Control size. */
export type LabCheckboxSize = 'tiny' | 's' | 'm' | 'l';
/** The honest tri-state value the machine carries. */
export type LabCheckboxChecked = boolean | 'indeterminate';

type CheckboxSchema = SchemaOf<checkboxMachine.Service>;
type CheckboxApi = checkboxMachine.Api;

/**
 * The `@zag-js/checkbox` package seen through the renderer-agnostic seam — the
 * SAME `MachineModule` shape the proof bound for `@zag-js/toggle`, with no casts.
 */
const checkboxModule: MachineModule<CheckboxSchema, CheckboxApi> = checkboxMachine;

export class LabCheckbox extends LabElement {
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    /** Controlled checked state. When the attribute is present, consumer owns it. */
    checked: { type: Boolean, reflect: true },
    /**
     * The honest third state. Reflected so `:host([indeterminate])` styling and
     * the SSR attribute follow the machine. When set, the machine's checked value
     * is `"indeterminate"` (aria-checked="mixed").
     */
    indeterminate: { type: Boolean, reflect: true },
    /** Uncontrolled initial state — read once by the machine at init. */
    defaultChecked: { type: Boolean, attribute: 'default-checked', reflect: true },
    /** Uncontrolled initial indeterminate — read once at init. */
    defaultIndeterminate: {
      type: Boolean,
      attribute: 'default-indeterminate',
      reflect: true,
    },
    disabled: { type: Boolean, reflect: true },
    /**
     * Accessible name for the no-visible-label case. When set, it names the
     * hidden input directly; a visible slotted label is preferred over it via the
     * machine's `aria-labelledby` when present.
     */
    ariaLabel: { attribute: 'aria-label', reflect: true },
    /** Native form field name for the hidden input (form participation). */
    name: { reflect: true },
  };

  declare type: LabCheckboxType;
  declare size: LabCheckboxSize;
  declare checked: boolean;
  declare indeterminate: boolean;
  declare defaultChecked: boolean;
  declare defaultIndeterminate: boolean;
  declare disabled: boolean;
  declare ariaLabel: string | null;
  declare name: string | null;

  private readonly checkbox: ZagController<CheckboxSchema, CheckboxApi>;

  constructor() {
    super();
    this.type = 'accent';
    this.size = 'm';
    this.checked = false;
    this.indeterminate = false;
    this.defaultChecked = false;
    this.defaultIndeterminate = false;
    this.disabled = false;
    this.ariaLabel = null;
    this.name = null;
    // Wire the Zag checkbox behavior. The tri-state value is folded into one
    // `CheckedState`: indeterminate wins, else the boolean. Controlled only when
    // a `checked`/`indeterminate` attribute is present; otherwise the machine
    // owns it from the defaults (uncontrolled). Honest two-mode contract.
    // `id` is a stable per-instance value (mirrors React's `useId`) so the
    // machine's scoped ids — including the label id the input references — are
    // unique and real, never the colliding `checkbox:undefined:*`.
    this.checkbox = this.runMachine(checkboxModule, () => ({
      id: this.uid,
      name: this.name ?? undefined,
      defaultChecked: this.resolveDefault(),
      checked: this.resolveControlled(),
      disabled: this.disabled,
      onCheckedChange: (details: checkboxMachine.CheckedChangeDetails) => {
        this.indeterminate = details.checked === 'indeterminate';
        this.checked = details.checked === true;
        this.dispatchEvent(
          new CustomEvent<checkboxMachine.CheckedChangeDetails>('checked-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
    }));
  }

  /** The uncontrolled initial state, folded into the machine's tri-state value. */
  private resolveDefault(): LabCheckboxChecked {
    if (this.defaultIndeterminate) return 'indeterminate';
    return this.defaultChecked;
  }

  /** The controlled state, or undefined when this checkbox is uncontrolled. */
  private resolveControlled(): LabCheckboxChecked | undefined {
    if (this.hasAttribute('indeterminate') && this.indeterminate) return 'indeterminate';
    if (this.hasAttribute('checked')) return this.checked;
    return undefined;
  }

  static override styles = css`
    :host {
      /* Size knobs the size axis maps onto. */
      --_box: ${litVar('--lab-size-control-l', '1.25rem')};
      --_radius: ${litVar('--lab-radius-xs', '0.25rem')};
      --_gap: ${litVar('--lab-space-sm', '0.5rem')};
      --_font: ${litVar('--lab-font-size-md', '1rem')};

      display: inline-flex;
      vertical-align: middle;
    }

    :host([size='tiny']) {
      --_box: ${litVar('--lab-size-checkbox-tiny', '0.875rem')};
      --_font: ${litVar('--lab-font-size-xs', '0.8333rem')};
    }
    :host([size='s']) {
      --_box: ${litVar('--lab-size-control-m', '1rem')};
      --_font: ${litVar('--lab-font-size-xs', '0.8333rem')};
    }
    :host([size='l']) {
      --_box: ${litVar('--lab-size-control-xl', '1.5rem')};
      --_font: ${litVar('--lab-font-size-lg', '1.2rem')};
    }

    .root {
      display: inline-flex;
      align-items: center;
      gap: var(--_gap);
      font: inherit;
      font-size: var(--_font);
      line-height: ${litVar('--lab-line-height-md', '1.5')};
      color: ${litVar('--lab-label-primary')};
      cursor: pointer;
    }

    /* The box — the Zag control element. Unchecked = bordered, transparent. */
    .control {
      box-sizing: border-box;
      position: relative;
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--_box);
      height: var(--_box);
      border-radius: var(--_radius);
      border: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-base')};
      background-color: transparent;
      color: transparent;
      transition:
        background-color var(--lab-motion-transition-duration) var(--lab-motion-transition-easing),
        border-color var(--lab-motion-transition-duration) var(--lab-motion-transition-easing),
        color var(--lab-motion-transition-duration) var(--lab-motion-transition-easing);
    }

    /* Checked OR mixed fills the box per type and reveals the glyph. The longhand
       is set directly (no var()->var() across the shadow boundary — proto-A). */
    :host([checked][type='accent']) .control,
    :host([indeterminate][type='accent']) .control {
      background-color: ${litVar('--lab-fill-accent')};
      border-color: ${litVar('--lab-border-accent')};
      color: ${litVar('--lab-label-on-accent')};
    }
    :host([checked][type='neutral']) .control,
    :host([indeterminate][type='neutral']) .control {
      background-color: ${litVar('--lab-fill-neutral')};
      border-color: ${litVar('--lab-border-base')};
      color: ${litVar('--lab-label-on-neutral')};
    }
    :host([checked][type='danger']) .control,
    :host([indeterminate][type='danger']) .control {
      background-color: ${litVar('--lab-fill-danger')};
      border-color: ${litVar('--lab-border-danger')};
      color: ${litVar('--lab-label-on-danger')};
    }

    /* Two glyphs, mutually exclusive — the machine's state picks which shows. The
       check shows only when fully checked; the dash shows only when mixed. */
    .glyph {
      width: 80%;
      height: 80%;
      display: none;
      color: currentColor;
    }
    :host([checked]:not([indeterminate])) .glyph-check {
      display: block;
    }
    :host([indeterminate]) .glyph-mixed {
      display: block;
    }
    /* Indeterminate visually outranks checked when both attributes coexist. */
    :host([indeterminate]) .glyph-check {
      display: none;
    }

    /* The input is now a SIBLING of the (aria-hidden) control so it stays in the
       a11y tree; match focus-visible from the shared root, not as a descendant. */
    .root:has(input:focus-visible) .control {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: ${litVar('--lab-focus-ring-offset')};
    }

    :host([disabled]) .root {
      cursor: not-allowed;
      opacity: 0.45;
    }

    input {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      border: 0;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      overflow: hidden;
      white-space: nowrap;
    }
  `;

  override updated(): void {
    // Apply the machine's connect props onto the real shadow nodes (role,
    // aria-checked incl. "mixed", keyboard, focus, the hidden input whose
    // `.indeterminate` DOM property the machine sets). Clear prior spreads first.
    this.checkbox.clearSpreads();
    const api = this.checkbox.api;
    const root = this.renderRoot.querySelector<HTMLElement>('.root');
    const control = this.renderRoot.querySelector<HTMLElement>('.control');
    const label = this.renderRoot.querySelector<HTMLElement>('.label');
    const input = this.renderRoot.querySelector<HTMLInputElement>('input');
    if (root) this.checkbox.spread(root, api.getRootProps());
    if (control) this.checkbox.spread(control, api.getControlProps());
    // Spread the label part so the id the machine's `aria-labelledby` targets
    // actually exists — without this the reference dangles and the name is lost.
    if (label) this.checkbox.spread(label, api.getLabelProps());
    if (input) {
      this.checkbox.spread(input, api.getHiddenInputProps());
      this.nameHiddenInput(input);
      // `indeterminate` is a DOM PROPERTY (no attribute) — it is what AT reads as
      // aria-checked="mixed". The machine's own sync effect can run before Lit has
      // painted the input, so set it here from the connected api too, keeping the
      // native control's mixed state in lockstep with the machine on every render.
      input.indeterminate = api.indeterminate;
    }
  }

  /**
   * Reconcile the input's accessible name. With a visible label the machine's
   * `aria-labelledby` (→ the `.label` part) names it. With NO visible label, that
   * reference would resolve to empty and (per ARIA) outrank `aria-label`, leaving
   * the control unnamed — so drop the dangling reference and apply `aria-label`.
   */
  private nameHiddenInput(input: HTMLInputElement): void {
    if (this.hasDefaultSlotContent()) {
      input.removeAttribute('aria-label');
      return;
    }
    input.removeAttribute('aria-labelledby');
    if (this.ariaLabel) input.setAttribute('aria-label', this.ariaLabel);
    else input.removeAttribute('aria-label');
  }

  override render(): TemplateResult {
    // Structure only; behaviour (role, aria-checked incl. "mixed", keyboard,
    // focus) is spread in `updated()` from the machine. SSR emits real markup. The
    // hidden input is a SIBLING of the (aria-hidden) control — NOT a descendant —
    // so it stays in the accessibility tree (an aria-hidden ancestor would erase
    // it, removing the checkbox role entirely).
    return html`
      <label class="root">
        <span class="control">
          ${svg`<svg class="glyph glyph-check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" />
          </svg>`}
          ${svg`<svg class="glyph glyph-mixed" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3.5 8h9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>`}
        </span>
        <input type="checkbox" />
        <span class="label"><slot></slot></span>
      </label>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-checkbox': LabCheckbox;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-checkbox')) {
  customElements.define('lab-checkbox', LabCheckbox);
}
