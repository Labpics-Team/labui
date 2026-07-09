import * as tagsInputMachine from '@zag-js/tags-input';
/**
 * `<lab-tags-input>` — a tokenized text field: a text input plus a row of removable tag
 * chips. Enter adds a tag, Backspace removes the last, each chip has a delete button and
 * (optionally) edit-in-place, paste splits on a delimiter, with a max-tags cap — driven
 * end-to-end by the `@zag-js/tags-input` machine.
 *
 * MACHINE, not opt-out (core-CONTRACT §1): a tags input HAS shared interaction state a
 * machine owns — the array of tag values, the input value, the highlighted-tag roving
 * navigation (Arrow/Home/End across chips, Backspace to remove the last), add-on-Enter,
 * paste-split on the delimiter, edit-in-place (Enter / double-click → an inline input),
 * the max-tags / overflow validity, and each chip's delete trigger + its accessible
 * name. Hand-rolling that is exactly the "machinery Zag ships" the seam exists to
 * consume. So this element runs the machine through `ZagController`: the machine owns the
 * chips' roles + the input + keyboard + add/remove/edit; the element only paints (DIP —
 * it depends on the injected `MachineModule`, never on hand-written tag-add/keyboard).
 *
 * REUSES the field a11y seam (core-CONTRACT §4), it does NOT duplicate it: the
 * label / helper / error ASSOCIATION is the same shared `field-a11y` helper that
 * `<lab-input>` / `<lab-combobox>` use. The text input IS the field's control (the
 * machine's `<label htmlFor>` already targets it), so the field a11y lands on the INPUT,
 * exactly like the single-input fields: `aria-describedby` (helper + error),
 * `aria-errormessage`, `aria-required` ADDED over the machine's input spread. The MACHINE
 * owns the input's `aria-invalid`, the chips' roles and the keyboard; this element only
 * ADDS the input's description wiring — the same split the other fields use, so neither
 * layer re-implements the other. Visual surface reuses the shared `field-styles`.
 *
 * Идентичность чипа — ПОЗИЦИЯ в машинном списке (осознанное исключение из канона
 * value-lookup core-CONTRACT §1): tags-input допускает allow-duplicates, где значение
 * НЕ уникально — лукап по data-value отдавал бы первый матч, оставляя второй дубль
 * немым. Узлы маппятся позиционно (render() рисует .item из того же массива в том же
 * цикле — соответствие 1:1), а ключи МАШИНЫ остаются {index, value}, как ждёт zag
 * (id чипа = value+index, удаление резолвится по DOM-позиции).
 *
 * Axes (the form-field model — Type × Size × State, plus the tag policy):
 *   - type:        neutral | danger | warning | success   (sentiment of the field)
 *   - size:        s | m | l
 *   - max:         the maximum number of tags (overflow → invalid)
 *   - delimiter:   the character that adds a tag and splits a paste (default ",")
 *   - editable:    allow editing a chip in place (Enter / double-click)
 *   - addOnPaste:  add a tag when a value is pasted (split on the delimiter)
 *   - state:       disabled · readonly · invalid · required   (reflected, drive CSS + ARIA)
 *
 * Token contract (core-CONTRACT §2): ONLY semantic --lab-* roles + dimensions via the
 * shared `field-styles` plus the chip surface here. No hex, no primitive, no colour-role
 * fallback.
 *
 * SSR (core-CONTRACT §7): structure (label + control + input + any default chips) is
 * always present; the machine spreads the input/chip ARIA in `updated()`, so
 * `@lit-labs/ssr` emits a meaningful, styled control in the declarative shadow DOM before
 * any JS upgrades it.
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

export type { LabFieldSize as LabTagsInputSize, LabFieldType as LabTagsInputType };

type TagsInputSchema = SchemaOf<tagsInputMachine.Service>;
type TagsInputApi = tagsInputMachine.Api;

/**
 * The `@zag-js/tags-input` package seen through the renderer-agnostic seam — the SAME
 * `MachineModule` shape the Lit base binds for every machine-driven component, no casts.
 */
const tagsInputModule: MachineModule<TagsInputSchema, TagsInputApi> = tagsInputMachine;

/** Per-instance machine id source — keeps the input/label/chip ids deterministic and the
 * derived helper/error ids collision-free across instances. */
let tagsInputSeq = 0;

/**
 * The accessible-name translations for the chip controls. The machine wires these onto
 * the delete trigger (`aria-label`) and the edit input — so the X button has a real name
 * ("Delete <tag>") and a screen reader announces tag lifecycle events. Shared with the
 * React twin so both renderers name the chip controls identically (parity, not a second
 * implementation). Only the strings the controls need are overridden; the rest fall back
 * to the machine's English defaults.
 */
export const tagsInputTranslations: Partial<tagsInputMachine.IntlTranslations> = {
  deleteTagTriggerLabel: (value: string) => `Delete ${value}`,
  tagSelected: (value: string) => `${value} selected. Press Backspace or Delete to remove.`,
  tagAdded: (value: string) => `Added tag ${value}`,
  tagsPasted: (values: string[]) => `Pasted ${values.length} tags`,
  tagEdited: (value: string) => `Editing tag ${value}. Press Enter to save or Escape to cancel.`,
  tagUpdated: (value: string) => `Tag updated to ${value}`,
  tagDeleted: (value: string) => `Deleted tag ${value}`,
};

export class LabTagsInput extends LabElement {
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    /** Visible label text. Always rendered into a real `<label for>`. */
    label: {},
    /** When set, the label is clipped (kept in the a11y tree, visually hidden). */
    labelHidden: { type: Boolean, attribute: 'label-hidden', reflect: true },
    /** Helper / description text shown below the control and linked via describedby. */
    helper: {},
    /** Error message; announced (role="alert") and linked only when `invalid`. */
    error: {},
    /** Placeholder text for the empty input. */
    placeholder: {},
    /** Maximum number of tags. Overflow drives the invalid state. */
    max: { type: Number },
    /** The character that adds a tag and splits a pasted value (default ","). */
    delimiter: {},
    /** Allow editing a chip in place (Enter / double-click). */
    editable: { type: Boolean },
    /** Add a tag when a value is pasted (split on the delimiter). */
    addOnPaste: { type: Boolean, attribute: 'add-on-paste' },
    /** Allow duplicate tag values. */
    allowDuplicates: { type: Boolean, attribute: 'allow-duplicates' },
    /** Controlled tag value(s) (mirrors the machine). */
    value: {
      attribute: 'value',
      converter: { fromAttribute: (raw: string | null): string[] => parseValues(raw) },
    },
    /** Uncontrolled initial tag value(s) — read once by the machine at init. */
    defaultValue: {
      attribute: 'default-value',
      converter: { fromAttribute: (raw: string | null): string[] => parseValues(raw) },
    },
    /** Non-editable: the chips read their value but cannot be changed. */
    readonly: { type: Boolean, reflect: true },
    /** Non-interactive and dimmed. */
    disabled: { type: Boolean, reflect: true },
    /** Required — sets aria-required on the input and the native hidden input. */
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
  declare placeholder: string;
  declare max: number;
  declare delimiter: string;
  declare editable: boolean;
  declare addOnPaste: boolean;
  declare allowDuplicates: boolean;
  declare value: string[];
  declare defaultValue: string[];
  declare readonly: boolean;
  declare disabled: boolean;
  declare required: boolean;
  declare invalid: boolean;
  declare name: string;

  private readonly machineCtl: ZagController<TagsInputSchema, TagsInputApi>;
  /** Stable machine id — the input/label/chip ids and the derived helper/error ids all
   * key off this, so nothing collides across instances. */
  private readonly fieldId = `lab-tags-input-${++tagsInputSeq}`;
  /** Значения чипов, отрисованные этим проходом, — per-chip геттеры маппятся на узлы
   * ПОЗИЦИОННО по этому массиву (тот же массив рисует .item в render() того же цикла,
   * поэтому соответствие 1:1 — в том числе при allow-duplicates, где значение не
   * уникально). Зеркалит машинный список: удалённый/переставленный тег не оставляет
   * узла с протухшими геттерами. */
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
    this.value = [];
    this.defaultValue = [];
    this.readonly = false;
    this.disabled = false;
    this.required = false;
    this.invalid = false;
    this.name = '';
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
      value: this.hasAttribute('value') ? this.value : undefined,
      defaultValue: this.defaultValue.length ? this.defaultValue : undefined,
      disabled: this.disabled,
      readOnly: this.readonly,
      invalid: this.invalid,
      required: this.required,
      name: this.name || undefined,
      translations: tagsInputTranslations as tagsInputMachine.IntlTranslations,
      onValueChange: (details: tagsInputMachine.ValueChangeDetails) => {
        this.value = details.value;
        // The chip set changed → repaint so the rendered chips match the machine value
        // before the next spread maps the per-chip getters onto them.
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

  /** The current tag values as the machine sees them (empty before the machine starts).
   * The render reads this so the drawn chips always match the machine's value. */
  private currentTags(): string[] {
    try {
      return this.machineCtl.api.value;
    } catch {
      return this.hasAttribute('value') ? this.value : this.defaultValue;
    }
  }

  static override styles = [
    fieldStyles,
    css`
      /* The control surface — a bordered box that wraps the chip row + the text input.
         Here .control is a WRAPPER <div> (not the editable input it is in Input/Textarea).
         The shared field-styles .control rule paints an input surface AND a plain <div>
         matches .control:read-only (the combobox lesson — a wrapper that also carries the
         class double-paints / takes the readonly tint). We re-declare the wrapper's
         surface here under :host so it wins specificity, and drive readonly/disabled/
         sentiment from the reflected HOST attributes — the surface lands on THIS one box
         (the chips + input live inside it, transparent), never a second box. The
         label/helper/error parts still come from field-styles unchanged (true reuse). */
      :host .control {
        box-sizing: border-box;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--_field-gap);
        width: 100%;
        min-height: ${litVar('--lab-size-control-h-m', '2.5rem')};
        margin: 0;
        padding: var(--_field-pad-y) var(--_field-pad-x);
        background-color: ${litVar('--lab-bg-primary')};
        border: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-base')};
        border-radius: var(--_field-radius);
        box-shadow: none;
        transition: border-color 120ms ease, box-shadow 120ms ease;
        cursor: text;
      }
      :host(:not([disabled]):not([readonly])) .control:hover {
        border-color: ${litVar('--lab-border-strong')};
      }
      :host([type='danger']) .control {
        border-color: ${litVar('--lab-border-danger')};
      }
      :host([type='warning']) .control {
        border-color: ${litVar('--lab-border-warning-strong')};
      }
      :host([type='success']) .control {
        border-color: ${litVar('--lab-border-success-strong')};
      }
      :host([readonly]) .control {
        background-color: ${litVar('--lab-fill-primary')};
        border-color: ${litVar('--lab-border-soft')};
        cursor: default;
      }
      :host([disabled]) .control {
        cursor: not-allowed;
        opacity: 0.5;
      }
      /* Focus ring: the control surface lights when the inner input is focus-visible (the
         input has no border of its own — the .control frame carries it). */
      :host .control:has(.input:focus-visible) {
        border-color: ${litVar('--lab-border-focus')};
        box-shadow: 0 0 0 ${litVar('--lab-focus-ring-width')} ${litVar('--lab-border-focus')};
      }
      :host([type='danger']) .control:has(.input:focus-visible) {
        box-shadow: 0 0 0 ${litVar('--lab-focus-ring-width')} ${litVar('--lab-border-danger')};
      }
      :host([type='warning']) .control:has(.input:focus-visible) {
        box-shadow: 0 0 0 ${litVar('--lab-focus-ring-width')} ${litVar('--lab-border-warning-strong')};
      }
      :host([type='success']) .control:has(.input:focus-visible) {
        box-shadow: 0 0 0 ${litVar('--lab-focus-ring-width')} ${litVar('--lab-border-success-strong')};
      }

      /* One tag chip — a pill with the tag text and a delete button. The machine sets
         data-highlighted (keyboard/pointer navigation) and data-disabled. */
      .item {
        display: inline-flex;
        align-items: center;
        gap: ${litVar('--lab-space-xs', '0.25rem')};
        max-width: 100%;
        padding: var(--lab-radius-xs, 0.125rem) var(--lab-radius-xs, 0.125rem) var(--lab-radius-xs, 0.125rem) var(--lab-space-sm, 0.5rem);
        font-size: var(--_field-label-font);
        letter-spacing: var(--_field-label-tracking);
        line-height: 1.4;
        color: ${litVar('--lab-label-primary')};
        background-color: ${litVar('--lab-fill-primary')};
        border-radius: ${litVar('--lab-radius-sm', '0.25rem')};
      }
      .item[data-highlighted] {
        background-color: ${litVar('--lab-fill-neutral')};
        color: ${litVar('--lab-label-on-neutral')};
      }
      .item[data-disabled] {
        opacity: 0.5;
      }

      .item-text {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      /* The edit-in-place input — hidden by the machine (hidden attr) unless this chip is
         being edited; then it replaces the preview. Inherits the chip's text band. */
      .item-input {
        min-width: 4ch;
        margin: 0;
        padding: 0;
        font: inherit;
        font-size: var(--_field-label-font);
        letter-spacing: var(--_field-label-tracking);
        color: ${litVar('--lab-label-primary')};
        background: transparent;
        border: 0;
        outline: none;
        appearance: none;
      }

      /* The chip's delete button — a real <button> the machine wires with an accessible
         name and the remove keyboard/click. */
      .item-delete {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: ${litVar('--lab-size-control-l', '1.25rem')};
        height: ${litVar('--lab-size-control-l', '1.25rem')};
        padding: 0;
        font: inherit;
        line-height: 1;
        color: ${litVar('--lab-label-secondary')};
        background: transparent;
        border: 0;
        border-radius: ${litVar('--lab-radius-sm', '0.25rem')};
        cursor: pointer;
        transition: color 120ms ease, background-color 120ms ease;
      }
      .item-delete:hover:not([data-disabled]) {
        color: ${litVar('--lab-label-primary')};
        background-color: ${litVar('--lab-fill-neutral')};
      }
      .item-delete:focus-visible {
        outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
        outline-offset: calc(-1 * ${litVar('--lab-focus-ring-offset')});
      }
      .item-delete[data-disabled] {
        cursor: not-allowed;
        opacity: 0.45;
      }

      /* The text-entry input — the field's control. Reuses the shared field surface roles
         but paints transparently inside the .control frame (which carries the border). */
      .input {
        flex: 1 1 ${litVar('--lab-space-24', '6rem')};
        min-width: ${litVar('--lab-space-24', '6rem')};
        margin: 0;
        padding: var(--lab-radius-xs, 0.125rem) 0;
        font: inherit;
        font-size: var(--_field-font);
        letter-spacing: var(--_field-tracking);
        line-height: var(--_field-line);
        color: ${litVar('--lab-label-primary')};
        background: transparent;
        border: 0;
        outline: none;
        appearance: none;
      }
      .input::placeholder {
        color: ${litVar('--lab-label-tertiary')};
        opacity: 1;
      }

      @media (prefers-reduced-motion: reduce) {
        .control,
        .item-delete {
          transition: none;
        }
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
    // control, the text input, each chip's parts). We do NOT clearSpreads() between
    // renders — data-highlighted MOVES between chips as the user navigates, and
    // spreadProps' per-node diff both swaps listeners AND removes attributes that drop
    // out; clearing it each render would leave a stale data-highlighted on a chip (the
    // select/combobox canon).
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
      <div class="field" part="field">
        <label id=${ids.label} class="label" part="label" for=${ids.control}>
          <span class="label-text">${this.label}</span
          >${this.required ? html`<span class="required-mark" aria-hidden="true"> *</span>` : nothing}
        </label>
        <div class="control" part="control">
          ${this.renderedTags.map(
            (tagValue) => html`
              <span class="item" part="item" data-value=${tagValue}>
                <span class="item-preview" part="item-preview">
                  <span class="item-text" part="item-text">${tagValue}</span>
                  <button class="item-delete" part="item-delete" type="button">×</button>
                </span>
                <input class="item-input" part="item-input" />
              </span>
            `,
          )}
          <input class="input" part="input" />
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

/** Parse the JSON `value` / `default-value` attribute into a string[]; a bare comma- or
 * pipe-separated string is tolerated; malformed input is empty. */
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

/** Set an attribute when the value is defined, otherwise remove it (never "" vs none confusion). */
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
