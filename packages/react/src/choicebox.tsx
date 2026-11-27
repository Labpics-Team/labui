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
  const mounted = useRef(false);
  const [localValue, setLocalValue] = useState<readonly string[]>(defaultValue);
  const selected = value ?? localValue;
  const current = useRef({ value, defaultValue });
  const nativeSelection = (): string[] =>
    Array.from(
      root.current?.querySelectorAll<HTMLInputElement>('input:checked') ?? [],
      (input) => input.value,
    );
  useClientLayoutEffect(() => {
    current.current = { value, defaultValue };
    // The group accepts the same early native choice preserved by its uncontrolled inputs.
    if (!mounted.current && value === undefined) {
      const accepted = nativeSelection();
      if (
        accepted.length !== localValue.length ||
        accepted.some((item, index) => item !== localValue[index])
      )
        setLocalValue(accepted);
    }
    mounted.current = true;
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
  }, [multiple, form, name, items]);
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
    const committed = current.current.value;
    if (committed !== undefined)
      for (const input of root.current?.querySelectorAll<HTMLInputElement>('input') ?? [])
        input.checked = committed.includes(input.value);
  };
  if (!multiple)
    return (
      <div ref={root}>
        <RadioGroup
          variant={layout}
          value={value === undefined ? undefined : (selected[0] ?? null)}
          defaultValue={defaultValue[0] ?? null}
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
            checked={value === undefined ? undefined : selected.includes(item.value)}
            defaultChecked={defaultValue.includes(item.value)}
            disabled={disabled || item.disabled}
            name={name}
            value={item.value}
            form={name ? form : ''}
            icon={item.icon}
            description={item.description}
            onCheckedChange={() => change(nativeSelection())}
          >
            {item.label}
          </Checkbox>
        ))}
      </fieldset>
    </div>
  );
}
