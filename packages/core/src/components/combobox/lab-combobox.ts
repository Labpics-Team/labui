import * as comboboxMachine from '@zag-js/combobox';
import {
  type PropertyValues,
  type TemplateResult,
  css,
  html,
  isServer,
  nothing,
  unsafeCSS,
} from 'lit';
import type { MachineModule, PropTypes } from '../../behaviors/types.js';
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
import { type ComboboxSchema, comboboxBehavior, mountComboboxKeyboard } from './runtime.js';

export type LabComboboxType = LabFieldType;
export type LabComboboxSize = LabFieldSize;
export type LabComboboxPlacement = NonNullable<
  NonNullable<comboboxMachine.Props['positioning']>['placement']
>;

export interface LabComboboxItem {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

type ComboboxApi = comboboxMachine.Api<PropTypes, LabComboboxItem>;

const comboboxModule: MachineModule<ComboboxSchema, ComboboxApi> = comboboxBehavior;

let comboboxInstanceSeq = 0;

export { filterComboboxItems } from './filter.js';
import { filterComboboxItems } from './filter.js';

export class LabCombobox extends LabElement {
  static formAssociated = true;
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    placement: { reflect: true },
    multiple: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    readonly: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    invalid: { type: Boolean, reflect: true },
    name: { reflect: true },
    disabledByForm: { state: true },
    placeholder: {},
    label: {},
    labelHidden: { type: Boolean, attribute: 'label-hidden', reflect: true },
    helper: {},
    error: {},
    value: {
      attribute: 'value',
      converter: {
        fromAttribute: (raw: string | null): string[] | null =>
          raw === null ? null : parseValues(raw),
      },
    },
    defaultValue: {
      attribute: 'default-value',
      converter: { fromAttribute: (raw: string | null): string[] => parseValues(raw) },
    },
    items: {
      attribute: 'items',
      converter: { fromAttribute: (raw: string | null): LabComboboxItem[] => parseItems(raw) },
    },
  };

  declare type: LabComboboxType;
  declare size: LabComboboxSize;
  declare placement: LabComboboxPlacement;
  declare multiple: boolean;
  declare disabled: boolean;
  declare readonly: boolean;
  declare required: boolean;
  declare invalid: boolean;
  declare name: string;
  private declare disabledByForm: boolean;
  private readonly internals?: ElementInternals;
  declare placeholder: string;
  declare label: string;
  declare labelHidden: boolean;
  declare helper: string;
  declare error: string;
  declare value: string[] | null;
  private initialValue?: string[];
  declare defaultValue: string[];
  declare items: LabComboboxItem[];

  private readonly machineCtl: ZagController<ComboboxSchema, ComboboxApi>;
  private readonly machineId = `lab-combobox-${++comboboxInstanceSeq}`;
  private stopKeyboard?: () => void;
  private query = '';
  private filteredItems: LabComboboxItem[] = [];
  private collection = comboboxMachine.collection<LabComboboxItem>({ items: [] });
  private sourceCollection = comboboxMachine.collection<LabComboboxItem>({ items: [] });

  constructor() {
    super();
    this.type = 'neutral';
    this.size = 'm';
    this.placement = 'bottom-start';
    this.multiple = false;
    this.disabled = false;
    this.readonly = false;
    this.required = false;
    this.invalid = false;
    this.name = '';
    this.disabledByForm = false;
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
    this.placeholder = '';
    this.label = '';
    this.labelHidden = false;
    this.helper = '';
    this.error = '';
    this.value = null;
    this.defaultValue = [];
    this.items = [];
    this.machineCtl = this.runMachine(comboboxModule, () => ({
      id: this.machineId,
      ids: {
        input: fieldPartIds(this.machineId).control,
        label: fieldPartIds(this.machineId).label,
      },
      collection: this.collection,
      sourceCollection: this.sourceCollection,
      multiple: this.multiple,
      disabled: this.disabled || this.disabledByForm,
      readOnly: this.readonly,
      required: this.required,
      invalid: this.invalid,
      name: this.name || undefined,
      placeholder: this.placeholder || undefined,
      value: this.value ?? undefined,
      defaultValue: this.defaultValue.length ? this.defaultValue : undefined,
      openOnClick: true,
      positioning: {
        placement: this.placement,
        strategy: 'fixed',
        gutter: 4,
        overflowPadding: 16,
        sameWidth: true,
      },
      onQueryChange: (query: string) => {
        this.applyFilter(query);
        this.requestUpdate();
      },
      onInputValueChange: (details: comboboxMachine.InputValueChangeDetails) => {
        this.requestUpdate();
        this.dispatchEvent(
          new CustomEvent<comboboxMachine.InputValueChangeDetails>('input-value-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
      onValueChange: (details: comboboxMachine.ValueChangeDetails<LabComboboxItem>) => {
        // The callback requests a change; controlled input stays with its consumer.
        this.requestUpdate();
        this.dispatchEvent(
          new CustomEvent<comboboxMachine.ValueChangeDetails<LabComboboxItem>>('value-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
      onOpenChange: (details: comboboxMachine.OpenChangeDetails) => {
        this.dispatchEvent(
          new CustomEvent<comboboxMachine.OpenChangeDetails>('open-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
    }));
  }

  override connectedCallback(): void {
    this.updateSourceCollection();
    this.applyFilter('');
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    this.stopKeyboard?.();
    this.stopKeyboard = undefined;
    super.disconnectedCallback();
  }

  override willUpdate(changed: PropertyValues): void {
    // Keep the collection in step with a replaced source list and the current query.
    if (changed.has('items')) {
      this.updateSourceCollection();
      this.applyFilter(this.query);
    }
  }

  private updateSourceCollection(): void {
    this.sourceCollection = comboboxMachine.collection<LabComboboxItem>({
      items: this.items ?? [],
      itemToValue: (item) => item.value,
      itemToString: (item) => item.label,
      isItemDisabled: (item) => item.disabled ?? false,
    });
  }

  private applyFilter(query: string): void {
    this.query = query;
    this.filteredItems = filterComboboxItems(this.items ?? [], query);
    this.collection = comboboxMachine.collection<LabComboboxItem>({
      items: this.filteredItems,
      itemToValue: (item) => item.value,
      itemToString: (item) => item.label,
      isItemDisabled: (item) => item.disabled ?? false,
    });
  }

  static override styles = [
    unsafeCSS(extensionFieldCss),
    css`:host { display:block; min-inline-size:0; }`,
  ];

  private a11yInput(): FieldA11yInput {
    return {
      id: this.machineId,
      invalid: this.invalid,
      required: this.required,
      hasHelper: this.helper.length > 0,
      hasError: this.error.length > 0,
    };
  }

  /** Accepted values; assigning value keeps external control. */
  get selectedValues(): readonly string[] {
    return this.isConnected ? this.machineCtl.api.value : (this.value ?? this.defaultValue);
  }

  formDisabledCallback(disabled: boolean): void {
    this.disabledByForm = disabled;
  }
  formResetCallback(): void {
    this.machineCtl.api.setValue(this.value ?? this.initialValue ?? []);
    this.requestUpdate();
  }
  formStateRestoreCallback(state: string | File | FormData): void {
    if (this.value === null && typeof state === 'string')
      this.machineCtl.api.setValue(parseValues(state));
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

  override updated(): void {
    this.initialValue ??= [...this.defaultValue];
    const api = this.machineCtl.api;
    const root = this.renderRoot;

    const labelEl = root.querySelector<HTMLElement>('.label');
    if (labelEl) this.machineCtl.spread(labelEl, api.getLabelProps());

    const control = root.querySelector<HTMLElement>('.control');
    if (control) this.machineCtl.spread(control, api.getControlProps());

    const input = root.querySelector<HTMLInputElement>('.input');
    if (input) {
      this.stopKeyboard ??= mountComboboxKeyboard(input, () => this.machineCtl.api);
      this.machineCtl.spread(input, api.getInputProps());
      const aria = fieldControlAria(this.a11yInput());
      setOrRemove(input, 'aria-describedby', aria['aria-describedby']);
      setOrRemove(input, 'aria-invalid', aria['aria-invalid']);
      setOrRemove(input, 'aria-errormessage', aria['aria-errormessage']);
      setOrRemove(input, 'aria-required', aria['aria-required']);
    }

    const formInput = root.querySelector<HTMLInputElement>('.input');
    if (formInput) {
      const values = api.value;
      const disabled = this.disabled || this.disabledByForm;
      const data = new FormData();
      if (this.name && !disabled) for (const value of values) data.append(this.name, value);
      this.internals?.setFormValue(disabled ? null : data, JSON.stringify(values));
      const missing = !disabled && !this.readonly && this.required && values.length === 0;
      this.internals?.setValidity(
        missing ? { valueMissing: true } : this.invalid ? { customError: true } : {},
        missing
          ? 'Please fill out this field.'
          : this.invalid
            ? this.error || 'Invalid value.'
            : '',
        formInput,
      );
    }

    const trigger = root.querySelector<HTMLElement>('.trigger');
    if (trigger) this.machineCtl.spread(trigger, api.getTriggerProps());

    const positioner = root.querySelector<HTMLElement>('.positioner');
    if (positioner) {
      this.machineCtl.spread(positioner, api.getPositionerProps());
      const open = api.open && !this.disabled && !this.disabledByForm && !this.readonly;
      if (open !== positioner.matches(':popover-open')) {
        if (open) positioner.showPopover();
        else positioner.hidePopover();
        if (open) api.reposition();
      }
    }

    const content = root.querySelector<HTMLElement>('.content');
    if (content) this.machineCtl.spread(content, api.getContentProps());

    // One traversal; the rendered order and collection are derived together.
    const rows = root.querySelectorAll<HTMLElement>('.item');
    for (const [index, item] of this.filteredItems.entries()) {
      const itemEl = rows[index];
      if (!itemEl) continue;
      this.machineCtl.spread(itemEl, api.getItemProps({ item }));

      const text = itemEl.querySelector<HTMLElement>('.item-text');
      if (text) this.machineCtl.spread(text, api.getItemTextProps({ item }));

      const indicatorEl = itemEl.querySelector<HTMLElement>('.item-indicator');
      if (indicatorEl) this.machineCtl.spread(indicatorEl, api.getItemIndicatorProps({ item }));
    }
  }

  override render(): TemplateResult {
    const ids = fieldPartIds(this.machineId);
    const showError = fieldErrorIsActive(this.a11yInput());
    return html`
      <div class="field" data-lab-input data-lab-combobox ?data-multiple=${this.multiple} data-type=${this.type} data-size=${this.size} part="field"
        ?data-label-hidden=${this.labelHidden} ?data-unlabelled=${!this.label}
        ?data-disabled=${this.disabled || this.disabledByForm} ?data-readonly=${this.readonly} ?data-invalid=${this.invalid} data-trailing>
        <div class="lab-input-frame" part="frame">
        <label id=${ids.label} class="label lab-field-label" for=${ids.control} part="label">
          <span class="label-text">${this.label}</span
          >${this.required ? html`<span class="lab-field-required-mark" aria-hidden="true"> *</span>` : nothing}
        </label>
        <div class="control lab-extension-control" part="control">
          <div class="lab-combobox-values">
          ${
            this.multiple
              ? this.selectedValues.map((selected) => {
                  const label =
                    this.items.find((item) => item.value === selected)?.label ?? selected;
                  return html`<span class="lab-tags-input-item" data-lab-chip data-size="s" data-selected data-sharp>
              <span class="lab-chip-content" data-part="item-preview">
                <span class="lab-chip-label" data-part="item-text">${label}</span>
                <button type="button" class="lab-tags-input-delete" aria-label=${`Удалить ${label}`}
                  ?disabled=${this.disabled || this.disabledByForm || this.readonly} @click=${() => {
                    this.machineCtl.api.clearValue(selected);
                    this.renderRoot
                      .querySelector<HTMLInputElement>('.input')
                      ?.focus({ preventScroll: true });
                  }}><span class="lab-chip-close" aria-hidden="true"></span></button>
              </span>
            </span>`;
                })
              : nothing
          }
          <input class="input lab-field-control" part="input" id=${ids.control} role="combobox" aria-expanded="false" value=${isServer && !this.multiple ? (this.value ?? this.defaultValue).map((value) => this.items.find((item) => item.value === value)?.label ?? value).join(', ') : nothing} ?disabled=${this.disabled || this.disabledByForm} ?readonly=${this.readonly} autocomplete="off" />
          </div>
          <button class="trigger lab-extension-trigger" type="button" part="trigger"><span class="lab-extension-chevron" aria-hidden="true"></span></button>
        </div>
        <fieldset class="lab-input-outline" aria-hidden="true"><legend>${this.label}${this.required ? ' *' : ''}</legend></fieldset></div>
        <div class="positioner lab-combobox-positioner" part="positioner" popover="manual">
          <ul class="content lab-select-content" part="content" hidden>
            ${
              this.filteredItems.length === 0
                ? html`<li class="empty" part="empty" aria-hidden="true">No results</li>`
                : this.filteredItems.map(
                    (item) => html`
                    <li class="item lab-select-item" part="item" data-value="${item.value}">
                      <span class="item-text lab-select-item-text" part="item-text">${item.label}</span>
                      <span class="item-indicator lab-select-item-indicator" part="item-indicator" aria-hidden="true">✓</span>
                    </li>
                  `,
                  )
            }
          </ul>
        </div>
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

function parseItems(raw: string | null): LabComboboxItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is LabComboboxItem =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as LabComboboxItem).value === 'string' &&
        typeof (entry as LabComboboxItem).label === 'string',
    );
  } catch {
    return [];
  }
}

function parseValues(raw: string | null): string[] {
  if (raw === null) return [];
  const trimmed = raw.trim();
  if (trimmed === '') return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    if (typeof parsed === 'string') return [parsed];
    return [];
  } catch {
    return [trimmed];
  }
}

function setOrRemove(el: Element, name: string, value: string | undefined): void {
  if (value === undefined) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-combobox': LabCombobox;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-combobox')) {
  customElements.define('lab-combobox', LabCombobox);
}
