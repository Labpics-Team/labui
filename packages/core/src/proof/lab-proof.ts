/**
 * `<lab-proof>` — a PROOF element, NOT the production Button.
 *
 * Its only job is to drive the entire scaffold seam end to end and prove it
 * compiles and runs on the Lit renderer:
 *   - extends `LabElement` (base conventions + `delegatesFocus`);
 *   - runs the real `@zag-js/toggle` machine through `ZagController`
 *     (VanillaMachine) — pressing toggles `aria-pressed` via the machine, not
 *     ad-hoc element state;
 *   - paints using ONLY semantic `--lab-*` roles + dimension tokens (no hex);
 *   - is theme/material agnostic: Light/Dark and Ambient/Solid change its look
 *     purely from `[data-theme]` / `[data-material]` on an ancestor, with zero
 *     edits here;
 *   - server-renders to declarative shadow DOM via the SSR shim.
 *
 * It is intentionally minimal — one axis (pressed) — so it stays a *proof*, not
 * a half-built Button. The production Button (432 variants) is a later chapter
 * and will not reuse this element, only this seam.
 */
import { type TemplateResult, css, html } from 'lit';
import * as toggle from '@zag-js/toggle';
import type { MachineModule, SchemaOf } from '../behaviors/types.js';
import { litVar } from '../css.js';
import { LabElement } from '../lit/lab-element.js';
import type { ZagController } from '../lit/zag-controller.js';

type ToggleSchema = SchemaOf<toggle.Service>;
type ToggleApi = toggle.Api;

/**
 * The `@zag-js/toggle` package, viewed through the renderer-agnostic seam. The
 * namespace already matches `MachineModule` structurally (a `machine` + a
 * `connect`); this binding just names that fact so the controller is fully typed
 * with no casts.
 */
const toggleModule: MachineModule<ToggleSchema, ToggleApi> = toggle;

export class LabProof extends LabElement {
  static override properties = {
    /** Whether the proof starts pressed. Reflected so SSR + CSS can see it. */
    defaultPressed: { type: Boolean, attribute: 'default-pressed', reflect: true },
    /** Whether the proof is disabled. Reflected for styling + a11y. */
    disabled: { type: Boolean, reflect: true },
    /**
     * The machine's pressed state, mirrored onto the host and REFLECTED so
     * `:host([pressed])` styling and the SSR attribute work. Not `state: true` —
     * Lit does not reflect internal state to attributes, and the reflected
     * attribute is the contract the styles read.
     */
    pressed: { type: Boolean, reflect: true },
  };

  declare defaultPressed: boolean;
  declare disabled: boolean;
  declare pressed: boolean;

  private readonly toggle: ZagController<ToggleSchema, ToggleApi>;

  constructor() {
    super();
    this.defaultPressed = false;
    this.disabled = false;
    this.pressed = false;
    // Wire the Zag toggle behavior. Props read from reflected attributes so the
    // machine and the element never disagree.
    this.toggle = this.runMachine(toggleModule, () => ({
      defaultPressed: this.defaultPressed,
      disabled: this.disabled,
      onPressedChange: (pressed: boolean) => {
        this.pressed = pressed;
      },
    }));
  }

  static override styles = css`
    :host {
      display: inline-flex;
      vertical-align: middle;
      /* Dimension knobs the size of the control reads from. No literal hex. */
      --_radius: ${litVar('--lab-radius-control', '--lab-radius-lg')};
      --_pad-x: ${litVar('--lab-space-md', '1rem')};
      --_pad-y: ${litVar('--lab-space-sm', '0.5rem')};
      --_font: ${litVar('--lab-font-size-md', '1rem')};
    }

    button {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: ${litVar('--lab-space-sm', '0.5rem')};
      min-height: 2.5rem;
      padding: var(--_pad-y) var(--_pad-x);
      border-radius: var(--_radius);
      border: 0.0625rem solid ${litVar('--lab-border-neutral')};
      font: inherit;
      font-size: var(--_font);
      line-height: ${litVar('--lab-line-height-md', '1.5')};
      font-weight: ${litVar('--lab-font-weight-semibold', '600')};
      cursor: pointer;
      /* Unpressed: neutral tinted surface + primary label — semantic roles only. */
      background-color: ${litVar('--lab-fill-neutral-tinted')};
      color: ${litVar('--lab-label-primary')};
      transition:
        background-color 120ms ease,
        color 120ms ease,
        border-color 120ms ease;
    }

    /* Pressed: accent fill + on-accent label. Driven by the reflected attribute,
       which is driven by the machine — one source of truth. */
    :host([pressed]) button {
      background-color: ${litVar('--lab-fill-accent')};
      color: ${litVar('--lab-label-on-accent')};
      border-color: ${litVar('--lab-border-accent')};
    }

    button:focus-visible {
      outline: 0.125rem solid ${litVar('--lab-border-focus')};
      outline-offset: 0.125rem;
    }

    :host([disabled]) button,
    button[disabled] {
      cursor: not-allowed;
      opacity: 0.45;
    }

    .indicator {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: ${litVar('--lab-radius-full', '9999px')};
      background-color: currentColor;
      opacity: 0.5;
    }
    :host([pressed]) .indicator {
      opacity: 1;
    }
  `;

  override updated(): void {
    // Apply the machine's connect props onto the real shadow nodes (attrs, ARIA,
    // click handler) the vanilla way. Clear prior spreads first to avoid stacking
    // listeners across renders.
    this.toggle.clearSpreads();
    const api = this.toggle.api;
    const root = this.renderRoot.querySelector('button');
    const indicator = this.renderRoot.querySelector('.indicator');
    if (root) this.toggle.spread(root, api.getRootProps());
    if (indicator) this.toggle.spread(indicator, api.getIndicatorProps());
  }

  override render(): TemplateResult {
    // Structure only; behavior (role, aria-pressed, onClick) is spread in
    // `updated()` from the machine. Server-render still emits a real <button>
    // with the slotted label, so first paint is meaningful without JS.
    return html`
      <button type="button" ?disabled=${this.disabled}>
        <span class="indicator" aria-hidden="true"></span>
        <slot>Toggle</slot>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-proof': LabProof;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('lab-proof')) {
  customElements.define('lab-proof', LabProof);
}
