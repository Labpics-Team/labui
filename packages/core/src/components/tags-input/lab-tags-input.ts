import * as tagsInputMachine from '@zag-js/tags-input';
import { type PropertyValues, type TemplateResult, css, html, nothing, unsafeCSS } from 'lit';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
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

export type { LabFieldSize as LabTagsInputSize, LabFieldType as LabTagsInputType };

type TagsInputSchema = SchemaOf<tagsInputMachine.Service>;
type TagsInputApi = tagsInputMachine.Api;

const tagsInputModule: MachineModule<TagsInputSchema, TagsInputApi> = tagsInputMachine;

let tagsInputSeq = 0;

export { tagsInputTranslations } from './translations.js';
import { tagsInputTranslations } from './translations.js';

export class LabTagsInput extends LabElement {
  static formAssociated = true;
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    label: {},
    labelHidden: { type: Boolean, attribute: 'label-hidden', reflect: true },
    helper: {},
    error: {},
    placeholder: {},
    max: { type: Number },
    delimiter: {},
    editable: { type: Boolean },
    addOnPaste: { type: Boolean, attribute: 'add-on-paste' },
    allowDuplicates: { type: Boolean, attribute: 'allow-duplicates' },
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
  declare placeholder: string;
  declare max: number;
  declare delimiter: string;
  declare editable: boolean;
  declare addOnPaste: boolean;
  declare allowDuplicates: boolean;
  declare value: string[] | null;
  private initialValue?: string[];
  declare defaultValue: string[];
  declare readonly: boolean;
  declare disabled: boolean;
  declare required: boolean;
  declare invalid: boolean;
  declare name: string;
  private declare disabledByForm: boolean;
  private readonly internals?: ElementInternals;

  private readonly machineCtl: ZagController<TagsInputSchema, TagsInputApi>;
  private readonly fieldId = `lab-tags-input-${++tagsInputSeq}`;
  private renderedTags: string[] = [];

  constructor() {
    super();
    this.type = 'neutral';
    this.size = 'm';
    this.label = '';
    this.labelHidden = false;
    this.helper = '';
    this.error = '';
    this.placeholder = 'Add a tag…';
    this.max = Number.POSITIVE_INFINITY;
    this.delimiter = ',';
    this.editable = true;
    this.addOnPaste = false;
    this.allowDuplicates = false;
    this.value = null;
    this.defaultValue = [];
    this.readonly = false;
    this.disabled = false;
    this.required = false;
    this.invalid = false;
    this.name = '';
    this.disabledByForm = false;
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
    // Wire the Zag tags-input behavior. `value` is passed only when the consumer set the
    // attribute (controlled); otherwise the machine owns it from `defaultValue`
    // (uncontrolled) — the same honest two-mode contract as the other controls. The
    // machine owns the tag array + input + keyboard (Enter add / Backspace remove /
    // navigation) + paste-split + edit-in-place + max/overflow validity; the element only
    // paints. We READ the machine's value each render to know which chips to draw.
    this.machineCtl = this.runMachine(tagsInputModule, () => ({
      id: this.fieldId,
      ids: { input: fieldPartIds(this.fieldId).control, label: fieldPartIds(this.fieldId).label },
      max: this.max,
      delimiter: this.delimiter,
      editable: this.editable,
      addOnPaste: this.addOnPaste,
      allowDuplicates: this.allowDuplicates,
      placeholder: this.placeholder || undefined,
      value: this.value ?? undefined,
      defaultValue: this.defaultValue.length ? this.defaultValue : undefined,
      disabled: this.disabled || this.disabledByForm,
      readOnly: this.readonly,
      invalid: this.invalid,
      required: this.required,
      name: this.name || undefined,
      translations: tagsInputTranslations as tagsInputMachine.IntlTranslations,
      onValueChange: (details: tagsInputMachine.ValueChangeDetails) => {
        // The callback requests a change; controlled input stays with its consumer.
        this.requestUpdate();
        this.dispatchEvent(
          new CustomEvent<tagsInputMachine.ValueChangeDetails>('value-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
      onInputValueChange: (details: tagsInputMachine.InputValueChangeDetails) => {
        this.dispatchEvent(
          new CustomEvent<tagsInputMachine.InputValueChangeDetails>('input-value-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
      onValueInvalid: (details: tagsInputMachine.ValidityChangeDetails) => {
        this.dispatchEvent(
          new CustomEvent<tagsInputMachine.ValidityChangeDetails>('value-invalid', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
    }));
  }

  private currentTags(): string[] {
    try {
      return this.machineCtl.api.value;
    } catch {
      return this.value ?? this.defaultValue ?? [];
    }
  }

  static override styles = [
    unsafeCSS(extensionFieldCss),
    css`:host { display:block; min-inline-size:0; }`,
  ];

  private a11yInput(): FieldA11yInput {
    return {
      id: this.fieldId,
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
    if (this.value === null) this.machineCtl.api.setValue(this.initialValue ?? []);
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

  override updated(_changed: PropertyValues): void {
    // Spread the machine's connect props onto the real shadow nodes (root, label, the
    // control, the text input, each chip's parts). We do NOT clearSpreads() between
    // renders — data-highlighted MOVES between chips as the user navigates, and
    // spreadProps' per-node diff both swaps listeners AND removes attributes that drop
    // out; clearing it each render would leave a stale data-highlighted on a chip (the
    // select/combobox canon).
    this.initialValue ??= [...this.defaultValue];
    const api = this.machineCtl.api;
    const root = this.renderRoot;
    const rootEl = root.querySelector<HTMLElement>('.field');
    const labelEl = root.querySelector<HTMLElement>('.label');
    const controlEl = root.querySelector<HTMLElement>('.control');
    const inputEl = root.querySelector<HTMLInputElement>('.input');
    if (rootEl) this.machineCtl.spread(rootEl, api.getRootProps());
    if (labelEl) this.machineCtl.spread(labelEl, api.getLabelProps());
    if (controlEl) this.machineCtl.spread(controlEl, api.getControlProps());
    if (inputEl) {
      this.machineCtl.spread(inputEl, api.getInputProps());
      // The machine owns the input's aria-invalid + value. field-a11y adds ONLY the
      // describedby/errormessage/required association the machine does not — disjoint
      // attribute names, so both coexist on the same input without overwriting.
      const aria = fieldControlAria(this.a11yInput());
      setOrRemove(inputEl, 'aria-describedby', aria['aria-describedby']);
      setOrRemove(inputEl, 'aria-errormessage', aria['aria-errormessage']);
      setOrRemove(inputEl, 'aria-required', aria['aria-required']);
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

    // Узел каждого чипа ищется ПО ПОЗИЦИИ в отрендеренном списке: render() рисует
    // .item из того же массива renderedTags в том же цикле обновления, поэтому
    // соответствие 1:1 гарантировано — в том числе при allow-duplicates, где лукап
    // по data-value отдавал бы первый матч (второй дубль оставался немым: его ×
    // мёртв, а первый чип получал чужой индекс). Ключи МАШИНЫ при этом остаются
    // {index, value} — как их ждёт zag.
    const itemEls = root.querySelectorAll<HTMLElement>('.item');
    this.renderedTags.forEach((tagValue, index) => {
      const props = { index, value: tagValue };
      const itemEl = itemEls[index];
      if (!itemEl) return;
      this.machineCtl.spread(itemEl, api.getItemProps(props));

      const previewEl = itemEl.querySelector<HTMLElement>('.item-preview');
      if (previewEl) this.machineCtl.spread(previewEl, api.getItemPreviewProps(props));

      const textEl = itemEl.querySelector<HTMLElement>('.item-text');
      if (textEl) this.machineCtl.spread(textEl, api.getItemTextProps(props));

      const editEl = itemEl.querySelector<HTMLInputElement>('.item-input');
      if (editEl) this.machineCtl.spread(editEl, api.getItemInputProps(props));

      const deleteEl = itemEl.querySelector<HTMLButtonElement>('.item-delete');
      if (deleteEl) this.machineCtl.spread(deleteEl, api.getItemDeleteTriggerProps(props));
    });
  }

  override render(): TemplateResult {
    const ids = fieldPartIds(this.fieldId);
    const showError = fieldErrorIsActive(this.a11yInput());
    // Read the machine's value so the drawn chips always match it (the machine is the
    // source of truth — add/remove/edit happen there). Cache it for updated() to map the
    // per-chip getters by value.
    this.renderedTags = this.currentTags();
    // Structure only; behaviour (chip roles, add/remove/edit, navigation, the input
    // value) is spread in updated() from the machine. The label / helper / error
    // association is the shared field-a11y contract. SSR emits this real markup so first
    // paint is meaningful before any JS upgrades the element.
    return html`
      <div class="field" data-lab-input data-lab-tags-input data-type=${this.type} data-size=${this.size} part="field"
        ?data-label-hidden=${this.labelHidden} ?data-unlabelled=${!this.label}
        ?data-disabled=${this.disabled || this.disabledByForm} ?data-readonly=${this.readonly} ?data-invalid=${this.invalid} data-trailing>
        <div class="lab-input-frame" part="frame">
        <label id=${ids.label} class="label lab-field-label" part="label" for=${ids.control}>
          <span class="label-text">${this.label}</span
          >${this.required ? html`<span class="lab-field-required-mark" aria-hidden="true"> *</span>` : nothing}
        </label>
        <div class="control lab-extension-control lab-tags-input-control" part="control">
          ${this.renderedTags.map(
            (tagValue) => html`
              <span class="item lab-tags-input-item" data-lab-chip data-size="s" data-selected data-sharp part="item" data-value=${tagValue}>
                <span class="item-preview lab-chip-content" part="item-preview">
                  <span class="item-text lab-chip-label" part="item-text">${tagValue}</span>
                  <button class="item-delete lab-tags-input-delete" part="item-delete" type="button"><span class="lab-chip-close" aria-hidden="true"></span></button>
                </span>
                <input class="item-input lab-tags-input-edit" part="item-input" hidden />
              </span>
            `,
          )}
          <input class="input lab-field-control lab-tags-input-input" part="input" id=${ids.control} ?disabled=${this.disabled || this.disabledByForm} ?readonly=${this.readonly} />
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

function parseValues(raw: string | null): string[] {
  if (raw === null) return [];
  const trimmed = raw.trim();
  if (trimmed === '') return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    if (typeof parsed === 'string') return parsed ? [parsed] : [];
    return [];
  } catch {
    return trimmed
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }
}

function setOrRemove(el: Element, name: string, value: string | undefined): void {
  if (value === undefined) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-tags-input': LabTagsInput;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-tags-input')) {
  customElements.define('lab-tags-input', LabTagsInput);
}
