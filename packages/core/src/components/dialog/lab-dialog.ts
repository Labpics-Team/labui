import { symbol as close } from '@labpics/icons/symbols/close';
import { materialCss } from '@labpics/ui-materials/css';
import { dialogProfile } from '@labpics/ui-tokens';
import { type PropertyDeclarations, css, html, nothing, unsafeCSS } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import { projectedSlotElements, projectedSlotNodes } from '../../slot-projection.js';
import type { LabButton } from '../button/lab-button.js';
import '../button/index.js';
import '../icon/index.js';
import {
  type DialogOptions,
  type LabDialogRole,
  type LabDialogSize,
  type LabPopoverPlacement,
  mountDialog,
} from './runtime.js';
import { dialogCss } from './styles.js';
import { hasInteractiveTriggerLabel } from './trigger-label.js';

export type { LabDialogRole, LabDialogSize } from './runtime.js';
const defaultTrue = {
  fromAttribute: (value: string | null) => value !== 'false',
  toAttribute: (value: boolean) => String(value),
};

/** Native modality traverses composed slots; consumer nodes keep their parent,
 * framework state, styles and local theme in the browser top layer. */
export class LabDialog extends LabElement {
  static override properties: PropertyDeclarations = {
    open: { type: Boolean, reflect: true },
    controlled: { type: Boolean, reflect: true },
    size: { reflect: true },
    modal: { converter: defaultTrue, reflect: true, useDefault: true },
    closable: { converter: defaultTrue, reflect: true, useDefault: true },
    heading: {},
    description: {},
    closeLabel: { attribute: 'close-label' },
    ariaLabel: { attribute: 'aria-label' },
  };
  declare open: boolean;
  declare controlled: boolean;
  declare size: LabDialogSize;
  declare modal: boolean;
  declare closable: boolean;
  declare heading: string;
  declare description: string;
  declare closeLabel: string;
  declare ariaLabel: string | null;
  protected dialogRole: LabDialogRole = 'dialog';
  protected anchored = false;
  protected declare placement: LabPopoverPlacement;
  protected declare arrow: boolean;
  protected runtime?: ReturnType<typeof mountDialog>;
  private triggerSource: HTMLElement | null = null;
  private trigger: HTMLButtonElement | null = null;
  private stopSubscription?: () => void;
  private generation = 0;
  private triggerObserver?: MutationObserver;

  constructor() {
    super();
    this.open = false;
    this.controlled = false;
    this.size = 'm';
    this.modal = true;
    this.closable = true;
    this.heading = '';
    this.description = '';
    this.closeLabel = 'Закрыть';
    this.ariaLabel = null;
    this.placement = 'bottom';
    this.arrow = false;
  }
  static override styles = [
    css`:host { display: inline-flex; vertical-align: middle; }`,
    unsafeCSS(materialCss),
    unsafeCSS(dialogCss),
  ];
  protected changeOpen(open: boolean): void {
    if (open === this.open) return;
    if (!this.controlled) this.open = open;
    this.dispatchEvent(
      new CustomEvent('open-change', { detail: { open }, bubbles: true, composed: true }),
    );
  }
  protected initialFocus(): HTMLElement | null {
    return null;
  }
  protected renderActions() {
    return html`<slot name="actions" @slotchange=${() => this.requestUpdate()}></slot>`;
  }
  private options(): DialogOptions {
    return {
      open: this.open,
      modal: this.dialogRole === 'alertdialog' || this.modal,
      role: this.dialogRole,
      heading: !!this.heading,
      description: !!this.description,
      ariaLabel: this.ariaLabel || (this.anchored ? 'Дополнительное содержимое' : 'Диалог'),
      ...(this.anchored ? { placement: this.placement, arrow: this.arrow } : {}),
      initialFocus: () => this.initialFocus(),
      onOpenChange: (open) => this.changeOpen(open),
    };
  }
  private bind(target: HTMLButtonElement | null): void {
    if (this.trigger === target) return;
    this.runtime?.dispose();
    this.runtime = undefined;
    this.trigger = target;
    if (!target) return;
    if (target.type !== 'button' || hasInteractiveTriggerLabel(target.childNodes))
      throw new TypeError('LabDialog: trigger requires one button with a noninteractive label');
    const plane = this.renderRoot.querySelector<HTMLDialogElement>('dialog');
    const positioner = this.renderRoot.querySelector<HTMLElement>('[part="positioner"]');
    const surface = this.renderRoot.querySelector<HTMLElement>('[part="content"]');
    if (plane && positioner && surface) {
      if (!this.id) this.id = this.uid;
      this.runtime = mountDialog(
        target,
        plane,
        positioner,
        surface,
        this.options(),
        target.getRootNode() === plane.getRootNode() ? plane : this,
      );
    }
  }
  private clearTrigger(): void {
    this.generation++;
    this.stopSubscription?.();
    this.stopSubscription = undefined;
    this.bind(null);
    this.triggerSource = null;
  }
  private syncTrigger(): void {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="trigger"]');
    const assigned = projectedSlotElements(slot);
    const source =
      assigned[0] ?? this.renderRoot.querySelector<HTMLButtonElement>('.lab-dialog-trigger');
    if (
      assigned.length > 1 ||
      !(source instanceof HTMLElement) ||
      (source.localName !== 'lab-button' && !(source instanceof HTMLButtonElement))
    ) {
      this.clearTrigger();
      throw new TypeError('LabDialog: trigger slot requires one LabButton or native button');
    }
    if (source === this.triggerSource) return;
    this.clearTrigger();
    this.triggerSource = source;
    if (source instanceof HTMLButtonElement) this.bind(source);
    else {
      const generation = this.generation;
      void this.ownerDocument.defaultView?.customElements.whenDefined('lab-button').then(() => {
        if (!this.isConnected || this.generation !== generation) return;
        this.stopSubscription = (source as LabButton).interactionTarget.subscribe((target) =>
          this.bind(target),
        );
      });
    }
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
    this.triggerObserver = new MutationObserver(() => {
      if (this.hasUpdated) this.syncTrigger();
      this.requestUpdate();
    });
    this.triggerObserver.observe(this, { childList: true, characterData: true, subtree: true });
  }
  override disconnectedCallback(): void {
    this.triggerObserver?.disconnect();
    this.triggerObserver = undefined;
    this.clearTrigger();
    super.disconnectedCallback();
  }
  override updated(): void {
    if (!this.isConnected) return;
    if (!['s', 'm', 'l'].includes(this.size)) throw new TypeError('LabDialog: invalid size');
    this.syncTrigger();
    this.runtime?.update(this.options());
    for (const slot of this.renderRoot.querySelectorAll<HTMLSlotElement>(
      'slot[name="content"], slot[name="actions"]',
    )) {
      const hasContent = projectedSlotNodes(slot).some(
        (node) =>
          node.nodeType === Node.ELEMENT_NODE ||
          (node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim()),
      );
      if (slot.parentElement) slot.parentElement.hidden = !hasContent;
    }
  }
  override render() {
    const prefix = `${this.uid}-panel`;
    return html`
      <slot name="trigger" @slotchange=${this.syncTrigger}>
        <button class="lab-dialog-trigger" type="button" aria-haspopup="dialog" aria-expanded="false"><slot></slot></button>
      </slot>
      <dialog class="lab-dialog-plane" id=${prefix}>
        ${this.modal || this.dialogRole === 'alertdialog' ? html`<div class="lab-dialog-backdrop" aria-hidden="true"></div>` : nothing}
        <div class=${this.anchored ? 'lab-popover-positioner' : 'lab-dialog-positioner'} data-size=${this.size} part="positioner">
          <div class="lab-dialog-content lab-material lab-material--elevated" data-size=${this.size} part="content">
            ${
              this.heading || this.description || this.closable
                ? html`<div class="lab-dialog-header"><div class="lab-dialog-labels">
              ${this.heading ? html`<h2 class="lab-dialog-heading" part="heading" id=${`${prefix}-heading`}>${this.heading}</h2>` : nothing}
              ${this.description ? html`<p class="lab-dialog-description" part="description" id=${`${prefix}-description`}>${this.description}</p>` : nothing}
            </div>${this.closable ? html`<button class="lab-dialog-close" type="button" part="close-trigger" aria-label=${this.closeLabel} @click=${() => this.changeOpen(false)}><lab-icon .symbol=${close} .size=${dialogProfile.iconSize}></lab-icon></button>` : nothing}</div>`
                : nothing
            }
            <div class="lab-dialog-body" part="body"><slot name="content" @slotchange=${() => this.requestUpdate()}></slot></div>
            <div class="lab-dialog-actions" part="actions">${this.renderActions()}</div>
          </div>
          ${this.anchored && this.arrow ? html`<span class="lab-popover-arrow" part="arrow" aria-hidden="true"></span>` : nothing}
        </div>
      </dialog>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-dialog': LabDialog;
  }
}
export function registerLabDialog(): void {
  if (typeof customElements !== 'undefined' && !customElements.get('lab-dialog'))
    customElements.define('lab-dialog', LabDialog);
}
