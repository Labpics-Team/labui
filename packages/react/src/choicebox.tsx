'use client';
import type { LabChoiceboxLayout } from '@labpics/ui-core/choicebox';
import { listenSelectionReset } from '@labpics/ui-core/selection/runtime';
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Checkbox } from './checkbox.js';
import { Radio, RadioGroup } from './radio-group.js';

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface ChoiceboxItem {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}
export interface ChoiceboxProps {
  items: readonly ChoiceboxItem[];
  multiple?: boolean;
  layout?: LabChoiceboxLayout;
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (value: string[]) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  form?: string;
  label?: ReactNode;
  'aria-label'?: string;
}
/** Cards preserve Checkbox/Radio's actual form controls and their content composition. */
export function Choicebox({
  items,
  multiple = false,
  layout = 'card',
  value,
  defaultValue = [],
  onValueChange,
  disabled = false,
  required = false,
  name,
  form,
  label,
  'aria-label': ariaLabel,
}: ChoiceboxProps): ReactNode {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [localValue, setLocalValue] = useState<readonly string[]>(defaultValue);
  const selected = value ?? localValue;
  const current = useRef({ value, defaultValue });
  current.current = { value, defaultValue };
  useClientLayoutEffect(() => {
    // Composed controls receive the group's current value; their native reset baseline belongs to this group.
    const baseline = value ?? defaultValue;
    for (const input of root.current?.querySelectorAll<HTMLInputElement>('input') ?? [])
      input.defaultChecked = baseline.includes(input.value);
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebind when the renderer or form changes.
  useEffect(() => {
    const input = root.current?.querySelector<HTMLInputElement>('input');
    if (!input) return;
    return listenSelectionReset(
      input,
      () => {
        const next = current.current.value ?? current.current.defaultValue;
        for (const item of root.current?.querySelectorAll<HTMLInputElement>('input') ?? [])
          item.checked = next.includes(item.value);
        if (current.current.value === undefined) setLocalValue(next);
      },
      root.current ?? input,
    );
  }, [multiple, form, items]);
  useEffect(() => {
    if (!multiple) return;
    const inputs = Array.from(root.current?.querySelectorAll<HTMLInputElement>('input') ?? []);
    const missing =
      required && !inputs.some((input) => input.checked && !input.matches(':disabled'));
    for (const input of inputs)
      input.setCustomValidity(missing && !input.matches(':disabled') ? 'Выберите вариант.' : '');
  });
  const change = (next: string[]): void => {
    if (value === undefined) setLocalValue(next);
    onValueChange?.(next);
    if (value !== undefined)
      for (const input of root.current?.querySelectorAll<HTMLInputElement>('input') ?? [])
        input.checked = value.includes(input.value);
  };
  if (!multiple)
    return (
      <div ref={root}>
        <RadioGroup
          variant={layout}
          value={selected[0] ?? null}
          disabled={disabled}
          required={required}
          name={name}
          form={form}
          label={label}
          aria-label={ariaLabel}
          onValueChange={(next) => change(next === null ? [] : [next])}
        >
          {items.map((item) => (
            <Radio
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              icon={item.icon}
              description={item.description}
            >
              {item.label}
            </Radio>
          ))}
        </RadioGroup>
      </div>
    );
  return (
    <div ref={root}>
      <fieldset
        data-lab-radio-group=""
        disabled={disabled}
        aria-labelledby={label != null ? `${id}-label` : undefined}
        aria-label={label == null ? ariaLabel : undefined}
      >
        {label != null && (
          <legend className="lab-selection-group-label" id={`${id}-label`}>
            {label}
          </legend>
        )}
        {items.map((item) => (
          <Checkbox
            key={item.value}
            variant={layout}
            checked={selected.includes(item.value)}
            disabled={disabled || item.disabled}
            name={name}
            value={item.value}
            form={form}
            icon={item.icon}
            description={item.description}
            onCheckedChange={() =>
              change(
                Array.from(
                  root.current?.querySelectorAll<HTMLInputElement>('input:checked') ?? [],
                  (input) => input.value,
                ),
              )
            }
          >
            {item.label}
          </Checkbox>
        ))}
      </fieldset>
    </div>
  );
}
