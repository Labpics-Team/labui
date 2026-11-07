/**
 * Центрированное окно размеров s/m/l. Zag задаёт ARIA, закрытие, блокировку фона,
 * trap и возврат фокуса. modal="false" сохраняет немодальный режим.
 *
 * LabModal размещает поверхность в manual popover внутри исходного CSS-контекста.
 * Узлы slot="content" физически входят в поддерево trap: Zag не обходит assigned
 * slots при поиске tabbable. На сервере floating content не создаётся.
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

  /* Zag блокирует pointer-events фона. Подложка принимает outside click,
     positioner пропускает его, а content сохраняет Zag pointer-events:auto.
     Политику outside-dismiss для Dialog/AlertDialog определяет машина. */
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

  /* Содержимое остаётся в дереве потребителя и проецируется нативным slot. */
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
          <div class="body" part="body"><slot name="content"></slot></div>
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
