/**
 * A single or multiple choice from a positioned listbox. Zag provides selection,
 * keyboard navigation, focus and positioning; all Lit parts share one shadow root.
 * A supplied value is controlled. Without one, defaultValue initializes the machine.
 */
import * as selectMachine from '@zag-js/select';
import { type TemplateResult, css, html, isServer, nothing } from 'lit';
import type { MachineModule, PropTypes, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';

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
  static override properties = {
    size: { reflect: true },
    /** Where the listbox sits relative to the trigger. */
    placement: { reflect: true },
    /** Multiple-selection mode — the machine sets `aria-multiselectable`. */
    multiple: { type: Boolean, reflect: true },
    /** Trigger non-interactive when present. */
    disabled: { type: Boolean, reflect: true },
    /** Native form field name for the hidden `<select>`. */
    name: {},
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
      disabled: this.disabled,
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

  static override styles = css`
    :host {
      --_h: 2.25rem;
      --_pad-x: ${litVar('--lab-space-md', '1rem')};
      --_font: ${litVar('--lab-font-size-md', '1rem')};
      --_gap: ${litVar('--lab-space-xs', '0.25rem')};

      display: inline-flex;
      flex-direction: column;
      gap: var(--_gap);
      vertical-align: middle;
    }

    :host([size='s']) {
      --_h: 1.875rem;
      --_font: ${litVar('--lab-font-size-xs', '0.8333rem')};
    }
    :host([size='l']) {
      --_h: 2.75rem;
      --_font: ${litVar('--lab-font-size-lg', '1.2rem')};
    }

    .label {
      font-size: var(--_font);
      font-weight: ${litVar('--lab-font-weight-semibold', '600')};
      color: ${litVar('--lab-label-primary')};
    }

    /* The control wraps the trigger; the machine spreads no behaviour onto it
       beyond getControlProps (data attrs), so it is a pure layout frame. */
    .control {
      display: inline-flex;
    }

    /* The Zag trigger — a real button; the machine spreads role=combobox,
       aria-haspopup=listbox, aria-controls, aria-expanded and the toggle handler. */
    .trigger {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: ${litVar('--lab-space-sm', '0.5rem')};
      min-width: 12rem;
      height: var(--_h);
      margin: 0;
      padding: 0 var(--_pad-x);
      border: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-base')};
      border-radius: ${litVar('--lab-radius-s', '0.375rem')};
      background-color: ${litVar('--lab-bg-primary')};
      color: ${litVar('--lab-label-primary')};
      font: inherit;
      font-size: var(--_font);
      line-height: ${litVar('--lab-line-height-md', '1.5')};
      cursor: pointer;
      transition: border-color var(--lab-motion-transition-duration) var(--lab-motion-transition-easing);
    }
    .trigger:hover {
      border-color: ${litVar('--lab-border-strong')};
    }
    .trigger[data-state='open'] {
      border-color: ${litVar('--lab-border-accent')};
    }
    .trigger[data-disabled] {
      cursor: not-allowed;
      opacity: 0.45;
    }
    .trigger:focus-visible {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: ${litVar('--lab-focus-ring-offset')};
    }

    /* Trigger value text — placeholder colour when nothing is selected. The
       @zag-js/select machine sets data-placeholder-shown on the TRIGGER (not the
       value-text), so the placeholder tint keys off the trigger's attribute and
       descends to the value text. */
    .value-text {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .trigger[data-placeholder-shown] .value-text {
      color: ${litVar('--lab-label-tertiary')};
    }

    /* The disclosure indicator — rotates when open (machine sets data-state). */
    .indicator {
      flex: 0 0 auto;
      display: inline-flex;
      color: ${litVar('--lab-label-secondary')};
      transition: transform var(--lab-motion-transition-duration) var(--lab-motion-transition-easing);
    }
    .indicator[data-state='open'] {
      transform: rotate(180deg);
    }

    /* The Zag positioner — Floating UI writes --x/--y here and mirrors the content
       z-index into --z-index for layering. */
    .positioner {
      /* positioning frame only */
    }

    /* The floating listbox — raised surface with a hairline, lifted and layered. */
    .content {
      box-sizing: border-box;
      min-width: var(--reference-width, 12rem);
      max-height: 16rem;
      overflow-y: auto;
      margin: 0;
      padding: ${litVar('--lab-space-xs', '0.25rem')};
      list-style: none;
      border-radius: ${litVar('--lab-radius-s', '0.375rem')};
      background-color: ${litVar('--lab-bg-secondary')};
      color: ${litVar('--lab-label-primary')};
      border: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-soft')};
      box-shadow: var(--lab-elevation-overlay);
      font: inherit;
      font-size: var(--_font);
      line-height: ${litVar('--lab-line-height-md', '1.5')};
      z-index: ${litVar('--lab-z-dropdown', '900')};
    }
    .content[hidden] {
      display: none;
    }
    .content:focus-visible {
      outline: none;
    }

    /* One option — the Zag item element. */
    .item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${litVar('--lab-space-sm', '0.5rem')};
      padding: ${litVar('--lab-space-xs', '0.25rem')} ${litVar('--lab-space-sm', '0.5rem')};
      border-radius: ${litVar('--lab-radius-xs', '0.25rem')};
      cursor: pointer;
      user-select: none;
    }
    /* Highlight (keyboard/pointer) — the machine sets data-highlighted. */
    .item[data-highlighted] {
      background-color: ${litVar('--lab-fill-primary')};
    }
    /* Selected — the machine sets data-state=checked + aria-selected. */
    .item[data-state='checked'] .item-text {
      color: ${litVar('--lab-label-accent')};
      font-weight: ${litVar('--lab-font-weight-semibold', '600')};
    }
    .item[data-disabled] {
      cursor: not-allowed;
      opacity: 0.45;
    }

    .item-text {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    /* The selected-indicator — shown only on the selected option (machine toggles). */
    .item-indicator {
      flex: 0 0 auto;
      display: inline-flex;
      color: ${litVar('--lab-label-accent')};
    }

    /* The hidden native <select> for form submission — visually removed. */
    select {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      border: 0;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      overflow: hidden;
      white-space: nowrap;
    }
  `;

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
    if (hiddenSelect) this.machineCtl.spread(hiddenSelect, api.getHiddenSelectProps());

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
    // Structure only; behaviour (combobox/listbox roles, aria, open/close,
    // navigation, typeahead, dismiss, positioning, form value) is spread in
    // updated() from the machine. SSR emits this markup so first paint is a
    // meaningful, styled trigger before any JS upgrades it.
    return html`
      ${this.label ? html`<span class="label" part="label">${this.label}</span>` : nothing}
      <div class="control" part="control">
        <button class="trigger" type="button" part="trigger">
          <span class="value-text" part="value-text">${this.valueText}</span>
          <span class="indicator" part="indicator" aria-hidden="true">▾</span>
        </button>
      </div>
      <div class="positioner" part="positioner">
        <ul class="content" part="content" hidden>
          ${(this.items ?? []).map(
            (item) => html`
              <li class="item" part="item" data-value="${item.value}">
                <span class="item-text" part="item-text">${item.label}</span>
                <span class="item-indicator" part="item-indicator" aria-hidden="true">✓</span>
              </li>
            `,
          )}
        </ul>
      </div>
      <select>
        ${(this.items ?? []).map(
          (item) => html`<option value="${item.value}" ?disabled="${item.disabled ?? false}">
            ${item.label}
          </option>`,
        )}
      </select>
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
