'use client';
import { symbol as checkmark } from '@labpics/icons/symbols/checkmark';
import { symbol as chevronForward } from '@labpics/icons/symbols/chevron-forward';
import {
  type LabDragButtonSource,
  type LabDragButtonStatus,
  mountDragButton,
} from '@labpics/ui-core/drag-button/runtime';
import { type ButtonHTMLAttributes, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './icon.js';
import '@labpics/ui-core/drag-button.css';
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface DragButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick'> {
  label: string;
  helperText?: string;
  showHelper?: boolean;
  pendingText?: string;
  successText?: string;
  dangerText?: string;
  status?: LabDragButtonStatus;
  resetKey?: string | number;
  onComplete?: (source: LabDragButtonSource) => void;
}
export function DragButton({
  label,
  helperText = 'Swipe it',
  showHelper = true,
  pendingText = 'Pending',
  successText = 'Success',
  dangerText = 'Error',
  status = 'idle',
  resetKey,
  disabled = false,
  onComplete,
  ...rest
}: DragButtonProps) {
  const root = useRef<HTMLButtonElement>(null);
  const runtime = useRef<ReturnType<typeof mountDragButton>>();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [iconSize, setIconSize] = useState(24);
  const options = useRef({
    status,
    disabled,
    resetKey,
    complete: (source: LabDragButtonSource) => onComplete?.(source),
    change: setCurrentStatus,
    size: setIconSize,
  });
  useClientLayoutEffect(() => {
    options.current = {
      status,
      disabled,
      resetKey,
      complete: (source) => onComplete?.(source),
      change: setCurrentStatus,
      size: setIconSize,
    };
    if (!runtime.current && root.current)
      runtime.current = mountDragButton(root.current, options.current);
    else runtime.current?.update(options.current);
  });
  useClientLayoutEffect(
    () => () => {
      runtime.current?.dispose();
      runtime.current = undefined;
    },
    [],
  );
  const result = currentStatus === 'success' || currentStatus === 'danger';
  const text =
    currentStatus === 'success'
      ? successText
      : currentStatus === 'danger'
        ? dangerText
        : pendingText;
  return (
    <>
      <button
        {...rest}
        ref={root}
        type="button"
        disabled={disabled}
        data-lab-drag-button=""
        data-status={currentStatus}
        aria-label={label}
        aria-disabled={disabled || currentStatus !== 'idle'}
        aria-busy={currentStatus === 'pending'}
      >
        <span className="lab-drag-track" aria-hidden="true">
          <span className="lab-drag-helper" hidden={!showHelper}>
            {helperText}
          </span>
        </span>
        <span className="lab-drag-fill" aria-hidden="true">
          <span className="lab-drag-chevron" hidden={currentStatus !== 'idle'}>
            <Icon symbol={chevronForward} size={iconSize} />
          </span>
          <span className="lab-drag-result" hidden={currentStatus === 'idle'}>
            <span className="lab-drag-icon" hidden={!result}>
              <Icon symbol={checkmark} size={iconSize} />
            </span>
            <span className="lab-drag-spinner" hidden={currentStatus !== 'pending'} />
            <span className="lab-drag-result-text">{text}</span>
          </span>
        </span>
      </button>
      <output className="lab-drag-announcement" aria-live="polite" aria-atomic="true">
        {currentStatus === 'idle' ? '' : text}
      </output>
    </>
  );
}
