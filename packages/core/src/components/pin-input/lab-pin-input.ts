import type * as pin from '@zag-js/pin-input';
import { type PropertyValues, type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import type { SchemaOf } from '../../behaviors/types.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';
import {
  type LabFieldSize,
  type LabFieldType,
  fieldControlAria,
  fieldPartIds,
} from '../field/field-a11y.js';
import { pinCount, pinInputBehavior, pinValueMatchesType } from './behavior.js';
import { pinInputCss } from './styles.js';

export type { LabFieldSize as LabPinInputSize, LabFieldType as LabPinInputType };
export type LabPinInputValueType = NonNullable<pin.Props['type']>;
let sequence = 0;

/** Authored segmented code field. Zag owns editing; ElementInternals owns the outer form. */
export class LabPinInput extends LabElement {
  static formAssociated = true;
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    label: {},
    labelHidden: { type: Boolean, attribute: 'label-hidden', reflect: true },
    helper: {},
    error: {},
    count: { type: Number },
    valueType: { attribute: 'value-type' },
    mask: { type: Boolean, reflect: true },
    otp: { type: Boolean, reflect: true },
    placeholder: {},
    value: {
      converter: {
        fromAttribute: (value: string | null) => (value === null ? undefined : parseChars(value)),
      },
    },
    defaultValue: { attribute: 'default-value', converter: { fromAttribute: parseChars } },
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
  declare count: number;
  declare valueType: LabPinInputValueType;
  declare mask: boolean;
  declare otp: boolean;
  declare placeholder: string;
  /** Controlled value; leave undefined for local editing initialized by defaultValue. */
  declare value: string[] | undefined;
  declare defaultValue: string[];
  declare readonly: boolean;
  declare disabled: boolean;
  declare required: boolean;
  declare invalid: boolean;
  declare name: string;
  private declare disabledByForm: boolean;
  private fieldId = `lab-pin-input-${++sequence}`;
  private readonly internals?: ElementInternals;
  private readonly machineCtl: ZagController<SchemaOf<pin.Service>, pin.Api>;
  private localValue?: string[];
  private resetValue?: string[];
  private restoring = false;

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
    this.placeholder = '';
    this.value = undefined;
    this.defaultValue = [];
    this.readonly = false;
    this.disabled = false;
    this.required = false;
    this.invalid = false;
    this.name = '';
    this.disabledByForm = false;
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
    this.machineCtl = this.runMachine(pinInputBehavior, () => ({
      id: this.fieldId,
      ids: { label: fieldPartIds(this.fieldId).label },
      count: pinCount(this.count),
      type: this.valueType,
      mask: this.mask,
      otp: this.otp,
      placeholder: this.placeholder,
      value: this.value,
      defaultValue: this.localValue ?? this.defaultValue,
      disabled: this.disabled || this.disabledByForm,
      readOnly: this.readonly,
      invalid: this.invalid,
      required: this.required,
      name: this.name || undefined,
      onValueChange: (details: pin.ValueChangeDetails) => {
        if (this.value === undefined) this.localValue = details.value;
        this.syncForm();
        if (!this.restoring)
          this.dispatchEvent(
            new CustomEvent<pin.ValueChangeDetails>('value-change', {
              detail: details,
              bubbles: true,
              composed: true,
            }),
          );
        // A controlled consumer can accept the edit synchronously in value-change.
        this.syncForm();
      },
      onValueComplete: (details: pin.ValueChangeDetails) => {
        // Completion handlers may call requestSubmit before Lit's next update.
        this.syncForm();
        if (!this.restoring)
          this.dispatchEvent(
            new CustomEvent<pin.ValueChangeDetails>('value-complete', {
              detail: details,
              bubbles: true,
              composed: true,
            }),
          );
      },
      onValueInvalid: (details: pin.ValueInvalidDetails) =>
        this.dispatchEvent(
          new CustomEvent<pin.ValueInvalidDetails>('value-invalid', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        ),
    }));
  }
  static override styles = [
    unsafeCSS(pinInputCss),
    css`:host { display: block; min-inline-size: 0; max-inline-size: 100%; }`,
  ];
  /** Current accepted value, including locally edited uncontrolled values. */
  get currentValue(): string[] {
    return Array.from(
      { length: pinCount(this.count) },
      (_, index) => (this.value ?? this.localValue ?? this.defaultValue)[index] ?? '',
    );
  }
  private get disabledState(): boolean {
    return this.disabled || this.disabledByForm;
  }
  private get aria() {
    return fieldControlAria({
      id: this.fieldId,
      invalid: this.invalid,
      required: this.required,
      hasHelper: this.helper.length > 0,
      hasError: this.error.length > 0,
    });
  }
  protected override willUpdate(_changed: PropertyValues): void {
    this.resetValue ??= [...this.defaultValue];
  }
  override connectedCallback(): void {
    const existing = this.shadowRoot?.querySelector<HTMLElement>('[data-lab-pin-input]');
    if (!this.hasUpdated && existing) {
      if (existing.dataset.fieldId) this.fieldId = existing.dataset.fieldId;
      if (this.value === undefined) {
        const inputs = [...existing.querySelectorAll<HTMLInputElement>('.segment')];
        if (inputs.some((input) => input.value !== input.defaultValue)) {
          const accepted = this.currentValue;
          for (const [index, input] of inputs.entries()) {
            if (input.value === input.defaultValue) continue;
            // Native editing/autofill can happen before the component is loaded.
            // A complete pasted code in one cell replaces the following cells.
            const characters = [...input.value];
            if (!characters.length) accepted[index] = '';
            for (const [offset, character] of characters.entries()) {
              if (index + offset >= accepted.length) break;
              accepted[index + offset] = character;
            }
          }
          this.localValue = accepted;
        }
      }
    }
    super.connectedCallback();
  }
  formDisabledCallback(disabled: boolean): void {
    this.disabledByForm = disabled;
  }
  formResetCallback(): void {
    this.restore(this.resetValue ?? []);
  }
  formStateRestoreCallback(state: string | File | FormData): void {
    if (typeof state === 'string') this.restore(parseChars(state));
  }
  private restore(value: string[]): void {
    if (this.value !== undefined) {
      this.requestUpdate();
      return;
    }
    this.restoring = true;
    this.machineCtl.api.setValue(value);
    this.localValue = value;
    this.restoring = false;
    this.requestUpdate();
  }
  checkValidity(): boolean {
    return this.internals?.checkValidity() ?? true;
  }
  reportValidity(): boolean {
    return this.internals?.reportValidity() ?? true;
  }
  private syncForm(): void {
    const value = this.currentValue;
    this.internals?.setFormValue(this.disabledState ? null : value.join(''), JSON.stringify(value));
    const anchor = this.renderRoot.querySelector<HTMLInputElement>('.segment');
    const missing = this.required && value.some((character) => character === '');
    const malformed = !pinValueMatchesType(value, this.valueType);
    const invalid = !this.readonly && !this.disabledState && (missing || malformed || this.invalid);
    this.internals?.setValidity(
      invalid
        ? malformed
          ? { patternMismatch: true }
          : missing
            ? { valueMissing: true }
            : { customError: true }
        : {},
      invalid
        ? this.error ||
            (malformed
              ? 'Enter a code with the expected character type.'
              : `Enter all ${pinCount(this.count)} characters.`)
        : '',
      anchor ?? undefined,
    );
  }
  override updated(): void {
    this.machineCtl.clearSpreads();
    const api = this.machineCtl.api;
    const root = this.renderRoot;
    for (const [selector, props] of [
      ['.field', api.getRootProps()],
      ['.label', api.getLabelProps()],
      ['.control', api.getControlProps()],
      ['.hidden-input', api.getHiddenInputProps()],
    ] as const) {
      const node = root.querySelector<HTMLElement>(selector);
      if (node) this.machineCtl.spread(node, props);
    }
    root.querySelectorAll<HTMLInputElement>('.segment').forEach((input, index) => {
      this.machineCtl.spread(input, api.getInputProps({ index }));
      input.setAttribute(
        'aria-label',
        `${this.label || 'Pin input'}, ${this.valueType === 'numeric' ? 'digit' : 'character'} ${index + 1} of ${pinCount(this.count)}`,
      );
      for (const [name, value] of Object.entries(this.aria)) setAttribute(input, name, value);
    });
    const group = root.querySelector('.control');
    if (group) {
      group.setAttribute('role', 'group');
      group.setAttribute('aria-labelledby', fieldPartIds(this.fieldId).label);
      for (const [name, value] of Object.entries(this.aria))
        if (name !== 'aria-required') setAttribute(group, name, value);
    }
    this.syncForm();
  }
  private onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.key === 'Enter' &&
      !event.isComposing &&
      !this.disabledState &&
      !this.readonly &&
      this.currentValue.every(Boolean)
    )
      this.internals?.form?.requestSubmit();
  };
  override render(): TemplateResult {
    const ids = fieldPartIds(this.fieldId);
    const value = this.currentValue;
    return html`
      <div class="field" part="field" data-lab-pin-input data-field-id=${this.fieldId}
        data-size=${this.size} data-type=${this.type} ?data-invalid=${this.invalid}
        ?data-disabled=${this.disabledState} ?data-label-hidden=${this.labelHidden || !this.label}>
        <label id=${ids.label} class="label lab-field-label" part="label">
          ${this.label || 'Pin input'}${this.required ? html`<span class="lab-field-required-mark" aria-hidden="true"> *</span>` : nothing}
        </label>
        <div class="control lab-pin-input-control" part="control" role="group" aria-labelledby=${ids.label}
          aria-describedby=${this.aria['aria-describedby'] ?? nothing} aria-invalid=${this.aria['aria-invalid'] ?? nothing}
          aria-errormessage=${this.aria['aria-errormessage'] ?? nothing} @keydown=${this.onKeyDown}>
          ${value.map(
            (character, index) => html`
            <span class="lab-pin-input-cell" part="cell">
              <input class="segment lab-pin-input-segment" part="segment" data-index=${index}
                type=${this.mask ? 'password' : this.valueType === 'numeric' ? 'tel' : 'text'}
                value=${character} ?data-filled=${character !== ''} ?disabled=${this.disabledState}
                ?readonly=${this.readonly} inputmode=${this.valueType === 'numeric' ? 'numeric' : 'text'}
                autocomplete=${this.otp ? 'one-time-code' : 'off'} placeholder=${this.placeholder}
                aria-required=${this.aria['aria-required'] ?? nothing} aria-invalid=${this.aria['aria-invalid'] ?? nothing}
                aria-describedby=${this.aria['aria-describedby'] ?? nothing} aria-errormessage=${this.aria['aria-errormessage'] ?? nothing}
                aria-label=${`${this.label || 'Pin input'}, character ${index + 1} of ${value.length}`} />
              <span class="lab-pin-input-dot" aria-hidden="true"></span>
            </span>`,
          )}
          <input class="hidden-input" part="hidden-input" type="hidden" value=${value.join('')} />
        </div>
        ${this.helper ? html`<span id=${ids.helper} class="helper lab-field-helper" part="helper">${this.helper}</span>` : nothing}
        ${this.invalid && this.error ? html`<span id=${ids.error} class="error lab-field-error" part="error" role="alert">${this.error}</span>` : nothing}
      </div>`;
  }
}
function parseChars(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value))
      return value.filter((character): character is string => typeof character === 'string');
    if (typeof value === 'string') return [...value];
  } catch {
    /* Bare code attributes are also supported. */
  }
  return [...raw];
}
function setAttribute(node: Element, name: string, value: string | undefined): void {
  if (value === undefined) node.removeAttribute(name);
  else node.setAttribute(name, value);
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-pin-input': LabPinInput;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-pin-input'))
  customElements.define('lab-pin-input', LabPinInput);
