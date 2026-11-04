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
import { type TemplateResult, css, html } from 'lit';
import { litVar } from '../../css.js';
import { LabModal, type ModalRole } from './modal.js';

/** Control size — drives panel width band and padding. */
export type LabDialogSize = 's' | 'm' | 'l';
/** The dialog's ARIA role. `alertdialog` is the stricter variant (see `<lab-alert-dialog>`). */
export type LabDialogRole = ModalRole;

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
    border-radius: ${litVar('--lab-radius-m', '0.5rem')};
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
    border-radius: ${litVar('--lab-radius-xs', '0.25rem')};
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

/** Dialog передаёт общему владельцу модальности свою геометрию и оформление. */
export class LabDialog extends LabModal {
  static override properties = {
    size: { reflect: true },
  };

  declare size: LabDialogSize;

  constructor() {
    super();
    this.size = 'm';
  }

  protected override get portalStyleSheets(): CSSStyleSheet[] {
    return [dialogFloatingStyles.styleSheet as CSSStyleSheet];
  }

  protected override get portalAttributes(): Readonly<Record<string, string>> {
    return { 'data-size': this.size };
  }

  protected override floatingTemplate(): TemplateResult {
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
