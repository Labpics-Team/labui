'use client';
import { type ReactNode, useRef } from 'react';
import { Button } from './button.js';
import { Dialog, type DialogProps } from './dialog.js';

export interface AlertDialogProps
  extends Omit<DialogProps, 'role' | 'actions' | 'modal' | 'initialFocus'> {
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  /** Reports intent; close through open/onOpenChange when the operation finishes. */
  onConfirm?: () => void;
  onCancel?: () => void;
}
export function AlertDialog({
  confirmLabel = 'Продолжить',
  cancelLabel = 'Отмена',
  pending = false,
  onConfirm,
  onCancel,
  closable = false,
  ...props
}: AlertDialogProps): ReactNode {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      {...props}
      role="alertdialog"
      closable={closable}
      initialFocus={() => cancel.current}
      actions={({ close }) => (
        <>
          <Button type="neutral" kind="fill" size="m" loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button
            ref={cancel}
            type="neutral"
            kind="tinted"
            size="m"
            onClick={() => {
              onCancel?.();
              close();
            }}
          >
            {cancelLabel}
          </Button>
        </>
      )}
    />
  );
}
