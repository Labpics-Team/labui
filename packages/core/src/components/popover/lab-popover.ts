/**
 * `<lab-popover>` — the second positioned overlay, and the first DISMISSABLE,
 * FOCUS-MANAGED one. It extends the overlay canon set by `<lab-tooltip>` from a
 * passive hint to an interactive panel.
 *
 * Axes (the Figma model — Placement × Size × Modal × State):
 *   - placement:  where the panel sits relative to the trigger (Zag popper).
 *   - size:       s | m | l — panel padding and width band.
 *   - modal:      when true the machine traps focus (see the Lit focus-trap caveat
 *                 below), locks scroll and disables outside interaction; a scrim is
 *                 shown. When false it is a lightweight non-modal panel that dismisses
 *                 on outside-click/Esc.
 *   - closable:   render a built-in close button (the machine wires its handler).
 *
 * Why a machine: a popover is dense interaction state — open on click, focus moved
 * into the panel on open and RESTORED to the trigger on close, dismiss on Escape
 * or outside-click, optional focus trap + scroll lock when modal, `role="dialog"` +
 * `aria-modal` + `aria-labelledby`/`aria-describedby`, and dynamic positioning.
 * Every bit of that is the platform/Zag machinery LabUI consumes rather than
 * rebuilds. So this element runs `@zag-js/popover` through `ZagController`.
 *
 * ── The overlay canon (Lit half), continued ──────────────────────────────────
 * Trigger, positioner and content all live inside the shadow root (style
 * encapsulation; Zag's `getRootNode` scoped to it). The positioner uses
 * `strategy:'fixed'` to escape clipping/stacking ancestors without a portal, so the
 * machine is told `portalled:false` — the content already sits next to the trigger
 * in the shadow tree, not in a document portal. (The React twin sets
 * `portalled:true` and renders into a body portal; the dismiss + focus behaviour is
 * identical because both come from the machine.)
 *
 * ── Focus-trap caveat (Lit half) — READ BEFORE USING modal WITH SLOTTED CONTENT ──
 * Zag's modal trap runs `@zag-js/focus-trap` over the CONTENT element and finds
 * tabbables by walking that element's DOM subtree (`getShadowRoot:true` pierces
 * NESTED shadow roots, not the light DOM). In this Lit element the panel body arrives
 * through `<slot name="content">`, so slotted nodes physically live in the host's
 * LIGHT DOM, OUTSIDE the content's shadow subtree the trap walks. Consequence: a
 * focusable placed in `slot="content"` (e.g. a `<button>` or `<a>` you project in) is
 * NOT part of the trap and Tab can leave the panel through it. Focusables that DO live
 * in the shadow subtree — the built-in `closable` close button, the content element
 * itself (`tabindex=-1`) — ARE trapped, and `aria-modal`/scroll-lock/scrim still apply.
 * So a `modal` Lit popover with ONLY shadow-rendered focusables (the common case:
 * a message + the close button) traps correctly; one whose ONLY interactive controls
 * are slotted does not fully contain Tab.
 * If you need a hard trap around a focusable BODY, either render that control inside
 * the shadow tree (extend the element / use `closable`) or use the React `<Popover>`
 * twin, whose body-portal content lives in the trap's own DOM subtree and is trapped
 * correctly. This is a deliberate consequence of the shadow-DOM, no-portal canon
 * (style encapsulation), not a bug in the machine.
 *
 * Token contract (core-CONTRACT §2): ONLY semantic `--lab-*` roles. The panel is the
 * raised surface (`--lab-bg-secondary` + `--lab-label-primary`) with a `--lab-
 * border-soft` hairline, `--lab-fx-shadow-major` lift, and layering by
 * `--lab-z-dropdown` (non-modal) / `--lab-z-modal` (modal). The scrim is
 * `--lab-bg-overlay-base` at `--lab-z-modal-underlay`. No hex, no primitive, no
 * invented role, and no literal fallback on a colour role (css.ts: a missing
 * role is a contract bug, not something to paper over with a baked-in colour).
 *
 * SSR (core-CONTRACT §7): a popover is client-only. The server emits the trigger and
 * a `hidden` panel; the machine upgrades it on the client. No flash, no pre-work.
 */
import * as popoverMachine from '@zag-js/popover';
import { type TemplateResult, css, html } from 'lit';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';

/** Where the panel sits relative to the trigger (Zag popper placement). */
export type LabPopoverPlacement = popoverMachine.Placement;
/** Control size — drives panel padding and width band. */
export type LabPopoverSize = 's' | 'm' | 'l';

type PopoverSchema = SchemaOf<popoverMachine.Service>;
type PopoverApi = popoverMachine.Api;

/** The `@zag-js/popover` package seen through the renderer-agnostic seam. */
const popoverModule: MachineModule<PopoverSchema, PopoverApi> = popoverMachine;

/** Per-instance machine id source. Overlays are client-only, so a client counter
 * is SSR-safe; an explicit id keeps the machine's element ids deterministic. */
let popoverInstanceSeq = 0;

export class LabPopover extends LabElement {
  static override properties = {
    placement: { reflect: true },
    size: { reflect: true },
    /** When true: focus trap (over shadow-subtree focusables — see the slotted-content
     * caveat in the file header) + scroll lock + outside-interaction disabled + scrim. */
    modal: { type: Boolean, reflect: true },
    /** Render a built-in close button wired to the machine. */
    closable: { type: Boolean, reflect: true },
    /** Whether to render the pointing arrow. */
    arrow: { type: Boolean, reflect: true },
    /** Optional panel heading — wires aria-labelledby on the dialog. */
    heading: {},
    /** Optional panel description — wires aria-describedby on the dialog. */
    description: {},
  };

  declare placement: LabPopoverPlacement;
  declare size: LabPopoverSize;
  declare modal: boolean;
  declare closable: boolean;
  declare arrow: boolean;
  declare heading: string;
  declare description: string;

  private readonly machineCtl: ZagController<PopoverSchema, PopoverApi>;
  /** Stable machine id — keeps the dialog/title/description element ids deterministic. */
  private readonly machineId = `lab-popover-${++popoverInstanceSeq}`;

  constructor() {
    super();
    this.placement = 'bottom';
    this.size = 'm';
    this.modal = false;
    this.closable = false;
    this.arrow = true;
    this.heading = '';
    this.description = '';
    // Wire the Zag popover behavior. `portalled:false` because the content lives
    // in this shadow root (not a document portal); `strategy:'fixed'` is the
    // overlay canon for escaping clipping/stacking ancestors without one.
    this.machineCtl = this.runMachine(popoverModule, () => ({
      id: this.machineId,
      modal: this.modal,
      portalled: false,
      positioning: { placement: this.placement, strategy: 'fixed' },
      onOpenChange: (details: popoverMachine.OpenChangeDetails) => {
        this.dispatchEvent(
          new CustomEvent<popoverMachine.OpenChangeDetails>('open-change', {
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
      --_pad: ${litVar('--lab-space-md', '1rem')};
      --_min-width: 14rem;
      --_max-width: 22rem;

      display: inline-flex;
      vertical-align: middle;
    }

    :host([size='s']) {
      --_pad: ${litVar('--lab-space-sm', '0.5rem')};
      --_min-width: 11rem;
      --_max-width: 18rem;
    }
    :host([size='l']) {
      --_pad: ${litVar('--lab-space-lg', '1.5rem')};
      --_min-width: 18rem;
      --_max-width: 28rem;
    }

    /* The Zag trigger — a real button; the machine spreads aria-haspopup=dialog,
       aria-controls, aria-expanded, the toggle handler and focus restoration here. */
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
      cursor: pointer;
    }
    .trigger:focus-visible {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: ${litVar('--lab-focus-ring-offset')};
      border-radius: ${litVar('--lab-radius-sm', '0.25rem')};
    }

    /* Modal scrim — toggled in updated() from the machine's open state. */
    .backdrop {
      position: fixed;
      inset: 0;
      background-color: ${litVar('--lab-bg-overlay-base')};
      z-index: ${litVar('--lab-z-modal-underlay', '1100')};
    }
    .backdrop[hidden] {
      display: none;
    }

    /* The Zag positioner — Floating UI writes --x/--y here and mirrors the content
       z-index into --z-index for layering. */
    .positioner {
      /* positioning frame only */
    }

    /* The floating panel — raised surface with a hairline, lifted and layered. The
       arrow reuses the same surface role so it fuses to the panel edge. */
    .content {
      --arrow-size: 0.625rem;
      --arrow-background: ${litVar('--lab-bg-secondary')};

      box-sizing: border-box;
      position: relative;
      min-width: var(--_min-width);
      max-width: var(--_max-width);
      padding: var(--_pad);
      border-radius: ${litVar('--lab-radius-lg', '0.5rem')};
      background-color: ${litVar('--lab-bg-secondary')};
      color: ${litVar('--lab-label-primary')};
      border: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-soft')};
      box-shadow: var(--lab-elevation-overlay);
      font: inherit;
      font-size: ${litVar('--lab-font-size-md', '1rem')};
      letter-spacing: ${litVar('--lab-letter-spacing-md', '-0.0083em')};
      line-height: ${litVar('--lab-line-height-md', '1.5')};
      z-index: ${litVar('--lab-z-dropdown', '900')};
    }
    :host([modal]) .content {
      z-index: ${litVar('--lab-z-modal', '1200')};
    }
    .content[hidden] {
      display: none;
    }
    .content:focus-visible {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: ${litVar('--lab-focus-ring-offset')};
    }

    .heading {
      margin: 0 0 ${litVar('--lab-space-xs', '0.25rem')} 0;
      font-size: ${litVar('--lab-font-size-lg', '1.2rem')};
      letter-spacing: ${litVar('--lab-letter-spacing-lg', '-0.0194em')};
      line-height: ${litVar('--lab-line-height-md', '1.5')};
      color: ${litVar('--lab-label-primary')};
    }
    .description {
      margin: 0 0 ${litVar('--lab-space-sm', '0.5rem')} 0;
      color: ${litVar('--lab-label-secondary')};
    }

    /* Built-in close button, top-trailing corner of the panel. */
    .close {
      position: absolute;
      top: ${litVar('--lab-space-xs', '0.25rem')};
      right: ${litVar('--lab-space-xs', '0.25rem')};
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      padding: 0;
      border: 0;
      border-radius: ${litVar('--lab-radius-sm', '0.25rem')};
      background: none;
      color: ${litVar('--lab-label-secondary')};
      font-size: 1.125rem;
      line-height: 1;
      cursor: pointer;
    }
    .close:hover {
      background-color: ${litVar('--lab-fill-primary')};
      color: ${litVar('--lab-label-primary')};
    }
    .close:focus-visible {
      outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
      outline-offset: ${litVar('--lab-focus-ring-offset')};
    }

    .arrow {
      --arrow-size: 0.625rem;
    }
    .arrow-tip {
      border-top-left-radius: 0.0625rem;
    }
  `;

  override updated(): void {
    // Spread the machine's connect props onto the real shadow nodes. Clear prior
    // spreads first so listeners/props never stack; the positioner's Floating-UI
    // --x/--y survive because the floating style string is invariant across renders.
    this.machineCtl.clearSpreads();
    const api = this.machineCtl.api;
    const root = this.renderRoot;
    const trigger = root.querySelector<HTMLElement>('.trigger');
    const positioner = root.querySelector<HTMLElement>('.positioner');
    const content = root.querySelector<HTMLElement>('.content');
    const heading = root.querySelector<HTMLElement>('.heading');
    const description = root.querySelector<HTMLElement>('.description');
    const close = root.querySelector<HTMLElement>('.close');
    const arrow = root.querySelector<HTMLElement>('.arrow');
    const arrowTip = root.querySelector<HTMLElement>('.arrow-tip');
    const backdrop = root.querySelector<HTMLElement>('.backdrop');

    if (trigger) this.machineCtl.spread(trigger, api.getTriggerProps());
    if (positioner) this.machineCtl.spread(positioner, api.getPositionerProps());
    if (content) this.machineCtl.spread(content, api.getContentProps());
    if (heading) this.machineCtl.spread(heading, api.getTitleProps());
    if (description) this.machineCtl.spread(description, api.getDescriptionProps());
    if (this.closable && close) this.machineCtl.spread(close, api.getCloseTriggerProps());
    if (this.arrow && arrow) this.machineCtl.spread(arrow, api.getArrowProps());
    if (this.arrow && arrowTip) this.machineCtl.spread(arrowTip, api.getArrowTipProps());

    // The scrim is purely visual; the machine already blocks interaction. Drive its
    // visibility from the machine's open state (read here), never a hand-kept flag.
    if (backdrop) backdrop.toggleAttribute('hidden', !(this.modal && api.open));
  }

  override render(): TemplateResult {
    // Structure only; behaviour (open/close, dialog role, aria, focus management,
    // dismiss, positioning) is spread in updated() from the machine.
    return html`
      <button class="trigger" type="button" part="trigger"><slot></slot></button>
      <div class="backdrop" part="backdrop" hidden></div>
      <div class="positioner" part="positioner">
        <div class="content" part="content">
          ${this.heading ? html`<h2 class="heading" part="heading">${this.heading}</h2>` : null}
          ${
            this.description
              ? html`<p class="description" part="description">${this.description}</p>`
              : null
          }
          <slot name="content"></slot>
          ${
            this.closable
              ? html`<button class="close" type="button" part="close-trigger" aria-label="Close">×</button>`
              : null
          }
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
    'lab-popover': LabPopover;
  }
}

// Idempotent registration — safe across Lit SSR and client module instances.
if (typeof customElements !== 'undefined' && !customElements.get('lab-popover')) {
  customElements.define('lab-popover', LabPopover);
}
