/**
 * `<lab-combobox>` — a text input with a filterable listbox (autocomplete / typeahead).
 *
 * The COMBOBOX is the Select's listbox + a typeable input that NARROWS the options as
 * the user types. It reuses BOTH established seams verbatim, fusing them:
 *
 *   1. The COMPOUND + POSITIONED listbox canon (`<lab-select>`): ONE Zag machine owns
 *      the control, the positioner, the listbox content, and N option parts keyed by
 *      VALUE. `connect()` returns group-level getters (`getControlProps`,
 *      `getContentProps`, `getPositionerProps`, `getInputProps`, `getTriggerProps`,
 *      `getClearTriggerProps`) AND per-item getters that take the ITEM OBJECT
 *      (`getItemProps({ item })`, `getItemTextProps({ item })`,
 *      `getItemIndicatorProps({ item })`). All parts live in ONE shadow scope; the
 *      positioner uses `strategy:'fixed'` (`portalled:false`) to escape clipping /
 *      stacking ancestors WITHOUT a portal — and the React twin sets `portalled:true`
 *      with a body portal, identical behaviour because both come from the machine.
 *      Options carry `data-value="<value>"`; `updated()` spreads the per-item getters
 *      by that STABLE key (`CSS.escape`), never the positional index — the filtered
 *      list reorders/shrinks every keystroke, so a value key is the only correct map.
 *
 *   2. The FORM-FIELD a11y seam (`field-a11y`, shared with `<lab-input>` / the numeric
 *      fields): the programmatic association of the label, the helper / description and
 *      the error message to the input. The Zag combobox machine ALREADY owns the
 *      combobox/listbox roles, `aria-expanded` / `aria-controls` / `aria-activedescendant`
 *      / `aria-autocomplete`, the input value, keyboard navigation, typeahead, dismiss
 *      and focus. `field-a11y` adds ONLY what the machine does not: `aria-describedby`
 *      (helper + error, in reading order), `aria-invalid` / `aria-errormessage` (only
 *      when invalid + a message exists) and `aria-required`. These are MERGED onto the
 *      machine's input props in `updated()` — never a second copy of the role wiring.
 *
 * Filtering — the consumer's documented responsibility (Zag does NOT filter for you):
 *   The machine fires `onInputValueChange({ inputValue })` on every keystroke; this
 *   element derives the VISIBLE subset of `items` (case-insensitive label substring
 *   match), rebuilds the collection from it, and re-renders. The machine still owns the
 *   highlight, selection, keyboard and dismiss over WHATEVER collection it is handed —
 *   so narrowing is "which items exist", nothing more. An empty query shows all items.
 *
 * Axes (the field model ⊕ the listbox model — Type × Size × Multiple × Placement):
 *   - type:        neutral | danger | warning | success — field sentiment (border/label).
 *   - size:        s | m | l — input height + listbox font band (the shared field axes).
 *   - multiple:    single (one value) | multiple (a set; `aria-multiselectable`).
 *   - value:       controlled selected value(s) (reflected as a JSON attribute).
 *   - defaultValue: uncontrolled initial value(s), read once by the machine.
 *   - disabled / readonly / required / invalid: the field states (reflected, drive
 *     CSS + the native input + the field a11y), exactly as `<lab-input>`.
 *   - placement:   where the listbox sits relative to the input (Zag popper).
 *
 * a11y is the machine's PLUS the field's, never hand-rolled: the input is
 * `role="combobox"` with `aria-autocomplete` / `aria-expanded` / `aria-controls` →
 * content / `aria-activedescendant` → highlighted option; the content is
 * `role="listbox"` with `aria-multiselectable` (multiple); each option is
 * `role="option"` with `aria-selected`. Arrow/Home/End navigation, typeahead,
 * Escape / outside-click dismiss and focus restoration ALL come from
 * `@zag-js/combobox` (DIP — injected `MachineModule`). The label / helper / error
 * association comes from the shared `field-a11y`. No fabricated role, no duplicated
 * state.
 *
 * Token contract (core-CONTRACT §2): ONLY semantic `--lab-*` roles. The input reuses
 * the shared `field-styles` surface (`--lab-bg-primary`, `--lab-border-base`,
 * sentiment borders, `--lab-border-focus` ring); the listbox is the raised surface
 * (`--lab-bg-secondary` + `--lab-label-primary`) with a `--lab-border-soft` hairline
 * and `--lab-fx-shadow-major` lift at `--lab-z-dropdown`; the highlighted option fills
 * with `--lab-fill-neutral-tinted`, the selected option's label is `--lab-label-accent`.
 * No hex, no primitive, no colour-role fallback.
 *
 * SSR (core-CONTRACT §7): a combobox is client-only. The server emits the labelled
 * input and a `hidden` listbox; the machine upgrades it on the client. No flash.
 */
import * as comboboxMachine from '@zag-js/combobox';
import { type PropertyValues, type TemplateResult, css, html, nothing } from 'lit';
import type { MachineModule, PropTypes, SchemaOf } from '../../behaviors/types.js';
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

/** Field sentiment — the `type` axis, shared with the other form controls. */
export type LabComboboxType = LabFieldType;
/** Control size — drives input height and listbox font band. */
export type LabComboboxSize = LabFieldSize;
/** Where the listbox sits relative to the input (Zag popper placement). */
export type LabComboboxPlacement = NonNullable<
  NonNullable<comboboxMachine.Props['positioning']>['placement']
>;

/**
 * One combobox option. The COMPOUND unit: the element renders one option per VISIBLE
 * entry and spreads the machine's per-item getters onto its parts. Shared with the
 * React twin so both renderers describe an option the same way and cannot drift. The
 * collection's `itemToValue` / `itemToString` read these exact fields.
 */
export interface LabComboboxItem {
  /** The value submitted/selected when this option is chosen. Unique in the list. */
  readonly value: string;
  /** The visible label text of the option (and what the input shows on select). */
  readonly label: string;
  /** Whether THIS option is non-interactive (independent of the control's `disabled`). */
  readonly disabled?: boolean;
}

/**
 * The combobox machine's schema, parameterized by OUR item type — the same shape the
 * Lit base binds for every other machine-driven component, named directly because
 * `@zag-js/combobox` parameterizes its schema by the collection item.
 */
type ComboboxSchema = SchemaOf<comboboxMachine.Service<LabComboboxItem>>;
type ComboboxApi = comboboxMachine.Api<PropTypes, LabComboboxItem>;

/**
 * The `@zag-js/combobox` package seen through the renderer-agnostic seam — the SAME
 * `MachineModule` shape the Lit base binds for every other component, no casts.
 */
const comboboxModule: MachineModule<ComboboxSchema, ComboboxApi> = comboboxMachine;

/** Per-instance machine id source. Overlays are client-only, so a client counter is
 * SSR-safe; an explicit id keeps the machine's element ids deterministic. */
let comboboxInstanceSeq = 0;

/**
 * The default filter: case-insensitive label substring match. An empty query shows
 * EVERY item (no narrowing until the user types). Extracted so the React twin matches
 * it exactly (parity is one rule, not two implementations).
 */
export function filterComboboxItems(
  items: readonly LabComboboxItem[],
  query: string,
): LabComboboxItem[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...items];
  return items.filter((item) => item.label.toLowerCase().includes(q));
}

export class LabCombobox extends LabElement {
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    /** Where the listbox sits relative to the input. */
    placement: { reflect: true },
    /** Multiple-selection mode — the machine sets `aria-multiselectable`. */
    multiple: { type: Boolean, reflect: true },
    /** Input non-interactive when present. */
    disabled: { type: Boolean, reflect: true },
    /** Non-editable: the input reads its value but cannot be changed (machine readOnly). */
    readonly: { type: Boolean, reflect: true },
    /** Required — sets aria-required and the native `required`. */
    required: { type: Boolean, reflect: true },
    /** Invalid — drives aria-invalid / aria-errormessage and the danger styling. */
    invalid: { type: Boolean, reflect: true },
    /** Native form field name for the combobox input. */
    name: {},
    /** Placeholder shown in the input when empty. */
    placeholder: {},
    /** Visible label text, wired as a real `<label for>` (the field's accessible name). */
    label: {},
    /** When set, the label is clipped (kept in the a11y tree, visually hidden). */
    labelHidden: { type: Boolean, attribute: 'label-hidden', reflect: true },
    /** Helper / description text shown below the control and linked via describedby. */
    helper: {},
    /** Error message; announced (role="alert") and linked only when `invalid`. */
    error: {},
    /**
     * Controlled selected value(s). A custom element can't carry an array in a plain
     * attribute, so this is primarily a JS PROPERTY; a JSON string attribute
     * (`value='["a"]'`) is parsed for pure-HTML/SSR use.
     */
    value: {
      attribute: 'value',
      converter: { fromAttribute: (raw: string | null): string[] => parseValues(raw) },
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
  declare placeholder: string;
  declare label: string;
  declare labelHidden: boolean;
  declare helper: string;
  declare error: string;
  declare value: string[];
  declare defaultValue: string[];
  declare items: LabComboboxItem[];

  private readonly machineCtl: ZagController<ComboboxSchema, ComboboxApi>;
  /** Stable machine id — keeps the input/content/option element ids deterministic, and
   * is the base for the field part ids so label/helper/error never collide. */
  private readonly machineId = `lab-combobox-${++comboboxInstanceSeq}`;
  /** The VISIBLE subset of `items` for the current query — what the listbox renders and
   * what the collection resolves. The machine owns highlight/selection over THIS set. */
  private filteredItems: LabComboboxItem[] = [];
  /** The collection rebuilt whenever `items` or the query changes — the machine's value
   * resolver. Built from `filteredItems` so the machine only ever knows visible options. */
  private collection = comboboxMachine.collection<LabComboboxItem>({ items: [] });

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
    this.placeholder = '';
    this.label = '';
    this.labelHidden = false;
    this.helper = '';
    this.error = '';
    this.value = [];
    this.defaultValue = [];
    this.items = [];
    // Wire the Zag combobox behaviour. `portalled:false` because the content lives in
    // this shadow root; `strategy:'fixed'` is the overlay canon for escaping
    // clipping/stacking ancestors without a portal. The machine fires
    // `onInputValueChange` per keystroke — this element re-derives the filtered
    // collection there (Zag does not filter for you). `value` is passed only when the
    // consumer set the attribute (controlled); otherwise the machine owns it from
    // `defaultValue`.
    this.machineCtl = this.runMachine(comboboxModule, () => ({
      id: this.machineId,
      ids: {
        input: fieldPartIds(this.machineId).control,
        label: fieldPartIds(this.machineId).label,
      },
      collection: this.collection,
      multiple: this.multiple,
      disabled: this.disabled,
      readOnly: this.readonly,
      required: this.required,
      invalid: this.invalid,
      name: this.name || undefined,
      placeholder: this.placeholder || undefined,
      value: this.hasAttribute('value') ? this.value : undefined,
      defaultValue: this.defaultValue.length ? this.defaultValue : undefined,
      // Open the suggestion list on click/focus of the input (Zag defaults this off);
      // this matches the "open on focus / type" contract the docs promise, and is the
      // standard autocomplete UX — the user clicks the field and sees the options.
      openOnClick: true,
      positioning: { placement: this.placement, strategy: 'fixed' },
      onInputValueChange: (details: comboboxMachine.InputValueChangeDetails) => {
        // The consumer owns filtering: narrow the visible items by the typed query and
        // rebuild the collection. requestUpdate() repaints with the new option set; the
        // machine keeps owning highlight/selection/keyboard over whatever we hand it.
        this.applyFilter(details.inputValue);
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
        this.value = details.value;
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

  override willUpdate(changed: PropertyValues): void {
    // Rebuild the filtered collection from `items` BEFORE the machine reads props this
    // render, so its value resolver always matches the rendered options. On the first
    // pass (and whenever the source list changes) reset the filter to "show all".
    if (changed.has('items')) {
      this.applyFilter(this.currentInputValue());
    }
  }

  /** The current input value as the machine sees it (empty before the machine starts). */
  private currentInputValue(): string {
    try {
      return this.machineCtl.api.inputValue;
    } catch {
      return '';
    }
  }

  /** Narrow `items` by the query and rebuild the collection from the visible subset. */
  private applyFilter(query: string): void {
    this.filteredItems = filterComboboxItems(this.items, query);
    this.collection = comboboxMachine.collection<LabComboboxItem>({
      items: this.filteredItems,
      itemToValue: (item) => item.value,
      itemToString: (item) => item.label,
      isItemDisabled: (item) => item.disabled ?? false,
    });
  }

  static override styles = [
    fieldStyles,
    css`
      :host {
        /* Listbox font band tracks the field size knob the shared field-styles binds. */
        position: relative;
      }

      /* The input control wrapper — the Zag control part (the <div class="control">,
         data attrs only). It is a TRANSPARENT flex container that frames the input + the
         trigger button in a row; the field SURFACE lives on the input, never here.

         The shared field-styles .control rule paints the surface (border + background +
         padding) and matches BOTH this wrapper <div> AND the input (class="input control").
         Without this reset the wrapper would paint a SECOND padded, bordered, filled box
         around the input — the double-box defect — and a plain <div> even matches
         .control:read-only, so it would take the tinted readonly surface. Neutralise the
         wrapper so the surface lands ONLY on the input, exactly like the React twin's
         transparent .lab-combobox-control. Selector :not(.input) targets the wrapper alone;
         the input (.input.control) keeps the field surface untouched. */
      .control:not(.input) {
        position: relative;
        display: flex;
        align-items: stretch;
        width: auto;
        margin: 0;
        padding: 0;
        background: transparent;
        border: 0;
        border-radius: 0;
      }

      /* The Zag input — a real <input role="combobox">. It reuses the shared field
         .control surface (border, focus ring, sentiment), so it paints exactly like
         <lab-input>; the trigger button overlaps its right padding. */
      .input.control {
        flex: 1 1 auto;
        padding-right: 2.25rem;
      }

      /* The disclosure trigger — a real <button> the machine wires to toggle the
         listbox. Sits inside the input's right padding; it is decorative chrome over
         the field surface (no border of its own). */
      .trigger {
        position: absolute;
        top: 0;
        right: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.25rem;
        height: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: ${litVar('--lab-label-secondary')};
        cursor: pointer;
        transition: transform 120ms ease;
      }
      .trigger[data-state='open'] {
        transform: rotate(180deg);
      }
      .trigger[data-disabled] {
        cursor: not-allowed;
        opacity: 0.45;
      }
      .trigger:focus-visible {
        outline: 0.125rem solid ${litVar('--lab-border-focus')};
        outline-offset: -0.125rem;
        border-radius: ${litVar('--lab-radius-sm', '0.25rem')};
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
        border-radius: ${litVar('--lab-radius-md', '0.375rem')};
        background-color: ${litVar('--lab-bg-secondary')};
        color: ${litVar('--lab-label-primary')};
        border: 0.0625rem solid ${litVar('--lab-border-soft')};
        box-shadow: 0 0.5rem 1.5rem ${litVar('--lab-fx-shadow-major')};
        font: inherit;
        font-size: var(--_field-font);
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
        border-radius: ${litVar('--lab-radius-sm', '0.25rem')};
        cursor: pointer;
        user-select: none;
      }
      /* Highlight (keyboard/pointer) — the machine sets data-highlighted. */
      .item[data-highlighted] {
        background-color: ${litVar('--lab-fill-neutral-tinted')};
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

      /* Empty state — shown when the query matches no option. */
      .empty {
        padding: ${litVar('--lab-space-xs', '0.25rem')} ${litVar('--lab-space-sm', '0.5rem')};
        color: ${litVar('--lab-label-tertiary')};
        font-size: var(--_field-font);
      }

      @media (prefers-reduced-motion: reduce) {
        .trigger {
          transition: none;
        }
      }
    `,
  ];

  /** The semantic inputs the shared a11y helper resolves the field ARIA contract from. */
  private a11yInput(): FieldA11yInput {
    return {
      id: this.machineId,
      invalid: this.invalid,
      required: this.required,
      hasHelper: this.helper.length > 0,
      hasError: this.error.length > 0,
    };
  }

  override updated(): void {
    // Apply the machine's connect props onto the real shadow nodes, then MERGE the
    // field-a11y describedby/error/required onto the input. We do NOT clearSpreads()
    // between renders (the select/tabs canon): spreadProps keeps a per-node diff that
    // both swaps listeners AND removes attributes that drop out — critical here, where
    // data-highlighted and aria-selected MOVE between options as the user types/navigates.
    const api = this.machineCtl.api;
    const root = this.renderRoot;

    const labelEl = root.querySelector<HTMLElement>('.label');
    if (labelEl) this.machineCtl.spread(labelEl, api.getLabelProps());

    const control = root.querySelector<HTMLElement>('.control');
    if (control) this.machineCtl.spread(control, api.getControlProps());

    const input = root.querySelector<HTMLInputElement>('.input');
    if (input) {
      this.machineCtl.spread(input, api.getInputProps());
      // The machine owns the combobox/listbox roles + aria-expanded/controls/
      // activedescendant/autocomplete + the value. field-a11y adds ONLY the
      // describedby/invalid/errormessage/required association the machine does not — so
      // both sources of ARIA coexist on the same input without either overwriting the
      // other (these attribute names are disjoint from the machine's).
      const aria = fieldControlAria(this.a11yInput());
      setOrRemove(input, 'aria-describedby', aria['aria-describedby']);
      setOrRemove(input, 'aria-invalid', aria['aria-invalid']);
      setOrRemove(input, 'aria-errormessage', aria['aria-errormessage']);
      // aria-required is the machine's when `required` is set; field-a11y keeps it in
      // sync for the case the machine omits it. Setting the same value is idempotent.
      setOrRemove(input, 'aria-required', aria['aria-required']);
    }

    const trigger = root.querySelector<HTMLElement>('.trigger');
    if (trigger) this.machineCtl.spread(trigger, api.getTriggerProps());

    const positioner = root.querySelector<HTMLElement>('.positioner');
    if (positioner) this.machineCtl.spread(positioner, api.getPositionerProps());

    const content = root.querySelector<HTMLElement>('.content');
    if (content) this.machineCtl.spread(content, api.getContentProps());

    // Map each VISIBLE option's getters onto its node by the STABLE key `value`, never
    // the positional index. The filtered list reorders/shrinks every keystroke, and the
    // machine keys its per-item getters by the collection-resolved value, so honouring
    // that here means a node never receives another option's props. `CSS.escape`
    // neutralises any quote/bracket in the value so the selector can't break.
    for (const item of this.filteredItems) {
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

  override render(): TemplateResult {
    // Structure only; behaviour (combobox/listbox roles, aria, open/close, filter,
    // navigation, dismiss, positioning, value) is spread in updated() from the machine.
    // The label/helper/error markup mirrors <lab-input> so the field surface is identical.
    // SSR emits this markup so first paint is a meaningful, styled labelled input.
    const ids = fieldPartIds(this.machineId);
    const showError = fieldErrorIsActive(this.a11yInput());
    return html`
      <div class="field" part="field">
        <label id=${ids.label} class="label" for=${ids.control} part="label">
          <span class="label-text">${this.label}</span
          >${this.required ? html`<span class="required-mark" aria-hidden="true"> *</span>` : nothing}
        </label>
        <div class="control" part="control">
          <input class="input control" part="input" autocomplete="off" />
          <button class="trigger" type="button" part="trigger">▾</button>
        </div>
        <div class="positioner" part="positioner">
          <ul class="content" part="content" hidden>
            ${
              this.filteredItems.length === 0
                ? html`<li class="empty" part="empty" aria-hidden="true">No results</li>`
                : this.filteredItems.map(
                    (item) => html`
                    <li class="item" part="item" data-value="${item.value}">
                      <span class="item-text" part="item-text">${item.label}</span>
                      <span class="item-indicator" part="item-indicator" aria-hidden="true">✓</span>
                    </li>
                  `,
                  )
            }
          </ul>
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

/** Parse the JSON `items` attribute into a typed list; malformed input is empty. */
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

/** Parse the JSON `value` / `default-value` attribute into a string[]; a bare string is
 * tolerated as a single-value shorthand; malformed input is empty. */
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

/** Set an attribute when the value is defined, otherwise remove it (never "" vs none confusion). */
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
