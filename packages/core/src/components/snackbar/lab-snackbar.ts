import { materialCss } from '@labpics/ui-materials/css';
import { snackbarProfile } from '@labpics/ui-tokens';
import { type PropertyValues, css, html, nothing, unsafeCSS } from 'lit';
import { LabElement } from '../../lit/lab-element.js';
import '../button/lab-button.js';
import { type SnackbarRuntime, mountSnackbarRuntime } from './runtime.js';
import { snackbarCss } from './styles.js';

/** A brief outcome with one optional action. Position belongs to the surrounding view. */
export class LabSnackbar extends LabElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    message: {},
    duration: { type: Number },
    actionLabel: { attribute: 'action-label' },
    notificationKey: { attribute: 'notification-key' },
  };
  declare open: boolean;
  declare message: string;
  declare duration: number;
  declare actionLabel: string;
  declare notificationKey: string | number | undefined;
  private runtime: SnackbarRuntime | undefined;

  constructor() {
    super();
    this.open = false;
    this.message = '';
    this.duration = snackbarProfile.durationMs;
    this.actionLabel = '';
  }
  static override styles = [
    unsafeCSS(materialCss),
    unsafeCSS(snackbarCss),
    css`:host { display: block; max-width: 100%; }`,
  ];
  private close(): void {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('lab-open-change', {
        detail: { open: false },
        bubbles: true,
        composed: true,
      }),
    );
  }
  private readonly action = (): void => {
    const event = new CustomEvent('lab-action', {
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    if (this.dispatchEvent(event)) this.close();
  };
  override updated(_changed: PropertyValues): void {
    if (!this.isConnected) return;
    const panel = this.renderRoot.querySelector<HTMLElement>('[data-lab-snackbar]');
    const announcement = this.renderRoot.querySelector<HTMLElement>('[role=status]');
    if (!panel || !announcement) return;
    this.runtime ??= mountSnackbarRuntime(panel, announcement, {
      onTimeout: () => this.close(),
      onError: (error) =>
        this.dispatchEvent(
          new CustomEvent('lab-error', {
            detail: { error },
            bubbles: true,
            composed: true,
          }),
        ),
    });
    this.runtime.update(this);
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate();
  }
  override disconnectedCallback(): void {
    try {
      this.runtime?.dispose();
    } finally {
      this.runtime = undefined;
      super.disconnectedCallback();
    }
  }
  override render() {
    const size = snackbarProfile.timer.size;
    const stroke = snackbarProfile.timer.strokeWidth;
    return html`
      <div data-lab-snackbar class="lab-material lab-material--elevated" part="surface" ?hidden=${!this.open}>
        <div class="lab-snackbar-label">
          <span class="lab-snackbar-timer" aria-hidden="true" ?hidden=${this.duration === 0}>
            <svg viewBox="0 0 ${size} ${size}" fill="none">
              <circle class="lab-snackbar-ring" r=${(size - stroke) / 2} cx="0" cy="0"
                transform="translate(${size / 2} ${size / 2}) rotate(-90) scale(1 -1)"
                pathLength="1" stroke="currentColor" stroke-width=${stroke} stroke-linecap="round" />
            </svg>
            <span class="lab-snackbar-count">${Math.ceil(this.duration / 1000)}</span>
          </span>
          <span class="lab-snackbar-message" part="message">${this.message}</span>
        </div>
        ${this.actionLabel ? html`<lab-button class="lab-snackbar-action" part="action" size="s" type="accent" kind="ghost" @click=${this.action}>${this.actionLabel}</lab-button>` : nothing}
      </div>
      <span class="lab-snackbar-announcement" role="status" aria-atomic="true"></span>
    `;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-snackbar': LabSnackbar;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('lab-snackbar')) {
  customElements.define('lab-snackbar', LabSnackbar);
}
