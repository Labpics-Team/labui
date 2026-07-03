import * as tabsMachine from '@zag-js/tabs';
/**
 * `<lab-tabs>` — the first COMPOUND component that consumes a GROUP machine
 * through the Behaviors seam (core-CONTRACT §1). This is the canonical compound
 * pattern for LabUI group widgets (it lands together with Radio).
 *
 * Axes (the Figma Tabs model — Orientation × Size × Activation):
 *   - orientation: horizontal | vertical   (list axis; reflected for layout)
 *   - size:  s | m | l                      (trigger density; reflected)
 *   - activationMode: automatic | manual    (select-on-focus vs select-on-Enter)
 *   - value: machine-owned selected tab (reflected for CSS + SSR)
 *   - defaultValue: uncontrolled initial selection (read once at machine init)
 *
 * Why a machine here, when Badge/Breadcrumb opt out: tabs HAVE interaction state
 * a machine owns — a selected `value`, ROVING focus across the triggers, arrow-key
 * navigation, `role="tablist"`/`tab`/`tabpanel` wiring, and automatic-vs-manual
 * activation. Those are precisely the listed machine-eligible states in
 * core-CONTRACT §1, so this element MUST drive the seam. It runs `@zag-js/tabs`
 * (a single GROUP machine) through `ZagController`: the machine owns selection,
 * keyboard, focus and ARIA; the element only paints (DIP — it depends on the
 * injected `MachineModule`, never on a hand-written tab controller).
 *
 * The compound canon (shared with Radio): ONE element runs ONE group machine and
 * owns ALL of its nodes in a single shadow root — the list, every trigger, every
 * panel — spreading the machine's per-node prop-getters (`getTriggerProps(value)`,
 * `getContentProps(value)`) onto them, exactly as `<lab-switch>` spreads
 * `getControlProps`/`getThumbProps`. Triggers are declared as the `items` array
 * (value + label); panel CONTENT projects from light DOM via a per-value named
 * slot (`slot="<value>"`), so rich content stays in the consumer's tree while the
 * machine-wired panel wrapper lives in the shadow root where Zag's id-based DOM
 * queries and focus management resolve. A `<lab-tab>`/`<lab-tab-panel>` light-DOM
 * split was rejected: its nodes would live OUTSIDE the shadow root the machine
 * scopes its queries to, breaking roving focus — the single-element compound is
 * the robust shape for a group machine.
 *
 * Token contract (core-CONTRACT §2): ONLY semantic --lab-* roles + dimension
 * tokens via `litVar`. The active trigger reads `--lab-label-accent` + an
 * `--lab-fill-accent` underline; idle triggers read `--lab-label-secondary`; the
 * list track is `--lab-border-base`. No hex, no primitive, no invented role.
 *
 * SSR (core-CONTRACT §7): structure is always present (the machine spreads ARIA
 * in `updated()`), so the declarative shadow DOM emits a meaningful, styled tab
 * set before any JS upgrades it.
 */
import { type TemplateResult, css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';

/** List axis. */
export type LabTabsOrientation = 'horizontal' | 'vertical';
/** Trigger density. */
export type LabTabsSize = 's' | 'm' | 'l';
/** When a focused tab activates: on focus (automatic) or on Enter/Space (manual). */
export type LabTabsActivationMode = 'automatic' | 'manual';

/** One tab: a stable `value`, a visible `label`, and an optional disabled flag. */
export interface LabTabItem {
  /** Stable identity of the tab — the machine's selection key + the slot name. */
  readonly value: string;
  /** Visible trigger text. */
  readonly label: string;
  /** Whether this tab cannot be selected. */
  readonly disabled?: boolean;
}

type TabsSchema = SchemaOf<tabsMachine.Service>;
type TabsApi = tabsMachine.Api;

/**
 * The `@zag-js/tabs` package seen through the renderer-agnostic seam — the SAME
 * binding pattern `<lab-switch>` uses for `@zag-js/switch`. No casts: the
 * namespace already matches `MachineModule` structurally.
 */
const tabsModule: MachineModule<TabsSchema, TabsApi> = tabsMachine;

export class LabTabs extends LabElement {
  static override properties = {
    orientation: { reflect: true },
    size: { reflect: true },
    activationMode: { attribute: 'activation-mode', reflect: true },
    /** Controlled selected value. When set, the consumer owns the selection. */
    value: { reflect: true },
    /** Uncontrolled initial selection — read once by the machine at init. */
    defaultValue: { attribute: 'default-value', reflect: true },
    /** The tabs to render. Set as a property (not an attribute). */
    items: { attribute: false },
  };

  declare orientation: LabTabsOrientation;
  declare size: LabTabsSize;
  declare activationMode: LabTabsActivationMode;
  declare value: string | null;
  declare defaultValue: string | null;
  declare items: ReadonlyArray<LabTabItem>;

  private readonly machineCtl: ZagController<TabsSchema, TabsApi>;

  constructor() {
    super();
    this.orientation = 'horizontal';
    this.size = 'm';
    this.activationMode = 'automatic';
    this.value = null;
    this.defaultValue = null;
    this.items = [];
    // Wire the Zag tabs behavior. Props read from reflected attributes so the
    // machine and the element never disagree. `value` is passed only when the
    // consumer set it (controlled); otherwise the machine owns it from
    // `defaultValue` (uncontrolled) — the SAME honest two-mode contract as Switch.
    this.machineCtl = this.runMachine(tabsModule, () => ({
      value: this.hasAttribute('value') ? this.value : undefined,
      defaultValue: this.defaultValue ?? undefined,
      orientation: this.orientation,
      activationMode: this.activationMode,
      onValueChange: (details: tabsMachine.ValueChangeDetails) => {
        this.value = details.value;
        this.dispatchEvent(
          new CustomEvent<tabsMachine.ValueChangeDetails>('value-change', {
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
      --_gap: ${litVar('--lab-space-xs', '0.25rem')};
      --_pad-x: ${litVar('--lab-space-md', '1rem')};
      --_pad-y: ${litVar('--lab-space-sm', '0.5rem')};
      --_font: ${litVar('--lab-font-size-md', '1rem')};

      display: block;
    }

    :host([size='s']) {
      --_pad-x: ${litVar('--lab-space-sm', '0.5rem')};
      --_pad-y: ${litVar('--lab-space-xs', '0.25rem')};
      --_font: ${litVar('--lab-font-size-xs', '0.8333rem')};
    }
    :host([size='l']) {
      --_pad-x: ${litVar('--lab-space-lg', '1.5rem')};
      --_pad-y: ${litVar('--lab-space-md', '1rem')};
      --_font: ${litVar('--lab-font-size-lg', '1.2rem')};
    }

    .root {
      display: flex;
      flex-direction: column;
      gap: ${litVar('--lab-space-md', '1rem')};
    }
    :host([orientation='vertical']) .root {
      flex-direction: row;
    }

    /* The Zag list element — the tablist track. */
    .list {
      display: flex;
      flex-direction: row;
      gap: var(--_gap);
      border-bottom: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-base')};
    }
    :host([orientation='vertical']) .list {
      flex-direction: column;
      border-bottom: none;
      border-inline-end: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-base')};
    }

    /* The Zag trigger element — one button per tab. */
    .trigger {
      appearance: none;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--_gap);
      margin: 0;
      padding: var(--_pad-y) var(--_pad-x);
      border: none;
      background: transparent;
      /* The selected underline rides on this transparent border so layout never
         shifts between idle and selected (craft-frontend P4 / CLS). */
      border-bottom: ${litVar('--lab-stroke-thick')} solid transparent;
      font: inherit;
      font-size: var(--_font);
      line-height: ${litVar('--lab-line-height-md', '1.5')};
      font-weight: ${litVar('--lab-font-weight-semibold', '600')};
      color: ${litVar('--lab-label-secondary')};
      white-space: nowrap;
      cursor: pointer;
      transition: color 120ms ease, border-color 120ms ease;
    }
    :host([orientation='vertical']) .trigger {
      justify-content: flex-start;
      border-bottom: none;
      border-inline-end: ${litVar('--lab-stroke-thick')} solid transparent;
      margin-inline-end: -0.0625rem;
    }

    .trigger:hover:not([data-disabled]) {
      color: ${litVar('--lab-label-primary')};
    }

    /* Selected: the machine sets data-selected; paint the accent label + underline. */
    .trigger[data-selected] {
      color: ${litVar('--lab-label-accent')};
      border-bottom-color: ${litVar('--lab-fill-accent')};
    }
    :host([orientation='vertical']) .trigger[data-selected] {
      border-bottom-color: transparent;
      border-inline-end-color: ${litVar('--lab-fill-accent')};
    }

    .trigger[data-disabled] {
      color: ${litVar('--lab-label-tertiary')};
      cursor: not-allowed;
    }

    /* Focus is roving (machine-driven); draw the ring on the focused trigger. */
    .trigger:focus-visible {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: calc(-1 * ${litVar('--lab-focus-ring-offset')});
      border-radius: ${litVar('--lab-radius-control', '0.5rem')};
    }

    /* The Zag content element — one panel per tab. */
    .panel {
      flex: 1 1 auto;
      min-width: 0;
      color: ${litVar('--lab-label-primary')};
      font: inherit;
      font-size: ${litVar('--lab-font-size-md', '1rem')};
      letter-spacing: ${litVar('--lab-letter-spacing-md', '-0.011em')};
      line-height: ${litVar('--lab-line-height-md', '1.5')};
    }
    .panel:focus-visible {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: ${litVar('--lab-focus-ring-offset')};
      border-radius: ${litVar('--lab-radius-control', '0.5rem')};
    }
    /* Unselected panels are hidden by the machine (it sets [hidden]); this is a
       belt-and-braces fallback so first paint never flashes every panel. */
    .panel[hidden] {
      display: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .trigger {
        transition: none;
      }
    }
  `;

  override updated(): void {
    // Apply the machine's connect props onto the real shadow nodes (roles, ARIA,
    // roving tabindex, keyboard + click handlers). Unlike Switch we do NOT
    // `clearSpreads()` between renders: `spreadProps` keeps a per-node diff and
    // both swaps event listeners AND removes attributes that drop out of the props
    // (e.g. `data-selected` when a tab is deselected). Calling its cleanup each
    // render would reset that diff, leaving stale `data-selected` on the old tab.
    // The accumulated cleanups run once on disconnect (ZagController.hostDisconnected).
    const api = this.machineCtl.api;
    const root = this.renderRoot.querySelector<HTMLElement>('.root');
    const list = this.renderRoot.querySelector<HTMLElement>('.list');
    if (root) this.machineCtl.spread(root, api.getRootProps());
    if (list) this.machineCtl.spread(list, api.getListProps());

    // Map machine props onto nodes by STABLE value, not by position. `render()`
    // keys both lists with `repeat(..., i => i.value, ...)`, so a node keeps its
    // identity across reorders; here we resolve each node by its own
    // `data-value` marker (the SAME identity key) rather than a fragile index —
    // a reorder can never spread one tab's props onto another tab's node.
    for (const item of this.items) {
      const selector = `[data-item-value="${CSS.escape(item.value)}"]`;
      const trigger = this.renderRoot.querySelector<HTMLElement>(`.trigger${selector}`);
      const panel = this.renderRoot.querySelector<HTMLElement>(`.panel${selector}`);
      if (trigger) {
        this.machineCtl.spread(
          trigger,
          api.getTriggerProps({ value: item.value, disabled: item.disabled }),
        );
      }
      if (panel) this.machineCtl.spread(panel, api.getContentProps({ value: item.value }));
    }
  }

  override render(): TemplateResult {
    // Structure only; behavior (roles, aria-selected, roving focus, keyboard) is
    // spread in `updated()` from the machine. Panel content projects from light
    // DOM through a per-value named slot, so rich content stays in the consumer's
    // tree while the machine-wired wrapper lives here in the shadow root.
    // Keyed by `value` (Lit `repeat`) so a node's identity is its tab, never its
    // position — reordering `items` moves the right DOM node instead of leaving a
    // node to receive a sibling's machine props. `data-item-value` is the stable
    // marker `updated()` resolves each node by (present at first paint, before any
    // machine spread runs).
    return html`
      <div class="root">
        <div class="list">
          ${repeat(
            this.items,
            (item) => item.value,
            (item) =>
              html`<button class="trigger" type="button" data-item-value=${item.value}>
                ${item.label}
              </button>`,
          )}
        </div>
        ${repeat(
          this.items,
          (item) => item.value,
          (item) =>
            html`<div class="panel" data-item-value=${item.value}>
              <slot name=${item.value}></slot>
            </div>`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-tabs': LabTabs;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-tabs')) {
  customElements.define('lab-tabs', LabTabs);
}
