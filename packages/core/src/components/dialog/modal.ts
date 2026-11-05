import * as dialogMachine from '@labpics/ui-core/behaviors/dialog';
import { type PropertyDeclarations, type TemplateResult, css, html, render } from 'lit';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';

export type ModalRole = 'dialog' | 'alertdialog';
type DialogSchema = SchemaOf<dialogMachine.Service>;
const dialogModule: MachineModule<DialogSchema, dialogMachine.Api> = dialogMachine;
let instanceSequence = 0;

/**
 * Общий владелец модальности Dialog и Sheet. Manual popover сохраняет CSS-предков
 * и выводит поверхность из clipping/transform; Zag владеет закрытием и фокусом.
 * Слоты сохраняют DOM, стили и обработчики содержимого в дереве потребителя.
 */
export abstract class LabModal extends LabElement {
  static override properties: PropertyDeclarations = {
    modal: { reflect: true },
    closable: { type: Boolean, reflect: true },
    heading: {},
    description: {},
  };

  declare modal: string;
  declare closable: boolean;
  declare heading: string;
  declare description: string;

  protected dialogRole: ModalRole = 'dialog';
  protected portalAttribute = 'data-lab-dialog-portal';
  protected abstract get portalStyleSheets(): CSSStyleSheet[];
  protected abstract floatingTemplate(): TemplateResult;

  protected get portalAttributes(): Readonly<Record<string, string>> {
    return {};
  }

  /** Только свойства поведения; наследник не создаёт второй modal runtime. */
  protected get dialogBehaviorProps(): Pick<dialogMachine.Props, 'open' | 'aria-label'> {
    return {};
  }

  protected onDialogOpenChange(details: dialogMachine.OpenChangeDetails): void {
    this.dispatchEvent(
      new CustomEvent<dialogMachine.OpenChangeDetails>('open-change', {
        detail: details,
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** Вызывается после проекции слотов и применения актуальных Zag props. */
  protected afterFloatingUpdate(_root: ShadowRoot, _open: boolean): void {}

  protected completeFailedDialogFocus(): void {
    if (!this.isConnected) return;
    const focus = this.modalFocus();
    if (focus && this.isIndependentModal(focus.content)) return;
    // trapFocus создаёт trap на RAF. Ранний отказ отменяет его до активации,
    // поэтому уже заданная точка finalFocus должна завершиться здесь, до callback.
    this.finalFocusTarget()?.focus({ preventScroll: true });
  }

  private readonly machineId = `lab-dialog-${++instanceSequence}`;
  private readonly machineCtl: ZagController<DialogSchema, dialogMachine.Api>;
  private portalHost?: HTMLElement;
  private portalRoot?: ShadowRoot;
  private contextObserver?: MutationObserver;
  private contentObserver?: MutationObserver;

  private get isModal(): boolean {
    return this.modal !== 'false';
  }

  constructor() {
    super();
    this.modal = 'true';
    this.closable = true;
    this.heading = '';
    this.description = '';
    this.machineCtl = this.runMachine(dialogModule, () => ({
      ...this.dialogBehaviorProps,
      id: this.machineId,
      role: this.dialogRole,
      modal: this.isModal,
      getRootNode: () => this.portalRoot ?? document,
      triggerEl: () => this.renderRoot.querySelector<HTMLElement>('.trigger'),
      // Trigger остаётся в другом shadow root. Заг передаёт ссылку focus trap,
      // а не пытается повторно искать её в portal root.
      finalFocusEl: () => this.finalFocusTarget(),
      onOpenChange: (details) => this.onDialogOpenChange(details),
    }));
  }

  private modalFocus(): { active: HTMLElement; content: Element } | undefined {
    let active = this.ownerDocument.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    if (!(active instanceof HTMLElement)) return;
    let node: Node | null = active;
    while (node) {
      if (
        node instanceof Element &&
        node.matches('[data-scope="dialog"][data-part="content"][data-state="open"]')
      )
        return { active, content: node };
      if (node instanceof Element && node.assignedSlot) {
        node = node.assignedSlot;
        continue;
      }
      node = node instanceof ShadowRoot ? node.host : node.parentNode;
    }
  }

  private finalFocusTarget(): HTMLElement | null {
    const focus = this.modalFocus();
    // Поздний cleanup сохраняет самостоятельный новый modal. Родитель остаётся
    // допустимым местом возврата: его прежний Sheet trigger снова доступен.
    if (focus && this.isIndependentModal(focus.content)) return focus.active;
    const trigger = this.renderRoot.querySelector<HTMLElement>('.trigger');
    return this.isConnected &&
      trigger?.isConnected &&
      !trigger.matches(':disabled') &&
      !trigger.closest('[inert]')
      ? trigger
      : null;
  }

  private isIndependentModal(content: Element): boolean {
    return (
      content !== this.portalRoot?.querySelector('.content') &&
      !this.contextAncestors().includes(content)
    );
  }

  static override styles = css`
    :host {
      display: inline-flex;
      vertical-align: middle;
    }
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
      border-radius: ${litVar('--lab-radius-xs', '0.25rem')};
    }
    .portal-plane {
      position: fixed;
      inset: 0;
      width: auto;
      height: auto;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      overflow: visible;
      pointer-events: none;
      font: inherit;
      color: inherit;
    }
    .portal-plane::backdrop {
      pointer-events: none;
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.contextObserver = new MutationObserver(() => this.requestUpdate());
    this.contentObserver = new MutationObserver(() => this.requestUpdate());
    // Изменения внутри стабильного slot wrapper тоже меняют содержимое панели.
    this.contentObserver.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['slot'],
    });
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.contextObserver?.disconnect();
    this.contextObserver = undefined;
    this.contentObserver?.disconnect();
    this.contentObserver = undefined;
    try {
      super.disconnectedCallback();
    } finally {
      if (this.portalRoot) render(null, this.portalRoot);
    }
  }

  private ensurePortal(): void {
    if (this.portalHost || !this.isConnected || typeof document === 'undefined') return;
    // Lit владеет стабильным host; отдельный shadow root не затрагивается render.
    const host = this.renderRoot.querySelector<HTMLElement>('.portal-plane');
    if (!host) return;
    host.setAttribute(this.portalAttribute, this.machineId);
    const ownTestId = this.getAttribute('data-testid');
    if (ownTestId) host.setAttribute('data-portal-for', ownTestId);
    const root = host.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = this.portalStyleSheets;
    this.portalHost = host;
    this.portalRoot = root;
  }

  private contextAncestors(): Element[] {
    const ancestors: Element[] = [];
    let node: Node | null = this;
    while (node) {
      if (node instanceof Element) {
        ancestors.push(node);
        if (node.assignedSlot) {
          node = node.assignedSlot;
          continue;
        }
      }
      node = node instanceof ShadowRoot ? node.host : node.parentNode;
    }
    return ancestors;
  }

  private syncContext(): void {
    const host = this.portalHost;
    if (!host) return;
    const ancestors = this.contextAncestors();
    for (const attribute of ['data-theme', 'data-material', 'data-contrast']) {
      const value = ancestors.find((node) => node.hasAttribute(attribute))?.getAttribute(attribute);
      if (value !== null && value !== undefined) host.setAttribute(attribute, value);
      else host.removeAttribute(attribute);
    }

    // CSS наследуется браузером, включая media/CSSOM/font changes. Проецируются
    // только предметные флаги, нужные селекторам и runtime материала.
    this.contextObserver?.disconnect();
    for (const ancestor of ancestors) {
      this.contextObserver?.observe(ancestor, {
        attributes: true,
        attributeFilter: ['data-theme', 'data-material', 'data-contrast'],
      });
    }
  }

  override updated(): void {
    // Уже поставленный Lit update может исполниться после disconnect.
    if (!this.isConnected) return;
    this.ensurePortal();
    const root = this.portalRoot;
    if (!root) return;
    this.syncContext();
    render(this.floatingTemplate(), root);
    this.portalHost?.setAttribute('data-modal', String(this.isModal));
    for (const [attribute, value] of Object.entries(this.portalAttributes)) {
      this.portalHost?.setAttribute(attribute, value);
    }
    this.machineCtl.clearSpreads();
    const api = this.machineCtl.api;
    const trigger = this.renderRoot.querySelector<HTMLElement>('.trigger');
    if (trigger) this.machineCtl.spread(trigger, api.getTriggerProps());
    for (const [selector, props] of [
      ['.backdrop', api.getBackdropProps()],
      ['.positioner', api.getPositionerProps()],
      ['.content', api.getContentProps()],
      ['.heading', api.getTitleProps()],
      ['.description', api.getDescriptionProps()],
    ] as const) {
      const element = root.querySelector<HTMLElement>(selector);
      if (element) this.machineCtl.spread(element, props);
    }
    const close = root.querySelector<HTMLElement>('.close');
    if (this.closable && close) this.machineCtl.spread(close, api.getCloseTriggerProps());
    root.querySelector('.positioner')?.toggleAttribute('hidden', !api.open);
    const host = this.portalHost;
    if (host && api.open !== host.matches(':popover-open')) {
      if (api.open) host.showPopover();
      else host.hidePopover();
    }
    this.afterFloatingUpdate(root, api.open);
  }

  override render(): TemplateResult {
    return html`
      <button class="trigger" type="button" part="trigger"><slot></slot></button>
      <div class="portal-plane" popover="manual">
        <slot name="content" slot="content" @slotchange=${this.contentSlotChanged}></slot>
      </div>
    `;
  }

  private contentSlotChanged(): void {
    if (this.isConnected) this.requestUpdate();
  }
}
