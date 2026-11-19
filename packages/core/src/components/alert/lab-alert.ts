import { symbol as alertCircle } from '@labpics/icons/symbols/alert-circle';
import { symbol as close } from '@labpics/icons/symbols/close';
import { materialCss } from '@labpics/ui-materials/css';
import { alertProfile } from '@labpics/ui-tokens';
import { css, html, nothing, unsafeCSS } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import '../icon/index.js';
import { type LabAlertAnnouncement, type LabAlertType, alertQuantity } from './contract.js';
import { mountAlertRuntime } from './runtime.js';
import { alertCss } from './styles.js';

export type { LabAlertAnnouncement, LabAlertType } from './contract.js';

// Default-true booleans need an explicit false in SSR and generated bindings.
const defaultTrue = {
  fromAttribute: (value: string | null) => value !== 'false',
  toAttribute: (value: boolean) => String(value),
};

/** Important, persistent feedback. Quantity is visual depth, never a message queue. */
export class LabAlert extends LabElement {
  static override properties = {
    open: { converter: defaultTrue, reflect: true, useDefault: true },
    controlled: { type: Boolean, reflect: true },
    type: { reflect: true },
    quantity: { type: Number, reflect: true },
    heading: {},
    description: {},
    showIcon: { converter: defaultTrue, attribute: 'show-icon', reflect: true, useDefault: true },
    closeLabel: { attribute: 'close-label' },
    announcement: { reflect: true },
    notificationKey: { attribute: 'notification-key' },
    iconSize: { state: true },
  };
  declare open: boolean;
  declare controlled: boolean;
  declare type: LabAlertType;
  declare quantity: number;
  declare heading: string;
  declare description: string;
  declare showIcon: boolean;
  declare closeLabel: string;
  declare announcement: LabAlertAnnouncement;
  declare notificationKey: string | number | undefined;
  private declare iconSize: number;
  private runtime?: ReturnType<typeof mountAlertRuntime>;
  constructor() {
    super();
    this.open = true;
    this.controlled = false;
    this.type = 'neutral';
    this.quantity = 1;
    this.heading = '';
    this.description = '';
    this.showIcon = true;
    this.closeLabel = 'Закрыть уведомление';
    this.announcement = 'polite';
    this.iconSize = alertProfile.iconSize;
  }
  static override styles = [
    unsafeCSS(materialCss),
    unsafeCSS(alertCss),
    css`
    :host { display: block; min-width: 0; max-width: 100%; }
    ::slotted([slot='icon']) { width: 100%; height: 100%; }
  `,
  ];
  private readonly dismiss = () => {
    const accepted = this.dispatchEvent(
      new CustomEvent('dismiss', { bubbles: true, composed: true, cancelable: true }),
    );
    if (accepted && !this.controlled) this.open = false;
  };
  override connectedCallback() {
    super.connectedCallback();
    this.requestUpdate();
  }
  override updated() {
    if (!this.isConnected) return;
    const panel = this.renderRoot.querySelector<HTMLElement>('[data-lab-alert]');
    const live = this.renderRoot.querySelector<HTMLElement>('.lab-alert-announcement');
    if (!panel || !live) return;
    this.runtime ??= mountAlertRuntime(panel, live, (px) => {
      if (px > 0 && this.iconSize !== px) this.iconSize = px;
    });
    this.runtime.update(this);
  }
  override disconnectedCallback() {
    this.runtime?.dispose();
    this.runtime = undefined;
    super.disconnectedCallback();
  }
  override render() {
    const quantity = alertQuantity(this.quantity);
    return html`<div data-lab-alert data-type=${this.type} data-quantity=${quantity} part="alert" ?hidden=${!this.open}>
      <div class="lab-alert-surface lab-material lab-material--elevated" part="surface">
        <div class="lab-alert-label">
          ${this.showIcon ? html`<span class="lab-alert-icon" part="icon" aria-hidden="true"><slot name="icon"><lab-icon .symbol=${alertCircle} .size=${this.iconSize}></lab-icon></slot></span>` : nothing}
          <div class="lab-alert-content" part="content">
            <p class="lab-alert-heading" part="heading">${this.heading}</p>
            ${this.description ? html`<p class="lab-alert-description" part="description">${this.description}</p>` : nothing}
          </div>
        </div>
        <button type="button" class="lab-alert-close" part="close" aria-label=${this.closeLabel || 'Закрыть уведомление'} @click=${this.dismiss}><lab-icon .symbol=${close} .size=${this.iconSize}></lab-icon></button>
      </div>
      ${quantity > 1 ? html`<div class="lab-alert-layer" data-depth="1" part="stack" aria-hidden="true"><span class="lab-material lab-material--base"></span></div>` : nothing}
      ${quantity > 2 ? html`<div class="lab-alert-layer" data-depth="2" part="stack" aria-hidden="true"><span class="lab-material lab-material--muted"></span></div>` : nothing}
    </div>
    <span class="lab-alert-announcement" role=${this.announcement === 'assertive' ? 'alert' : 'status'} aria-atomic="true"></span>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-alert': LabAlert;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-alert'))
  customElements.define('lab-alert', LabAlert);
