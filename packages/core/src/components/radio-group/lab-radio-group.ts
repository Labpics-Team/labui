import { type PropertyValues, type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { LabElement } from '../../lit/lab-element.js';
import {
  type LabSelectionItem,
  type LabSelectionSize,
  type LabSelectionType,
  type LabSelectionVariant,
  navigateRadio,
  parseSelectionItems,
} from '../selection/contract.js';
import { type SelectionMotion, mountSelectionMotion } from '../selection/runtime.js';
import { selectionCss } from '../selection/styles.js';

export type LabRadioGroupType = LabSelectionType;
export type LabRadioGroupSize = LabSelectionSize;
export type LabRadioGroupOrientation = 'horizontal' | 'vertical';
export type LabRadioItem = LabSelectionItem;

/** One native radio group, one form value; rich labels retain stable item identity. */
export class LabRadioGroup extends LabElement {
  static formAssociated = true;
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    variant: { reflect: true },
    orientation: { reflect: true },
    value: { reflect: true },
    defaultValue: { attribute: 'default-value', reflect: true },
    controlled: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    name: { reflect: true },
    label: { reflect: true },
    ariaLabel: { attribute: 'aria-label', reflect: true },
    items: {
      reflect: true,
      converter: { fromAttribute: parseSelectionItems, toAttribute: JSON.stringify },
    },
    disabledByForm: { state: true },
  };
  declare type: LabRadioGroupType;
  declare size: LabRadioGroupSize;
  declare variant: LabSelectionVariant;
  declare orientation: LabRadioGroupOrientation;
  declare value: string | null;
  declare defaultValue: string | null;
  declare controlled: boolean;
  declare disabled: boolean;
  declare required: boolean;
  declare name: string;
  declare label: string;
  declare ariaLabel: string | null;
  declare items: LabRadioItem[];
  private declare disabledByForm: boolean;
  private readonly internals?: ElementInternals;
  private resetValue?: string | null;
  private motions = new Map<HTMLInputElement, SelectionMotion>();

  constructor() {
    super();
    this.type = 'accent';
    this.size = 'm';
    this.variant = 'plain';
    this.orientation = 'horizontal';
    this.value = null;
    this.defaultValue = null;
    this.controlled = false;
    this.disabled = false;
    this.required = false;
    this.name = '';
    this.label = '';
    this.ariaLabel = null;
    this.items = [];
    this.disabledByForm = false;
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
  }
  static override styles = [
    unsafeCSS(selectionCss),
    css`
    :host { display: block; min-inline-size: 0; max-inline-size: 100%; }
    ::slotted([slot^='icon-']) { inline-size: 100%; block-size: 100%; }
    .lab-selection-description { display: block; }
  `,
  ];
  protected override willUpdate(changed: PropertyValues): void {
    if (this.resetValue === undefined) {
      this.resetValue = this.controlled ? this.value : (this.value ?? this.defaultValue);
      this.value = this.resetValue;
    } else if (changed.has('defaultValue')) this.resetValue = this.defaultValue;
  }
  private get inputs(): HTMLInputElement[] {
    return Array.from(this.renderRoot.querySelectorAll('input'));
  }
  private syncForm(): void {
    const inputs = this.inputs;
    for (const input of inputs) input.checked = input.value === this.value;
    const selected = inputs.find((input) => input.checked && !input.disabled);
    this.internals?.setFormValue(
      this.name ? (selected?.value ?? null) : null,
      JSON.stringify(this.value),
    );
    const anchor = inputs.find((input) => !input.disabled);
    const missing = !!this.name && this.required && !selected && !!anchor;
    this.internals?.setValidity(
      missing ? { valueMissing: true } : {},
      missing ? 'Выберите один вариант.' : '',
      anchor,
    );
  }
  private readonly onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    if (!input.checked || input.disabled) return;
    if (!this.controlled) this.value = input.value;
    this.dispatchEvent(
      new CustomEvent<{ value: string }>('value-change', {
        detail: { value: input.value },
        bubbles: true,
        composed: true,
      }),
    );
    this.syncForm();
    this.requestUpdate();
  };
  private readonly onKeyDown = (event: KeyboardEvent): void => navigateRadio(event, this.inputs);
  formDisabledCallback(disabled: boolean): void {
    this.disabledByForm = disabled;
  }
  formResetCallback(): void {
    if (!this.name) return;
    if (!this.controlled) {
      this.value = this.resetValue ?? null;
      this.syncForm();
    }
  }
  formStateRestoreCallback(state: string | File | FormData): void {
    if (!this.controlled && typeof state === 'string') {
      try {
        const value: unknown = JSON.parse(state);
        this.value = typeof value === 'string' ? value : null;
      } catch {
        this.value = state;
      }
      this.syncForm();
    }
  }
  get form(): HTMLFormElement | null {
    return this.internals?.form ?? null;
  }
  get validity(): ValidityState | undefined {
    return this.internals?.validity;
  }
  get validationMessage(): string {
    return this.internals?.validationMessage ?? '';
  }
  checkValidity(): boolean {
    return this.internals?.checkValidity() ?? true;
  }
  reportValidity(): boolean {
    return this.internals?.reportValidity() ?? true;
  }
  override updated(): void {
    this.syncForm();
    const inputs = this.inputs;
    for (const [input, motion] of this.motions)
      if (!inputs.includes(input)) {
        motion.dispose();
        this.motions.delete(input);
      }
    for (const input of inputs) {
      if (!this.motions.has(input))
        this.motions.set(
          input,
          mountSelectionMotion(input.closest('label') as HTMLLabelElement, input),
        );
      this.motions.get(input)?.update();
    }
  }
  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.requestUpdate();
  }
  override disconnectedCallback(): void {
    for (const motion of this.motions.values()) motion.dispose();
    this.motions.clear();
    super.disconnectedCallback();
  }
  override render(): TemplateResult {
    const value = this.value ?? (!this.controlled && !this.hasUpdated ? this.defaultValue : null);
    const disabled = this.disabled || this.disabledByForm;
    const selected = this.items.find((item) => item.value === value && !item.disabled);
    const tabValue = (selected ?? this.items.find((item) => !item.disabled))?.value;
    return html`<div class="root" data-lab-radio-group data-type=${this.type} data-size=${this.size} data-orientation=${this.orientation}
      role="radiogroup" aria-required=${String(this.required)} aria-labelledby=${this.label ? `${this.uid}-label` : nothing} aria-label=${this.label ? nothing : this.ariaLabel || nothing}
      ?data-disabled=${disabled} @keydown=${this.onKeyDown}>
      ${this.label ? html`<span class="group-label lab-selection-group-label" id=${`${this.uid}-label`}>${this.label}</span>` : nothing}
      ${repeat(
        this.items,
        (item) => item.value,
        (item) => {
          const checked = item.value === value;
          const itemDisabled = disabled || !!item.disabled;
          const id = `${this.uid}-${encodeURIComponent(item.value)}`;
          return html`<label class="item lab-radio-item" part="item" data-lab-selection data-kind="radio" data-type=${this.type}
          data-size=${this.variant === 'plain' ? this.size : 'l'} data-variant=${this.variant} data-value=${item.value} ?data-selected=${checked} ?data-disabled=${itemDisabled}>
          <span class="lab-selection-label-start" id=${`${id}-start`}><slot name=${`label-start-${item.value}`}>${item.labelStart ?? nothing}</slot></span>
          <span class="lab-selection-icon" aria-hidden="true"><slot name=${`icon-${item.value}`}></slot></span>
          <span class="lab-selection-control control lab-radio-control" part="control" aria-hidden="true" data-state=${checked ? 'checked' : 'unchecked'} ?data-disabled=${itemDisabled}><span class="lab-selection-mark dot lab-radio-dot"></span></span>
          <span class="lab-selection-label text lab-radio-text" part="label"><span id=${`${id}-label`}><slot name=${`label-${item.value}`}>${item.label}</slot></span>
            <span class="lab-selection-description" id=${`${id}-description`}><slot name=${`description-${item.value}`}>${item.description ?? nothing}</slot></span></span>
          <input id=${id} type="radio" name=${this.name || this.uid} value=${item.value} ?checked=${checked} ?disabled=${itemDisabled}
            ?required=${this.required} tabindex=${item.value === tabValue && !disabled ? 0 : -1}
            aria-labelledby=${`${id}-start ${id}-label`} aria-describedby=${`${id}-description`} @change=${this.onChange} />
        </label>`;
        },
      )}
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-radio-group': LabRadioGroup;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-radio-group'))
  customElements.define('lab-radio-group', LabRadioGroup);
