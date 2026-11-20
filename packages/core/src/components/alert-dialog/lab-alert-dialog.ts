import { html } from 'lit';
import type { LabButton } from '../button/lab-button.js';
import { LabDialog, type LabDialogRole } from '../dialog/lab-dialog.js';

/** Confirm reports intent and stays open until the application finishes.
 * Cancel and Escape close; outside clicks never do. */
export class LabAlertDialog extends LabDialog {
  static override properties = {
    confirmLabel: { attribute: 'confirm-label' },
    cancelLabel: { attribute: 'cancel-label' },
    pending: { type: Boolean, reflect: true },
  };
  declare confirmLabel: string;
  declare cancelLabel: string;
  declare pending: boolean;
  protected override dialogRole: LabDialogRole = 'alertdialog';
  constructor() {
    super();
    this.closable = false;
    this.confirmLabel = 'Продолжить';
    this.cancelLabel = 'Отмена';
    this.pending = false;
  }
  protected override initialFocus(): HTMLElement | null {
    return (
      this.renderRoot.querySelector<LabButton>('[data-cancel]')?.interactionTarget.current ?? null
    );
  }
  protected override renderActions() {
    return html`
      <lab-button kind="fill" type="neutral" size="m" ?loading=${this.pending}
        @click=${() => {
          if (!this.pending)
            this.dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true }));
        }}>${this.confirmLabel}</lab-button>
      <lab-button data-cancel kind="tinted" type="neutral" size="m"
        @click=${() => {
          this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
          this.changeOpen(false);
        }}>${this.cancelLabel}</lab-button>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lab-alert-dialog': LabAlertDialog;
  }
}
export function registerLabAlertDialog(): void {
  if (typeof customElements !== 'undefined' && !customElements.get('lab-alert-dialog'))
    customElements.define('lab-alert-dialog', LabAlertDialog);
}
