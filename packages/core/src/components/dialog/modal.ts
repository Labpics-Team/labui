import * as dialogMachine from '@labpics/ui-core/behaviors/dialog';
import { spreadProps } from '@zag-js/vanilla';
import { type PropertyDeclarations, type TemplateResult, css, html, render } from 'lit';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { litVar } from '../../css.js';
import { LabElement } from '../../lit/lab-element.js';
import type { ZagController } from '../../lit/zag-controller.js';
import type { LabButton } from '../button/lab-button.js';
import {
  type DialogFocusContext,
  bindDialogTriggerControls,
  completeFailedDialogFocus,
  composedAncestors,
  dialogFinalFocusTarget,
} from './focus.js';
import { hasInteractiveTriggerLabel } from './trigger-label.js';

export type ModalRole = 'dialog' | 'alertdialog';
type DialogSchema = SchemaOf<dialogMachine.Service>;
const dialogModule: MachineModule<DialogSchema, dialogMachine.Api> = dialogMachine;
let instanceSequence = 0;

function hasButtonTargetPort(
  element: HTMLElement,
): element is HTMLElement & Pick<LabButton, 'interactionTarget'> {
  if (element.localName !== 'lab-button' || !('interactionTarget' in element)) return false;
  const port = element.interactionTarget;
  return (
    typeof port === 'object' &&
    port !== null &&
    'current' in port &&
    'subscribe' in port &&
    typeof port.subscribe === 'function'
  );
}

function assertTriggerLabel(nodes: readonly Node[]): void {
  if (hasInteractiveTriggerLabel(nodes)) {
    throw new TypeError('LabModal: interactive children require one button in slot="trigger".');
  }
}

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
    completeFailedDialogFocus(this.dialogFocusContext());
  }

  private readonly machineId = `lab-dialog-${++instanceSequence}`;
  private readonly machineCtl: ZagController<DialogSchema, dialogMachine.Api>;
  private portalHost?: HTMLElement;
  private portalRoot?: ShadowRoot;
  private contextObserver?: MutationObserver;
  private contentObserver?: MutationObserver;
  private triggerSource: HTMLElement | null = null;
  private triggerTarget: HTMLButtonElement | null = null;
  private triggerGeneration = 0;
  private waitingForUpgrade = -1;
  private stopTriggerSubscription?: () => void;
  private stopTriggerSpread?: () => void;
  private restoreTriggerControls?: () => void;
  private readonly triggerAttributes = new Map<string, string | null>();

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
      triggerEl: () => this.currentTriggerTarget(),
      // Trigger остаётся в другом shadow root. Заг передаёт ссылку focus trap,
      // а не пытается повторно искать её в portal root.
      finalFocusEl: () => dialogFinalFocusTarget(this.dialogFocusContext()),
      onOpenChange: (details) => this.onDialogOpenChange(details),
    }));
  }

  private dialogFocusContext(): DialogFocusContext {
    return {
      owner: this,
      content: this.portalRoot?.querySelector('.content') ?? null,
      trigger: this.currentTriggerTarget(),
    };
  }

  private currentTriggerTarget(): HTMLButtonElement | null {
    const source = this.triggerSource;
    if (!source || !this.matchesTriggerAssignment(source) || this.triggerTarget?.type !== 'button')
      return null;
    // Focus и outside exclusion читают актуальное содержимое до observer delivery.
    try {
      return source === this.selectTriggerSource() ? this.triggerTarget : null;
    } catch {
      return null;
    }
  }

  private matchesTriggerAssignment(source: HTMLElement): boolean {
    if (!this.isConnected || !source.isConnected) return false;
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="trigger"]');
    const assigned = slot?.assignedNodes() ?? [];
    return assigned.length
      ? assigned.length === 1 && assigned[0] === source
      : source === this.renderRoot.querySelector('.trigger');
  }

  private selectTriggerSource(): HTMLElement | null {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="trigger"]');
    if (!slot) return null;
    const label = this.renderRoot.querySelector<HTMLSlotElement>('.trigger > slot');
    if (label) assertTriggerLabel(label.assignedNodes({ flatten: true }));
    const assigned = slot.assignedNodes();
    if (assigned.length) {
      const source = assigned[0];
      if (
        assigned.length !== 1 ||
        !(source instanceof HTMLElement) ||
        (source.localName !== 'lab-button' && !(source instanceof HTMLButtonElement))
      ) {
        throw new TypeError(
          'LabModal: slot="trigger" accepts exactly one LabButton or native button.',
        );
      }
      assertTriggerLabel([...source.childNodes]);
      return source;
    }
    return this.renderRoot.querySelector<HTMLButtonElement>('.trigger');
  }

  private clearTriggerSpread(): void {
    const stop = this.stopTriggerSpread;
    this.stopTriggerSpread = undefined;
    stop?.();
  }

  private clearTriggerBinding(): void {
    const previous = this.triggerTarget;
    this.triggerTarget = null;
    this.clearTriggerSpread();
    this.restoreTriggerControls?.();
    this.restoreTriggerControls = undefined;
    if (previous) {
      for (const [attribute, value] of this.triggerAttributes) {
        if (value === null) previous.removeAttribute(attribute);
        else previous.setAttribute(attribute, value);
      }
    }
    this.triggerAttributes.clear();
  }

  private releaseTrigger(): void {
    this.triggerGeneration++;
    this.triggerSource = null;
    this.waitingForUpgrade = -1;
    const stop = this.stopTriggerSubscription;
    this.stopTriggerSubscription = undefined;
    try {
      stop?.();
    } finally {
      this.clearTriggerBinding();
    }
  }

  private acceptTriggerTarget(
    source: HTMLElement,
    generation: number,
    target: HTMLButtonElement | null,
  ): void {
    if (
      generation !== this.triggerGeneration ||
      source !== this.triggerSource ||
      !this.matchesTriggerAssignment(source)
    ) {
      return;
    }
    try {
      if (source !== this.selectTriggerSource()) return;
    } catch (error) {
      this.releaseTrigger();
      throw error;
    }
    if (target !== null) {
      if (!(target instanceof HTMLButtonElement) || target.type !== 'button') {
        this.clearTriggerBinding();
        throw new TypeError('LabModal: trigger must own a native button with type="button".');
      }
      const targetRoot = target.getRootNode();
      if (
        source !== target &&
        (!(targetRoot instanceof ShadowRoot) || targetRoot.host !== source)
      ) {
        this.clearTriggerBinding();
        throw new TypeError('LabModal: LabButton interaction target belongs to another owner.');
      }
    }
    if (target === this.triggerTarget) return;
    this.clearTriggerBinding();
    if (target) {
      // Custom Button и floating plane находятся в разных shadow roots.
      // Modal host доступен из родительского root; content role остаётся внутри.
      const controlled = target.getRootNode() === this.renderRoot ? this.portalHost : this;
      if (!controlled) return;
      this.restoreTriggerControls = bindDialogTriggerControls(target, controlled);
      this.triggerTarget = target;
    }
    this.requestUpdate();
  }

  private syncTrigger(): void {
    let source: HTMLElement | null;
    try {
      source = this.selectTriggerSource();
    } catch (error) {
      this.releaseTrigger();
      throw error;
    }
    if (source !== this.triggerSource) {
      this.releaseTrigger();
      this.triggerSource = source;
    }
    if (!source) return;
    const generation = this.triggerGeneration;
    if (source instanceof HTMLButtonElement) {
      this.acceptTriggerTarget(source, generation, source);
      return;
    }
    if (this.stopTriggerSubscription) return;
    const registry = this.ownerDocument.defaultView?.customElements;
    if (!registry) throw new TypeError('LabModal: custom element registry is unavailable.');
    if (!registry.get('lab-button')) {
      if (this.waitingForUpgrade === generation) return;
      this.waitingForUpgrade = generation;
      void registry.whenDefined('lab-button').then(() => {
        if (
          generation === this.triggerGeneration &&
          source === this.triggerSource &&
          this.matchesTriggerAssignment(source)
        ) {
          this.requestUpdate();
        }
      });
      return;
    }
    registry.upgrade(source);
    if (!hasButtonTargetPort(source)) {
      this.releaseTrigger();
      throw new TypeError('LabModal: LabButton does not provide its interaction target.');
    }
    const stop = source.interactionTarget.subscribe((target) => {
      this.acceptTriggerTarget(source, generation, target);
    });
    // subscribe может вызвать callback немедленно; callback мог заменить slot.
    if (
      generation === this.triggerGeneration &&
      source === this.triggerSource &&
      this.matchesTriggerAssignment(source)
    ) {
      this.stopTriggerSubscription = stop;
    } else {
      stop();
    }
  }

  private spreadTrigger(api: dialogMachine.Api): void {
    this.clearTriggerSpread();
    const source = this.triggerSource;
    const target = this.currentTriggerTarget();
    if (!source || !target) return;
    const generation = this.triggerGeneration;
    const { type: _type, 'aria-controls': _controls, onClick, ...props } = api.getTriggerProps();
    for (const attribute of Object.keys(props)) {
      if (!attribute.startsWith('on') && !this.triggerAttributes.has(attribute)) {
        this.triggerAttributes.set(attribute, target.getAttribute(attribute));
      }
    }
    this.stopTriggerSpread = spreadProps(
      target,
      {
        ...props,
        onClick: (event: Event) => {
          if (
            generation !== this.triggerGeneration ||
            source !== this.triggerSource ||
            !this.matchesTriggerAssignment(source) ||
            target !== this.triggerTarget
          ) {
            return;
          }
          try {
            if (source !== this.selectTriggerSource()) return;
            if (target.type !== 'button') {
              throw new TypeError('LabModal: trigger must keep native type="button".');
            }
          } catch (error) {
            this.releaseTrigger();
            throw error;
          }
          if (!target.disabled && typeof onClick === 'function') onClick(event);
        },
      },
      this.machineId,
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
    this.contentObserver = new MutationObserver(() => {
      if (this.triggerSource) {
        try {
          if (this.triggerSource !== this.selectTriggerSource()) this.releaseTrigger();
        } catch {
          this.releaseTrigger();
          // Следующий update сообщает ошибку; физический opener остаётся для recovery.
        }
      }
      this.requestUpdate();
    });
    // Изменения внутри стабильного slot wrapper тоже меняют содержимое панели.
    this.contentObserver.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'slot',
        'type',
        'html-type',
        'href',
        'xlink:href',
        'usemap',
        'tabindex',
        'contenteditable',
        'role',
        'controls',
      ],
    });
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.contextObserver?.disconnect();
    this.contextObserver = undefined;
    this.contentObserver?.disconnect();
    this.contentObserver = undefined;
    try {
      this.releaseTrigger();
    } finally {
      try {
        super.disconnectedCallback();
      } finally {
        if (this.portalRoot) render(null, this.portalRoot);
      }
    }
  }

  private ensurePortal(): void {
    if (this.portalHost || !this.isConnected || typeof document === 'undefined') return;
    // Lit владеет стабильным host; отдельный shadow root не затрагивается render.
    const host = this.renderRoot.querySelector<HTMLElement>('.portal-plane');
    if (!host) return;
    host.id = `${this.machineId}-portal`;
    host.setAttribute(this.portalAttribute, this.machineId);
    const ownTestId = this.getAttribute('data-testid');
    if (ownTestId) host.setAttribute('data-portal-for', ownTestId);
    const root = host.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = this.portalStyleSheets;
    this.portalHost = host;
    this.portalRoot = root;
  }

  private syncContext(): void {
    const host = this.portalHost;
    if (!host) return;
    const ancestors = composedAncestors(this);
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
    try {
      this.syncTrigger();
    } finally {
      // Отказ opener не прерывает close bindings, видимость и Sheet exit.
      this.syncContext();
      render(this.floatingTemplate(), root);
      this.portalHost?.setAttribute('data-modal', String(this.isModal));
      for (const [attribute, value] of Object.entries(this.portalAttributes)) {
        this.portalHost?.setAttribute(attribute, value);
      }
      this.machineCtl.clearSpreads();
      const api = this.machineCtl.api;
      this.spreadTrigger(api);
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
  }

  override render(): TemplateResult {
    return html`
      <slot name="trigger" data-projection="direct" @slotchange=${this.triggerSlotChanged}>
        <button class="trigger" type="button" part="trigger"><slot @slotchange=${this.triggerSlotChanged}></slot></button>
      </slot>
      <div class="portal-plane" popover="manual">
        <slot name="content" slot="content" @slotchange=${this.contentSlotChanged}></slot>
      </div>
    `;
  }

  private contentSlotChanged(): void {
    if (this.isConnected) this.requestUpdate();
  }

  private triggerSlotChanged(): void {
    if (!this.isConnected) return;
    this.releaseTrigger();
    this.requestUpdate();
  }
}
