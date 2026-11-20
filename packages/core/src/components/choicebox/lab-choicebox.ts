import { type PropertyValues, type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { LabElement } from '../../lit/lab-element.js';
import { slotSizeCss } from '../../slot-projection.js';
import '../checkbox/index.js';
import '../radio-group/index.js';
import type { LabCheckbox } from '../checkbox/lab-checkbox.js';
import type { LabRadioGroup } from '../radio-group/lab-radio-group.js';
import {
  type LabChoiceboxLayout,
  type LabSelectionItem,
  parseSelectionItems,
} from '../selection/contract.js';

export type { LabChoiceboxLayout } from '../selection/contract.js';
export type LabChoiceboxItem = LabSelectionItem;
const valuesFromAttribute = (raw: string | null): string[] => {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
};

/** Selection cards compose the public Check/Radio controls, retaining one action per option. */
export class LabChoicebox extends LabElement {
  static formAssociated = true;
  static override properties = {
    layout: { reflect: true },
    multiple: { type: Boolean, reflect: true },
    value: {
      reflect: true,
      converter: { fromAttribute: valuesFromAttribute, toAttribute: JSON.stringify },
    },
    defaultValue: {
      attribute: 'default-value',
      reflect: true,
      converter: { fromAttribute: valuesFromAttribute, toAttribute: JSON.stringify },
    },
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
  declare layout: LabChoiceboxLayout;
  declare multiple: boolean;
  declare value: string[];
  declare defaultValue: string[];
  declare controlled: boolean;
  declare disabled: boolean;
  declare required: boolean;
  declare name: string;
  declare label: string;
  declare ariaLabel: string | null;
  declare items: LabChoiceboxItem[];
  private declare disabledByForm: boolean;
  private readonly internals?: ElementInternals;
  private resetValue?: string[];
  constructor() {
    super();
    this.layout = 'card';
    this.multiple = false;
    this.value = [];
    this.defaultValue = [];
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
  static override styles = css`
    :host { display: block; min-inline-size: 0; max-inline-size: 100%; }
    .group { display: flex; flex-wrap: wrap; gap: 1rem; min-inline-size: 0; }
    .label { flex: 1 0 100%; color: var(--lab-label-primary); font: inherit; overflow-wrap: anywhere; }
    lab-checkbox { flex: 1 1 17.71875rem; min-inline-size: 0; }
    ${unsafeCSS(slotSizeCss("::slotted([slot^='icon-'])", '100%', '100%'))}
  `;
  protected override willUpdate(changed: PropertyValues): void {
    if (!this.resetValue) {
      this.resetValue = [
        ...(this.controlled || this.value.length ? this.value : this.defaultValue),
      ];
      this.value = [...this.resetValue];
    } else if (changed.has('defaultValue')) this.resetValue = [...this.defaultValue];
  }
  private syncForm(): void {
    const disabled = this.disabled || this.disabledByForm;
    const effective = this.multiple ? this.value : this.value.slice(0, 1);
    const selected = this.items.filter((item) => effective.includes(item.value) && !item.disabled);
    const data = new FormData();
    if (!disabled && this.name) for (const item of selected) data.append(this.name, item.value);
    this.internals?.setFormValue(
      disabled || !selected.length ? null : data,
      JSON.stringify(this.value),
    );
    const missing =
      !!this.name &&
      this.required &&
      !disabled &&
      !selected.length &&
      this.items.some((item) => !item.disabled);
    this.internals?.setValidity(
      missing ? { valueMissing: true } : {},
      missing ? 'Выберите вариант.' : '',
    );
  }
  private change(value: string[]): void {
    if (!this.controlled) this.value = value;
    this.dispatchEvent(
      new CustomEvent<{ value: string[] }>('value-change', {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
    this.requestUpdate();
    this.syncForm();
  }
  private readonly onRadioChange = (event: CustomEvent<{ value: string }>): void => {
    event.stopPropagation();
    this.change([event.detail.value]);
  };
  private onCheckChange(event: CustomEvent<{ checked: boolean }>, value: string): void {
    event.stopPropagation();
    this.change(
      event.detail.checked
        ? [...this.value.filter((item) => item !== value), value]
        : this.value.filter((item) => item !== value),
    );
  }
  formDisabledCallback(disabled: boolean): void {
    this.disabledByForm = disabled;
  }
  formResetCallback(): void {
    if (!this.name) return;
    if (!this.controlled) {
      this.value = [...(this.resetValue ?? [])];
      this.syncForm();
    }
  }
  formStateRestoreCallback(state: string | File | FormData): void {
    if (!this.controlled && typeof state === 'string') {
      this.value = valuesFromAttribute(state);
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
    if (!this.checkValidity())
      this.renderRoot
        .querySelector<LabCheckbox | LabRadioGroup>('lab-checkbox:not([disabled]), lab-radio-group')
        ?.focus();
    return this.internals?.reportValidity() ?? true;
  }
  override updated(): void {
    this.syncForm();
  }
  override render(): TemplateResult {
    const value =
      this.value.length || this.controlled || this.hasUpdated ? this.value : this.defaultValue;
    const disabled = this.disabled || this.disabledByForm;
    if (!this.multiple)
      return html`<lab-radio-group .items=${this.items} .variant=${this.layout} .value=${value[0] ?? null} controlled
      .label=${this.label} aria-label=${this.ariaLabel || nothing} ?disabled=${disabled} ?required=${this.required} @value-change=${this.onRadioChange}>
      ${this.items.flatMap((item) => ['label', 'description', 'icon'].map((part) => html`<slot name=${`${part}-${item.value}`} slot=${`${part}-${item.value}`}>${part === 'label' ? item.label : part === 'description' ? item.description : nothing}</slot>`))}
    </lab-radio-group>`;
    return html`<div class="group" role="group" aria-labelledby=${this.label ? `${this.uid}-label` : nothing} aria-label=${this.label ? nothing : this.ariaLabel || nothing}>
      ${this.label ? html`<span class="label" id=${`${this.uid}-label`}>${this.label}</span>` : nothing}
      ${repeat(
        this.items,
        (item) => item.value,
        (
          item,
        ) => html`<lab-checkbox .variant=${this.layout} .checked=${value.includes(item.value)} controlled
        ?disabled=${disabled || !!item.disabled} @checked-change=${(event: CustomEvent<{ checked: boolean }>) => this.onCheckChange(event, item.value)}>
        <slot name=${`label-${item.value}`}>${item.label}</slot>
        <slot name=${`description-${item.value}`} slot="description">${item.description ?? nothing}</slot>
        <slot name=${`icon-${item.value}`} slot="icon"></slot>
      </lab-checkbox>`,
      )}
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-choicebox': LabChoicebox;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-choicebox'))
  customElements.define('lab-choicebox', LabChoicebox);
