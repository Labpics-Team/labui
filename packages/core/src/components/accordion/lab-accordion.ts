import * as accordionMachine from '@zag-js/accordion';
/**
 * `<lab-accordion>` — a COMPOUND component that consumes the `@zag-js/accordion`
 * GROUP machine through the Behaviors seam (core-CONTRACT §1). It follows the
 * compound canon established by `<lab-radio-group>` / `<lab-tabs>`: ONE custom
 * element runs ONE group machine and owns ALL of its parts in a single shadow
 * root — the root, and per item a trigger (header button), an indicator, and a
 * content region.
 *
 * Why a machine here (Card opts out, Accordion does not): an accordion HAS
 * interaction state a machine owns — which panels are `expanded`, single-vs-multi
 * open, collapsible-or-not, `aria-expanded`/`role="region"`/`aria-controls`/
 * `aria-labelledby` wiring, roving keyboard navigation across the headers
 * (Arrow/Home/End), and focus tracking. Those are precisely the machine-eligible
 * states in core-CONTRACT §1, so this element MUST drive the seam. It runs
 * `@zag-js/accordion` through `ZagController` (DIP — it depends on the injected
 * `MachineModule`, never on hand-written disclosure logic).
 *
 * Axes (the disclosure model — Multiple × Collapsible × Orientation × Size):
 *   - multiple:    one panel open at a time (false) vs many (true)
 *   - collapsible: whether the single open panel can be closed back to none
 *   - orientation: vertical | horizontal  (drives the arrow-key axis; reflected)
 *   - size:        s | m | l              (header density; reflected)
 *   - value:       machine-owned open values (controlled; a JS array property, not a reflected attribute)
 *   - defaultValue: uncontrolled initial open set (read once at machine init)
 *
 * Compound DOM (the same shape as Radio/Tabs): each item is rendered from the
 * `items` config (value + header label + disabled). The header button and its
 * content region both live in THIS shadow root — where Zag's id-based DOM queries
 * and focus management resolve — and rich panel CONTENT projects from light DOM
 * via a per-value named slot (`slot="<value>"`), so the consumer's tree keeps the
 * content while the machine-wired wrapper stays in shadow.
 *
 * KEYED-maapping by value (NOT index): both lists are keyed with
 * `repeat(items, i => i.value, ...)` and each node carries a stable
 * `data-item-value` marker; `updated()` resolves each node by that marker with
 * `CSS.escape`, so a reorder can never spread one item's machine props onto
 * another item's node. This is the round-1 lesson, enforced here.
 *
 * Token contract (core-CONTRACT §2): ONLY semantic --lab-* roles + dimension
 * tokens via `litVar`. The header label reads `--lab-label-primary`; the open
 * header reads `--lab-label-accent`; item dividers read `--lab-border-base`; the
 * focus ring reads `--lab-border-focus`. No hex, no primitive, no invented role.
 *
 * SSR (core-CONTRACT §7): structure is always present (the machine spreads ARIA
 * in `updated()`), so the declarative shadow DOM emits a meaningful, styled
 * accordion before any JS upgrades it.
 */
import { type TemplateResult, css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';

/** Arrow-key navigation axis across the headers. */
export type LabAccordionOrientation = 'vertical' | 'horizontal';
/** Header density. */
export type LabAccordionSize = 's' | 'm' | 'l';

/** One accordion panel: a stable `value`, a header `label`, and an optional disabled flag. */
export interface LabAccordionItem {
  /** Stable identity of the panel — the machine's open key + the slot name. */
  readonly value: string;
  /** Visible header (trigger) text. */
  readonly label: string;
  /** Whether this panel cannot be opened. */
  readonly disabled?: boolean;
}

type AccordionSchema = SchemaOf<accordionMachine.Service>;
type AccordionApi = accordionMachine.Api;

/**
 * The `@zag-js/accordion` package seen through the renderer-agnostic seam — the
 * SAME binding pattern `<lab-tabs>` uses for `@zag-js/tabs`. No casts: the
 * namespace already matches `MachineModule` structurally.
 */
const accordionModule: MachineModule<AccordionSchema, AccordionApi> = accordionMachine;

export class LabAccordion extends LabElement {
  static override properties = {
    orientation: { reflect: true },
    size: { reflect: true },
    /** Allow many panels open at once. */
    multiple: { type: Boolean, reflect: true },
    /** Allow the single open panel to close back to none. */
    collapsible: { type: Boolean, reflect: true },
    /** Group-level disable — every header becomes non-interactive. */
    disabled: { type: Boolean, reflect: true },
    /** Controlled open value(s). When set, the consumer owns the open state. */
    value: { attribute: false },
    /**
     * Uncontrolled initial open value(s) — read once by the machine at init. A
     * custom element can't carry an array in a plain attribute, so this is
     * primarily a JS PROPERTY; a comma-separated string attribute
     * (`default-value="what,how"`) is parsed for pure-HTML / SSR use, where it
     * must be present at upgrade time (the machine reads it once on connect).
     */
    defaultValue: {
      attribute: 'default-value',
      converter: {
        fromAttribute: (raw: string | null): string[] | null => parseValueList(raw),
      },
    },
    /** The panels to render. Set as a property (not an attribute). */
    items: { attribute: false },
  };

  declare orientation: LabAccordionOrientation;
  declare size: LabAccordionSize;
  declare multiple: boolean;
  declare collapsible: boolean;
  declare disabled: boolean;
  declare value: string[] | null;
  declare defaultValue: string[] | null;
  declare items: ReadonlyArray<LabAccordionItem>;

  private readonly machineCtl: ZagController<AccordionSchema, AccordionApi>;

  constructor() {
    super();
    this.orientation = 'vertical';
    this.size = 'm';
    this.multiple = false;
    this.collapsible = false;
    this.disabled = false;
    this.value = null;
    this.defaultValue = null;
    this.items = [];
    // Wire the Zag accordion behavior. `value` is passed only when the consumer
    // set it (controlled); otherwise the machine owns it from `defaultValue`
    // (uncontrolled) — the SAME honest two-mode contract as Tabs/Switch.
    this.machineCtl = this.runMachine(accordionModule, () => ({
      value: this.value ?? undefined,
      defaultValue: this.defaultValue ?? undefined,
      multiple: this.multiple,
      collapsible: this.collapsible,
      disabled: this.disabled,
      orientation: this.orientation,
      onValueChange: (details: accordionMachine.ValueChangeDetails) => {
        this.value = details.value;
        this.dispatchEvent(
          new CustomEvent<accordionMachine.ValueChangeDetails>('value-change', {
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

    /* The Zag root element — scopes the machine. */
    .root {
      display: flex;
      flex-direction: column;
      border: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-base')};
      border-radius: ${litVar('--lab-radius-card', '1rem')};
      overflow: hidden;
    }
    :host([orientation='horizontal']) .root {
      flex-direction: row;
    }

    /* One disclosure unit — the Zag item element. */
    .item {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    /* A divider between stacked items (vertical) — not after the last. */
    .item:not(:last-child) {
      border-bottom: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-base')};
    }
    :host([orientation='horizontal']) .item:not(:last-child) {
      border-bottom: none;
      border-inline-end: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-base')};
    }

    /* The header button — the Zag item-trigger element. */
    .trigger {
      appearance: none;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${litVar('--lab-space-sm', '0.5rem')};
      width: 100%;
      margin: 0;
      padding: var(--_pad-y) var(--_pad-x);
      border: none;
      background: transparent;
      font: inherit;
      font-size: var(--_font);
      line-height: ${litVar('--lab-line-height-md', '1.5')};
      font-weight: ${litVar('--lab-font-weight-semibold', '600')};
      text-align: start;
      color: ${litVar('--lab-label-primary')};
      cursor: pointer;
      transition: color var(--lab-motion-transition-duration) var(--lab-motion-transition-easing);
    }

    .trigger:hover:not([data-disabled]) {
      color: ${litVar('--lab-label-accent')};
    }
    /* Open header reads the accent label (machine sets data-state=open). */
    .trigger[data-state='open'] {
      color: ${litVar('--lab-label-accent')};
    }
    .trigger[data-disabled] {
      color: ${litVar('--lab-label-tertiary')};
      cursor: not-allowed;
    }
    .trigger:focus-visible {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: calc(-1 * ${litVar('--lab-focus-ring-offset')});
    }

    /* The chevron — the Zag item-indicator element. Rotates on open. */
    .indicator {
      flex: none;
      display: inline-flex;
      width: 0.75em;
      height: 0.75em;
      color: currentColor;
      transition: transform var(--lab-motion-transition-duration) var(--lab-motion-transition-easing);
    }
    .indicator svg {
      width: 100%;
      height: 100%;
    }
    .indicator[data-state='open'] {
      transform: rotate(180deg);
    }

    /* The panel — the Zag item-content element. Hidden by the machine when closed. */
    .content {
      padding: 0 var(--_pad-x) var(--_pad-y);
      color: ${litVar('--lab-label-secondary')};
      font: inherit;
      font-size: ${litVar('--lab-font-size-md', '1rem')};
      letter-spacing: ${litVar('--lab-letter-spacing-md', '-0.0083em')};
      line-height: ${litVar('--lab-line-height-md', '1.5')};
    }
    /* The machine sets [hidden] on closed panels; belt-and-braces so first paint
       never flashes every panel before the machine upgrades. */
    .content[hidden] {
      display: none;
    }
  `;

  override firstUpdated(): void {
    // Focus-before-toggle guard (WebKit). The `@zag-js/accordion` machine only
    // accepts `TRIGGER.CLICK` in its `focused` state; the trigger reaches that
    // state via the `focus` event (`onFocus` → `TRIGGER.FOCUS`). On Chromium a
    // native click focuses the <button> first, so a click already arrives in the
    // `focused` state and toggles. WebKit (the engine, on every OS) does NOT focus
    // a <button> on click — Zag compensates with `event.currentTarget.focus()` in
    // its own `onClick`, but ONLY when `isSafari()` is true, and `isSafari()`
    // checks `navigator.platform`/`vendor`, which are not "Apple" under Playwright
    // WebKit (platform = "Win32"). So the workaround never runs there, the click
    // lands in `idle`, and the panel never toggles (verified: focus event fires on
    // click but WebKit blurs the button before the click handler, so even a
    // pointerdown-focus is undone; only synchronous focus inside the same click
    // dispatch survives). We restore that guarantee engine-agnostically: a single
    // capture-phase `click` listener on the stable `.root` focuses the trigger —
    // synchronously, in the same click dispatch — BEFORE Zag's bubble-phase
    // `onClick` runs, but only when the engine has not already focused it. On
    // Chromium the trigger is already the active element, so this is a no-op. One
    // delegated listener covers every trigger and survives re-renders; it is
    // removed with the shadow root on disconnect, so no explicit cleanup is needed.
    const root = this.renderRoot.querySelector<HTMLElement>('.root');
    root?.addEventListener('click', this.focusTriggerBeforeToggle, true);
  }

  /**
   * Capture-phase handler: if the clicked trigger is not yet the active element
   * (WebKit does not focus a <button> on click), focus it now so Zag's `onFocus`
   * moves the machine into the `focused` state before the bubbling `TRIGGER.CLICK`
   * is processed. No-op on engines that already focused the trigger (Chromium).
   */
  private readonly focusTriggerBeforeToggle = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const trigger = target?.closest<HTMLButtonElement>('.trigger');
    if (trigger && this.shadowRoot?.activeElement !== trigger) {
      trigger.focus();
    }
  };

  override updated(): void {
    // Apply the machine's connect props onto the real shadow nodes (roles, ARIA,
    // keyboard + click handlers, data-state). Like Tabs we do NOT `clearSpreads()`
    // between renders: `spreadProps` keeps a per-node diff that swaps listeners
    // AND removes attributes that drop out (e.g. `data-state` flipping
    // open→closed). Clearing each render would reset that diff and leave stale
    // state attributes. Accumulated cleanups run once on disconnect.
    const api = this.machineCtl.api;
    const root = this.renderRoot.querySelector<HTMLElement>('.root');
    if (root) this.machineCtl.spread(root, api.getRootProps());

    // Map machine props onto nodes by STABLE value, not by position. `render()`
    // keys the list with `repeat(..., i => i.value, ...)`, so a node keeps its
    // identity across reorders; here we resolve each node by its own
    // `data-item-value` marker (the SAME identity key) — a reorder can never
    // spread one item's props onto another item's node (round-1 lesson).
    for (const item of this.items) {
      const itemProps = { value: item.value, disabled: item.disabled };
      const selector = `[data-item-value="${CSS.escape(item.value)}"]`;
      const itemEl = this.renderRoot.querySelector<HTMLElement>(`.item${selector}`);
      const trigger = this.renderRoot.querySelector<HTMLElement>(`.trigger${selector}`);
      const indicator = this.renderRoot.querySelector<HTMLElement>(`.indicator${selector}`);
      const content = this.renderRoot.querySelector<HTMLElement>(`.content${selector}`);
      if (itemEl) this.machineCtl.spread(itemEl, api.getItemProps(itemProps));
      if (trigger) this.machineCtl.spread(trigger, api.getItemTriggerProps(itemProps));
      if (indicator) this.machineCtl.spread(indicator, api.getItemIndicatorProps(itemProps));
      if (content) this.machineCtl.spread(content, api.getItemContentProps(itemProps));
    }
  }

  override render(): TemplateResult {
    // Structure only; behavior (roles, aria-expanded, aria-controls, keyboard) is
    // spread in `updated()` from the machine. Panel content projects from light
    // DOM through a per-value named slot, so rich content stays in the consumer's
    // tree while the machine-wired wrapper lives here in the shadow root. Keyed by
    // `value` so a node's identity is its panel, never its position.
    return html`
      <div class="root">
        ${repeat(
          this.items,
          (item) => item.value,
          (item) => html`
            <div class="item" data-item-value=${item.value}>
              <button class="trigger" type="button" data-item-value=${item.value}>
                <span class="trigger-label">${item.label}</span>
                <span class="indicator" data-item-value=${item.value}>
                  <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path
                      d="M2.5 4.5 6 8l3.5-3.5"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
              </button>
              <div class="content" data-item-value=${item.value}>
                <slot name=${item.value}>${nothing}</slot>
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }
}

/**
 * Parse a comma-separated `default-value` attribute into a typed open-value list.
 * Empty / absent input is null (the machine's "nothing open" signal); each entry
 * is trimmed and blanks are dropped, so `default-value="what, how"` opens both.
 */
function parseValueList(raw: string | null): string[] | null {
  if (raw === null) return null;
  const values = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return values.length > 0 ? values : null;
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-accordion': LabAccordion;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-accordion')) {
  customElements.define('lab-accordion', LabAccordion);
}
