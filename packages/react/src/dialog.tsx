'use client';
import { symbol as close } from '@labpics/icons/symbols/close';
import {
  type DialogOptions,
  type LabDialogRole,
  type LabDialogSize,
  type LabPopoverPlacement,
  mountDialog,
} from '@labpics/ui-core/dialog/runtime';
import { dialogProfile } from '@labpics/ui-tokens';
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { type ModalTrigger, useModalTrigger } from './components/modal-trigger.js';
import { Icon } from './icon.js';
import '@labpics/ui-materials/material.css';
import '@labpics/ui-core/dialog.css';

export interface DialogProps {
  content?: ReactNode;
  heading?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode | ((controls: { close(): void }) => ReactNode);
  size?: LabDialogSize;
  open?: boolean;
  defaultOpen?: boolean;
  modal?: boolean;
  closable?: boolean;
  closeLabel?: string;
  role?: LabDialogRole;
  'aria-label'?: string;
  initialFocus?: () => HTMLElement | null;
  onOpenChange?: (open: boolean) => void;
  trigger?: ModalTrigger;
  children?: ReactNode;
}
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** DOM and React state remain in their original tree; the shared Core runtime
 * supplies top-layer modality, focus restoration and anchored positioning. */
export function DialogSurface({
  content,
  heading,
  description,
  actions,
  size = 'm',
  open,
  defaultOpen = false,
  modal = true,
  closable = true,
  closeLabel = 'Закрыть',
  role = 'dialog',
  'aria-label': ariaLabel = 'Диалог',
  initialFocus,
  onOpenChange,
  trigger,
  children,
  placement,
  arrow = false,
}: DialogProps & { placement?: LabPopoverPlacement; arrow?: boolean }): ReactNode {
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const isOpen = open ?? localOpen;
  const isModal = role === 'alertdialog' || modal;
  const id = useId();
  const plane = useRef<HTMLDialogElement>(null);
  const positioner = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement | null>(null);
  const runtime = useRef<ReturnType<typeof mountDialog>>();
  const mountedTrigger = useRef<HTMLButtonElement | null>(null);
  const { triggerEl, renderTrigger } = useModalTrigger('LabDialog', trigger, children);
  const hasHeading = heading != null && heading !== false && heading !== '';
  const hasDescription = description != null && description !== false && description !== '';
  function changeOpen(next: boolean): void {
    if (next === isOpen) return;
    if (open === undefined) setLocalOpen(next);
    onOpenChange?.(next);
  }
  const options = useRef<DialogOptions>(null as unknown as DialogOptions);
  options.current = {
    open: isOpen,
    modal: isModal,
    role,
    heading: hasHeading,
    description: hasDescription,
    ariaLabel,
    initialFocus,
    onOpenChange: changeOpen,
    placement,
    arrow,
  };
  useClientLayoutEffect(() => {
    const target = triggerEl();
    if (target !== mountedTrigger.current) {
      runtime.current?.dispose();
      runtime.current = undefined;
      mountedTrigger.current = target;
      if (target && plane.current && positioner.current && surface.current)
        runtime.current = mountDialog(
          target,
          plane.current,
          positioner.current,
          surface.current,
          options.current,
        );
    }
    runtime.current?.update(options.current);
  });
  useClientLayoutEffect(
    () => () => {
      runtime.current?.dispose();
      runtime.current = undefined;
      mountedTrigger.current = null;
    },
    [],
  );
  const closeDialog = () => changeOpen(false);
  const actionContent = typeof actions === 'function' ? actions({ close: closeDialog }) : actions;
  return (
    <>
      {renderTrigger({
        id: `${id}-trigger`,
        'aria-haspopup': 'dialog',
        'aria-expanded': isOpen,
        ...{ 'data-scope': 'dialog', 'data-part': 'trigger', 'data-ownedby': id },
      })}
      <dialog ref={plane} id={id} className="lab-dialog-plane">
        {isModal && <div className="lab-dialog-backdrop" aria-hidden="true" />}
        <div
          ref={positioner}
          className={placement ? 'lab-popover-positioner' : 'lab-dialog-positioner'}
          data-size={size}
        >
          <div className="lab-dialog-stage" data-size={size}>
            <div
              className="lab-dialog-material lab-material lab-material--elevated"
              aria-hidden="true"
            />
            <div className="lab-dialog-reveal">
              <div ref={surface} className="lab-dialog-content" data-size={size}>
                {(hasHeading || hasDescription || closable) && (
                  <div className="lab-dialog-header">
                    <div className="lab-dialog-labels">
                      {hasHeading && (
                        <h2 id={`${id}-heading`} className="lab-dialog-heading">
                          {heading}
                        </h2>
                      )}
                      {hasDescription && (
                        <p id={`${id}-description`} className="lab-dialog-description">
                          {description}
                        </p>
                      )}
                    </div>
                    {closable && (
                      <button
                        type="button"
                        className="lab-dialog-close"
                        aria-label={closeLabel}
                        onClick={closeDialog}
                      >
                        <Icon symbol={close} size={dialogProfile.iconSize} />
                      </button>
                    )}
                  </div>
                )}
                {content != null && <div className="lab-dialog-body">{content}</div>}
                {actionContent != null && <div className="lab-dialog-actions">{actionContent}</div>}
              </div>
            </div>
          </div>
          {placement && arrow && <span className="lab-popover-arrow" aria-hidden="true" />}
        </div>
      </dialog>
    </>
  );
}
export function Dialog(props: DialogProps): ReactNode {
  return <DialogSurface {...props} />;
}
