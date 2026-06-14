/**
 * `<lab-alert-dialog>` — the STRICTER dialog: a blocking confirmation that demands an
 * explicit decision. It is `<lab-dialog>` with `role="alertdialog"`, and that single
 * role change is load-bearing in the machine, not cosmetic.
 *
 * What the role buys (all machine-owned, see @zag-js/dialog `props`):
 *   - role="alertdialog" on the content — assistive tech announces it as an alert that
 *     interrupts and expects a response (vs a plain dialog).
 *   - closeOnInteractOutside resolves to `modal && !alertDialog` → FALSE: an
 *     alert-dialog does NOT dismiss on outside-click. The decision must be explicit —
 *     a confirm or a cancel action — never an accidental click on the scrim.
 *   - initialFocusEl defaults to the close trigger, so focus lands on a safe control.
 *   Escape still dismisses (closeOnEscape stays true) — that is the keyboard cancel.
 *
 * Everything else — the light-DOM portal that makes the focus trap REAL around slotted
 * controls, scroll-lock, scrim, aria-labelledby/describedby, focus move-in + restore —
 * is inherited unchanged from `<lab-dialog>`. The consumer is expected to project
 * confirm/cancel controls through `slot="content"`; those controls are relocated into
 * the portal body and trapped like any other dialog body.
 *
 * `closable` defaults true here too: the close button is the canonical cancel and the
 * machine's initialFocus target. A heading is strongly recommended (an alert without a
 * question is not an alert) but not enforced in code — that is editorial, documented
 * in the doc page, not a runtime throw.
 */
import { LabDialog, type LabDialogRole } from '../dialog/lab-dialog.js';

export class LabAlertDialog extends LabDialog {
  /** The only behavioural change: the stricter ARIA role, which the machine reads to
   * disable outside-click dismissal and announce an interrupting alert. */
  protected override dialogRole: LabDialogRole = 'alertdialog';
}

declare global {
  interface HTMLElementTagNameMap {
    'lab-alert-dialog': LabAlertDialog;
  }
}

/**
 * Idempotent registration — exported and invoked from the BARREL (`index.ts`), for the
 * same reason as `<lab-dialog>`: this module shares the `LabDialog` base in a hoisted
 * chunk, so the registration must live in the sideEffects-protected
 * `dist/components/alert-dialog/index.js`, not as a bare top-level side-effect here.
 */
export function registerLabAlertDialog(): void {
  if (typeof customElements !== 'undefined' && !customElements.get('lab-alert-dialog')) {
    customElements.define('lab-alert-dialog', LabAlertDialog);
  }
}
