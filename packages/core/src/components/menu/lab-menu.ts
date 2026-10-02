/**
 * `<lab-menu>` — the second compound + positioned canon: a trigger that opens a
 * positioned action menu of items. Like `<lab-select>` it fuses the keyed-compound
 * group machine with the positioned, dismissable overlay; it differs from Select in
 * SEMANTICS — a menu is a list of ACTIONS (`role="menu"` / `menuitem`), not a value
 * picker (`listbox` / `option`), so it owns no selected value and no hidden form
 * field. Selecting an item RUNS it and (by default) closes the menu.
 *
 * Compound + positioned shape (the CANON, shared with Select):
 *   A Zag *menu* machine is ONE instance owning the trigger, the positioner, the
 *   menu content, and N item parts keyed by VALUE. Its `connect()` returns
 *   group-level getters (`getTriggerProps`, `getContentProps`, `getPositionerProps`)
 *   AND per-item getters that take a `{ value }` (`getItemProps({ value })`). Unlike
 *   Select, a menu has NO collection: the item's value IS the key, passed directly.
 *   The machine queries the DOM through `getRootNode` (this element's shadow root)
 *   and anchors the menu with Floating UI, so every part lives in ONE shadow scope —
 *   the element renders all parts in its own shadow DOM from a declarative `items`
 *   config (NOT a parent + N child elements).
 *
 *   Positioner canon (from `<lab-popover>`): the content sits in the shadow root,
 *   positioned with `strategy:'fixed'` to escape clipping/stacking ancestors WITHOUT
 *   a portal, so the machine is told `portalled:false`. (The React twin sets
 *   `portalled:true` and renders into a body portal; dismiss + keyboard + positioning
 *   are identical because both come from the machine.)
 *
 * Keyed mapping (from `<lab-radio-group>` / Select): each item node carries
 * `data-value="<value>"`; `updated()` spreads the machine's per-item getters onto its
 * node by that STABLE key (via `CSS.escape`), never the positional index — items can
 * be filtered/reordered, and the id the machine puts on each item is exactly what the
 * menu's `aria-activedescendant` points at during Arrow/typeahead navigation.
 *
 * Axes (the Figma model — Size × Placement × Disabled):
 *   - size:        s | m | l — menu font band + item padding.
 *   - placement:   where the menu sits relative to the trigger (Zag popper).
 *   - disabled:    trigger non-interactive. UNLIKE `<lab-select>`, the
 *                  `@zag-js/menu` machine has NO top-level `disabled` and
 *                  `getTriggerProps()` emits neither `disabled` nor `data-disabled`,
 *                  so the disable is applied at the ELEMENT level: `render()` binds
 *                  the native `disabled` attribute onto the trigger `<button>`
 *                  (`?disabled`). A native-disabled button cannot be clicked or
 *                  keyboard-activated, so the menu cannot open; the machine's own
 *                  pointer/keydown handlers also early-return on a disabled target.
 *                  The disabled VISUAL fires from `.trigger:disabled` (the real
 *                  native state), matching the React twin. An item may ALSO be
 *                  disabled independently (machine-driven, via `getItemProps`).
 *
 * a11y is the machine's, not hand-rolled: the trigger advertises the menu with
 * `aria-haspopup="menu"` / `aria-controls` → content / `aria-expanded`; the content
 * is `role="menu"` with `aria-activedescendant`; each item is `role="menuitem"`;
 * Arrow/Home/End navigation, typeahead, Escape/outside-click dismiss and focus
 * restoration ALL come from `@zag-js/menu` (DIP — injected `MachineModule`, zero
 * hand-written roving/positioning/dismiss).
 *
 * Token contract (core-CONTRACT §2): ONLY semantic `--lab-*` roles. The menu is the
 * raised surface (`--lab-bg-secondary` + `--lab-label-primary`) with a
 * `--lab-border-soft` hairline and `--lab-fx-shadow-major` lift, layered at
 * `--lab-z-dropdown`; the highlighted item fills with `--lab-fill-primary`;
 * a danger item's label is `--lab-label-danger`; a separator is `--lab-border-soft`.
 * No hex, no primitive.
 *
 * SSR (core-CONTRACT §7): a menu is client-only. The server emits the trigger and a
 * `hidden` menu; the machine upgrades it on the client. No flash, no pre-work.
 */
import * as menuMachine from '@zag-js/menu';
import { type TemplateResult, css, html } from 'lit';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';

/** Control size — drives menu font band and item padding. */
export type LabMenuSize = 's' | 'm' | 'l';
/** Where the menu sits relative to the trigger (Zag popper placement). */
export type LabMenuPlacement = NonNullable<
  NonNullable<menuMachine.Props['positioning']>['placement']
>;

/**
 * One menu item. The COMPOUND unit: the element renders one item per entry and
 * spreads the machine's per-value getters onto its node. Shared with the React twin
 * so both renderers describe an item the same way and cannot drift. A `separator`
 * entry is a non-interactive divider rather than an action.
 */
export interface LabMenuItem {
  /** The value emitted on `select` when this item is chosen. Unique in the menu. */
  readonly value: string;
  /** The visible label text of the item. */
  readonly label: string;
  /** Whether THIS item is non-interactive (independent of the trigger's `disabled`). */
  readonly disabled?: boolean;
  /** Danger intent — paints the item's label as the danger role (e.g. "Delete"). */
  readonly danger?: boolean;
  /** Render this entry as a visual separator instead of an action item. */
  readonly separator?: boolean;
}

type MenuSchema = SchemaOf<menuMachine.Service>;
type MenuApi = menuMachine.Api;

/**
 * The `@zag-js/menu` package seen through the renderer-agnostic seam — the SAME
 * `MachineModule` shape the Lit base binds for every other component, no casts.
 */
const menuModule: MachineModule<MenuSchema, MenuApi> = menuMachine;

/** Per-instance machine id source. Overlays are client-only, so a client counter
 * is SSR-safe; an explicit id keeps the machine's element ids deterministic. */
let menuInstanceSeq = 0;

export class LabMenu extends LabElement {
  static override properties = {
    size: { reflect: true },
    /** Where the menu sits relative to the trigger. */
    placement: { reflect: true },
    /** Trigger non-interactive when present. */
    disabled: { type: Boolean, reflect: true },
    /** Label shown in the trigger button. */
    label: {},
    /**
     * The items. Primarily a JS PROPERTY; a JSON string attribute
     * (`items='[{"value":"a","label":"A"}]'`) is parsed for pure-HTML/SSR use.
     */
    items: {
      attribute: 'items',
      converter: { fromAttribute: (raw: string | null): LabMenuItem[] => parseItems(raw) },
    },
  };

  declare size: LabMenuSize;
  declare placement: LabMenuPlacement;
  declare disabled: boolean;
  declare label: string;
  declare items: LabMenuItem[];

  private readonly machineCtl: ZagController<MenuSchema, MenuApi>;
  /** Stable machine id — keeps the trigger/content/item element ids deterministic. */
  private readonly machineId = `lab-menu-${++menuInstanceSeq}`;

  constructor() {
    super();
    this.size = 'm';
    this.placement = 'bottom-start';
    this.disabled = false;
    this.label = 'Menu';
    this.items = [];
    // Wire the Zag menu behaviour. `portalled:false` because the content lives in
    // this shadow root; `strategy:'fixed'` is the overlay canon for escaping
    // clipping/stacking ancestors without a portal.
    this.machineCtl = this.runMachine(menuModule, () => ({
      id: this.machineId,
      positioning: { placement: this.placement, strategy: 'fixed' },
      onSelect: (details: menuMachine.SelectionDetails) => {
        this.dispatchEvent(
          new CustomEvent<menuMachine.SelectionDetails>('select', {
            detail: details,
            bubbles: true,
            composed: true,
          }),
        );
      },
      onOpenChange: (details: menuMachine.OpenChangeDetails) => {
        this.dispatchEvent(
          new CustomEvent<menuMachine.OpenChangeDetails>('open-change', {
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
      --_h: 2.25rem;
      --_pad-x: ${litVar('--lab-space-md', '1rem')};
      --_font: ${litVar('--lab-font-size-md', '1rem')};

      display: inline-flex;
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

    /* The Zag trigger — a real button; the machine spreads aria-haspopup=menu,
       aria-controls, aria-expanded and the toggle handler. The native disabled
       attribute (bound in render from this.disabled) makes it non-interactive —
       the machine has no top-level disabled, so this is element-level. */
    .trigger {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: ${litVar('--lab-space-xs', '0.25rem')};
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
    .trigger:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
    .trigger:focus-visible {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: ${litVar('--lab-focus-ring-offset')};
    }

    .trigger-caret {
      display: inline-flex;
      color: ${litVar('--lab-label-secondary')};
      transition: transform var(--lab-motion-transition-duration) var(--lab-motion-transition-easing);
    }
    .trigger[data-state='open'] .trigger-caret {
      transform: rotate(180deg);
    }

    /* The Zag positioner — Floating UI writes --x/--y here and mirrors the content
       z-index into --z-index for layering. */
    .positioner {
      /* positioning frame only */
    }

    /* The floating menu — raised surface with a hairline, lifted and layered. */
    .content {
      box-sizing: border-box;
      min-width: 11rem;
      max-height: 20rem;
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

    /* One action item — the Zag menuitem element. */
    .item {
      display: flex;
      align-items: center;
      gap: ${litVar('--lab-space-sm', '0.5rem')};
      padding: ${litVar('--lab-space-xs', '0.25rem')} ${litVar('--lab-space-sm', '0.5rem')};
      border-radius: ${litVar('--lab-radius-xs', '0.25rem')};
      color: ${litVar('--lab-label-primary')};
      cursor: pointer;
      user-select: none;
    }
    /* Highlight (keyboard/pointer) — the machine sets data-highlighted. */
    .item[data-highlighted] {
      background-color: ${litVar('--lab-fill-primary')};
    }
    .item[data-disabled] {
      cursor: not-allowed;
      opacity: 0.45;
    }
    .item[data-danger] {
      color: ${litVar('--lab-label-danger')};
    }
    .item[data-danger][data-highlighted] {
      background-color: ${litVar('--lab-fill-danger-tinted')};
    }

    /* A non-interactive divider between item groups. */
    .separator {
      height: 0.0625rem;
      margin: ${litVar('--lab-space-xs', '0.25rem')} 0;
      background-color: ${litVar('--lab-border-soft')};
    }
  `;

  override updated(): void {
    // Apply the machine's connect props onto the real shadow nodes: group-level
    // (trigger, content menu, positioner) and the per-item getters for every action
    // item. We do NOT `clearSpreads()` between renders (the tabs canon): `spreadProps`
    // keeps a per-node diff and both swaps event listeners AND removes attributes that
    // drop out of the props — critical here, where `data-highlighted` MOVES between
    // items as the user navigates. Calling its cleanup each render would reset that
    // diff and leave a stale `data-highlighted` on the previously-active item,
    // desyncing aria-activedescendant. The accumulated cleanups run once on disconnect
    // (ZagController.hostDisconnected).
    const api = this.machineCtl.api;
    const root = this.renderRoot;

    const trigger = root.querySelector<HTMLElement>('.trigger');
    if (trigger) this.machineCtl.spread(trigger, api.getTriggerProps());

    const positioner = root.querySelector<HTMLElement>('.positioner');
    if (positioner) this.machineCtl.spread(positioner, api.getPositionerProps());

    const content = root.querySelector<HTMLElement>('.content');
    if (content) this.machineCtl.spread(content, api.getContentProps());

    // Map each action item's getters onto its node by the STABLE key `value`, never
    // the positional index. The machine keys its per-item getters by value, so a
    // node never receives another item's props if render order and `items` diverge
    // (filter/reorder) — and the id the machine puts on the item is exactly what the
    // menu's aria-activedescendant points at. Separators carry no behaviour, so they
    // are skipped. `CSS.escape` neutralises any quote/bracket in the value.
    for (const item of this.items ?? []) {
      if (item.separator) continue;
      const selector = `.item[data-value="${CSS.escape(item.value)}"]`;
      const itemEl = root.querySelector<HTMLElement>(selector);
      if (!itemEl) continue;
      this.machineCtl.spread(
        itemEl,
        api.getItemProps({ value: item.value, disabled: item.disabled }),
      );
    }
  }

  override render(): TemplateResult {
    // Structure only; behaviour (menu/menuitem roles, aria, open/close, navigation,
    // typeahead, dismiss, positioning) is spread in updated() from the machine. SSR
    // emits this markup so first paint is a meaningful, styled trigger before JS.
    return html`
      <button class="trigger" type="button" part="trigger" ?disabled=${this.disabled}>
        <span class="trigger-label">${this.label}</span>
        <span class="trigger-caret" part="caret" aria-hidden="true">▾</span>
      </button>
      <div class="positioner" part="positioner">
        <ul class="content" part="content" hidden>
          ${(this.items ?? []).map((item) =>
            item.separator
              ? html`<li class="separator" part="separator" role="separator"></li>`
              : html`
                  <li
                    class="item"
                    part="item"
                    data-value="${item.value}"
                    ?data-danger="${item.danger ?? false}"
                  >
                    ${item.label}
                  </li>
                `,
          )}
        </ul>
      </div>
    `;
  }
}

/** Parse the JSON `items` attribute into a typed list; malformed input is empty. */
function parseItems(raw: string | null): LabMenuItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is LabMenuItem => {
      if (typeof entry !== 'object' || entry === null) return false;
      const item = entry as LabMenuItem;
      // A separator is defined by `separator: true` alone — it carries no value/label.
      if (item.separator === true) return true;
      return typeof item.value === 'string' && typeof item.label === 'string';
    });
  } catch {
    return [];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-menu': LabMenu;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-menu')) {
  customElements.define('lab-menu', LabMenu);
}
