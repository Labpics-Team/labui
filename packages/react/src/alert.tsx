'use client';
import { symbol as alertCircle } from '@labpics/icons/symbols/alert-circle';
import { symbol as close } from '@labpics/icons/symbols/close';
import {
  type LabAlertAnnouncement,
  type LabAlertType,
  alertQuantity,
} from '@labpics/ui-core/alert/contract';
import { mountAlertRuntime } from '@labpics/ui-core/alert/runtime';
import { alertProfile } from '@labpics/ui-tokens';
import {
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Icon } from './icon.js';
import '@labpics/ui-materials/material.css';
import '@labpics/ui-core/alert.css';

export type { LabAlertAnnouncement, LabAlertType };
export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  heading: string;
  description?: string;
  type?: LabAlertType;
  quantity?: number;
  open?: boolean;
  defaultOpen?: boolean;
  showIcon?: boolean;
  icon?: ReactNode;
  closeLabel?: string;
  announcement?: LabAlertAnnouncement;
  notificationKey?: string | number;
  /** preventDefault keeps an uncontrolled alert open. Controlled alerts request dismissal only. */
  onDismiss?: (event: MouseEvent<HTMLButtonElement>) => void;
}
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  {
    heading,
    description = '',
    type = 'neutral',
    quantity = 1,
    open,
    defaultOpen = true,
    showIcon = true,
    icon,
    closeLabel = 'Закрыть уведомление',
    announcement = 'polite',
    notificationKey,
    onDismiss,
    ...rest
  },
  ref,
) {
  const [uncontrolledOpen, setOpen] = useState(defaultOpen);
  const [iconSize, setIconSize] = useState<number>(alertProfile.iconSize);
  const visible = open ?? uncontrolledOpen;
  const depth = alertQuantity(quantity);
  const panel = useRef<HTMLDivElement | null>(null);
  const live = useRef<HTMLSpanElement>(null);
  const runtime = useRef<ReturnType<typeof mountAlertRuntime>>();
  useClientLayoutEffect(() => {
    if (!panel.current || !live.current) return;
    runtime.current ??= mountAlertRuntime(panel.current, live.current, (px) => {
      if (px > 0) setIconSize(px);
    });
    runtime.current.update({ open: visible, heading, description, notificationKey });
  });
  useClientLayoutEffect(
    () => () => {
      runtime.current?.dispose();
      runtime.current = undefined;
    },
    [],
  );
  return (
    <>
      <div
        {...rest}
        data-lab-alert=""
        data-type={type}
        data-quantity={depth}
        hidden={!visible}
        ref={(node) => {
          panel.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
      >
        <div className="lab-alert-surface lab-material lab-material--elevated">
          <div className="lab-alert-label">
            {showIcon && (
              <span className="lab-alert-icon" aria-hidden="true">
                {icon ?? <Icon symbol={alertCircle} size={iconSize} />}
              </span>
            )}
            <div className="lab-alert-content">
              <p className="lab-alert-heading">{heading}</p>
              {description && <p className="lab-alert-description">{description}</p>}
            </div>
          </div>
          <button
            type="button"
            className="lab-alert-close"
            aria-label={closeLabel || 'Закрыть уведомление'}
            onClick={(event) => {
              onDismiss?.(event);
              if (!event.defaultPrevented && open === undefined) setOpen(false);
            }}
          >
            <Icon symbol={close} size={iconSize} />
          </button>
        </div>
        {depth > 1 && (
          <div className="lab-alert-layer" data-depth="1" aria-hidden="true">
            <span className="lab-material lab-material--base" />
          </div>
        )}
        {depth > 2 && (
          <div className="lab-alert-layer" data-depth="2" aria-hidden="true">
            <span className="lab-material lab-material--muted" />
          </div>
        )}
      </div>
      <span
        className="lab-alert-announcement"
        ref={live}
        role={announcement === 'assertive' ? 'alert' : 'status'}
        aria-atomic="true"
      />
    </>
  );
});
