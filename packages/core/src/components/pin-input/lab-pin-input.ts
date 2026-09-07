import * as pinInputMachine from '@zag-js/pin-input';
/**
 * `<lab-pin-input>` — a segmented code field: N single-character `<input>`s that
 * focus-advance as the user types, fill across on paste, and optionally mask, driven
 * end-to-end by the `@zag-js/pin-input` machine.
 *
 * MACHINE, not opt-out (core-CONTRACT §1): a pin input HAS shared interaction state a
 * machine owns — the segmented value as an array of single characters, the roving
 * focus that auto-advances to the next box on type and back on Backspace, paste that
 * distributes across the boxes, per-box `aria-invalid` + roving `tabindex`, masking
 * (`type=password`), and the complete/invalid lifecycle. Hand-rolling that focus dance
 * is exactly the "machinery Zag ships" the seam exists to consume. So this element runs
 * the machine through `ZagController`: the machine owns each input's value + focus +
 * keyboard + paste-fill + masking; the element only paints (DIP — it depends on the
 * injected `MachineModule`, never on hand-written focus-advance).
 *
 * REUSES the field a11y seam (core-CONTRACT §4), it does NOT duplicate it: the
 * label / helper / error ASSOCIATION is the same shared `field-a11y` helper that
 * `<lab-input>` / `<lab-number-input>` use. A pin input is a GROUP of inputs, so the
 * group owns `aria-labelledby`, `aria-describedby`, `aria-errormessage` and
 * `aria-invalid`. `aria-required` is not valid on role="group"; it lands on every
 * visible textbox segment instead, while the machine owns native `required` on the
 * hidden form input. Neither layer re-implements the other. Visual surface reuses the
 * shared `field-styles`.
 *
 * Axes (the form-field model — Type × Size × State, plus the segmented count):
 *   - type:       neutral | danger | warning | success   (sentiment of the field)
 *   - size:       s | m | l
 *   - count:      the number of segments (single-character boxes)
 *   - valueType:  numeric | alphanumeric | alphabetic     (the machine's accepted chars;
 *                 named `valueType` so it never collides with the sentiment `type` axis)
 *   - mask:       hide each character (`type=password`)
 *   - state:      disabled · readonly · invalid · required   (reflected, drive CSS + ARIA)
 *
 * Token contract (core-CONTRACT §2): ONLY semantic --lab-* roles + dimensions via the
 * shared `field-styles` plus the segment surface here. No hex, no primitive, no
 * colour-role fallback.
 *
 * SSR (core-CONTRACT §7): structure (label + N boxes + hidden input) is always present;
 * the machine spreads the per-box value ARIA + roving tabindex in `updated()`, so
 * `@lit-labs/ssr` emits a meaningful, styled control in the declarative shadow DOM
 * before any JS upgrades it.
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

export type { LabFieldSize as LabPinInputSize, LabFieldType as LabPinInputType };

/** The character set the segments accept — the machine's `type`, renamed so it never
 * collides with the field sentiment `type` axis (neutral/danger/…). */
export type LabPinInputValueType = NonNullable<pinInputMachine.Props['type']>;

type PinInputSchema = SchemaOf<pinInputMachine.Service>;
type PinInputApi = pinInputMachine.Api;

/**
 * The `@zag-js/pin-input` package seen through the renderer-agnostic seam — the SAME
 * `MachineModule` shape the Lit base binds for every machine-driven component, no casts.
 */
const pinInputModule: MachineModule<PinInputSchema, PinInputApi> = pinInputMachine;

/** Per-instance machine id source — keeps the input/label/control ids deterministic and
 * the derived helper/error ids collision-free across instances. */
let pinInputSeq = 0;

export class LabPinInput extends LabElement {
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    /** Visible label text. Always rendered into a real `<label>`. */
    label: {},
    /** When set, the label is clipped (kept in the a11y tree, visually hidden). */
    labelHidden: { type: Boolean, attribute: 'label-hidden', reflect: true },
    /** Helper / description text shown below the control and linked via describedby. */
    helper: {},
    /** Error message; announced (role="alert") and linked only when `invalid`. */
    error: {},
    /** The number of single-character segments. */
    count: { type: Number },
    /** The character set each segment accepts (machine `type`). */
    valueType: { attribute: 'value-type' },
    /** Hide each character (renders the boxes as `type=password`). */
    mask: { type: Boolean, reflect: true },
    /** Signal one-time-code autofill on the segments. */
    otp: { type: Boolean, reflect: true },
    /** Placeholder character shown in each empty box. */
    placeholder: {},
    /** Controlled value (array of single chars, mirrors the machine). */
    value: {
      attribute: 'value',
      converter: { fromAttribute: (raw: string | null): string[] => parseChars(raw) },
    },
    /** Uncontrolled initial value — read once by the machine at init. */
    defaultValue: {
      attribute: 'default-value',
      converter: { fromAttribute: (raw: string | null): string[] => parseChars(raw) },
    },
    /** Non-editable: the boxes read their value but cannot be changed. */
    readonly: { type: Boolean, reflect: true },
    /** Non-interactive and dimmed. */
    disabled: { type: Boolean, reflect: true },
    /** Required — sets aria-required on visible segments and native required on the hidden input. */
    required: { type: Boolean, reflect: true },
    /** Invalid — drives aria-invalid / aria-errormessage and the danger styling. */
    invalid: { type: Boolean, reflect: true },
    /** Native form field name (rides the machine's hidden input). */
    name: {},
  };

  declare type: LabFieldType;
  declare size: LabFieldSize;
  declare label: string;
  declare labelHidden: boolean;
  declare helper: string;
  declare error: string;
  declare count: number;
  declare valueType: LabPinInputValueType;
  declare mask: boolean;
  declare otp: boolean;
  declare placeholder: string;
  declare value: string[];
  declare defaultValue: string[];
  declare readonly: boolean;
  declare disabled: boolean;
  declare required: boolean;
  declare invalid: boolean;
  declare name: string;

  private readonly machineCtl: ZagController<PinInputSchema, PinInputApi>;
  /** Stable machine id — the input/label/control ids and the derived helper/error ids
   * all key off this, so nothing collides across instances. */
  private readonly fieldId = `lab-pin-input-${++pinInputSeq}`;

  constructor() {
    super();
    this.type = 'neutral';
    this.size = 'm';
    this.label = '';
    this.labelHidden = false;
    this.helper = '';
    this.error = '';
    this.count = 4;
    this.valueType = 'numeric';
    this.mask = false;
    this.otp = false;
    this.placeholder = '○';
    this.value = [];
    this.defaultValue = [];
    this.readonly = false;
    this.disabled = false;
    this.required = false;
    this.invalid = false;
    this.name = '';
    // Wire the Zag pin-input behavior. `value` is passed only when the consumer set the
    // attribute (controlled); otherwise the machine owns it from `defaultValue`
    // (uncontrolled) — the same honest two-mode contract as the other controls. The
    // machine owns each box's value + roving focus + keyboard + paste-fill + masking +
    // the complete/invalid lifecycle; the element only paints.
    this.machineCtl = this.runMachine(pinInputModule, () => ({
      id: this.fieldId,
      // Pin the machine's label id to the field-a11y label part id, so the GROUP's
      // aria-labelledby (added in updated()) targets the SAME node the machine labels —
      // one label id, no drift between the machine's label and the field a11y.
      ids: { label: fieldPartIds(this.fieldId).label },
      count: this.count,
      type: this.valueType,
      mask: this.mask,
      otp: this.otp,
      placeholder: this.placeholder,
      value: this.hasAttribute('value') ? this.value : undefined,
      defaultValue: this.defaultValue.length ? this.defaultValue : undefined,
      disabled: this.disabled,
      readOnly: this.readonly,
      invalid: this.invalid,
      required: this.required,
      name: this.name || undefined,
      onValueChange: (details: pinInputMachine.ValueChangeDetails) => {
        this.value = details.value;
        this.dispatchEvent(
          new CustomEvent<pinInputMachine.ValueChangeDetails>('value-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
      onValueComplete: (details: pinInputMachine.ValueChangeDetails) => {
        this.dispatchEvent(
          new CustomEvent<pinInputMachine.ValueChangeDetails>('value-complete', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
      onValueInvalid: (details: pinInputMachine.ValueInvalidDetails) => {
        this.dispatchEvent(
          new CustomEvent<pinInputMachine.ValueInvalidDetails>('value-invalid', {
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
      /* The control row: a horizontal track of single-character boxes. Here .control is a
         WRAPPER <div> (not the editable input it is in Input/Textarea), so the shared
         field-styles' input-oriented surface rules (.control:read-only — which a <div>
         matches, .control:disabled, .control:hover) must NOT decide its surface. We
         neutralise the wrapper to a bare transparent flex container (the combobox lesson:
         the field surface lands on ONE box only — here, on each segment input — never on
         the wrapper), so the wrapper never paints a second box around the segments. The
         label/helper/error parts still come from field-styles unchanged (true reuse). */
      :host .control {
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        gap: var(--_field-gap);
        width: auto;
        margin: 0;
        padding: 0;
        background: transparent;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }
      :host([disabled]) .control {
        cursor: not-allowed;
        opacity: 0.5;
      }

      /* One segment — a real single-character <input>. THIS is the painted field surface
         (border + background + focus ring + sentiment), so it reads exactly like
         <lab-input>. Square by default; centred text. */
      .segment {
        box-sizing: border-box;
        width: ${litVar('--lab-size-control-h-m', '2.5rem')};
        height: ${litVar('--lab-size-control-h-m', '2.5rem')};
        margin: 0;
        padding: 0;
        font: inherit;
        font-size: var(--_field-font);
        letter-spacing: var(--_field-tracking);
        line-height: var(--_field-line);
        text-align: center;
        color: ${litVar('--lab-label-primary')};
        background-color: ${litVar('--lab-bg-primary')};
        border: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-base')};
        border-radius: var(--_field-radius);
        transition: border-color var(--lab-motion-transition-duration) var(--lab-motion-transition-easing);
        appearance: none;
      }
      .segment::placeholder {
        color: ${litVar('--lab-label-tertiary')};
        opacity: 1;
      }

      :host([size='s']) .segment {
        width: ${litVar('--lab-size-control-h-s', '2rem')};
        height: ${litVar('--lab-size-control-h-s', '2rem')};
      }
      :host([size='l']) .segment {
        width: ${litVar('--lab-size-control-h-l', '3rem')};
        height: ${litVar('--lab-size-control-h-l', '3rem')};
      }

      :host(:not([disabled]):not([readonly])) .segment:hover {
        border-color: ${litVar('--lab-border-strong')};
      }

      /* Sentiment: the type axis re-points each segment's border. Driven by the reflected
         host attribute (the styling contract), independent of size. */
      :host([type='danger']) .segment {
        border-color: ${litVar('--lab-border-danger')};
      }
      :host([type='warning']) .segment {
        border-color: ${litVar('--lab-border-warning-strong')};
      }
      :host([type='success']) .segment {
        border-color: ${litVar('--lab-border-success-strong')};
      }

      /* Readonly / disabled surfaces. */
      :host([readonly]) .segment {
        background-color: ${litVar('--lab-fill-primary')};
        border-color: ${litVar('--lab-border-soft')};
      }
      .segment:disabled {
        cursor: not-allowed;
      }

      /* Focus ring from the focus role — never a removed outline. The segment carries its
         own border, so the ring lights on the focused box. */
      .segment:focus-visible {
        border-color: ${litVar('--lab-border-focus')};
        outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
        outline-offset: ${litVar('--lab-focus-ring-offset')};
      }
      :host([type='danger']) .segment:focus-visible {
        outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-danger')};
        outline-offset: ${litVar('--lab-focus-ring-offset')};
      }
      :host([type='warning']) .segment:focus-visible {
        outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-warning-strong')};
        outline-offset: ${litVar('--lab-focus-ring-offset')};
      }
      :host([type='success']) .segment:focus-visible {
        outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-success-strong')};
        outline-offset: ${litVar('--lab-focus-ring-offset')};
      }
    `,
  ];

  /** The semantic inputs the shared a11y helper resolves the helper/error contract from.
   * The base id is the machine id, so the derived helper/error ids sit in the same
   * namespace as the machine's input/label ids without colliding. */
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
    // Spread the machine's connect props onto the real shadow nodes (root, label, the
    // control group, each segment input, the hidden form input). We do NOT clearSpreads()
    // between renders — the per-input getters set the roving tabindex (0 on the active
    // box, -1 on the rest), and spreadProps' per-node diff both swaps listeners AND
    // removes attributes that drop out; clearing it each render would leave a stale
    // tabindex on a box (the number-input/select canon).
    const api = this.machineCtl.api;
    const root = this.renderRoot;
    const rootEl = root.querySelector<HTMLElement>('.field');
    const labelEl = root.querySelector<HTMLElement>('.label');
    const controlEl = root.querySelector<HTMLElement>('.control');
    const hiddenEl = root.querySelector<HTMLInputElement>('.hidden-input');
    if (rootEl) this.machineCtl.spread(rootEl, api.getRootProps());
    if (labelEl) this.machineCtl.spread(labelEl, api.getLabelProps());
    if (controlEl) this.machineCtl.spread(controlEl, api.getControlProps());
    if (hiddenEl) this.machineCtl.spread(hiddenEl, api.getHiddenInputProps());

    const aria = fieldControlAria(this.a11yInput());

    // Map each segment's getters onto its box by the STABLE key `index`. Pin segments
    // never reorder, so the positional index is the machine's own key. Required belongs
    // to these focusable textbox elements: role="group" does not support aria-required.
    for (const index of api.items) {
      const inputEl = root.querySelector<HTMLInputElement>(`.segment[data-index="${index}"]`);
      if (inputEl) {
        this.machineCtl.spread(inputEl, api.getInputProps({ index }));
        setOrRemove(inputEl, 'aria-required', aria['aria-required']);
        inputEl.setAttribute(
          'aria-label',
          `${this.label || 'Pin input'}, digit ${index + 1} of ${this.count}`,
        );
      }
    }

    // The aggregate group owns only the field semantics valid for role="group": shared
    // label/description plus invalid/error association. Applied after the machine spread
    // so the field's associations remain authoritative without inventing an unsupported
    // required state on the container.
    if (controlEl) {
      const ids = fieldPartIds(this.fieldId);
      controlEl.setAttribute('role', 'group');
      controlEl.setAttribute('aria-labelledby', ids.label);
      setOrRemove(controlEl, 'aria-describedby', aria['aria-describedby']);
      setOrRemove(controlEl, 'aria-invalid', aria['aria-invalid']);
      setOrRemove(controlEl, 'aria-errormessage', aria['aria-errormessage']);
      controlEl.removeAttribute('aria-required');
    }
  }

  override render(): TemplateResult {
    const ids = fieldPartIds(this.fieldId);
    const showError = fieldErrorIsActive(this.a11yInput());
    // Structure only; behaviour (per-box value, roving focus/keyboard, paste-fill,
    // masking, the hidden form value) is spread in updated() from the machine. The
    // label / helper / error association is the shared field-a11y contract, on the group.
    // SSR emits this real markup so first paint is meaningful before any JS upgrades it.
    const segments = Array.from({ length: Math.max(0, this.count) }, (_unused, index) => index);
    return html`
      <div class="field" part="field">
        <label id=${ids.label} class="label" part="label">
          <span class="label-text">${this.label}</span
          >${this.required ? html`<span class="required-mark" aria-hidden="true"> *</span>` : nothing}
        </label>
        <div class="control" part="control">
          ${segments.map(
            (index) =>
              html`<input
                class="segment"
                part="segment"
                data-index=${index}
                inputmode=${this.valueType === 'numeric' ? 'numeric' : 'text'}
              />`,
          )}
          <input class="hidden-input" part="hidden-input" />
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

/** Parse a value attribute into an array of single chars. Accepts a JSON array
 * (`'["1","2"]'`) or a bare string (`"12"` → `["1","2"]`); malformed input is empty. */
function parseChars(raw: string | null): string[] {
  if (raw === null) return [];
  const trimmed = raw.trim();
  if (trimmed === '') return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    if (typeof parsed === 'string') return [...parsed];
    return [...trimmed];
  } catch {
    return [...trimmed];
  }
}

/** Set an attribute when the value is defined, otherwise remove it (never "" vs none confusion). */
function setOrRemove(el: Element, name: string, value: string | undefined): void {
  if (value === undefined) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-pin-input': LabPinInput;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-pin-input')) {
  customElements.define('lab-pin-input', LabPinInput);
}
