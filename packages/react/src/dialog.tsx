/**
 * <Dialog> — the native-React twin of the Lit `<lab-dialog>` (ADR-0001).
 *
 * Same axes, same `@zag-js/dialog` machine through the SAME Behaviors seam — here via
 * `useZag`. The machine owns open-on-click, focus move-in + restore-on-close, dismiss
 * (Escape / outside-click), the modal focus-trap + scroll-lock + outside-content
 * hiding, `role="dialog"` + `aria-modal`/`aria-labelledby`/`aria-describedby`. The
 * component spreads prop-getters and paints with the SAME `--lab-*` roles — parity is
 * CSS, not a second behaviour.
 *
 * ── The overlay canon (React half) — the trap is REAL here for free ──────────────
 * React помещает content в document.body через createPortal; controls остаются
 * потомками модальной поверхности. Lit проецирует consumer subtree через слоты.
 * Оба рендерера используют поведение и общий focus runtime из Core.
 * До mounted сервер не выводит клиентскую модальную поверхность.
 *
 * Client Component: a dialog is interactive (open state, focus, scroll-lock). It is a
 * leaf under a Server Component shell — never a `'use client'` page (dive-next P1).
 */
'use client';

import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import * as dialogMachine from '@labpics/ui-core/behaviors/dialog';
import type { LabDialogRole, LabDialogSize } from '@labpics/ui-core/dialog';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useZag } from './use-zag.js';
import './dialog.css';

type DialogSchema = SchemaOf<dialogMachine.Service>;
type DialogApi = dialogMachine.Api;

const dialogModule: MachineModule<DialogSchema, DialogApi> = dialogMachine;

export interface DialogProps {
  /** The dialog body (parity with the Lit slot="content"). */
  content?: ReactNode;
  /** Optional dialog heading — wires aria-labelledby on the content. */
  heading?: ReactNode;
  /** Optional dialog description — wires aria-describedby on the content. */
  description?: ReactNode;
  /** Control size — drives panel width band and padding. */
  size?: LabDialogSize;
  /** When true (default): focus trap + scroll lock + outside content hidden + scrim. */
  modal?: boolean;
  /** Render a built-in close button wired to the machine. */
  closable?: boolean;
  /** The dialog's ARIA role. `alertdialog` is the stricter variant (no outside-click
   * dismissal). Defaults to `dialog`; `<AlertDialog>` sets `alertdialog`. */
  role?: LabDialogRole;
  /** Fires when the machine opens or closes (machine is the source of truth). */
  onOpenChange?: (open: boolean) => void;
  /** The trigger content — wrapped in the accessible trigger button. */
  children?: ReactNode;
}

/**
 * The shared dialog implementation. `<Dialog>` and `<AlertDialog>` are thin presets
 * over it — the ONLY difference is the `role` the machine reads (which flips
 * outside-click dismissal and the announced role), so they share one component and one
 * stylesheet rather than duplicating the floating tree.
 */
export function Dialog({
  content,
  heading,
  description,
  size = 'm',
  modal = true,
  closable = true,
  role = 'dialog',
  onOpenChange,
  children,
}: DialogProps): ReactNode {
  const api = useZag(dialogModule, {
    id: useId(),
    role,
    modal,
    onOpenChange: onOpenChange ? (details) => onOpenChange(details.open) : undefined,
  });

  // Dialogs are client-only: gate the body portal on mount so SSR/first hydration emit
  // nothing for the floating layer.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const floating = (
    <>
      {modal && api.open && <div {...api.getBackdropProps()} className="lab-dialog-backdrop" />}
      <div
        {...api.getPositionerProps()}
        className="lab-dialog-positioner"
        data-open={api.open || undefined}
        data-modal={modal || undefined}
      >
        <div {...api.getContentProps()} className="lab-dialog-content" data-size={size}>
          {heading != null && (
            <h2 {...api.getTitleProps()} className="lab-dialog-heading">
              {heading}
            </h2>
          )}
          {description != null && (
            <p {...api.getDescriptionProps()} className="lab-dialog-description">
              {description}
            </p>
          )}
          <div className="lab-dialog-body">{content}</div>
          {closable && (
            <button {...api.getCloseTriggerProps()} className="lab-dialog-close" aria-label="Close">
              ×
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      <button type="button" {...api.getTriggerProps()} className="lab-dialog-trigger">
        {children}
      </button>
      {mounted && createPortal(floating, document.body)}
    </>
  );
}
