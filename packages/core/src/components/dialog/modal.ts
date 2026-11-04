import * as dialogMachine from '@zag-js/dialog';
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
 * Общий владелец модальности Dialog и Sheet. Перенесённые узлы находятся в
 * поддереве focus trap; маркеры сохраняют их исходное место при disconnect.
 * Геометрия и движение конкретной поверхности остаются у наследника.
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

  /** Вызывается после переноса контента и применения актуальных Zag props. */
  protected afterFloatingUpdate(_root: ShadowRoot, _open: boolean): void {}

  private readonly machineId = `lab-dialog-${++instanceSequence}`;
  private readonly machineCtl: ZagController<DialogSchema, dialogMachine.Api>;
  private portalHost?: HTMLElement;
  private portalRoot?: ShadowRoot;
  private bodyMount?: HTMLElement;
  private readonly origins = new Map<Element, Comment>();
  private contextObserver?: MutationObserver;
  private copiedProperties = new Set<string>();

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
      // Trigger остаётся в другом shadow root. Заг передаёт ссылку focus trap,
      // а не пытается повторно искать её в portal root.
      finalFocusEl: () => this.renderRoot.querySelector<HTMLElement>('.trigger'),
      onOpenChange: (details) => this.onDialogOpenChange(details),
    }));
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
  `;

  override connectedCallback(): void {
    this.ensurePortal();
    super.connectedCallback();
    this.contextObserver = new MutationObserver(() => this.requestUpdate());
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.contextObserver?.disconnect();
    this.contextObserver = undefined;
    super.disconnectedCallback();
    for (const [node, marker] of this.origins) {
      if (marker.parentNode === this && node.parentNode === this.bodyMount) {
        marker.replaceWith(node);
      } else {
        marker.remove();
      }
    }
    this.origins.clear();
    this.portalHost?.remove();
    this.portalHost = undefined;
    this.portalRoot = undefined;
    this.bodyMount = undefined;
    this.copiedProperties.clear();
  }

  private ensurePortal(): void {
    if (this.portalHost || !this.isConnected || typeof document === 'undefined') return;
    const host = this.ownerDocument.createElement('div');
    host.setAttribute(this.portalAttribute, this.machineId);
    const ownTestId = this.getAttribute('data-testid');
    if (ownTestId) host.setAttribute('data-portal-for', ownTestId);
    const root = host.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = this.portalStyleSheets;
    this.ownerDocument.body.append(host);
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
    const view = this.ownerDocument.defaultView;
    if (!host || !view) return;
    const ancestors = this.contextAncestors();
    for (const attribute of ['data-theme', 'data-material', 'data-contrast']) {
      const value = ancestors.find((node) => node.hasAttribute(attribute))?.getAttribute(attribute);
      if (value !== null && value !== undefined) host.setAttribute(attribute, value);
      else host.removeAttribute(attribute);
    }

    // Копируется результат CSS-владельца, включая локальные role overrides и
    // наследуемый material context. Portal не вычисляет палитру или режим.
    const style = view.getComputedStyle(this);
    const next = new Set<string>();
    for (let index = 0; index < style.length; index++) {
      const property = style.item(index);
      if (!property.startsWith('--')) continue;
      next.add(property);
      const value = style.getPropertyValue(property);
      if (host.style.getPropertyValue(property) !== value) host.style.setProperty(property, value);
    }
    for (const property of this.copiedProperties) {
      if (!next.has(property)) host.style.removeProperty(property);
    }
    this.copiedProperties = next;
    host.style.font = style.font;

    this.contextObserver?.disconnect();
    for (const ancestor of ancestors) {
      this.contextObserver?.observe(ancestor, {
        attributes: true,
        attributeFilter: ['data-theme', 'data-material', 'data-contrast', 'style', 'class'],
      });
    }
  }

  private relocateBody(): void {
    if (!this.bodyMount) return;
    for (const [node, marker] of this.origins) {
      if (marker.parentNode === this && node.parentNode === this.bodyMount) continue;
      if (node.parentNode === this.bodyMount) node.remove();
      marker.remove();
      this.origins.delete(node);
    }
    for (const node of [...this.children]) {
      if (node.getAttribute('slot') !== 'content') continue;
      const marker = this.ownerDocument.createComment('lab-modal-content');
      node.replaceWith(marker);
      this.origins.set(node, marker);
      this.bodyMount.append(node);
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
    this.bodyMount = root.querySelector<HTMLElement>('.body') ?? undefined;
    this.relocateBody();

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
    this.afterFloatingUpdate(root, api.open);
  }

  override render(): TemplateResult {
    return html`
      <button class="trigger" type="button" part="trigger"><slot></slot></button>
      <slot name="content" hidden aria-hidden="true" @slotchange=${this.contentSlotChanged}></slot>
    `;
  }

  private contentSlotChanged(): void {
    if (
      this.isConnected &&
      [...this.children].some((node) => node.getAttribute('slot') === 'content')
    ) {
      this.requestUpdate();
    }
  }
}
