/**
 * <AlertDialog> — the native-React twin of the Lit `<lab-alert-dialog>` (ADR-0001).
 *
 * It is `<Dialog>` with `role="alertdialog"` — and that single role change is
 * load-bearing in the `@zag-js/dialog` machine, not cosmetic. The machine reads the
 * role to:
 *   - render role="alertdialog" on the content (announced as an interrupting alert);
 *   - resolve closeOnInteractOutside to `modal && !alertDialog` → FALSE, so an
 *     alert-dialog does NOT dismiss on outside-click (the decision must be explicit:
 *     a confirm or a cancel action, never an accidental scrim click);
 *   - default initialFocus to the close trigger.
 * Escape still cancels (closeOnEscape stays true).
 *
 * Everything else — the body portal that makes the focus trap real, scroll-lock,
 * scrim, aria wiring, focus move-in + restore — is inherited unchanged from `<Dialog>`.
 * Project confirm/cancel controls through `content`; they are trapped like any other
 * dialog body. `closable` stays the default `true`: the close button is the canonical
 * cancel and the machine's initialFocus target.
 */
'use client';

import type { ReactNode } from 'react';
import { Dialog, type DialogProps } from './dialog.js';

/** AlertDialog props are Dialog's, minus `role` (it is fixed to `alertdialog`). */
export type AlertDialogProps = Omit<DialogProps, 'role'>;

export function AlertDialog(props: AlertDialogProps): ReactNode {
  return <Dialog {...props} role="alertdialog" />;
}
