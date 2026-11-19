import { materialCss } from '@labpics/ui-materials/css';
import { type TemplateResult, css, html, unsafeCSS } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import type { LabButton } from '../button/lab-button.js';
import {
  type LabTooltipPlacement,
  type LabTooltipSize,
  type LabTooltipTail,
  type LabTooltipType,
  mountTooltip,
} from './runtime.js';
import { tooltipCss } from './styles.js';

export type {
  LabTooltipPlacement,
  LabTooltipSize,
  LabTooltipTail,
  LabTooltipType,
} from './runtime.js';

/** Supplementary text attached to the consumer's control. The manual popover
 * escapes clipping without moving content away from its local theme or dialog.
 */
export class LabTooltip extends LabElement {
  static override properties = {
    placement: { reflect: true },
    type: { reflect: true },
    size: { reflect: true },
    tail: { reflect: true },
    content: {},
    openDelay: { type: Number, attribute: 'open-delay' },
    closeDelay: { type: Number, attribute: 'close-delay' },
    disabled: { type: Boolean, reflect: true },
    arrow: {
      reflect: true,
      converter: {
        fromAttribute: (value: string | null) => value !== 'false',
        toAttribute: (value: boolean) => String(value),
      },
    },
  };
  declare placement: LabTooltipPlacement;
  declare type: LabTooltipType;
  declare size: LabTooltipSize;
  declare tail: LabTooltipTail;
  declare content: string;
  declare openDelay: number;
  declare closeDelay: number;
  declare disabled: boolean;
  declare arrow: boolean;
  private source: Element | null = null;
  private trigger: HTMLElement | null = null;
  private stopSubscription?: () => void;
  private controller?: ReturnType<typeof mountTooltip>;
  private generation = 0;

  constructor() {
    super();
    this.placement = 'bottom';
    this.type = 'neutral';
    this.size = 'm';
    this.tail = 'chevron';
    this.content = '';
    this.openDelay = 400;
    this.closeDelay = 150;
    this.disabled = false;
    this.arrow = true;
  }
  static override styles = [
    css`:host { display: inline-flex; vertical-align: middle; }`,
    unsafeCSS(materialCss),
    unsafeCSS(tooltipCss),
  ];

  private options() {
    return {
      placement: this.placement,
      openDelay: this.openDelay,
      closeDelay: this.closeDelay,
      disabled: this.disabled,
      arrow: this.arrow,
      tail: this.tail,
      description: () => {
        const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="content"]');
        return (
          slot
            ?.assignedNodes({ flatten: true })
            .map((node) => node.textContent ?? '')
            .join('') || this.content
        );
      },
      descriptionNodes: () =>
        this.renderRoot
          .querySelector<HTMLSlotElement>('slot[name="content"]')
          ?.assignedNodes({ flatten: true }) ?? [],
      onOpenChange: (open: boolean) =>
        this.dispatchEvent(
          new CustomEvent('open-change', { detail: { open }, bubbles: true, composed: true }),
        ),
    };
  }
  private bind(target: HTMLElement | null): void {
    if (target === this.trigger) return;
    this.controller?.dispose();
    this.controller = undefined;
    this.trigger = target;
    if (!target) return;
    const positioner = this.renderRoot.querySelector<HTMLElement>('.lab-tooltip-positioner');
    const content = this.renderRoot.querySelector<HTMLElement>('.lab-tooltip-content');
    const tail = this.renderRoot.querySelector<HTMLElement>('.lab-tooltip-arrow');
    if (positioner && content && tail)
      this.controller = mountTooltip(target, positioner, content, tail, this.options());
  }
  private clear(): void {
    this.generation++;
    this.stopSubscription?.();
    this.stopSubscription = undefined;
    this.bind(null);
    this.source = null;
  }
  override connectedCallback(): void {
    super.connectedCallback();
    // Lit does not schedule another update when an existing element reconnects.
    // Rebind the actual control after disconnectedCallback released its runtime.
    this.requestUpdate();
  }
  override disconnectedCallback(): void {
    this.clear();
    super.disconnectedCallback();
  }
  private changed = () => this.requestUpdate();

  override updated(): void {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot:not([name])');
    const assigned = slot?.assignedElements() ?? [];
    const fallback = this.renderRoot.querySelector<HTMLElement>('.lab-tooltip-fallback');
    if (fallback) {
      if (assigned.length) fallback.removeAttribute('tabindex');
      else fallback.tabIndex = 0;
    }
    const source = assigned[0] ?? fallback;
    if (source !== this.source) {
      this.clear();
      this.source = source;
      if (source?.localName === 'lab-button') {
        const generation = this.generation;
        void this.ownerDocument.defaultView?.customElements.whenDefined('lab-button').then(() => {
          if (!this.isConnected || generation !== this.generation) return;
          this.stopSubscription = (source as LabButton).interactionTarget.subscribe((target) =>
            this.bind(target),
          );
        });
      } else if (
        source instanceof HTMLElement &&
        source.matches('button,a[href],input,select,textarea,[tabindex]')
      )
        this.bind(source);
      else if (source)
        throw new TypeError('LabTooltip requires one native focusable control or LabButton.');
    }
    this.controller?.update(this.options());
  }
  override render(): TemplateResult {
    // The structure is identical before and after hydration. Plain text acquires
    // a focusable text anchor on slotchange; supplied controls stay the only action.
    return html`
      <span class="lab-tooltip-fallback" part="trigger"><slot @slotchange=${this.changed}></slot></span>
      <div popover="manual" class="lab-tooltip-positioner" part="positioner">
        <div class="lab-tooltip-content" part="content" data-type=${this.type} data-size=${this.size} hidden>
          <slot name="content" @slotchange=${this.changed}>${this.content}</slot>
          <span class="lab-tooltip-arrow" part="arrow" data-tail=${this.tail} ?hidden=${!this.arrow} aria-hidden="true"></span>
        </div>
      </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-tooltip': LabTooltip;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-tooltip'))
  customElements.define('lab-tooltip', LabTooltip);
