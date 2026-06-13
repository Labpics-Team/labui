/**
 * `<lab-radio-group>` — the FIRST COMPOUND LabUI component, consuming the
 * `@zag-js/radio-group` machine through the Behaviors seam (core-CONTRACT §1).
 *
 * Compound shape (the CANON for Select / Tabs / Menu / Accordion that follow):
 *   A Zag *group* machine is ONE instance that owns N parts. Its `connect()`
 *   returns group-level getters (`getRootProps`, `getLabelProps`) AND per-item
 *   getters keyed by value (`getItemProps(value)`, `getItemControlProps(value)`,
 *   `getItemTextProps(value)`, `getItemHiddenInputProps(value)`). The machine
 *   queries the DOM through `getRootNode`, which the `ZagController` points at
 *   THIS element's shadow root — so every part the machine drives MUST live in
 *   ONE shadow scope. A radio whose items were slotted light-DOM children would
 *   put those parts OUTSIDE the machine's query root and break focus/roving.
 *
 *   Therefore the Web-Component compound is ONE custom element that renders all
 *   parts in its own shadow DOM from a declarative `items` config (value/label/
 *   disabled) — NOT a parent element plus N child custom elements. The element
 *   spreads each per-item getter onto its matching shadow node in `updated()`.
 *   (The React twin uses the renderer-native shape — a context-provider parent
 *   plus `<Radio>` leaf children — because React composition is functions, not a
 *   shared DOM query root. Same machine, two idiomatic compositions.)
 *
 * Axes (the Figma model — Type × Size × Orientation × State × Disabled):
 *   - type:        accent | neutral | danger   (intent of the SELECTED dot)
 *   - size:        s | m | l
 *   - orientation: horizontal | vertical       (machine-owned; reflected for CSS)
 *   - value:       controlled selected value (reflected for CSS + SSR)
 *   - defaultValue: uncontrolled initial value (read once by the machine at init)
 *   - disabled:    group-level non-interactive; an item may also be disabled
 *
 * a11y is the machine's, not hand-rolled: `role="radiogroup"`, roving tabindex,
 * Arrow-key selection, `aria-checked`, focus management, and a hidden native
 * radio input per item all come from `@zag-js/radio-group` (DIP — injected
 * `MachineModule`, no hand-written roving logic).
 *
 * Token contract (core-CONTRACT §2): ONLY semantic --lab-* roles. The unchecked
 * ring is `--lab-border-neutral`; the checked ring is `--lab-border-{type}`; the
 * dot is `--lab-fill-{type}`; the label is `--lab-label-primary`. No hex, no
 * primitive, no invented role.
 */
import { type TemplateResult, css, html, nothing } from 'lit';
import * as radioGroupMachine from '@zag-js/radio-group';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';

/** Semantic intent of the selected radio's dot + ring. */
export type LabRadioGroupType = 'accent' | 'neutral' | 'danger';
/** Control size. */
export type LabRadioGroupSize = 's' | 'm' | 'l';
/** Layout direction of the radio list (machine-owned, drives roving keys). */
export type LabRadioGroupOrientation = 'horizontal' | 'vertical';

/**
 * One radio option. The COMPOUND unit: the group renders one item per entry and
 * spreads the machine's per-value getters onto its parts. Shared with the React
 * twin so both renderers describe an item the same way and cannot drift.
 */
export interface LabRadioItem {
  /** The value submitted/selected when this radio is chosen. Unique in the group. */
  readonly value: string;
  /** The visible label text next to the dot. */
  readonly label: string;
  /** Whether THIS item is non-interactive (independent of group `disabled`). */
  readonly disabled?: boolean;
}

type RadioGroupSchema = SchemaOf<radioGroupMachine.Service>;
type RadioGroupApi = radioGroupMachine.Api;

/**
 * The `@zag-js/radio-group` package seen through the renderer-agnostic seam — the
 * SAME `MachineModule` shape the Lit base binds for switch/checkbox, no casts.
 */
const radioGroupModule: MachineModule<RadioGroupSchema, RadioGroupApi> = radioGroupMachine;

export class LabRadioGroup extends LabElement {
  static override properties = {
    type: { reflect: true },
    size: { reflect: true },
    /** Reflected so `:host([orientation])` lays the list out before JS upgrades. */
    orientation: { reflect: true },
    /** Controlled selected value. When the attribute is present, consumer owns it. */
    value: { reflect: true },
    /** Uncontrolled initial value — read once by the machine at init. */
    defaultValue: { attribute: 'default-value', reflect: true },
    /** Group-level disable — every item becomes non-interactive. */
    disabled: { type: Boolean, reflect: true },
    /** Native form field name for the hidden radio inputs. */
    name: {},
    /** Optional group label text; rendered as the machine's label part. */
    label: {},
    /**
     * The radio options. A custom element can't carry an array in a plain
     * attribute, so this is primarily a JS PROPERTY; a JSON string attribute
     * (`items='[{"value":"a","label":"A"}]'`) is parsed for pure-HTML/SSR use.
     */
    items: {
      attribute: 'items',
      converter: {
        fromAttribute: (raw: string | null): LabRadioItem[] => parseItems(raw),
      },
    },
  };

  declare type: LabRadioGroupType;
  declare size: LabRadioGroupSize;
  declare orientation: LabRadioGroupOrientation;
  declare value: string;
  declare defaultValue: string;
  declare disabled: boolean;
  declare name: string;
  declare label: string;
  declare items: LabRadioItem[];

  private readonly group: ZagController<RadioGroupSchema, RadioGroupApi>;

  constructor() {
    super();
    this.type = 'accent';
    this.size = 'm';
    this.orientation = 'horizontal';
    this.value = '';
    this.defaultValue = '';
    this.disabled = false;
    this.name = '';
    this.label = '';
    this.items = [];
    // Wire the Zag radio-group behaviour. `value` is passed only when the
    // consumer set the attribute (controlled); otherwise the machine owns it from
    // `defaultValue` (uncontrolled) — the same honest two-mode contract as switch.
    this.group = this.runMachine(radioGroupModule, () => ({
      value: this.hasAttribute('value') ? this.value : undefined,
      defaultValue: this.defaultValue || undefined,
      disabled: this.disabled,
      orientation: this.orientation,
      name: this.name || undefined,
      onValueChange: (details: radioGroupMachine.ValueChangeDetails) => {
        this.value = details.value ?? '';
        this.dispatchEvent(
          new CustomEvent<radioGroupMachine.ValueChangeDetails>('value-change', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
    }));
  }

  static override styles = css`
    :host {
      /* Size knobs the size axis maps onto. Dimension tokens may carry a literal
         fallback so the control is usable before tokens load; colour roles never
         do (css.ts rule). */
      --_ring: 1.25rem;
      --_dot: 0.625rem;
      --_row-gap: ${litVar('--lab-space-sm', '0.5rem')};
      --_list-gap: ${litVar('--lab-space-md', '0.75rem')};
      --_font: ${litVar('--lab-font-size-md', '1rem')};

      display: block;
    }

    :host([size='s']) {
      --_ring: 1rem;
      --_dot: 0.5rem;
      --_font: ${litVar('--lab-font-size-xs', '0.8333rem')};
    }
    :host([size='l']) {
      --_ring: 1.5rem;
      --_dot: 0.75rem;
      --_font: ${litVar('--lab-font-size-lg', '1.2rem')};
    }

    /* Root is the Zag radiogroup element (role + roving focus spread in updated). */
    .root {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: var(--_list-gap);
      font: inherit;
      font-size: var(--_font);
      line-height: ${litVar('--lab-line-height-md', '1.5')};
      color: ${litVar('--lab-label-primary')};
    }
    :host([orientation='vertical']) .root {
      flex-direction: column;
      flex-wrap: nowrap;
      align-items: flex-start;
    }

    .group-label {
      flex: 1 0 100%;
      font-size: var(--_font);
      font-weight: 600;
      color: ${litVar('--lab-label-primary')};
    }

    /* One radio row — the Zag item element (a <label> wrapping ring + text). */
    .item {
      display: inline-flex;
      align-items: center;
      gap: var(--_row-gap);
      cursor: pointer;
    }
    .item[data-disabled] {
      cursor: not-allowed;
      opacity: 0.45;
    }

    /* The ring — the Zag item-control element. Unchecked = bordered, transparent. */
    .control {
      box-sizing: border-box;
      position: relative;
      flex: 0 0 auto;
      display: inline-grid;
      place-items: center;
      width: var(--_ring);
      height: var(--_ring);
      border-radius: ${litVar('--lab-radius-full', '9999px')};
      border: 0.0938rem solid ${litVar('--lab-border-neutral')};
      background-color: transparent;
      transition:
        border-color 120ms ease,
        background-color 120ms ease;
    }

    /* Checked ring colour per type, driven by the machine's data-state on the
       control. The longhand is set DIRECTLY (no var()->var() across the shadow
       boundary, which can go stale in Chromium on theme swap — proto-A note). */
    :host([type='accent']) .control[data-state='checked'] {
      border-color: ${litVar('--lab-border-accent')};
    }
    :host([type='neutral']) .control[data-state='checked'] {
      border-color: ${litVar('--lab-border-neutral')};
    }
    :host([type='danger']) .control[data-state='checked'] {
      border-color: ${litVar('--lab-border-danger')};
    }

    /* The dot — scales in only when the machine reports this item checked. */
    .dot {
      width: var(--_dot);
      height: var(--_dot);
      border-radius: ${litVar('--lab-radius-full', '9999px')};
      background-color: currentColor;
      transform: scale(0);
      transition: transform 120ms ease;
    }
    :host([type='accent']) .control[data-state='checked'] .dot {
      color: ${litVar('--lab-fill-accent')};
      transform: scale(1);
    }
    :host([type='neutral']) .control[data-state='checked'] .dot {
      color: ${litVar('--lab-fill-neutral')};
      transform: scale(1);
    }
    :host([type='danger']) .control[data-state='checked'] .dot {
      color: ${litVar('--lab-fill-danger')};
      transform: scale(1);
    }

    .text {
      color: ${litVar('--lab-label-primary')};
    }

    /* Focus is delegated to the per-item hidden input; draw the ring on the
       visible control when that input is focus-visible. */
    .control:has(input:focus-visible) {
      outline: 0.125rem solid ${litVar('--lab-border-focus')};
      outline-offset: 0.125rem;
    }

    /* The machine sets the hidden input's visually-hidden inline style after
       upgrade; this keeps it hidden at first paint (SSR) too, before that lands. */
    input {
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

    @media (prefers-reduced-motion: reduce) {
      .control,
      .dot {
        transition: none;
      }
    }
  `;

  override updated(): void {
    // Apply the machine's connect props onto the real shadow nodes: group-level
    // (role=radiogroup, roving focus) and the per-item getters for every option.
    // Clear prior spreads first to avoid stacking listeners across renders.
    this.group.clearSpreads();
    const api = this.group.api;

    const root = this.renderRoot.querySelector<HTMLElement>('.root');
    if (root) this.group.spread(root, api.getRootProps());

    const labelEl = this.renderRoot.querySelector<HTMLElement>('.group-label');
    if (labelEl) this.group.spread(labelEl, api.getLabelProps());

    // Map each item's getters onto its node by the STABLE key `value`, not the
    // positional index. The machine already keys its per-item getters by value;
    // honouring that here means a node never receives another item's props if the
    // render order and the `items` array ever diverge (reorder/virtualise/nest) —
    // the canon Select/Tabs/Menu/Accordion need this guarantee. `value` rides a
    // `data-value` attribute on each `.item` node; `CSS.escape` neutralises any
    // quote/bracket so the attribute selector can't be broken by item content.
    for (const item of this.items) {
      const selector = `.item[data-value="${CSS.escape(item.value)}"]`;
      const itemEl = this.renderRoot.querySelector<HTMLElement>(selector);
      if (!itemEl) continue;
      const itemProps = { value: item.value, disabled: item.disabled };
      this.group.spread(itemEl, api.getItemProps(itemProps));

      const control = itemEl.querySelector<HTMLElement>('.control');
      if (control) this.group.spread(control, api.getItemControlProps(itemProps));

      const text = itemEl.querySelector<HTMLElement>('.text');
      if (text) this.group.spread(text, api.getItemTextProps(itemProps));

      const input = itemEl.querySelector<HTMLElement>('input');
      if (input) this.group.spread(input, api.getItemHiddenInputProps(itemProps));
    }
  }

  override render(): TemplateResult {
    // Structure only; behaviour (role, roving focus, aria-checked, keyboard) is
    // spread in `updated()` from the machine. SSR emits this real markup so first
    // paint is a meaningful, styled radio list before any JS upgrades it.
    return html`
      <div class="root">
        ${this.label ? html`<span class="group-label">${this.label}</span>` : nothing}
        ${this.items.map(
          (item) => html`
            <label class="item" data-value="${item.value}">
              <span class="control"><span class="dot"></span></span>
              <span class="text">${item.label}</span>
              <input type="radio" />
            </label>
          `,
        )}
      </div>
    `;
  }
}

/** Parse the JSON `items` attribute into a typed list; malformed input is empty. */
function parseItems(raw: string | null): LabRadioItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is LabRadioItem =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as LabRadioItem).value === 'string' &&
        typeof (entry as LabRadioItem).label === 'string',
    );
  } catch {
    return [];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-radio-group': LabRadioGroup;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-radio-group')) {
  customElements.define('lab-radio-group', LabRadioGroup);
}
