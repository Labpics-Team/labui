'use client';
import type { LabCheckboxChecked, LabCheckboxSize, LabCheckboxType } from '@labpics/ui-core';
import {
  type LabSelectionVariant,
  type SelectionMotion,
  listenSelectionReset,
  mountSelectionMotion,
} from '@labpics/ui-core/selection/runtime';
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import '@labpics/ui-core/selection-controls.css';

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface CheckboxProps {
  type?: LabCheckboxType;
  size?: LabCheckboxSize;
  checked?: LabCheckboxChecked;
  defaultChecked?: LabCheckboxChecked;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  form?: string;
  'aria-label'?: string;
  labelStart?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Choicebox composes this control's card/row presentation. */
  variant?: LabSelectionVariant;
  onCheckedChange?: (checked: LabCheckboxChecked) => void;
  children?: ReactNode;
}
export function Checkbox({
  type = 'accent',
  size = 'm',
  checked,
  defaultChecked = false,
  disabled = false,
  required = false,
  name,
  value = 'on',
  form,
  'aria-label': ariaLabel,
  labelStart,
  description,
  icon,
  variant = 'plain',
  onCheckedChange,
  children,
}: CheckboxProps): ReactNode {
  const id = useId();
  const root = useRef<HTMLLabelElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const motion = useRef<SelectionMotion>();
  const [localChecked, setLocalChecked] = useState(defaultChecked);
  const state = checked ?? localChecked;
  const mixed = state === 'indeterminate';
  const current = useRef({ checked, defaultChecked, state });
  // biome-ignore lint/correctness/useExhaustiveDependencies: form changes rebind native reset ownership.
  useEffect(() => {
    const native = input.current;
    if (!native || !root.current) return;
    native.indeterminate = current.current.state === 'indeterminate';
    motion.current = mountSelectionMotion(root.current, native);
    const disposeReset = listenSelectionReset(native, () => {
      const next = current.current.checked ?? current.current.defaultChecked;
      native.checked = next === true;
      native.indeterminate = next === 'indeterminate';
      if (current.current.checked === undefined) setLocalChecked(next);
      motion.current?.update();
    });
    return () => {
      disposeReset();
      motion.current?.dispose();
      motion.current = undefined;
    };
  }, [form]);
  useClientLayoutEffect(() => {
    current.current = { checked, defaultChecked, state };
    if (input.current) {
      const next =
        !mounted.current && checked === undefined
          ? defaultChecked === 'indeterminate' && !input.current.checked
            ? 'indeterminate'
            : input.current.checked
          : state;
      if (!mounted.current && checked === undefined) setLocalChecked(next);
      input.current.checked = next === true;
      input.current.indeterminate = next === 'indeterminate';
    }
    mounted.current = true;
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
      data-lab-checkbox=""
      data-lab-selection=""
      data-kind="checkbox"
      data-type={type}
      data-size={variant === 'plain' ? size : 'l'}
      data-variant={variant}
      data-checked={state === true || undefined}
      data-selected={state !== false || undefined}
      data-indeterminate={mixed || undefined}
      data-disabled={disabled || undefined}
    >
      {hasStart && (
        <span className="lab-selection-label-start" id={`${id}-start`}>
          {labelStart}
        </span>
      )}
      {variant !== 'plain' && (
        <span className="lab-selection-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span
        className="lab-selection-control lab-checkbox-control"
        aria-hidden="true"
        data-state={mixed ? 'indeterminate' : state ? 'checked' : 'unchecked'}
      >
        <span className="lab-selection-mark" />
      </span>
      <input
        ref={input}
        id={id}
        type="checkbox"
        defaultChecked={(checked ?? defaultChecked) === true}
        aria-checked={mixed ? 'mixed' : state}
        disabled={disabled}
        required={required}
        name={name}
        value={value}
        form={form}
        aria-labelledby={labels || undefined}
        aria-label={labels ? undefined : ariaLabel}
        aria-describedby={description != null ? `${id}-description` : undefined}
        onInput={(event) => {
          const native = event.currentTarget;
          const next = native.checked;
          if (checked === undefined) setLocalChecked(next);
          onCheckedChange?.(next);
          const committed = current.current.checked;
          if (input.current === native && committed !== undefined) {
            native.checked = committed === true;
            native.indeterminate = committed === 'indeterminate';
          }
        }}
      />
      {(hasEnd || description != null) && (
        <span className="lab-selection-label lab-checkbox-label">
          {hasEnd && <span id={`${id}-label`}>{children}</span>}
          {description != null && (
            <span className="lab-selection-description" id={`${id}-description`}>
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
}
