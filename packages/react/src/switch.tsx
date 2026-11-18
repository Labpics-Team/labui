'use client';

import type { LabSwitchSize, LabSwitchType } from '@labpics/ui-core';
import {
  type SwitchMotion,
  mountSwitchMotion,
  switchAppearance,
} from '@labpics/ui-core/switch/runtime';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import '@labpics/ui-core/switch.css';

export interface SwitchProps {
  type?: LabSwitchType;
  size?: LabSwitchSize;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  form?: string;
  /** Authored transparent check/cross in the thumb. */
  icon?: boolean;
  /** Custom content replaces the authored cutout for its state. */
  iconOn?: ReactNode;
  iconOff?: ReactNode;
  labelStart?: ReactNode;
  'aria-label'?: string;
  onCheckedChange?: (checked: boolean) => void;
  children?: ReactNode;
}

export function Switch({
  type = 'accent',
  size = 'm',
  checked,
  defaultChecked = false,
  disabled = false,
  required = false,
  name,
  value = 'on',
  form,
  icon = false,
  iconOn,
  iconOff,
  labelStart,
  'aria-label': ariaLabel,
  onCheckedChange,
  children,
}: SwitchProps): ReactNode {
  const id = useId();
  const root = useRef<HTMLLabelElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const motion = useRef<SwitchMotion>();
  const [localChecked, setLocalChecked] = useState(defaultChecked);
  const effectiveChecked = checked ?? localChecked;
  const current = useRef({ checked, defaultChecked });
  current.current = { checked, defaultChecked };
  // biome-ignore lint/correctness/useExhaustiveDependencies: changing the form attribute re-associates the native input; rebind the reset listener.
  useEffect(() => {
    if (!root.current || !input.current) return;
    motion.current = mountSwitchMotion(root.current, input.current);
    const native = input.current;
    const ownerForm = native.form;
    const pendingResets = new Set<ReturnType<typeof setTimeout>>();
    const reset = (event: Event): void => {
      // A trusted click can run microtasks before the native reset default action.
      // Reconcile in the following task, after that action and ancestor cancellation.
      const task = setTimeout(() => {
        pendingResets.delete(task);
        if (event.defaultPrevented || !native.isConnected) return;
        const next = current.current.checked ?? current.current.defaultChecked;
        native.checked = next;
        if (current.current.checked === undefined) setLocalChecked(next);
        motion.current?.update();
      }, 0);
      pendingResets.add(task);
    };
    ownerForm?.addEventListener('reset', reset);
    return () => {
      for (const task of pendingResets) clearTimeout(task);
      ownerForm?.removeEventListener('reset', reset);
      motion.current?.dispose();
      motion.current = undefined;
    };
  }, [form]);
  useEffect(() => {
    motion.current?.update();
  });
  const hasStart = labelStart != null && labelStart !== false && labelStart !== '';
  const hasEnd = children != null && children !== false && children !== '';
  const labels = [hasStart ? `${id}-start` : '', hasEnd ? `${id}-label` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <label
      ref={root}
      data-lab-switch=""
      data-type={type}
      data-size={size}
      data-appearance={switchAppearance(type, effectiveChecked)}
      data-checked={effectiveChecked || undefined}
      data-disabled={disabled || undefined}
      data-icon={icon || undefined}
      data-custom-on={iconOn != null || undefined}
      data-custom-off={iconOff != null || undefined}
    >
      {hasStart && (
        <span id={`${id}-start`} className="lab-switch-label">
          {labelStart}
        </span>
      )}
      <span className="lab-switch-control" aria-hidden="true">
        <span className="lab-switch-thumb">
          <span className="lab-switch-icon lab-switch-icon-on">{iconOn}</span>
          <span className="lab-switch-icon lab-switch-icon-off">{iconOff}</span>
        </span>
      </span>
      <input
        ref={input}
        id={`${id}-input`}
        type="checkbox"
        role="switch"
        aria-checked={effectiveChecked}
        checked={effectiveChecked}
        disabled={disabled}
        required={required}
        name={name}
        value={value}
        form={form}
        aria-labelledby={labels || undefined}
        aria-label={labels ? undefined : ariaLabel}
        onChange={(event) => {
          if (checked === undefined) setLocalChecked(event.currentTarget.checked);
          onCheckedChange?.(event.currentTarget.checked);
        }}
      />
      {hasEnd && (
        <span id={`${id}-label`} className="lab-switch-label">
          {children}
        </span>
      )}
    </label>
  );
}
