'use client';
import type { LabPopoverPlacement } from '@labpics/ui-core/dialog/runtime';
import type { ReactNode } from 'react';
import { type DialogProps, DialogSurface } from './dialog.js';
export interface PopoverProps extends Omit<DialogProps, 'role'> {
  placement?: LabPopoverPlacement;
  arrow?: boolean;
}
export function Popover({
  placement = 'bottom',
  modal = false,
  closable = false,
  arrow = true,
  ...props
}: PopoverProps): ReactNode {
  return (
    <DialogSurface
      {...props}
      placement={placement}
      modal={modal}
      closable={closable}
      arrow={arrow}
    />
  );
}
