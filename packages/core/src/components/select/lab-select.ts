/**
 * A single or multiple choice from a positioned listbox. Zag provides selection,
 * keyboard navigation, focus and positioning; all Lit parts share one shadow root.
 * A supplied value is controlled. Without one, defaultValue initializes the machine.
 */
import * as selectMachine from '@zag-js/select';
import { type TemplateResult, css, html, isServer, nothing, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { MachineModule, PropTypes, SchemaOf } from '../../behaviors/types.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';
import { selectCss } from './styles.js';

/** Control size — drives trigger height and listbox font band. */
export type LabSelectSize = 's' | 'm' | 'l';
/** Where the listbox sits relative to the trigger (Zag popper placement). */
export type LabSelectPlacement = NonNullable<
  NonNullable<selectMachine.Props['positioning']>['placement']
>;

/**
 * One select option. The COMPOUND unit: the element renders one option per entry
 * and spreads the machine's per-item getters onto its parts. Shared with the React
 * twin so both renderers describe an option the same way and cannot drift. The
 * collection's `itemToValue`/`itemToString` read these exact fields.
 */
export interface LabSelectItem {
  /** The value submitted/selected when this option is chosen. Unique in the list. */
  readonly value: string;
  /** The visible label text of the option (and the trigger's value text). */
  readonly label: string;
  /** Whether THIS option is non-interactive (independent of the control's `disabled`). */
  readonly disabled?: boolean;
}

/**
 * The select machine's schema, parameterized by OUR item type. Unlike radio-group
 * (whose `Service` is concrete), `@zag-js/select` parameterizes its schema by the
 * collection item, so we name `SelectSchema<LabSelectItem>` directly — `SchemaOf`
 * can't recover it because `Service<SelectSchema<V>>`'s outer infer is the schema,
 * not the item. `Api`'s first param is the normalize target (`PropTypes`, the
 * seam default), its second the item.
 */
type SelectSchema = SchemaOf<selectMachine.Service<LabSelectItem>>;
type SelectApi = selectMachine.Api<PropTypes, LabSelectItem>;

/**
 * The `@zag-js/select` package seen through the renderer-agnostic seam — the SAME
 * `MachineModule` shape the Lit base binds for every other component, no casts.
 */
const selectModule: MachineModule<SelectSchema, SelectApi> = selectMachine;

/** Per-instance machine id source. Overlays are client-only, so a client counter
 * is SSR-safe; an explicit id keeps the machine's element ids deterministic. */
let selectInstanceSeq = 0;

export class LabSelect extends LabElement {
  static formAssociated = true;
  static override properties = {
    size: { reflect: true },
    /** Where the listbox sits relative to the trigger. */
    placement: { reflect: true },
    /** Multiple-selection mode — the machine sets `aria-multiselectable`. */
    multiple: { type: Boolean, reflect: true },
    /** Trigger non-interactive when present. */
    disabled: { type: Boolean, reflect: true },
    /** Name of the hidden native `<select>`. */
    name: { reflect: true },
    required: { type: Boolean, reflect: true },
    showLabel: {
      attribute: 'show-label',
      converter: { fromAttribute: (raw: string | null) => raw !== 'false' },
      reflect: true,
    },
    removeLabel: { attribute: 'remove-label' },
    disabledByForm: { state: true },
    /** Placeholder shown in the trigger when nothing is selected. */
    placeholder: {},
    /** Optional control label, wired as the machine's label part (accessible name). */
    label: {},
    /**
     * Controlled selected value(s). A custom element can't carry an array in a
     * plain attribute, so this is primarily a JS PROPERTY; a JSON string attribute
     * (`value='["a"]'`) is parsed for pure-HTML/SSR use.
     */
    value: {
      attribute: 'value',
      converter: {
        fromAttribute: (raw: string | null) => (raw === null ? null : parseValues(raw)),
      },
    },
    /** Uncontrolled initial value(s) — read once by the machine at init. */
    defaultValue: {
      attribute: 'default-value',
      converter: { fromAttribute: (raw: string | null): string[] => parseValues(raw) },
    },
    /**
     * The options. Primarily a JS PROPERTY; a JSON string attribute
     * (`items='[{"value":"a","label":"A"}]'`) is parsed for pure-HTML/SSR use.
     */
    items: {
      attribute: 'items',
      converter: { fromAttribute: (raw: string | null): LabSelectItem[] => parseItems(raw) },
    },
  };

  declare size: LabSelectSize;
  declare placement: LabSelectPlacement;
  declare multiple: boolean;
  declare disabled: boolean;
  declare name: string;
  declare required: boolean;
  /** Controls the internal Multiselect caption; its accessible name remains present. */
  declare showLabel: boolean;
  /** Verb used by chip removal buttons, followed by the option label. */
  declare removeLabel: string;
  private declare disabledByForm: boolean;
  private readonly internals?: ElementInternals;
  declare placeholder: string;
  declare label: string;
  /** Null leaves selection to the component; an array, including [], is controlled. */
  declare value: string[] | null;
  declare defaultValue: string[];
  declare items: LabSelectItem[];

  private readonly machineCtl: ZagController<SelectSchema, SelectApi>;
  /** Stable machine id — keeps the trigger/content/option element ids deterministic. */
  private readonly machineId = `lab-select-${++selectInstanceSeq}`;
  /** The collection rebuilt whenever `items` changes — the machine's value resolver. */
  private collection = selectMachine.collection<LabSelectItem>({ items: [] });

  constructor() {
    super();
    this.size = 'm';
    this.placement = 'bottom-start';
    this.multiple = false;
    this.disabled = false;
    this.name = '';
    this.required = false;
    this.showLabel = true;
    this.removeLabel = 'Remove';
    this.disabledByForm = false;
    if (typeof ElementInternals !== 'undefined') this.internals = this.attachInternals();
    this.placeholder = 'Select…';
    this.label = '';
    this.value = null;
    this.defaultValue = [];
    this.items = [];
    // All parts live in this shadow root. A defined value is controlled regardless
    // of whether it arrived as a JS property or an attribute.
    this.machineCtl = this.runMachine(selectModule, () => ({
      id: this.machineId,
      collection: this.collection,
      multiple: this.multiple,
      disabled: this.disabled || this.disabledByForm,
      required: this.required,
      dir: this.closest('[dir]')?.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr',
      name: this.name || undefined,
      value: this.value ?? undefined,
      defaultValue: this.defaultValue?.length ? this.defaultValue : undefined,
      positioning: { placement: this.placement, strategy: 'fixed' },
      onValueChange: (details: selectMachine.ValueChangeDetails<LabSelectItem>) => {
        this.dispatchEvent(
          new CustomEvent<selectMachine.ValueChangeDetails<LabSelectItem>>('value-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
        // Native input/autofill may already have changed the hidden select. Even
        // a rejected controlled request needs a render to restore accepted state.
        this.requestUpdate();
      },
      onOpenChange: (details: selectMachine.OpenChangeDetails) => {
        this.dispatchEvent(
          new CustomEvent<selectMachine.OpenChangeDetails>('open-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
    }));
  }

  /** The accepted selection, including the machine's uncontrolled state. */
  get selectedValues(): readonly string[] {
    return isServer || !this.isConnected
      ? (this.value ?? this.defaultValue ?? [])
      : this.machineCtl.api.value;
  }

  override willUpdate(changed: Map<string, unknown>): void {
    // Rebuild the collection from `items` BEFORE the machine reads props this
    // render, so its value resolver always matches the rendered options. The
    // collection is the machine's only source of value/label/disabled per item.
    if (changed.has('items')) {
      this.collection = selectMachine.collection<LabSelectItem>({
        items: this.items ?? [],
        itemToValue: (item) => item.value,
        itemToString: (item) => item.label,
        isItemDisabled: (item) => item.disabled ?? false,
      });
    }
  }

  static override styles = [
    unsafeCSS(selectCss),
    css`
    :host { display: inline-flex; min-inline-size: 0; max-inline-size: 100%; vertical-align: middle; }
    :host([multiple]) { display: flex; }
    :host(:not(:has([slot='leading']))) .lab-select-leading { display: none; }
    ::slotted([slot='leading']) { display: inline-flex; inline-size: 100%; block-size: 100%; }
  `,
  ];

  formDisabledCallback(disabled: boolean): void {
    this.disabledByForm = disabled;
  }
  formResetCallback(): void {
    if (this.value === null) this.machineCtl.api.setValue(this.defaultValue ?? []);
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
  get validationMessage(): string {
    return this.internals?.validationMessage ?? '';
  }
  checkValidity(): boolean {
    return this.internals?.checkValidity() ?? true;
  }
  reportValidity(): boolean {
    return this.internals?.reportValidity() ?? true;
  }

  private removeValue(value: string): void {
    if (this.disabled || this.disabledByForm) return;
    const api = this.machineCtl.api;
    // clearValue('') means clear ALL to Zag. Filtering the accepted array preserves
    // the empty-string option and controlled rejection/delay without local chips state.
    api.setValue(api.value.filter((selected) => selected !== value));
    api.focus();
    this.requestUpdate();
  }

  override updated(): void {
    // Apply the machine's connect props onto the real shadow nodes: group-level
    // (trigger combobox, content listbox, positioner) and the per-item getters for
    // every option. We do NOT `clearSpreads()` between renders (the tabs canon):
    // `spreadProps` keeps a per-node diff and both swaps event listeners AND removes
    // attributes that drop out of the props — critical here, where `data-highlighted`
    // and `aria-selected` MOVE between options as the user navigates/selects. Calling
    // its cleanup each render would reset that diff and leave a stale `data-highlighted`
    // on the previously-active option (the very bug that desynced aria-activedescendant
    // from the visibly-highlighted row). The accumulated cleanups run once on
    // disconnect (ZagController.hostDisconnected).
    const api = this.machineCtl.api;
    const root = this.renderRoot;

    const labelEl = root.querySelector<HTMLElement>('.label');
    if (labelEl) this.machineCtl.spread(labelEl, api.getLabelProps());

    const control = root.querySelector<HTMLElement>('.control');
    if (control) this.machineCtl.spread(control, api.getControlProps());

    const trigger = root.querySelector<HTMLElement>('.trigger');
    if (trigger) this.machineCtl.spread(trigger, api.getTriggerProps());

    const valueText = root.querySelector<HTMLElement>('.value-text');
    if (valueText) this.machineCtl.spread(valueText, api.getValueTextProps());

    const indicator = root.querySelector<HTMLElement>('.indicator');
    if (indicator) this.machineCtl.spread(indicator, api.getIndicatorProps());

    const positioner = root.querySelector<HTMLElement>('.positioner');
    if (positioner) this.machineCtl.spread(positioner, api.getPositionerProps());

    const content = root.querySelector<HTMLElement>('.content');
    if (content) this.machineCtl.spread(content, api.getContentProps());

    const hiddenSelect = root.querySelector<HTMLSelectElement>('select');
    if (hiddenSelect) {
      // Vanilla normalizes Zag's defaultValue to value. A native select's value
      // is scalar: assigning a multi-value array coerces it to a comma-joined
      // string and clears the selection. Project accepted values onto the actual
      // options after Lit has rendered them, including initial/collection updates
      // that do not trigger the machine's value-change effect.
      const { value: _value, ...selectProps } = api.getHiddenSelectProps();
      this.machineCtl.spread(hiddenSelect, selectProps);
      const selectedValues = new Set(api.value);
      let hasSelection = false;
      for (const option of hiddenSelect.options) {
        const selected = selectedValues.has(option.value);
        option.selected = selected;
        hasSelection ||= selected;
      }
      // A single select auto-selects its first option when all are deselected.
      if (!hasSelection) hiddenSelect.selectedIndex = -1;
      const data = new FormData();
      if (this.name && !hiddenSelect.disabled) {
        for (const option of hiddenSelect.selectedOptions) {
          if (!option.disabled) data.append(this.name, option.value);
        }
      }
      this.internals?.setFormValue(hiddenSelect.disabled ? null : data, JSON.stringify(api.value));
      this.internals?.setValidity(
        hiddenSelect.validity,
        hiddenSelect.validationMessage,
        trigger ?? undefined,
      );
    }

    // Map each option's getters onto its node by the STABLE key `value`, never the
    // positional index. The machine keys its per-item getters by the value the
    // collection resolves, so honouring that here means a node never receives
    // another option's props if render order and `items` ever diverge
    // (filter/reorder/virtualise) — and the id the machine puts on the option is
    // exactly what the listbox's aria-activedescendant points at. `CSS.escape`
    // neutralises any quote/bracket in the value so the selector can't break.
    for (const item of this.items ?? []) {
      const selector = `.item[data-value="${CSS.escape(item.value)}"]`;
      const itemEl = root.querySelector<HTMLElement>(selector);
      if (!itemEl) continue;
      this.machineCtl.spread(itemEl, api.getItemProps({ item }));

      const text = itemEl.querySelector<HTMLElement>('.item-text');
      if (text) this.machineCtl.spread(text, api.getItemTextProps({ item }));

      const indicatorEl = itemEl.querySelector<HTMLElement>('.item-indicator');
      if (indicatorEl) this.machineCtl.spread(indicatorEl, api.getItemIndicatorProps({ item }));
    }
  }

  /** Resolve the same accepted selection before and after the machine connects. */
  private get valueText(): string {
    if (!isServer && this.isConnected) return this.machineCtl.api.valueAsString || this.placeholder;
    return (
      this.selectedValues
        .map((value) => this.items?.find((item) => item.value === value)?.label)
        .filter((label) => label !== undefined)
        .join(', ') || this.placeholder
    );
  }

  override render(): TemplateResult {
    const values = this.selectedValues;
    const disabled = this.disabled || this.disabledByForm;
    const labelVisible = !!this.label && this.multiple && this.showLabel;
    const caption = this.label
      ? html`<span class="label lab-select-label ${labelVisible ? '' : 'lab-select-label-hidden'}" part="label">${this.label}</span>`
      : nothing;
    return html`
      <div data-lab-select data-size=${this.size} ?data-multiple=${this.multiple} ?data-disabled=${disabled} ?data-label-visible=${labelVisible}>
      ${!this.multiple ? caption : nothing}
      <div class="control lab-select-control" part="control">
        ${this.multiple ? caption : nothing}
        <button class="trigger lab-select-trigger" type="button" part="trigger" ?disabled=${disabled} aria-label=${this.label || this.placeholder}>
          <span class="lab-select-value">
            ${!this.multiple ? html`<span class="lab-select-leading" aria-hidden="true"><slot name="leading" ></slot></span>` : nothing}
            <span class="value-text lab-select-value-text" part="value-text" ?hidden=${this.multiple && values.length > 0}>${this.valueText}</span>
          </span>
          <span class="indicator lab-select-indicator" part="indicator" aria-hidden="true"></span>
        </button>
        ${
          this.multiple && values.length
            ? html`<div class="lab-select-chips" part="chips">
          ${repeat(
            values,
            (value) => value,
            (value) => {
              const item = this.items.find((item) => item.value === value);
              const label = item?.label ?? value;
              return html`<button type="button" data-lab-chip data-size="s" data-sharp data-selected data-value=${value} class="lab-select-remove" part="chip" ?disabled=${disabled || item?.disabled} aria-label=${`${this.removeLabel} ${label}`} @click=${() => this.removeValue(value)}>
              <span class="lab-chip-content"><span class="lab-chip-label">${label}</span><span class="lab-chip-close" aria-hidden="true"></span></span>
              <span class="lab-chip-glow" aria-hidden="true"></span>
            </button>`;
            },
          )}
        </div>`
            : nothing
        }
        ${this.multiple ? html`<fieldset class="lab-select-outline" aria-hidden="true"><legend>${this.label}</legend></fieldset>` : nothing}
      </div>
      <div class="positioner lab-select-positioner" part="positioner">
        <ul class="content lab-select-content" part="content" hidden>
          ${repeat(
            this.items ?? [],
            (item) => item.value,
            (item) => html`
            <li class="item lab-select-item" part="item" data-value=${item.value}>
              <span class="item-text lab-select-item-text" part="item-text">${item.label}</span>
              <span class="item-indicator lab-select-item-indicator" part="item-indicator" aria-hidden="true">✓</span>
            </li>`,
          )}
        </ul>
      </div>
      <select class="lab-select-hidden" ?multiple=${this.multiple} ?disabled=${disabled} ?required=${this.required}>
        ${(this.items ?? []).map((item) => html`<option value=${item.value} ?disabled=${item.disabled ?? false} ?selected=${values.includes(item.value)}>${item.label}</option>`)}
      </select>
      </div>
    `;
  }
}

/** Parse the JSON `items` attribute into a typed list; malformed input is empty. */
function parseItems(raw: string | null): LabSelectItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is LabSelectItem =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as LabSelectItem).value === 'string' &&
        typeof (entry as LabSelectItem).label === 'string',
    );
  } catch {
    return [];
  }
}

/** Parse the JSON `value` / `default-value` attribute into a string[]; a bare
 * string is tolerated as a single-value shorthand; malformed input is empty. */
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
    // Not JSON — treat the raw attribute as a single value (`value="apple"`).
    return [trimmed];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-select': LabSelect;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-select')) {
  customElements.define('lab-select', LabSelect);
}
