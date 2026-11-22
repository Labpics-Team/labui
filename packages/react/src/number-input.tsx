'use client';

import {
  type LabFieldSize,
  type LabFieldType,
  fieldControlAria,
  fieldControlAriaProps,
  fieldErrorIsActive,
  fieldPartIds,
} from '@labpics/ui-core';

import { numberInputBehavior, numberInputValidity } from '@labpics/ui-core/number-input/behavior';
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { useZag } from './use-zag.js';
import '@labpics/ui-core/input-extensions.css';

export type { LabFieldSize as LabNumberInputSize, LabFieldType as LabNumberInputType };

export interface NumberInputProps {
  type?: LabFieldType;
  size?: LabFieldSize;
  label: string;
  labelHidden?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  allowMouseWheel?: boolean;
  scrubber?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  name?: string;
  onValueChange?: (value: string, valueAsNumber: number) => void;
  onValueCommit?: (value: string, valueAsNumber: number) => void;
}

export function NumberInput({
  type = 'neutral',
  size = 'm',
  label,
  labelHidden = false,
  helper,
  error,
  value,
  defaultValue,
  placeholder,
  min,
  max,
  step,
  allowMouseWheel = false,
  scrubber = false,
  readOnly = false,
  disabled = false,
  required = false,
  invalid = false,
  name,
  onValueChange,
  onValueCommit,
}: NumberInputProps): ReactNode {
  const baseId = useId();
  const ids = fieldPartIds(baseId);
  const hasHelper = helper != null && helper !== '';
  const hasError = error != null && error !== '';

  const api = useZag(numberInputBehavior, {
    id: baseId,
    value,
    defaultValue,
    min,
    max,
    step,
    disabled,
    readOnly,
    invalid: invalid || undefined,
    required,
    name,
    allowMouseWheel,
    onValueCommit: onValueCommit
      ? (details) => onValueCommit(details.value, details.valueAsNumber)
      : undefined,
    onValueChange: onValueChange
      ? (details) => onValueChange(details.value, details.valueAsNumber)
      : undefined,
  });

  const showError = fieldErrorIsActive({ invalid: api.invalid, hasError });
  const fieldAria = fieldControlAria({
    id: baseId,
    invalid: api.invalid,
    required,
    hasHelper,
    hasError,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
  useClientLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const validity = numberInputValidity({
      value: api.value,
      valueAsNumber: api.valueAsNumber,
      min,
      max,
      required,
      invalid,
      disabled: input.disabled,
      readOnly,
    });
    input.setCustomValidity(
      validity.flags.customError && typeof error === 'string' && error ? error : validity.message,
    );
  });

  return (
    <div
      {...api.getRootProps()}
      className="lab-field"
      data-lab-number-input=""
      data-lab-input=""
      data-trailing=""
      data-type={type}
      data-size={size}
      data-label-hidden={labelHidden || undefined}
      data-readonly={readOnly || undefined}
      data-disabled={disabled || undefined}
      data-required={required || undefined}
      data-invalid={api.invalid || undefined}
    >
      <div className="lab-input-frame">
        {/* biome-ignore lint/a11y/noLabelWithoutControl: getLabelProps() spreads htmlFor → the spinbutton input id (the machine owns the association); Biome can't see through the spread. */}
        <label {...api.getLabelProps()} className="lab-field-label">
          <span
            {...(scrubber && !disabled && !readOnly ? api.getScrubberProps() : {})}
            className="lab-field-label-text"
          >
            {label}
          </span>
          {required ? (
            <span className="lab-field-required-mark" aria-hidden="true">
              {' *'}
            </span>
          ) : null}
        </label>
        <div {...api.getControlProps()} className="lab-extension-control">
          <input
            {...api.getInputProps()}
            {...fieldControlAriaProps(fieldAria)}
            aria-invalid={api.invalid || undefined}
            ref={inputRef}
            className="lab-number-input-input lab-field-control"
            placeholder={placeholder}
          />
          <div className="lab-number-input-triggers">
            <button
              {...api.getIncrementTriggerProps()}
              className="lab-extension-trigger lab-number-input-trigger lab-number-input-trigger-inc"
            >
              +
            </button>
            <button
              {...api.getDecrementTriggerProps()}
              className="lab-extension-trigger lab-number-input-trigger lab-number-input-trigger-dec"
            >
              {'−'}
            </button>
          </div>
        </div>
        <fieldset className="lab-input-outline" aria-hidden="true">
          <legend>
            {label}
            {required ? ' *' : ''}
          </legend>
        </fieldset>
      </div>
      {hasHelper ? (
        <span id={ids.helper} className="lab-field-helper">
          {helper}
        </span>
      ) : null}
      {showError ? (
        <span id={ids.error} className="lab-field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
