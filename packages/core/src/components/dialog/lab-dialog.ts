/**
 * `<lab-dialog>` — the first TRUE modal overlay: a blocking task surface that owns
 * the screen until it is finished or dismissed. It extends the overlay canon set by
 * `<lab-tooltip>` (passive) and `<lab-popover>` (interactive, anchored) to the
 * centered, scrim-backed, focus-TRAPPING dialog.
 *
 * Axes (the Figma model — Size × Modal × State):
 *   - size:     s | m | l — panel width band and padding.
 *   - modal:    when true (the default for a dialog) the machine TRAPS focus, locks
 *               scroll, blocks + hides outside content, and a scrim is shown. When
 *               false it is a light non-modal panel (no trap, no scroll-lock) that
 *               still dismisses on Escape / outside-click.
 *   - closable: render a built-in close button (the machine wires its handler).
 *
 * Why a machine: a dialog is dense interaction state — open on trigger click, focus
 * MOVED into the panel on open and RESTORED to the trigger on close, dismiss on
 * Escape / outside-click, a real focus trap + scroll lock when modal, `role="dialog"`
 * + `aria-modal` + `aria-labelledby`/`aria-describedby`, and the content below hidden
 * from assistive tech. Every bit of that is the platform/Zag machinery LabUI consumes
 * rather than rebuilds. So this element runs `@zag-js/dialog` through `ZagController`.
 *
 * ── The overlay canon (Lit half), with a DELIBERATE break for a real trap ────────
 * `<lab-popover>` keeps its content inside the element's OWN shadow root (style
 * encapsulation, `getRootNode` scoped to that shadow). That has a documented cost:
 * Zag's modal trap walks the CONTENT element's DOM subtree, and content projected
 * through a `<slot>` physically lives in the host's LIGHT DOM — outside that subtree —
 * so a slotted focusable is NOT trapped and Tab can leave through it. For a popover
 * (a compact, hint-like panel) that caveat is acceptable. For a DIALOG it is not: a
 * modal with a focus leak is an a11y bug. A dialog MUST trap.
 *
 * So this element breaks the no-portal canon on purpose (lesson #22): the floating
 * layer — backdrop + positioner + content + heading/description/close — is rendered
 * into a DEDICATED PORTAL element appended to `document.body` (the Lit equivalent of
 * React's `createPortal(body)`), the portal carries its OWN shadow root with the
 * floating styles, and the machine's `getRootNode` for this instance is pointed at
 * THAT shadow root. The dialog body the consumer provides through `slot="content"` is
 * physically MOVED out of the host's light DOM and into the portal content element,
 * so it lives inside the very subtree the trap walks (`getShadowRoot:true` lets the
 * trap pierce the portal's shadow root). The result is a REAL focus trap around the
 * whole dialog body, slotted controls included — parity with the React twin.
 *
 * Focus RESTORE across the split roots: the trigger stays encapsulated/styled in THIS
 * element's shadow root; only the floating layer is portalled. On close the machine's
 * `setReturnFocus` resolves the node to focus — its trigger lookup runs through
 * `getRootNode` (the portal root), where the trigger does NOT live, so that path finds
 * nothing and the trap would fall back to the node captured before activation. On WebKit
 * that captured node is the portal-host `<div>` (non-focusable), so the fallback drops
 * focus instead of returning it to the trigger. We therefore hand the machine an explicit
 * `finalFocusEl` pointing at this element's own trigger; it is consulted FIRST and used by
 * reference, so Zag's own trap restores focus to the right node on every engine. See the
 * `finalFocusEl` wiring in the constructor.
 *
 * Token contract (core-CONTRACT §2): ONLY semantic `--lab-*` roles. The panel is the
 * raised surface (`--lab-bg-secondary` + `--lab-label-primary`) with a
 * `--lab-border-soft` hairline and a `--lab-fx-shadow-major` lift, layered at
 * `--lab-z-modal`; the scrim is `--lab-bg-overlay-base` at `--lab-z-modal-underlay`.
 * No hex, no primitive, no invented role. The portal carries the page's
 * `[data-theme]`/`[data-material]` (copied from `document.documentElement`) so the
 * portalled panel resolves the SAME role bindings as the rest of the page.
 *
 * SSR (core-CONTRACT §7): a dialog is client-only. The server emits the trigger and
 * nothing for the floating layer; the machine upgrades it on the client (the portal
 * is created on connect, after the DOM exists). No flash, no pre-work.
 */
import * as dialogMachine from '@zag-js/dialog';
import { type TemplateResult, css, html, render } from 'lit';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';

/** Control size — drives panel width band and padding. */
export type LabDialogSize = 's' | 'm' | 'l';
/** The dialog's ARIA role. `alertdialog` is the stricter variant (see `<lab-alert-dialog>`). */
export type LabDialogRole = 'dialog' | 'alertdialog';

type DialogSchema = SchemaOf<dialogMachine.Service>;
type DialogApi = dialogMachine.Api;

/** The `@zag-js/dialog` package seen through the renderer-agnostic seam. */
const dialogModule: MachineModule<DialogSchema, DialogApi> = dialogMachine;

/** Per-instance machine id source. Dialogs are client-only, so a client counter is
 * SSR-safe; an explicit id keeps the machine's element ids deterministic. */
let dialogInstanceSeq = 0;

/**
 * Styles for the floating layer, adopted by the PORTAL's shadow root (not the
 * element's own shadow). Authoring them here keeps the dialog's visual contract in
 * one file alongside the element. `:host` here refers to the portal element.
 */
export const dialogFloatingStyles = css`
  :host {
    --_pad: ${litVar('--lab-space-lg', '1.5rem')};
    --_min-width: ${litVar('--lab-size-overlay-18', '18rem')};
    --_max-width: ${litVar('--lab-size-overlay-32', '32rem')};
  }
  :host([data-size='s']) {
    --_pad: ${litVar('--lab-space-md', '1rem')};
    --_min-width: ${litVar('--lab-size-overlay-16', '16rem')};
    --_max-width: ${litVar('--lab-size-overlay-24', '24rem')};
  }
  :host([data-size='l']) {
    --_pad: ${litVar('--lab-space-xl', '2rem')};
    --_min-width: ${litVar('--lab-size-overlay-22', '22rem')};
    --_max-width: ${litVar('--lab-size-overlay-40', '40rem')};
  }

  /* Modal scrim — the machine toggles its hidden attribute from open state. */
  .backdrop {
    position: fixed;
    inset: 0;
    background-color: ${litVar('--lab-bg-overlay-base')};
    z-index: ${litVar('--lab-z-modal-underlay', '1100')};
  }
  .backdrop[hidden] {
    display: none;
  }

  /* The positioner centers the panel in the viewport (a dialog is NOT anchored to
     its trigger, so there is no Floating UI here). */
  .positioner {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${litVar('--lab-space-lg', '1.5rem')};
    z-index: ${litVar('--lab-z-modal', '1200')};
  }
  .positioner[hidden] {
    display: none;
  }

  /* Scrim hit-test restore (modal only). A modal locks the page with
     @zag-js/remove-scroll, which sets body { pointer-events: none }; that cascades
     down to this portal host (appended to document.body) and would make the whole
     floating layer transparent to clicks — an outside-click on the scrim would fall
     through to the document element and never reach Zag's document-level
     interact-outside listener, so the dialog could not be dismissed by clicking the
     scrim. The backdrop is the scrim: re-arm hit-testing on it so an outside click
     lands on a real node (a descendant pointer-events:auto re-enables hit-testing
     regardless of the inherited none) and Zag's interact-outside fires. The
     positioner sits ABOVE the backdrop (higher z-index) and fills the viewport, so it
     is kept transparent (pointer-events:none) for the modal case: a click in the
     frame around the panel passes THROUGH to the backdrop beneath, while the centered
     content keeps Zag's inline pointer-events:auto and stays interactive. For an
     alert-dialog the click still reaches the document listener, but the machine
     refuses outside-dismiss (closeOnInteractOutside = modal && !alertDialog = false),
     so it does not close — policy preserved. Non-modal is untouched: Zag already sets
     the positioner's pointer-events:none inline and renders no backdrop. */
  :host([data-modal='true']) .backdrop {
    pointer-events: auto;
  }
  :host([data-modal='true']) .positioner {
    pointer-events: none;
  }

  /* The dialog panel — raised surface, hairline, lifted. */
  .content {
    box-sizing: border-box;
    position: relative;
    width: 100%;
    min-width: var(--_min-width);
    max-width: var(--_max-width);
    max-height: calc(100vh - 2 * ${litVar('--lab-space-lg', '1.5rem')});
    overflow: auto;
    padding: var(--_pad);
    border-radius: ${litVar('--lab-radius-lg', '0.5rem')};
    background-color: ${litVar('--lab-bg-secondary')};
    color: ${litVar('--lab-label-primary')};
    border: ${litVar('--lab-stroke-hairline')} solid ${litVar('--lab-border-soft')};
    box-shadow: var(--lab-elevation-modal);
    font: inherit;
    font-size: ${litVar('--lab-font-size-md', '1rem')};
    letter-spacing: ${litVar('--lab-letter-spacing-md', '-0.0083em')};
    line-height: ${litVar('--lab-line-height-md', '1.5')};
  }
  .content[hidden] {
    display: none;
  }
  .content:focus-visible {
    outline: ${litVar('--lab-focus-ring-width')} solid ${litVar('--lab-border-focus')};
    outline-offset: ${litVar('--lab-focus-ring-offset')};
  }

  .heading {
    margin: 0 0 ${litVar('--lab-space-sm', '0.5rem')} 0;
    padding-right: ${litVar('--lab-space-xl', '2rem')};
    font-size: ${litVar('--lab-font-size-lg', '1.2rem')};
    letter-spacing: ${litVar('--lab-letter-spacing-lg', '-0.0194em')};
    line-height: ${litVar('--lab-line-height-md', '1.5')};
    color: ${litVar('--lab-label-primary')};
  }
  .description {
    margin: 0 0 ${litVar('--lab-space-md', '1rem')} 0;
    color: ${litVar('--lab-label-secondary')};
  }

  /* The relocated dialog body — the consumer's slot="content" nodes are MOVED here. */
  .body {
    display: block;
  }

  .close {
    position: absolute;
    top: ${litVar('--lab-space-md', '1rem')};
    right: ${litVar('--lab-space-md', '1rem')};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: ${litVar('--lab-space-7', '1.75rem')};
    height: ${litVar('--lab-space-7', '1.75rem')};
    padding: 0;
    border: 0;
    border-radius: ${litVar('--lab-radius-sm', '0.25rem')};
    background: none;
    color: ${litVar('--lab-label-secondary')};
    font-size: ${litVar('--lab-space-5', '1.25rem')};
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
`;

export class LabDialog extends LabElement {
  static override properties = {
    size: { reflect: true },
    /** Modal mode as a STRING attribute, defaulting to 'true' for a dialog. A Boolean
     * attribute can't express "default true, opt out" (absence would force false), so
     * this is the honest tri-state: 'true' | 'false', read into a boolean for the
     * machine. Reflected so SSR/CSS can read it. */
    modal: { reflect: true },
    /** Render a built-in close button wired to the machine. */
    closable: { type: Boolean, reflect: true },
    /** Optional dialog heading — wires aria-labelledby on the content. */
    heading: {},
    /** Optional dialog description — wires aria-describedby on the content. */
    description: {},
  };

  declare size: LabDialogSize;
  /** The raw `modal` attribute value ('true' | 'false'); read via `isModal`. */
  declare modal: string;
  declare closable: boolean;
  declare heading: string;
  declare description: string;

  /** Modal is on unless explicitly set to the string 'false'. One source of truth for
   * the boolean the machine and the scrim/styles read. */
  private get isModal(): boolean {
    return this.modal !== 'false';
  }

  /** This element's OWN trigger button (in this shadow root, NOT the portal). The
   * machine's `finalFocusEl` reads it lazily at close time to restore focus to it,
   * since the machine's getRootNode-scoped trigger lookup can't reach this root. */
  private get triggerEl(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.trigger');
  }

  /** The ARIA role the machine renders. Overridden to `alertdialog` by the subclass. */
  protected dialogRole: LabDialogRole = 'dialog';

  private readonly machineCtl: ZagController<DialogSchema, DialogApi>;
  /** Stable machine id — keeps the content/title/description element ids deterministic. */
  private readonly machineId = `lab-dialog-${++dialogInstanceSeq}`;

  /** The portal element appended to `document.body`; its shadow root holds the
   * floating layer + the relocated dialog body. */
  private portalHost?: HTMLElement;
  /** The portal's shadow root — the machine's `getRootNode` for this instance. */
  private portalRoot?: ShadowRoot;
  /** The `.body` mount inside the portal content where the consumer's slotted nodes
   * are relocated. Relocation happens once; the nodes then live in the trap subtree. */
  private bodyMount?: HTMLElement;
  /** Guard so the one-time relocation of slotted children runs exactly once. */
  private bodyRelocated = false;

  constructor() {
    super();
    this.size = 'm';
    this.modal = 'true';
    this.closable = true;
    this.heading = '';
    this.description = '';
    // Wire the Zag dialog behavior. `getRootNode` is the PORTAL's shadow root, where
    // the floating layer (and the relocated body) live, so the machine resolves
    // content/title/description/backdrop by id THERE. The trigger lives in a different
    // root; its behaviour is wired by the spread handler (not an id lookup).
    //
    // Return-focus across the split roots: on close, @zag-js/focus-trap asks the dialog
    // machine for the node to restore focus to (its `setReturnFocus`). That resolver
    // tries, in order, `finalFocusEl()`, then a trigger looked up via getRootNode —
    // `getTriggerEls(scope)` queries the PORTAL root, where the trigger does NOT live —
    // then the node captured before activation. With no finalFocusEl the trigger lookup
    // returns nothing (wrong root) and the fallback is used; on WebKit that captured node
    // is the portal-host <div> (non-focusable), so focus is lost instead of returning to
    // the trigger. `finalFocusEl` is consulted FIRST and used by reference (not re-queried
    // through getRootNode), so pointing it at THIS element's own trigger makes Zag's own
    // trap restore focus to the right node. The trap performs the single, final focus
    // write — there is no second `.focus()` from the element to race it.
    this.machineCtl = this.runMachine(dialogModule, () => ({
      id: this.machineId,
      role: this.dialogRole,
      modal: this.isModal,
      getRootNode: () => this.portalRoot ?? document,
      finalFocusEl: () => this.triggerEl,
      onOpenChange: (details: dialogMachine.OpenChangeDetails) => {
        this.dispatchEvent(
          new CustomEvent<dialogMachine.OpenChangeDetails>('open-change', {
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
      display: inline-flex;
      vertical-align: middle;
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
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.ensurePortal();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.portalHost?.remove();
    this.portalHost = undefined;
    this.portalRoot = undefined;
    this.bodyMount = undefined;
    this.bodyRelocated = false;
  }

  /** Create the portal element + shadow root once and append it to `document.body`. */
  private ensurePortal(): void {
    if (this.portalHost || typeof document === 'undefined') return;
    const host = document.createElement('div');
    host.setAttribute('data-lab-dialog-portal', this.machineId);
    host.setAttribute('data-size', this.size);
    // Mirror modal state so the floating styles can re-enable scrim hit-testing for
    // a modal (whose scroll-lock sets body{pointer-events:none}). See dialogFloatingStyles.
    host.setAttribute('data-modal', String(this.isModal));
    // Mirror the element's own test id onto the portal so a test can find the
    // portalled floating layer for a specific dialog (the floating layer lives in
    // document.body, detached from the element in the DOM tree).
    const ownTestId = this.getAttribute('data-testid');
    if (ownTestId) host.setAttribute('data-portal-for', ownTestId);
    // Mirror the page theme/material so the portalled panel resolves the same roles.
    const docEl = document.documentElement;
    const theme = docEl.getAttribute('data-theme');
    const material = docEl.getAttribute('data-material');
    if (theme) host.setAttribute('data-theme', theme);
    if (material) host.setAttribute('data-material', material);
    const root = host.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [dialogFloatingStyles.styleSheet as CSSStyleSheet];
    document.body.append(host);
    this.portalHost = host;
    this.portalRoot = root;
  }

  /** The floating subtree, rendered into the portal's shadow root. Structure only;
   * behaviour is spread in `updated()` from the machine. The `.body` mount is where
   * the consumer's relocated slot="content" nodes are appended (once). */
  private floatingTemplate(): TemplateResult {
    return html`
      <div class="backdrop" part="backdrop" hidden></div>
      <div class="positioner" part="positioner" hidden>
        <div class="content" part="content" hidden>
          ${this.heading ? html`<h2 class="heading" part="heading">${this.heading}</h2>` : null}
          ${
            this.description
              ? html`<p class="description" part="description">${this.description}</p>`
              : null
          }
          <div class="body" part="body"></div>
          ${
            this.closable
              ? html`<button class="close" type="button" part="close-trigger" aria-label="Close">×</button>`
              : null
          }
        </div>
      </div>
    `;
  }

  /** Move the consumer's `slot="content"` light-DOM children into the portal `.body`
   * exactly once, so they live inside the trap's subtree. Idempotent. */
  private relocateBody(): void {
    if (this.bodyRelocated || !this.bodyMount) return;
    const slotted = Array.from(this.children).filter(
      (child) => child.getAttribute('slot') === 'content',
    );
    for (const node of slotted) this.bodyMount.append(node);
    this.bodyRelocated = true;
  }

  override updated(): void {
    this.ensurePortal();
    const root = this.portalRoot;
    if (root) {
      render(this.floatingTemplate(), root);
      this.portalHost?.setAttribute('data-size', this.size);
      this.portalHost?.setAttribute('data-modal', String(this.isModal));
      this.bodyMount = root.querySelector<HTMLElement>('.body') ?? undefined;
      this.relocateBody();
    }

    // Spread the machine's connect props onto the real nodes — trigger in THIS shadow
    // root, the floating nodes in the portal root. Clear prior spreads first so
    // listeners/props never stack across renders.
    this.machineCtl.clearSpreads();
    const api = this.machineCtl.api;

    const trigger = this.renderRoot.querySelector<HTMLElement>('.trigger');
    if (trigger) this.machineCtl.spread(trigger, api.getTriggerProps());

    if (root) {
      const backdrop = root.querySelector<HTMLElement>('.backdrop');
      const positioner = root.querySelector<HTMLElement>('.positioner');
      const content = root.querySelector<HTMLElement>('.content');
      const heading = root.querySelector<HTMLElement>('.heading');
      const description = root.querySelector<HTMLElement>('.description');
      const close = root.querySelector<HTMLElement>('.close');

      if (backdrop) this.machineCtl.spread(backdrop, api.getBackdropProps());
      if (positioner) this.machineCtl.spread(positioner, api.getPositionerProps());
      if (content) this.machineCtl.spread(content, api.getContentProps());
      if (heading) this.machineCtl.spread(heading, api.getTitleProps());
      if (description) this.machineCtl.spread(description, api.getDescriptionProps());
      if (this.closable && close) this.machineCtl.spread(close, api.getCloseTriggerProps());

      // The positioner is a viewport-filling flex frame; gate its visibility on the
      // machine's open state so it never intercepts pointer events while closed.
      if (positioner) positioner.toggleAttribute('hidden', !api.open);
    }
  }

  override render(): TemplateResult {
    // The element's OWN shadow root holds ONLY the trigger; the floating layer lives
    // in the portal. The default slot keeps the consumer's slot="content" children in
    // the light DOM until `relocateBody()` moves them into the portal body.
    return html`
      <button class="trigger" type="button" part="trigger"><slot></slot></button>
      <slot name="content" hidden aria-hidden="true"></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-dialog': LabDialog;
  }
}

/**
 * Idempotent registration — safe across Lit SSR and client module instances. This is
 * exported (not run at module top level) and invoked from the BARREL (`index.ts`)
 * instead, because `<lab-alert-dialog>` extends `LabDialog`, so tsup hoists this class
 * into a SHARED chunk outside `dist/components/**`; a bare top-level side-effect there
 * would be tree-shaken by a consumer's bundler (the chunk is not in the package
 * `sideEffects` glob). Running it from the barrel keeps the registration in the
 * sideEffects-protected `dist/components/dialog/index.js`. See the barrel.
 */
export function registerLabDialog(): void {
  if (typeof customElements !== 'undefined' && !customElements.get('lab-dialog')) {
    customElements.define('lab-dialog', LabDialog);
  }
}
