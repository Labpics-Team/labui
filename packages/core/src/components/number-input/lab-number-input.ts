import * as numberInputMachine from '@zag-js/number-input';
/**
 * `<lab-number-input>` — a numeric form field: a real `<input role="spinbutton">`
 * with increment / decrement triggers, min/max/step clamping, format/parse, and an
 * optional scrubber, driven end-to-end by the `@zag-js/number-input` machine.
 *
 * MACHINE, not opt-out (core-CONTRACT §1): unlike `<lab-input>` (a plain text field
 * the native `<input>` fully owns), a number input HAS shared interaction state a
 * machine owns — a parsed numeric value with min/max/step, clamp-on-blur, the
 * spinbutton role + `aria-valuenow/valuemin/valuemax/valuetext`, Arrow/PageUp-Down
 * keyboard stepping, increment/decrement triggers that disable at the bounds, and a
 * pointer scrubber. Hand-rolling that is exactly the "machinery Zag ships" the seam
 * exists to consume. So this element runs the machine through `ZagController`: the
 * machine owns value/clamp/keyboard/ARIA; the element only paints (DIP — it depends
 * on the injected `MachineModule`, never on hand-written stepping).
 *
 * REUSES the field a11y seam (core-CONTRACT §4), it does NOT duplicate it: the
 * label / helper / error ASSOCIATION is the same shared `field-a11y` helper that
 * `<lab-input>` / `<lab-textarea>` use — a real `<label for>`, `aria-describedby`
 * listing the helper id and (only when invalid + a message) the error id, and the
 * required mark. The MACHINE owns the spinbutton role + value ARIA + `aria-invalid`
 * on the input; this element only ADDS the field's describedby/errormessage/required
 * over the machine's spread (the same split the other fields use), so neither layer
 * re-implements the other. Visual surface reuses the shared `field-styles`.
 *
 * Axes (the form-field model — Type × Size × State):
 *   - type:  neutral | danger | warning | success   (sentiment of the field)
 *   - size:  s | m | l
 *   - state: disabled · readonly · invalid · required   (reflected, drive CSS + ARIA)
 *
 * Token contract (core-CONTRACT §2): ONLY semantic --lab-* roles + dimensions via
 * the shared `field-styles` plus the trigger surface here. No hex, no primitive, no
 * colour-role fallback.
 *
 * SSR (core-CONTRACT §7): structure is always present; the machine spreads the
 * spinbutton role + value ARIA in `updated()`, so `@lit-labs/ssr` emits a meaningful,
 * styled control in the declarative shadow DOM before any JS upgrades it.
 */
import { type PropertyValues, type TemplateResult, css, html, nothing } from 'lit';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';
import {
  type FieldA11yInput,
  type LabFieldSize,
  type LabFieldType,
  fieldControlAria,
  fieldErrorIsActive,
  fieldPartIds,
} from '../field/field-a11y.js';
import { fieldStyles } from '../field/field-styles.js';

export type { LabFieldSize as LabNumberInputSize, LabFieldType as LabNumberInputType };

type NumberInputSchema = SchemaOf<numberInputMachine.Service>;
type NumberInputApi = numberInputMachine.Api;

/**
 * The `@zag-js/number-input` package seen through the renderer-agnostic seam — the
 * SAME `MachineModule` shape the Lit base binds for every machine-driven component,
 * no casts. The namespace already matches `MachineModule` structurally.
 */
const numberInputModule: MachineModule<NumberInputSchema, NumberInputApi> = numberInputMachine;

/** Per-instance machine id source — keeps the input/label/trigger ids deterministic
 * and the derived helper/error ids collision-free. */
let numberInputSeq = 0;

export class LabNumberInput extends LabElement {
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    /** Visible label text. Always rendered into a real `<label for>`. */
    label: {},
    /** When set, the label is clipped (kept in the a11y tree, visually hidden). */
    labelHidden: { type: Boolean, attribute: 'label-hidden', reflect: true },
    /** Helper / description text shown below the control and linked via describedby. */
    helper: {},
    /** Error message; announced (role="alert") and linked only when `invalid`. */
    error: {},
    /** Controlled value (string, mirrors the machine). When set, the consumer owns it. */
    value: {},
    /** Uncontrolled initial value — read once by the machine at init. */
    defaultValue: { attribute: 'default-value' },
    /** Placeholder text for the empty control. */
    placeholder: {},
    /** Minimum value. */
    min: { type: Number },
    /** Maximum value. */
    max: { type: Number },
    /** Step the increment/decrement and Arrow keys move by. */
    step: { type: Number },
    /** Allow dragging the label/scrubber to change the value (pointer scrubber). */
    scrubber: { type: Boolean, reflect: true },
    /** Allow the mouse wheel to change the value while focused. */
    allowMouseWheel: { type: Boolean, attribute: 'allow-mouse-wheel' },
    /** Non-editable: the control reads its value but cannot be changed. */
    readonly: { type: Boolean, reflect: true },
    /** Non-interactive and dimmed. */
    disabled: { type: Boolean, reflect: true },
    /** Required — sets aria-required and the native `required`. */
    required: { type: Boolean, reflect: true },
    /** Invalid — drives aria-invalid / aria-errormessage and the danger styling. */
    invalid: { type: Boolean, reflect: true },
    /** Native form field name. */
    name: {},
  };

  declare type: LabFieldType;
  declare size: LabFieldSize;
  declare label: string;
  declare labelHidden: boolean;
  declare helper: string;
  declare error: string;
  declare value: string;
  declare defaultValue: string;
  declare placeholder: string;
  declare min: number;
  declare max: number;
  declare step: number;
  declare scrubber: boolean;
  declare allowMouseWheel: boolean;
  declare readonly: boolean;
  declare disabled: boolean;
  declare required: boolean;
  declare invalid: boolean;
  declare name: string;

  private readonly machineCtl: ZagController<NumberInputSchema, NumberInputApi>;
  /** Stable machine id — the input/label/trigger ids and the derived helper/error ids
   * all key off this, so nothing collides across instances. */
  private readonly fieldId = `lab-number-input-${++numberInputSeq}`;

  constructor() {
    super();
    this.type = 'neutral';
    this.size = 'm';
    this.label = '';
    this.labelHidden = false;
    this.helper = '';
    this.error = '';
    this.value = '';
    this.defaultValue = '';
    this.placeholder = '';
    this.min = Number.MIN_SAFE_INTEGER;
    this.max = Number.MAX_SAFE_INTEGER;
    this.step = 1;
    this.scrubber = false;
    this.allowMouseWheel = false;
    this.readonly = false;
    this.disabled = false;
    this.required = false;
    this.invalid = false;
    this.name = '';
    // Wire the Zag number-input behavior. `value` is passed only when the consumer
    // set the attribute (controlled); otherwise the machine owns it from
    // `defaultValue` (uncontrolled) — the same honest two-mode contract as the other
    // controls. The machine owns the spinbutton role, value ARIA, clamping, keyboard
    // and the trigger enable/disable; the element only paints.
    this.machineCtl = this.runMachine(numberInputModule, () => ({
      id: this.fieldId,
      value: this.hasAttribute('value') ? this.value : undefined,
      defaultValue: this.defaultValue || undefined,
      min: this.min,
      max: this.max,
      step: this.step,
      disabled: this.disabled,
      readOnly: this.readonly,
      invalid: this.invalid,
      required: this.required,
      name: this.name || undefined,
      allowMouseWheel: this.allowMouseWheel,
      onValueChange: (details: numberInputMachine.ValueChangeDetails) => {
        this.value = details.value;
        this.dispatchEvent(
          new CustomEvent<numberInputMachine.ValueChangeDetails>('value-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
      onValueCommit: (details: numberInputMachine.ValueChangeDetails) => {
        this.dispatchEvent(
          new CustomEvent<numberInputMachine.ValueChangeDetails>('value-commit', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
    }));
  }

  static override styles = [
    fieldStyles,
    css`
      /* The control row: the input sits beside the stacked +/- triggers. Here .control
         is a WRAPPER <div> (not the editable input it is in Input/Textarea), so the
         shared field-styles' input-oriented rules (.control:read-only — which a <div>
         matches, .control:disabled, .control:hover:not(:disabled):not([readonly]))
         must NOT decide its surface. We re-declare the wrapper's border/background here
         under :host so it wins specificity over those :read-only/:hover input rules, and
         drive readonly/disabled/sentiment from the reflected HOST attributes instead —
         the same styling contract the host exposes. The label/helper/error parts still
         come from field-styles unchanged (true reuse, no duplication of that wiring). */
      :host .control {
        box-sizing: border-box;
        display: inline-flex;
        align-items: stretch;
        width: 100%;
        padding: 0;
        overflow: hidden;
        background-color: ${litVar('--lab-bg-primary')};
        border: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-base')};
        border-radius: var(--_field-radius);
        box-shadow: none;
        transition: border-color 120ms ease, box-shadow 120ms ease;
      }
      :host(:not([disabled]):not([readonly])) .control:hover {
        border-color: ${litVar('--lab-border-strong')};
      }
      :host([type='danger']) .control {
        border-color: ${litVar('--lab-border-danger')};
      }
      :host([type='warning']) .control {
        border-color: ${litVar('--lab-border-warning-strong')};
      }
      :host([type='success']) .control {
        border-color: ${litVar('--lab-border-success-strong')};
      }
      :host([readonly]) .control {
        background-color: ${litVar('--lab-fill-neutral-tinted')};
        border-color: ${litVar('--lab-border-soft')};
      }
      :host([disabled]) .control {
        cursor: not-allowed;
        opacity: 0.5;
      }

      .input {
        flex: 1 1 auto;
        min-width: 0;
        margin: 0;
        padding: var(--_field-pad-y) var(--_field-pad-x);
        font: inherit;
        font-size: var(--_field-font);
        letter-spacing: var(--_field-tracking);
        line-height: var(--_field-line);
        color: ${litVar('--lab-label-primary')};
        background: transparent;
        border: 0;
        outline: none;
        appearance: none;
      }
      .input::placeholder {
        color: ${litVar('--lab-label-tertiary')};
        opacity: 1;
      }
      /* The native spinner arrows are replaced by the machine-driven triggers. */
      .input::-webkit-outer-spin-button,
      .input::-webkit-inner-spin-button {
        appearance: none;
        margin: 0;
      }

      /* The +/- trigger stack — a hairline-separated column of two real buttons the
         machine enables/disables at the bounds (data-disabled). */
      .triggers {
        display: flex;
        flex-direction: column;
        flex: 0 0 auto;
        border-inline-start: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-soft')};
      }

      .trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.75rem;
        margin: 0;
        padding: 0;
        font: inherit;
        font-size: ${litVar('--lab-font-size-xs', '0.8333rem')};
        letter-spacing: ${litVar('--lab-letter-spacing-xs', '-0.0042em')};
        line-height: 1;
        color: ${litVar('--lab-label-secondary')};
        background-color: ${litVar('--lab-fill-neutral-tinted')};
        border: 0;
        cursor: pointer;
        user-select: none;
        transition: background-color 120ms ease, color 120ms ease;
      }
      .trigger:first-child {
        border-block-end: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-soft')};
      }
      .trigger:hover:not([data-disabled]) {
        background-color: ${litVar('--lab-fill-neutral')};
        color: ${litVar('--lab-label-primary')};
      }
      .trigger[data-disabled] {
        cursor: not-allowed;
        opacity: 0.4;
      }

      :host([size='s']) .trigger {
        width: 1.5rem;
      }
      :host([size='l']) .trigger {
        width: 2rem;
      }

      /* Scrubber affordance on the label when enabled (the machine owns the drag). */
      :host([scrubber]) .label {
        cursor: ew-resize;
      }

      /* Focus ring: the control surface lights when the inner input is focus-visible
         (the input has no border of its own — the .control frame carries it). Scoped
         under :host so it beats the :host .control resting border above. */
      :host .control:has(.input:focus-visible) {
        border-color: ${litVar('--lab-border-focus')};
        box-shadow: 0 0 0 ${litVar('--lab-focus-ring-width')} ${litVar('--lab-border-focus')};
      }
      :host([type='danger']) .control:has(.input:focus-visible) {
        box-shadow: 0 0 0 ${litVar('--lab-focus-ring-width')} ${litVar('--lab-border-danger')};
      }
      :host([type='warning']) .control:has(.input:focus-visible) {
        box-shadow: 0 0 0 ${litVar('--lab-focus-ring-width')} ${litVar('--lab-border-warning-strong')};
      }
      :host([type='success']) .control:has(.input:focus-visible) {
        box-shadow: 0 0 0 ${litVar('--lab-focus-ring-width')} ${litVar('--lab-border-success-strong')};
      }

      @media (prefers-reduced-motion: reduce) {
        .trigger {
          transition: none;
        }
      }
    `,
  ];

  /** The semantic inputs the shared a11y helper resolves the helper/error contract
   * from. The base id is the machine id, so the derived helper/error ids sit in the
   * same namespace as the machine's input/label ids without colliding. */
  private a11yInput(): FieldA11yInput {
    return {
      id: this.fieldId,
      invalid: this.invalid,
      required: this.required,
      hasHelper: this.helper.length > 0,
      hasError: this.error.length > 0,
    };
  }

  override updated(_changed: PropertyValues): void {
    // Spread the machine's connect props onto the real shadow nodes (root, label,
    // control group, the spinbutton input + its value ARIA, the +/- triggers). We do
    // NOT clearSpreads() between renders — the trigger getters set/clear
    // data-disabled as the value crosses the bounds, and spreadProps' per-node diff
    // both swaps listeners AND removes attributes that drop out; clearing it each
    // render would leave a stale data-disabled on a trigger (the select/tabs canon).
    const api = this.machineCtl.api;
    const root = this.renderRoot;
    const rootEl = root.querySelector<HTMLElement>('.field');
    const labelEl = root.querySelector<HTMLElement>('.label');
    const controlEl = root.querySelector<HTMLElement>('.control');
    const inputEl = root.querySelector<HTMLInputElement>('.input');
    const decEl = root.querySelector<HTMLButtonElement>('.trigger-dec');
    const incEl = root.querySelector<HTMLButtonElement>('.trigger-inc');
    if (rootEl) this.machineCtl.spread(rootEl, api.getRootProps());
    if (labelEl) this.machineCtl.spread(labelEl, api.getLabelProps());
    if (controlEl) this.machineCtl.spread(controlEl, api.getControlProps());
    if (inputEl) this.machineCtl.spread(inputEl, api.getInputProps());
    if (decEl) this.machineCtl.spread(decEl, api.getDecrementTriggerProps());
    if (incEl) this.machineCtl.spread(incEl, api.getIncrementTriggerProps());

    // Add the FIELD a11y contract over the machine's spread: the machine owns the
    // spinbutton role + value ARIA + aria-invalid; the field owns the description
    // wiring (describedby → helper/error, errormessage, required) — the exact split
    // the other fields use. Applied after the spread so the description ids win and
    // the invalid value agrees with the machine (both derive from `invalid`).
    if (inputEl) {
      const aria = fieldControlAria(this.a11yInput());
      setOrRemove(inputEl, 'aria-describedby', aria['aria-describedby']);
      setOrRemove(inputEl, 'aria-errormessage', aria['aria-errormessage']);
      setOrRemove(inputEl, 'aria-required', aria['aria-required']);
      if (this.placeholder) inputEl.setAttribute('placeholder', this.placeholder);
      else inputEl.removeAttribute('placeholder');
    }
  }

  override render(): TemplateResult {
    const ids = fieldPartIds(this.fieldId);
    const showError = fieldErrorIsActive(this.a11yInput());
    // Structure only; behaviour (spinbutton role, value ARIA, clamping, keyboard,
    // trigger enable/disable) is spread in updated() from the machine. The label /
    // helper / error association is the shared field-a11y contract. SSR emits this
    // real markup so first paint is meaningful before any JS upgrades the element.
    return html`
      <div class="field" part="field">
        <label class="label" part="label">
          <span class="label-text">${this.label}</span
          >${this.required ? html`<span class="required-mark" aria-hidden="true"> *</span>` : nothing}
        </label>
        <div class="control" part="control">
          <input class="input" part="input" inputmode="decimal" />
          <div class="triggers" part="triggers">
            <button class="trigger trigger-inc" part="increment-trigger" type="button" tabindex="-1">
              +
            </button>
            <button class="trigger trigger-dec" part="decrement-trigger" type="button" tabindex="-1">
              −
            </button>
          </div>
        </div>
        ${
          this.helper
            ? html`<span id=${ids.helper} class="helper" part="helper">${this.helper}</span>`
            : nothing
        }
        ${
          showError
            ? html`<span id=${ids.error} class="error" part="error" role="alert">${this.error}</span>`
            : nothing
        }
      </div>
    `;
  }
}

/** Set an attribute when the value is defined, otherwise remove it (never "" vs none confusion). */
function setOrRemove(el: Element, name: string, value: string | undefined): void {
  if (value === undefined) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-number-input': LabNumberInput;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-number-input')) {
  customElements.define('lab-number-input', LabNumberInput);
}
