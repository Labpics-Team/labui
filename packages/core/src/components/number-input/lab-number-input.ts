import type * as numberInputMachine from '@zag-js/number-input';
import { type PropertyValues, type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import type { SchemaOf } from '../../behaviors/types.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';
import { extensionFieldCss } from '../field/extension-styles.js';
import {
  type FieldA11yInput,
  type LabFieldSize,
  type LabFieldType,
  fieldControlAria,
  fieldErrorIsActive,
  fieldPartIds,
} from '../field/field-a11y.js';

export type { LabFieldSize as LabNumberInputSize, LabFieldType as LabNumberInputType };

type NumberInputSchema = SchemaOf<numberInputMachine.Service>;
type NumberInputApi = numberInputMachine.Api;

import { submitFromShadowInput } from '../field/implicit-submit.js';
import { numberInputBehavior, numberInputValidity } from './behavior.js';

let numberInputSeq = 0;

export class LabNumberInput extends LabElement {
  static formAssociated = true;
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    label: {},
    labelHidden: { type: Boolean, attribute: 'label-hidden', reflect: true },
    helper: {},
    error: {},
    value: { converter: { fromAttribute: (raw: string | null) => raw } },
    defaultValue: { attribute: 'default-value' },
    placeholder: {},
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    scrubber: { type: Boolean, reflect: true },
    allowMouseWheel: { type: Boolean, attribute: 'allow-mouse-wheel' },
    readonly: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    invalid: { type: Boolean, reflect: true },
    name: { reflect: true },
    disabledByForm: { state: true },
  };

  declare type: LabFieldType;
  declare size: LabFieldSize;
  declare label: string;
  declare labelHidden: boolean;
  declare helper: string;
  declare error: string;
  declare value: string | null;
  private initialValue?: string;
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
  private declare disabledByForm: boolean;
  private readonly internals?: ElementInternals;

  private readonly machineCtl: ZagController<NumberInputSchema, NumberInputApi>;
  private readonly fieldId = `lab-number-input-${++numberInputSeq}`;

  constructor() {
    super();
    this.type = 'neutral';
    this.size = 'm';
    this.label = '';
    this.labelHidden = false;
    this.helper = '';
    this.error = '';
    this.value = null;
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
    this.disabledByForm = false;
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
    // Wire the Zag number-input behavior. `value` is passed only when the consumer
    // set the attribute (controlled); otherwise the machine owns it from
    // `defaultValue` (uncontrolled) — the same honest two-mode contract as the other
    // controls. The machine owns the spinbutton role, value ARIA, clamping, keyboard
    // and the trigger enable/disable; the element only paints.
    this.machineCtl = this.runMachine(numberInputBehavior, () => ({
      id: this.fieldId,
      ids: { input: fieldPartIds(this.fieldId).control, label: fieldPartIds(this.fieldId).label },
      value: this.value ?? undefined,
      defaultValue: this.defaultValue || undefined,
      min: this.min,
      max: this.max,
      step: this.step,
      disabled: this.disabled || this.disabledByForm,
      readOnly: this.readonly,
      invalid: this.invalid || undefined,
      required: this.required,
      name: this.name || undefined,
      allowMouseWheel: this.allowMouseWheel,
      onValueChange: (details: numberInputMachine.ValueChangeDetails) => {
        // The callback requests a change; controlled input stays with its consumer.
        this.requestUpdate();
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
    unsafeCSS(extensionFieldCss),
    css`:host { display:block; min-inline-size:0; }`,
  ];

  private a11yInput(): FieldA11yInput {
    return {
      id: this.fieldId,
      invalid: this.isConnected ? this.machineCtl.api.invalid : this.invalid,
      required: this.required,
      hasHelper: this.helper.length > 0,
      hasError: this.error.length > 0,
    };
  }

  /** Accepted text value, including a permitted intermediate numeric draft. */
  get currentValue(): string {
    return this.isConnected ? this.machineCtl.api.value : (this.value ?? this.defaultValue);
  }

  formDisabledCallback(disabled: boolean): void {
    this.disabledByForm = disabled;
  }
  formResetCallback(): void {
    if (this.value === null)
      this.machineCtl.send({ type: 'VALUE.SET', value: this.initialValue ?? '' });
    this.requestUpdate();
  }
  formStateRestoreCallback(state: string | File | FormData): void {
    if (this.value === null && typeof state === 'string')
      this.machineCtl.send({ type: 'VALUE.SET', value: state });
    this.requestUpdate();
  }
  get form(): HTMLFormElement | null {
    return this.internals?.form ?? null;
  }
  get validity(): ValidityState | undefined {
    return this.internals?.validity;
  }
  checkValidity(): boolean {
    return this.internals?.checkValidity() ?? true;
  }
  reportValidity(): boolean {
    return this.internals?.reportValidity() ?? true;
  }

  override updated(_changed: PropertyValues): void {
    // Spread the machine's connect props onto the real shadow nodes (root, label,
    // control group, the spinbutton input + its value ARIA, the +/- triggers). We do
    // NOT clearSpreads() between renders — the trigger getters set/clear
    // data-disabled as the value crosses the bounds, and spreadProps' per-node diff
    // both swaps listeners AND removes attributes that drop out; clearing it each
    // render would leave a stale data-disabled on a trigger (the select/tabs canon).
    this.initialValue ??= this.defaultValue;
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
    const scrubber = root.querySelector<HTMLElement>('.label-text');
    if (scrubber)
      this.machineCtl.spread(
        scrubber,
        this.scrubber && !this.disabled && !this.disabledByForm && !this.readonly
          ? api.getScrubberProps()
          : {},
      );
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
    const formInput = root.querySelector<HTMLInputElement>('.input');
    if (formInput) {
      const values = [api.value];
      const disabled = this.disabled || this.disabledByForm;
      const data = new FormData();
      if (this.name && !disabled) for (const value of values) data.append(this.name, value);
      this.internals?.setFormValue(disabled ? null : data, api.value);
      const validity = numberInputValidity({
        value: api.value,
        valueAsNumber: api.valueAsNumber,
        min: this.min,
        max: this.max,
        required: this.required,
        invalid: this.invalid,
        disabled,
        readOnly: this.readonly,
      });
      this.internals?.setValidity(
        validity.flags,
        validity.flags.customError ? this.error || validity.message : validity.message,
        formInput,
      );
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
      <div class="field" data-lab-input data-lab-number-input data-type=${this.type} data-size=${this.size} part="field"
        ?data-label-hidden=${this.labelHidden} ?data-unlabelled=${!this.label}
        ?data-disabled=${this.disabled || this.disabledByForm} ?data-readonly=${this.readonly} ?data-invalid=${this.isConnected ? this.machineCtl.api.invalid : this.invalid} data-trailing>
        <div class="lab-input-frame" part="frame">
        <label id=${ids.label} for=${ids.control} class="label lab-field-label" part="label">
          <span class="label-text">${this.label}</span
          >${this.required ? html`<span class="lab-field-required-mark" aria-hidden="true"> *</span>` : nothing}
        </label>
        <div class="control lab-extension-control" part="control">
          <input @keydown=${(event: KeyboardEvent) => submitFromShadowInput(event, event.target as HTMLInputElement, () => this.form)} class="input lab-field-control" part="input" id=${ids.control} role="spinbutton" value=${this.value ?? this.defaultValue} ?disabled=${this.disabled || this.disabledByForm} ?readonly=${this.readonly} inputmode="decimal" />
          <div class="triggers lab-number-input-triggers" part="triggers">
            <button class="lab-extension-trigger trigger trigger-inc" part="increment-trigger" type="button" tabindex="-1">
              +
            </button>
            <button class="lab-extension-trigger trigger trigger-dec" part="decrement-trigger" type="button" tabindex="-1">
              −
            </button>
          </div>
        </div>
        <fieldset class="lab-input-outline" aria-hidden="true"><legend>${this.label}${this.required ? ' *' : ''}</legend></fieldset></div>
        ${
          this.helper
            ? html`<span id=${ids.helper} class="helper lab-field-helper" part="helper">${this.helper}</span>`
            : nothing
        }
        ${
          showError
            ? html`<span id=${ids.error} class="error lab-field-error" part="error" role="alert">${this.error}</span>`
            : nothing
        }
      </div>
    `;
  }
}

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
