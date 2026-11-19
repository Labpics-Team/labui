import { symbol as checkmark } from '@labpics/icons/symbols/checkmark';
import { symbol as chevronForward } from '@labpics/icons/symbols/chevron-forward';
import { type PropertyValues, css, html, unsafeCSS } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import '../icon/index.js';
import { type LabDragButtonStatus, mountDragButton } from './runtime.js';
import { dragButtonCss } from './styles.js';
export type { LabDragButtonStatus, LabDragButtonSource } from './runtime.js';

/** A native action button; horizontal dragging is an optional confirmation gesture. */
export class LabDragButton extends LabElement {
  static override properties = {
    label: {},
    helperText: { attribute: 'helper-text' },
    showHelper: { type: Boolean, attribute: 'show-helper', reflect: true },
    pendingText: { attribute: 'pending-text' },
    successText: { attribute: 'success-text' },
    dangerText: { attribute: 'danger-text' },
    status: { reflect: true },
    disabled: { type: Boolean, reflect: true },
    resetKey: { attribute: 'reset-key' },
    currentStatus: { state: true },
    iconSize: { state: true },
  };
  declare label: string;
  declare helperText: string;
  declare showHelper: boolean;
  declare pendingText: string;
  declare successText: string;
  declare dangerText: string;
  declare status: LabDragButtonStatus;
  declare disabled: boolean;
  declare resetKey: string;
  private declare currentStatus: LabDragButtonStatus;
  private declare iconSize: number;
  private runtime?: ReturnType<typeof mountDragButton>;
  constructor() {
    super();
    this.label = 'Confirm';
    this.helperText = 'Swipe it';
    this.showHelper = true;
    this.pendingText = 'Pending';
    this.successText = 'Success';
    this.dangerText = 'Error';
    this.status = 'idle';
    this.currentStatus = 'idle';
    this.iconSize = 24;
    this.disabled = false;
    this.resetKey = '';
  }
  static override styles = [unsafeCSS(dragButtonCss), css`:host { display: block; min-width: 0; }`];
  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('status')) this.currentStatus = this.status;
  }
  protected override updated(): void {
    const options = {
      status: this.status,
      disabled: this.disabled,
      resetKey: this.resetKey,
      size: (pixels: number) => {
        if (this.iconSize !== pixels) this.iconSize = pixels;
      },
      change: (status: LabDragButtonStatus) => {
        if (this.currentStatus !== status) this.currentStatus = status;
      },
      complete: (source: 'drag' | 'press') => {
        this.dispatchEvent(
          new CustomEvent<{ source: 'drag' | 'press' }>('complete', {
            detail: { source },
            bubbles: true,
            composed: true,
          }),
        );
      },
    };
    if (!this.runtime) {
      const button = this.renderRoot.querySelector('button');
      if (button) this.runtime = mountDragButton(button, options);
    } else this.runtime.update(options);
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }
  override disconnectedCallback(): void {
    this.runtime?.dispose();
    this.runtime = undefined;
    super.disconnectedCallback();
  }
  override render() {
    const status = this.currentStatus;
    const result = status === 'success' || status === 'danger';
    const text =
      status === 'success'
        ? this.successText
        : status === 'danger'
          ? this.dangerText
          : this.pendingText;
    return html`
      <button type="button" data-lab-drag-button data-status=${status} ?disabled=${this.disabled}
        aria-label=${this.label} aria-disabled=${String(this.disabled || status !== 'idle')} aria-busy=${String(status === 'pending')}>
        <span class="lab-drag-track" aria-hidden="true"><span class="lab-drag-helper" ?hidden=${!this.showHelper}>${this.helperText}</span></span>
        <span class="lab-drag-fill" aria-hidden="true">
          <span class="lab-drag-chevron" ?hidden=${status !== 'idle'}><lab-icon .symbol=${chevronForward} .size=${this.iconSize}></lab-icon></span>
          <span class="lab-drag-result" ?hidden=${status === 'idle'}>
            <span class="lab-drag-icon" ?hidden=${!result}><lab-icon .symbol=${checkmark} .size=${this.iconSize}></lab-icon></span>
            <span class="lab-drag-spinner" ?hidden=${status !== 'pending'}></span>
            <span class="lab-drag-result-text">${text}</span>
          </span>
        </span>
      </button>
      <output class="lab-drag-announcement" aria-live="polite" aria-atomic="true">${status === 'idle' ? '' : text}</output>
    `;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-drag-button': LabDragButton;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-drag-button'))
  customElements.define('lab-drag-button', LabDragButton);
