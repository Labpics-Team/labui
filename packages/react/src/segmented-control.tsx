'use client';
import type { LabSegmentedItem, LabSegmentedStyle } from '@labpics/ui-core/segmented-control';
import { mountSegmentedMotion } from '@labpics/ui-core/segmented-control/runtime';
import { listenSelectionReset, navigateRadio } from '@labpics/ui-core/selection/runtime';
import {
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import '@labpics/ui-core/segmented-control.css';

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface SegmentedItem extends Omit<LabSegmentedItem, 'icon' | 'iconEnd'> {
  readonly icon?: ReactNode;
  readonly iconEnd?: ReactNode;
}
export interface SegmentedControlProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'children'> {
  items: readonly SegmentedItem[];
  value?: string | null;
  defaultValue?: string | null;
  shape?: LabSegmentedStyle;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  form?: string;
  label?: string;
  onValueChange?: (value: string) => void;
}

/** Native radios own forms and accessibility; value requests never mutate a controlled input. */
export function SegmentedControl({
  items,
  value,
  defaultValue = null,
  shape = 'rounded',
  disabled = false,
  required = false,
  name,
  form,
  label,
  onValueChange,
  ...rest
}: SegmentedControlProps): ReactNode {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [localValue, setLocalValue] = useState(defaultValue);
  const selected = value === undefined ? localValue : value;
  const current = useRef({ value, defaultValue });
  const motion = useRef<ReturnType<typeof mountSegmentedMotion>>();
  const mounted = useRef(false);
  const tabStop = (
    items.find((item) => item.value === selected && !item.disabled) ??
    items.find((item) => !item.disabled)
  )?.value;
  useEffect(() => {
    if (root.current) motion.current = mountSegmentedMotion(root.current);
    return () => {
      motion.current?.dispose();
      motion.current = undefined;
    };
  }, []);
  useClientLayoutEffect(() => {
    current.current = { value, defaultValue };
    const inputs = Array.from(root.current?.querySelectorAll<HTMLInputElement>('input') ?? []);
    const next =
      !mounted.current && value === undefined
        ? (inputs.find((input) => input.checked)?.value ?? null)
        : selected;
    if (!mounted.current && value === undefined) setLocalValue(next);
    for (const input of inputs) input.checked = input.value === next;
    mounted.current = true;
    motion.current?.update();
    const enabled = inputs.filter((input) => !input.matches(':disabled'));
    const missing = required && !enabled.some((input) => input.checked);
    for (const input of inputs)
      input.setCustomValidity(missing && enabled.includes(input) ? 'Выберите один вариант.' : '');
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: topology or form association can change the first input.
  useEffect(() => {
    const input = root.current?.querySelector<HTMLInputElement>('input');
    if (!input) return;
    return listenSelectionReset(
      input,
      () => {
        const next =
          current.current.value === undefined
            ? current.current.defaultValue
            : current.current.value;
        for (const item of root.current?.querySelectorAll<HTMLInputElement>('input') ?? [])
          item.checked = item.value === next;
        if (current.current.value === undefined) setLocalValue(next);
      },
      root.current ?? input,
    );
  }, [form, name, items]);
  return (
    <div
      {...rest}
      ref={root}
      data-lab-segmented=""
      data-shape={shape}
      role="radiogroup"
      aria-label={label || rest['aria-label']}
      aria-required={required}
      onKeyDown={(event) => {
        rest.onKeyDown?.(event);
        if (!event.defaultPrevented)
          navigateRadio(
            event.nativeEvent,
            Array.from(root.current?.querySelectorAll('input') ?? []),
          );
      }}
    >
      {items.map((item) => (
        <label
          key={item.value}
          className="lab-segment"
          data-selected={item.value === selected ? '' : undefined}
          data-icon-only={item.iconOnly ? '' : undefined}
        >
          <span className="lab-segment-active" aria-hidden="true" />
          {item.icon && (
            <span className="lab-segment-icon" aria-hidden="true">
              {item.icon}
            </span>
          )}
          <span className="lab-segment-label">{item.label}</span>
          {!item.iconOnly && item.iconEnd && (
            <span className="lab-segment-icon" aria-hidden="true">
              {item.iconEnd}
            </span>
          )}
          <input
            type="radio"
            name={name || `${id}-segmented`}
            form={name ? form : ''}
            value={item.value}
            defaultChecked={item.value === (value === undefined ? defaultValue : value)}
            disabled={disabled || item.disabled}
            required={required}
            tabIndex={!disabled && item.value === tabStop ? 0 : -1}
            onInput={(event) => {
              if (!event.currentTarget.checked) return;
              if (value === undefined) setLocalValue(item.value);
              onValueChange?.(item.value);
              const committed = current.current.value;
              if (committed !== undefined)
                for (const input of root.current?.querySelectorAll<HTMLInputElement>('input') ?? [])
                  input.checked = input.value === committed;
            }}
          />
        </label>
      ))}
    </div>
  );
}
