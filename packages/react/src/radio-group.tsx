'use client';
import type {
  LabRadioGroupOrientation,
  LabRadioGroupSize,
  LabRadioGroupType,
} from '@labpics/ui-core/radio-group';
import {
  type LabSelectionVariant,
  type SelectionMotion,
  listenSelectionReset,
  mountSelectionMotion,
  navigateRadio,
} from '@labpics/ui-core/selection/runtime';
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import '@labpics/ui-core/selection-controls.css';

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface RadioGroupProps {
  type?: LabRadioGroupType;
  size?: LabRadioGroupSize;
  orientation?: LabRadioGroupOrientation;
  value?: string | null;
  defaultValue?: string | null;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  form?: string;
  label?: ReactNode;
  'aria-label'?: string;
  variant?: LabSelectionVariant;
  onValueChange?: (value: string | null) => void;
  children?: ReactNode;
}
interface RadioContext {
  type: LabRadioGroupType;
  size: LabRadioGroupSize;
  variant: LabSelectionVariant;
  value: string | null;
  resetValue: string | null;
  disabled: boolean;
  required: boolean;
  name?: string;
  form?: string;
  select(value: string): void;
}
const RadioGroupContext = createContext<RadioContext | null>(null);

export function RadioGroup({
  type = 'accent',
  size = 'm',
  orientation = 'horizontal',
  value,
  defaultValue = null,
  disabled = false,
  required = false,
  name,
  form,
  label,
  'aria-label': ariaLabel,
  variant = 'plain',
  onValueChange,
  children,
}: RadioGroupProps): ReactNode {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const [localValue, setLocalValue] = useState(defaultValue);
  const selected = value !== undefined ? value : localValue;
  const current = useRef({ value, defaultValue });
  useClientLayoutEffect(() => {
    current.current = { value, defaultValue };
    const inputs = Array.from(root.current?.querySelectorAll<HTMLInputElement>('input') ?? []);
    const next =
      !mounted.current && value === undefined
        ? (inputs.find((input) => input.checked)?.value ?? null)
        : selected;
    if (!mounted.current && value === undefined) setLocalValue(next);
    mounted.current = true;
    for (const input of inputs) input.checked = input.value === next;
    const enabled = inputs.filter((input) => !input.matches(':disabled'));
    const tabStop = enabled.find((input) => input.checked) ?? enabled[0];
    for (const input of inputs) input.tabIndex = input === tabStop ? 0 : -1;
    const missing = required && !enabled.some((input) => input.checked);
    for (const input of inputs)
      input.setCustomValidity(missing && enabled.includes(input) ? 'Выберите один вариант.' : '');
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: form and child topology can change the first native input.
  useEffect(() => {
    const input = root.current?.querySelector<HTMLInputElement>('input');
    if (!input) return;
    return listenSelectionReset(
      input,
      () => {
        const next =
          current.current.value !== undefined
            ? current.current.value
            : current.current.defaultValue;
        for (const item of root.current?.querySelectorAll<HTMLInputElement>('input') ?? [])
          item.checked = item.value === next;
        if (current.current.value === undefined) setLocalValue(next);
      },
      root.current ?? input,
    );
  }, [form, name, children]);
  const context: RadioContext = {
    type,
    size,
    variant,
    value: selected,
    resetValue: value !== undefined ? value : defaultValue,
    disabled,
    required,
    name: name || `${id}-radio`,
    form: name ? form : '',
    select(next) {
      if (value === undefined) setLocalValue(next);
      onValueChange?.(next);
      const committed = current.current.value;
      if (committed !== undefined)
        for (const input of root.current?.querySelectorAll<HTMLInputElement>('input') ?? [])
          input.checked = input.value === committed;
    },
  };
  return (
    <div
      ref={root}
      data-lab-radio-group=""
      data-type={type}
      data-size={size}
      data-orientation={orientation}
      data-disabled={disabled ? '' : undefined}
      role="radiogroup"
      aria-required={required}
      aria-labelledby={label != null ? `${id}-label` : undefined}
      aria-label={label == null ? ariaLabel : undefined}
      onKeyDown={(event) =>
        navigateRadio(event.nativeEvent, Array.from(root.current?.querySelectorAll('input') ?? []))
      }
    >
      {label != null && (
        <span id={`${id}-label`} className="lab-selection-group-label">
          {label}
        </span>
      )}
      <RadioGroupContext.Provider value={context}>{children}</RadioGroupContext.Provider>
    </div>
  );
}
export interface RadioProps {
  value: string;
  disabled?: boolean;
  labelStart?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  'aria-label'?: string;
  children?: ReactNode;
}
export function Radio({
  value,
  disabled = false,
  labelStart,
  description,
  icon,
  'aria-label': ariaLabel,
  children,
}: RadioProps): ReactNode {
  const group = useContext(RadioGroupContext);
  const id = useId();
  const root = useRef<HTMLLabelElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const motion = useRef<SelectionMotion>();
  useEffect(() => {
    if (root.current && input.current)
      motion.current = mountSelectionMotion(root.current, input.current);
    return () => {
      motion.current?.dispose();
      motion.current = undefined;
    };
  }, []);
  useEffect(() => {
    motion.current?.update();
  });
  if (!group) throw new Error('<Radio> must be rendered inside a <RadioGroup>.');
  const checked = group.value === value;
  const blocked = disabled || group.disabled;
  const hasStart = labelStart != null && labelStart !== false && labelStart !== '';
  const hasEnd = children != null && children !== false && children !== '';
  const labels = [hasStart ? `${id}-start` : '', hasEnd ? `${id}-label` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <label
      ref={root}
      className="lab-radio-item"
      data-lab-selection=""
      data-kind="radio"
      data-type={group.type}
      data-size={group.variant === 'plain' ? group.size : 'l'}
      data-variant={group.variant}
      data-value={value}
      data-selected={checked || undefined}
      data-disabled={blocked || undefined}
    >
      {hasStart && (
        <span id={`${id}-start`} className="lab-selection-label-start">
          {labelStart}
        </span>
      )}
      {group.variant !== 'plain' && (
        <span className="lab-selection-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span
        className="lab-selection-control lab-radio-control"
        aria-hidden="true"
        data-state={checked ? 'checked' : 'unchecked'}
        data-disabled={blocked ? '' : undefined}
      >
        <span className="lab-selection-mark lab-radio-dot" />
      </span>
      <span className="lab-selection-label lab-radio-text">
        {hasEnd && <span id={`${id}-label`}>{children}</span>}
        {description != null && (
          <span id={`${id}-description`} className="lab-selection-description">
            {description}
          </span>
        )}
      </span>
      <input
        ref={input}
        id={id}
        type="radio"
        name={group.name}
        value={value}
        defaultChecked={group.resetValue === value}
        disabled={blocked}
        required={group.required}
        form={group.form}
        tabIndex={checked ? 0 : group.value !== null ? -1 : undefined}
        aria-labelledby={labels || undefined}
        aria-label={labels ? undefined : ariaLabel}
        aria-describedby={description != null ? `${id}-description` : undefined}
        onInput={(event) => {
          if (event.currentTarget.checked) group.select(value);
        }}
      />
    </label>
  );
}
