'use client';

import { type SnackbarRuntime, mountSnackbarRuntime } from '@labpics/ui-core/snackbar/runtime';
import { snackbarProfile } from '@labpics/ui-tokens';
import { type HTMLAttributes, type MouseEvent, useEffect, useLayoutEffect, useRef } from 'react';
import { Button } from './button.js';
import '@labpics/ui-materials/material.css';
import '@labpics/ui-core/snackbar.css';

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
export interface SnackbarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  open: boolean;
  message: string;
  /** Milliseconds; 0 keeps the message until the application closes it. */
  duration?: number;
  actionLabel?: string;
  /** A new key restarts repeated messages without remounting their action. */
  notificationKey?: string | number;
  onOpenChange?(open: boolean): void;
  onAction?(event: MouseEvent<HTMLButtonElement>): void;
  onRuntimeError?(error: unknown): void;
}

export function Snackbar({
  open,
  message,
  duration = snackbarProfile.durationMs,
  actionLabel,
  notificationKey,
  onOpenChange,
  onAction,
  onRuntimeError,
  ...props
}: SnackbarProps) {
  const panel = useRef<HTMLDivElement>(null);
  const announcement = useRef<HTMLSpanElement>(null);
  const runtime = useRef<SnackbarRuntime>();
  const latest = useRef({ onOpenChange, onRuntimeError });
  latest.current = { onOpenChange, onRuntimeError };
  useClientLayoutEffect(() => {
    if (!panel.current || !announcement.current) return;
    runtime.current ??= mountSnackbarRuntime(panel.current, announcement.current, {
      onTimeout: () => latest.current.onOpenChange?.(false),
      onError: (error) => latest.current.onRuntimeError?.(error),
    });
    runtime.current.update({ open, message, duration, notificationKey });
  });
  useClientLayoutEffect(
    () => () => {
      runtime.current?.dispose();
      runtime.current = undefined;
    },
    [],
  );
  const size = snackbarProfile.timer.size;
  const stroke = snackbarProfile.timer.strokeWidth;
  return (
    <div {...props}>
      <div
        ref={panel}
        data-lab-snackbar=""
        className="lab-material lab-material--elevated"
        hidden={!open}
      >
        <div className="lab-snackbar-label">
          <span className="lab-snackbar-timer" aria-hidden="true" hidden={duration === 0}>
            <svg viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
              <circle
                className="lab-snackbar-ring"
                r={(size - stroke) / 2}
                cx="0"
                cy="0"
                transform={`translate(${size / 2} ${size / 2}) rotate(-90) scale(1 -1)`}
                pathLength="1"
                stroke="currentColor"
                strokeWidth={stroke}
                strokeLinecap="round"
              />
            </svg>
            <span className="lab-snackbar-count">{Math.ceil(duration / 1000)}</span>
          </span>
          <span className="lab-snackbar-message">{message}</span>
        </div>
        {actionLabel && (
          <Button
            className="lab-snackbar-action"
            size="s"
            type="accent"
            kind="ghost"
            onClick={(event) => {
              onAction?.(event);
              if (!event.defaultPrevented) onOpenChange?.(false);
            }}
          >
            {actionLabel}
          </Button>
        )}
      </div>
      <span
        ref={announcement}
        className="lab-snackbar-announcement"
        role="status"
        aria-atomic="true"
      />
    </div>
  );
}
