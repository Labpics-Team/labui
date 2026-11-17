import { mountMaterialRuntime } from '@labpics/ui-materials';
import { materialCss } from '@labpics/ui-materials/css';
import { type TemplateResult, css, html, unsafeCSS } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LabElement } from '../../lit/lab-element.js';
import { type SheetMotion, mountSheetMotion, sheetMotionProperties } from '../../motion/sheet.js';
import type { LabButton } from '../button/lab-button.js';
import { bindDialogTriggerControls } from '../dialog/focus.js';
import { type NativeDialog, mountNativeDialog } from '../dialog/native.js';
import { hasInteractiveTriggerLabel } from '../dialog/trigger-label.js';
import { measureSheetGeometry } from './measure.js';
import { type LabSheetPosition, parseSheetPosition } from './positions.js';
import { sheetCss } from './styles.js';

export type { LabSheetPosition } from './positions.js';

/** Нижняя панель: DOM и тема сохраняются в месте вызова, browser владеет модальностью. */
export class LabSheet extends LabElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    position: { reflect: true },
    modal: {
      reflect: true,
      converter: {
        fromAttribute: (value: string | null) => value !== 'false',
        toAttribute: (value: boolean) => String(value),
      },
    },
    closable: { type: Boolean, reflect: true },
    heading: {},
    description: {},
    ariaLabel: { attribute: 'aria-label' },
  };

  declare open: boolean;
  declare position: LabSheetPosition;
  declare modal: boolean;
  declare closable: boolean;
  declare heading: string;
  declare description: string;
  declare ariaLabel: string | null;
  private present = false;
  private motion?: SheetMotion;
  private modalBoundary?: NativeDialog;
  private disposeMaterial?: () => void;
  private triggerSource: HTMLElement | null = null;
  private trigger: HTMLButtonElement | null = null;
  private triggerGeneration = 0;
  private stopTriggerSubscription?: () => void;
  private restoreTrigger?: () => void;

  constructor() {
    super();
    this.open = false;
    this.position = 'half';
    this.modal = true;
    this.closable = false;
    this.heading = '';
    this.description = '';
    this.ariaLabel = null;
  }

  static override styles = [
    unsafeCSS(materialCss),
    unsafeCSS(sheetCss),
    css`
    :host { display: inline-flex; vertical-align: middle; }
    .trigger { padding: 0; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; }
    .trigger:focus-visible {
      outline: var(--lab-focus-ring-width) solid var(--lab-border-focus);
      outline-offset: var(--lab-focus-ring-offset);
    }
    .lab-sheet-plane {
      position: fixed; inset: 0; box-sizing: border-box;
      width: 100%; height: 100dvh; max-width: none; max-height: none;
      padding: 0; margin: 0; border: 0; background: transparent;
      overflow: visible; color: inherit; font: inherit; pointer-events: none;
    }
    .lab-sheet-plane::backdrop { background: transparent; }
    .lab-sheet-plane:not([open]) { display: none; }
    .lab-sheet-content { pointer-events: auto; }
  `,
  ];

  private changeOpen(open: boolean): void {
    if (open === this.open) return;
    this.open = open;
    this.dispatchEvent(
      new CustomEvent('open-change', { detail: { open }, bubbles: true, composed: true }),
    );
  }

  private changePosition(position: LabSheetPosition): void {
    if (position === this.position) return;
    this.position = position;
    this.dispatchEvent(
      new CustomEvent('position-change', { detail: { position }, bubbles: true, composed: true }),
    );
  }

  private fail(error: unknown): void {
    this.present = false;
    this.changeOpen(false);
    this.modalBoundary?.update(false, this.modal, false);
    this.dispatchEvent(
      new CustomEvent('motion-error', { detail: { error }, bubbles: true, composed: true }),
    );
    this.requestUpdate();
  }

  private clearTrigger(): void {
    this.triggerGeneration++;
    this.stopTriggerSubscription?.();
    this.stopTriggerSubscription = undefined;
    this.restoreTrigger?.();
    this.restoreTrigger = undefined;
    this.trigger = null;
    this.triggerSource = null;
  }

  private bindTrigger(
    source: HTMLElement,
    target: HTMLButtonElement | null,
    generation: number,
  ): void {
    if (generation !== this.triggerGeneration || source !== this.triggerSource || !this.isConnected)
      return;
    if (target === this.trigger) return;
    this.restoreTrigger?.();
    this.restoreTrigger = undefined;
    this.trigger = null;
    if (!target) return;
    if (target.type !== 'button') throw new TypeError('LabSheet: trigger требует type="button"');
    const dialog = this.renderRoot.querySelector<HTMLDialogElement>('dialog');
    if (!dialog) return;
    const previous = ['aria-haspopup', 'aria-expanded'].map(
      (name) => [name, target.getAttribute(name)] as const,
    );
    if (!this.id) this.id = this.uid;
    const restoreControls = bindDialogTriggerControls(
      target,
      target.getRootNode() === dialog.getRootNode() ? dialog : this,
    );
    const open = (event: MouseEvent): void => {
      if (
        event.defaultPrevented ||
        target.disabled ||
        !source.isConnected ||
        target.type !== 'button'
      )
        return;
      if (hasInteractiveTriggerLabel(source.childNodes))
        throw new TypeError('LabSheet: подпись trigger не должна содержать другие controls');
      this.changeOpen(true);
    };
    target.addEventListener('click', open);
    target.setAttribute('aria-haspopup', 'dialog');
    this.trigger = target;
    this.restoreTrigger = () => {
      target.removeEventListener('click', open);
      restoreControls();
      for (const [name, value] of previous) {
        if (value === null) target.removeAttribute(name);
        else target.setAttribute(name, value);
      }
    };
  }

  private syncTrigger(): void {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="trigger"]');
    const assigned = slot?.assignedElements() ?? [];
    const source = assigned[0] ?? this.renderRoot.querySelector<HTMLButtonElement>('.trigger');
    if (
      assigned.length > 1 ||
      !(source instanceof HTMLElement) ||
      (source.localName !== 'lab-button' && !(source instanceof HTMLButtonElement))
    ) {
      this.clearTrigger();
      throw new TypeError('LabSheet: slot="trigger" требует одну LabButton или native button');
    }
    if (source !== this.triggerSource) {
      this.clearTrigger();
      this.triggerSource = source;
      const generation = this.triggerGeneration;
      if (source instanceof HTMLButtonElement) this.bindTrigger(source, source, generation);
      else {
        const registry = this.ownerDocument.defaultView?.customElements;
        if (!registry) return;
        void registry.whenDefined('lab-button').then(() => {
          if (generation !== this.triggerGeneration || !this.isConnected) return;
          const button = source as LabButton;
          this.stopTriggerSubscription = button.interactionTarget.subscribe((target) => {
            this.bindTrigger(source, target, generation);
            this.trigger?.setAttribute('aria-expanded', String(this.open));
          });
        });
      }
    }
    this.trigger?.setAttribute('aria-expanded', String(this.open));
  }

  override updated(): void {
    if (!this.isConnected) return;
    if (typeof this.open !== 'boolean' || typeof this.modal !== 'boolean') {
      throw new TypeError('LabSheet: open и modal должны быть Boolean');
    }
    const position = parseSheetPosition(this.position);
    const dialog = this.renderRoot.querySelector<HTMLDialogElement>('dialog');
    const positioner = this.renderRoot.querySelector<HTMLElement>('.lab-sheet-positioner');
    const frame = this.renderRoot.querySelector<HTMLElement>('.lab-sheet-frame');
    const handle = this.renderRoot.querySelector<HTMLElement>('.lab-sheet-handle');
    if (!dialog || !positioner || !frame || !handle) return;
    this.syncTrigger();
    if (this.open) this.present = true;
    this.modalBoundary ??= mountNativeDialog(dialog, {
      content: () => this.renderRoot.querySelector('.lab-sheet-content'),
      trigger: () => this.trigger,
      onDismiss: () => this.changeOpen(false),
    });
    this.modalBoundary.update(this.open || this.present, this.modal, this.open);
    try {
      if (!this.motion || (!this.motion.active && this.open)) {
        this.motion = mountSheetMotion(
          frame,
          handle,
          [
            ...frame.querySelectorAll('.lab-sheet-handle, .lab-sheet-panel-body, .lab-sheet-body'),
            ...positioner.querySelectorAll('.lab-sheet-preset'),
          ],
          {
            readGeometry: () => measureSheetGeometry(positioner),
            onPositionChange: (next) => this.changePosition(next),
            onOpenChange: (next) => this.changeOpen(next),
            onClosed: () => {
              if (this.open) return;
              this.present = false;
              this.requestUpdate();
            },
            onError: (error) => this.fail(error),
          },
        );
      }
      this.disposeMaterial ??= mountMaterialRuntime(frame, {
        motionProperties: sheetMotionProperties,
      });
      this.motion.update(this.open, position);
    } catch (error) {
      this.fail(error);
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }
  override disconnectedCallback(): void {
    try {
      this.motion?.dispose();
    } finally {
      this.motion = undefined;
      try {
        this.disposeMaterial?.();
      } finally {
        this.disposeMaterial = undefined;
        this.modalBoundary?.dispose();
        this.modalBoundary = undefined;
        this.present = false;
        this.clearTrigger();
        super.disconnectedCallback();
      }
    }
  }

  override render(): TemplateResult {
    const prefix = this.uid;
    return html`
      <slot name="trigger" @slotchange=${this.syncTrigger}>
        <button type="button" class="trigger"><slot></slot></button>
      </slot>
      <dialog class="lab-sheet-plane" id=${`${prefix}-panel`}
        aria-label=${ifDefined(this.ariaLabel ?? (this.heading ? undefined : 'Панель'))}
        aria-labelledby=${ifDefined(this.heading ? `${prefix}-heading` : undefined)}
        aria-describedby=${ifDefined(this.description ? `${prefix}-description` : undefined)}>
        ${this.modal ? html`<div class="lab-sheet-backdrop" aria-hidden="true"></div>` : null}
        <div class="lab-sheet-positioner" data-position=${this.position}>
          <div class="lab-sheet-frame" data-lab-sheet>
            <div class="lab-sheet-ghost lab-material-ghost--sheet" data-veil aria-hidden="true"></div>
            <div class="lab-sheet-content">
              <div class="lab-sheet-surface lab-material lab-material--sheet" part="surface">
                <button class="lab-sheet-handle" type="button" aria-label="Изменить высоту панели"><span class="lab-sheet-indicator"></span></button>
                <div class="lab-sheet-panel-body" part="scroll-area">
                  ${
                    this.heading || this.description
                      ? html`<div class="lab-sheet-panel-heading">
                    ${this.heading ? html`<h2 class="lab-sheet-heading" id=${`${prefix}-heading`}>${this.heading}</h2>` : null}
                    ${this.description ? html`<p class="lab-sheet-description" id=${`${prefix}-description`}>${this.description}</p>` : null}
                  </div>`
                      : null
                  }
                  <div class="lab-sheet-body"><slot name="content"></slot></div>
                </div>
                ${this.closable ? html`<button class="lab-sheet-close" type="button" aria-label="Закрыть" @click=${() => this.changeOpen(false)}>×</button>` : null}
              </div>
            </div>
          </div>
          <div class="lab-sheet-preset lab-sheet-preset-full" aria-hidden="true"></div>
          <div class="lab-sheet-preset lab-sheet-preset-two-thirds" aria-hidden="true"></div>
          <div class="lab-sheet-preset lab-sheet-preset-one-third" aria-hidden="true"></div>
          <div class="lab-sheet-preset lab-sheet-overlap" aria-hidden="true"></div>
          <div class="lab-sheet-preset lab-sheet-gap" aria-hidden="true"></div>
        </div>
      </dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-sheet': LabSheet;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-sheet'))
  customElements.define('lab-sheet', LabSheet);
