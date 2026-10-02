import * as tooltipMachine from '@zag-js/tooltip';
/**
 * `<lab-tooltip>` — the FIRST positioned-overlay component, and the canon every
 * later overlay (Popover, Menu, Select, Dialog) follows.
 *
 * Axes (the Figma model — Placement × Size × Delay × State):
 *   - placement:  where the floating layer sits relative to the trigger
 *                 (top|right|bottom|left, optionally -start|-end). Machine-owned
 *                 via Zag popper (Floating UI); reflected for CSS hooks.
 *   - size:       s | m | l — content padding, font-size and max-width.
 *   - openDelay / closeDelay: hover/focus debounce, owned by the machine.
 *   - disabled:   the machine never opens.
 *
 * Why a machine: a tooltip is pure interaction state a state machine owns — an
 * open lifecycle on hover/focus, `role="tooltip"` + `aria-describedby`, Escape to
 * dismiss, and (the hard part) DYNAMIC POSITIONING against the trigger. Hand-
 * rolling any of that is exactly the platform/Zag machinery Button declined to
 * rebuild. So this element runs `@zag-js/tooltip` through `ZagController`.
 *
 * ── The overlay canon (Lit half) ──────────────────────────────────────────────
 * The trigger, positioner and content ALL live inside this element's shadow root.
 * Two consequences, both deliberate:
 *   1. STYLE ENCAPSULATION. The floating surface reads the same `--lab-*` roles in
 *      the same shadow scope as every other LabUI element — no global stylesheet,
 *      no portal that strips the shadow styles off the content.
 *   2. SCOPED DOM. Zag queries the DOM through `getRootNode`; `ZagController`
 *      points that at THIS shadow root, so the machine finds the trigger /
 *      positioner / content / arrow by id inside the component, never the document.
 * To escape ancestor `overflow:hidden` and stacking contexts WITHOUT a portal, the
 * positioner uses `strategy: 'fixed'` (viewport-relative) — Floating UI then writes
 * `--x` / `--y` straight onto the positioner each frame and the surface tracks the
 * trigger anywhere on the page. (React's twin reaches the same guarantee with a
 * body portal; the machine + positioning config are identical — parity is CSS, not
 * a second behaviour.)
 *
 * Token contract (core-CONTRACT §2): ONLY semantic `--lab-*` roles. The surface is
 * the inverted role (`--lab-bg-inverted` + `--lab-label-inverted-primary`) — the
 * conventional high-contrast tooltip — lifted with `--lab-fx-shadow-minor` and
 * layered with `--lab-z-tooltip`. The arrow reuses the same surface role so it
 * reads as one shape. No hex, no primitive, no invented role, and no literal
 * fallback on a colour role (css.ts: a missing role is a contract bug, not
 * something to paper over with a baked-in colour).
 *
 * SSR (core-CONTRACT §7): a tooltip is client-only. The server emits the trigger
 * and a `hidden` content node (the machine spreads `hidden`/ARIA on the client);
 * there is no flash and no work done before interaction.
 */
import { type TemplateResult, css, html } from 'lit';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';

/** Where the floating layer sits relative to the trigger (Zag popper placement). */
export type LabTooltipPlacement = tooltipMachine.Placement;
/** Control size — drives content padding, font-size and max-width. */
export type LabTooltipSize = 's' | 'm' | 'l';

type TooltipSchema = SchemaOf<tooltipMachine.Service>;
type TooltipApi = tooltipMachine.Api;

/**
 * The `@zag-js/tooltip` package seen through the renderer-agnostic seam — the SAME
 * binding the React twin consumes. Naming it pins the `MachineModule` contract so
 * the controller is fully typed with no casts.
 */
const tooltipModule: MachineModule<TooltipSchema, TooltipApi> = tooltipMachine;

/** Per-instance machine id source. The tooltip machine REQUIRES an id (it keys a
 * global single-open store on it), unlike a self-contained control like Switch.
 * Overlays are client-only, so a simple client counter is SSR-safe. */
let tooltipInstanceSeq = 0;

export class LabTooltip extends LabElement {
  static override properties = {
    placement: { reflect: true },
    size: { reflect: true },
    /** Tooltip body text (the simple case). For rich content use slot="content". */
    content: {},
    /** Delay in ms before the tooltip opens on hover/focus. */
    openDelay: { type: Number, attribute: 'open-delay' },
    /** Delay in ms before the tooltip closes. */
    closeDelay: { type: Number, attribute: 'close-delay' },
    /** When true, the machine never opens. */
    disabled: { type: Boolean, reflect: true },
    /** Whether to render the pointing arrow. */
    arrow: { type: Boolean, reflect: true },
  };

  declare placement: LabTooltipPlacement;
  declare size: LabTooltipSize;
  declare content: string;
  declare openDelay: number;
  declare closeDelay: number;
  declare disabled: boolean;
  declare arrow: boolean;

  private readonly machineCtl: ZagController<TooltipSchema, TooltipApi>;
  /** Stable machine id — the tooltip machine requires one (global open store). */
  private readonly machineId = `lab-tooltip-${++tooltipInstanceSeq}`;

  constructor() {
    super();
    this.placement = 'bottom';
    this.size = 'm';
    this.content = '';
    this.openDelay = 400;
    this.closeDelay = 150;
    this.disabled = false;
    this.arrow = true;
    // Wire the Zag tooltip behavior. `strategy: 'fixed'` is the overlay canon —
    // the positioner is viewport-relative so it escapes clipping/stacking
    // ancestors with the content staying inside the shadow root (no portal).
    this.machineCtl = this.runMachine(tooltipModule, () => ({
      id: this.machineId,
      openDelay: this.openDelay,
      closeDelay: this.closeDelay,
      disabled: this.disabled,
      positioning: { placement: this.placement, strategy: 'fixed' },
      onOpenChange: (details: tooltipMachine.OpenChangeDetails) => {
        this.dispatchEvent(
          new CustomEvent<tooltipMachine.OpenChangeDetails>('open-change', {
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
      /* Size knobs the size axis maps onto. Dimension tokens carry a literal
         fallback so the surface is usable before tokens load; colour roles never
         do (css.ts rule). */
      --_pad-block: ${litVar('--lab-space-xs', '0.25rem')};
      --_pad-inline: ${litVar('--lab-space-sm', '0.5rem')};
      --_font: ${litVar('--lab-font-size-xs', '0.8333rem')};
      --_max-width: ${litVar('--lab-size-overlay-18', '18rem')};

      display: inline-flex;
      vertical-align: middle;
    }

    :host([size='s']) {
      --_pad-block: ${litVar('--lab-space-xs', '0.25rem')};
      --_pad-inline: ${litVar('--lab-space-xs', '0.25rem')};
      --_font: ${litVar('--lab-font-size-xxs', '0.6944rem')};
      --_max-width: ${litVar('--lab-size-overlay-14', '14rem')};
    }
    :host([size='l']) {
      --_pad-block: ${litVar('--lab-space-sm', '0.5rem')};
      --_pad-inline: ${litVar('--lab-space-md', '1rem')};
      --_font: ${litVar('--lab-font-size-md', '1rem')};
      --_max-width: ${litVar('--lab-size-overlay-22', '22rem')};
    }

    /* The trigger is the Zag trigger element — a real button so hover, focus and
       keyboard all land on one accessible target (the machine spreads role/aria/
       handlers here). It carries no surface of its own; it only wraps the slotted
       label or icon. */
    .trigger {
      display: inline-flex;
      align-items: center;
      gap: ${litVar('--lab-space-xs', '0.25rem')};
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      color: inherit;
      cursor: default;
    }
    .trigger:focus-visible {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: ${litVar('--lab-focus-ring-offset')};
      border-radius: ${litVar('--lab-radius-xs', '0.25rem')};
    }

    /* The Zag positioner — Floating UI writes position via --x/--y and layers it
       from the content's computed z-index (mirrored into --z-index by popper). */
    .positioner {
      /* No surface here; it is only the positioning frame. */
    }

    /* The floating surface — the conventional inverted, high-contrast tooltip. The
       arrow reuses the same surface role so the shape reads as one. */
    .content {
      --arrow-size: ${litVar('--lab-space-sm', '0.5rem')};
      --arrow-background: ${litVar('--lab-bg-inverted')};

      box-sizing: border-box;
      max-width: var(--_max-width);
      padding: var(--_pad-block) var(--_pad-inline);
      border-radius: ${litVar('--lab-radius-s', '0.375rem')};
      background-color: ${litVar('--lab-bg-inverted')};
      color: ${litVar('--lab-label-inverted-primary')};
      font: inherit;
      font-size: var(--_font);
      line-height: ${litVar('--lab-line-height-xs', '1.0006')};
      box-shadow: var(--lab-elevation-overlay);
      z-index: ${litVar('--lab-z-tooltip', '1400')};
    }
    .content[hidden] {
      display: none;
    }

    /* The Zag arrow + tip. The tip inherits --arrow-background, so it is the same
       surface visually fused to the content. */
    .arrow {
      --arrow-size: ${litVar('--lab-space-sm', '0.5rem')};
    }
    .arrow-tip {
      border-top-left-radius: ${litVar('--lab-stroke-hairline', '0.0625rem')};
    }
  `;

  override updated(): void {
    // Apply the machine's connect props onto the real shadow nodes (trigger
    // role/aria/handlers, positioner style, content hidden/role/id, arrow). Clear
    // prior spreads first so listeners and props never stack across renders. The
    // positioner's --x/--y (written directly by Floating UI) survive because the
    // floating style string is invariant across renders, so spreadProps skips it.
    this.machineCtl.clearSpreads();
    const api = this.machineCtl.api;
    const root = this.renderRoot;
    const trigger = root.querySelector<HTMLElement>('.trigger');
    const positioner = root.querySelector<HTMLElement>('.positioner');
    const content = root.querySelector<HTMLElement>('.content');
    const arrow = root.querySelector<HTMLElement>('.arrow');
    const arrowTip = root.querySelector<HTMLElement>('.arrow-tip');
    if (trigger) this.machineCtl.spread(trigger, api.getTriggerProps());
    if (positioner) this.machineCtl.spread(positioner, api.getPositionerProps());
    if (content) this.machineCtl.spread(content, api.getContentProps());
    if (this.arrow && arrow) this.machineCtl.spread(arrow, api.getArrowProps());
    if (this.arrow && arrowTip) this.machineCtl.spread(arrowTip, api.getArrowTipProps());
  }

  override render(): TemplateResult {
    // Structure only; behaviour (open state, role=tooltip, aria-describedby,
    // hover/focus, Escape, positioning) is spread in updated() from the machine.
    return html`
      <button class="trigger" type="button" part="trigger"><slot></slot></button>
      <div class="positioner" part="positioner">
        <div class="content" part="content" hidden>
          <slot name="content">${this.content}</slot>
          ${
            this.arrow
              ? html`<span class="arrow" part="arrow"><span class="arrow-tip" part="arrow-tip"></span></span>`
              : null
          }
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-tooltip': LabTooltip;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-tooltip')) {
  customElements.define('lab-tooltip', LabTooltip);
}
