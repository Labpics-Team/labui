'use client';

import {
  type LabFieldSize,
  type LabFieldType,
  fieldControlAria,
  fieldErrorIsActive,
  fieldPartIds,
} from '@labpics/ui-core';
import type { LabPinInputValueType } from '@labpics/ui-core/pin-input';
import {
  listenPinReset,
  pinCount,
  pinInputBehavior,
  pinValueMatchesType,
} from '@labpics/ui-core/pin-input/behavior';
import { type ReactNode, useCallback, useEffect, useId, useRef } from 'react';
import { useZag } from './use-zag.js';
import '@labpics/ui-core/pin-input.css';

export type { LabFieldSize as LabPinInputSize, LabFieldType as LabPinInputType };

export interface PinInputProps {
  /** Visible label text — rendered into a real `<label>`; names the control group. */
  label: string;
  /** Sentiment of the field. */
  type?: LabFieldType;
  /** Control size. */
  size?: LabFieldSize;
  /** Visually hide the label, keeping it in the a11y tree. */
  labelHidden?: boolean;
  /** Helper / description text linked to the control group via aria-describedby. */
  helper?: ReactNode;
  /** Error message; announced (role="alert") and linked only when `invalid`. */
  error?: ReactNode;
  /** The number of single-character segments. */
  count?: number;
  /** The character set each segment accepts (machine `type`). */
  valueType?: LabPinInputValueType;
  /** Hide each character (renders the boxes as `type=password`). */
  mask?: boolean;
  /** Signal one-time-code autofill on the segments. */
  otp?: boolean;
  /** Placeholder character shown in each empty box. */
  placeholder?: string;
  /** Controlled value (array of single chars) — when set, the consumer owns it. */
  value?: string[];
  /** Uncontrolled initial value — read once by the machine at init. */
  defaultValue?: string[];
  /** Non-editable: reads its value but cannot be changed. */
  readOnly?: boolean;
  /** Non-interactive and dimmed. */
  disabled?: boolean;
  /** Required — sets aria-required on visible segments and native required on the hidden input. */
  required?: boolean;
  /** Invalid — drives aria-invalid / aria-errormessage and danger styling. */
  invalid?: boolean;
  /** Native form field name (rides the machine's hidden input). */
  name?: string;
  /** Associate with an external native form. */
  form?: string;
  /** Fires when the machine changes the value (machine is source of truth). */
  onValueChange?: (value: string[], valueAsString: string) => void;
  /** Fires when all segments are filled. */
  onValueComplete?: (value: string[], valueAsString: string) => void;
}

export function PinInput({
  label,
  type = 'neutral',
  size = 'm',
  labelHidden = false,
  helper,
  error,
  count = 4,
  valueType = 'numeric',
  mask = false,
  otp = false,
  placeholder = '',
  value,
  defaultValue,
  readOnly = false,
  disabled = false,
  required = false,
  invalid = false,
  name,
  form,
  onValueChange,
  onValueComplete,
}: PinInputProps): ReactNode {
  count = pinCount(count);
  const hidden = useRef<HTMLInputElement>(null);
  const initialValue = useRef(defaultValue ?? []);
  const baseId = useId();
  const ids = fieldPartIds(baseId);
  const hasHelper = helper != null && helper !== '';
  const hasError = error != null && error !== '';
  const showError = fieldErrorIsActive({ invalid, hasError });
  const fieldAria = fieldControlAria({ id: baseId, invalid, required, hasHelper, hasError });
  const syncForm = useCallback(
    (accepted: string[]) => {
      const input = hidden.current;
      if (!input) return;
      const cells = Array.from({ length: count }, (_, i) => accepted[i] ?? '');
      input.value = cells.join('');
      const missing = required && cells.some((character) => character === '');
      const malformed = !pinValueMatchesType(cells, valueType);
      input.setCustomValidity(
        !readOnly && !disabled && (invalid || missing || malformed)
          ? typeof error === 'string' && error
            ? error
            : malformed
              ? 'Enter a code with the expected character type.'
              : `Enter all ${count} characters.`
          : '',
      );
    },
    [count, required, invalid, readOnly, disabled, error, valueType],
  );

  // The machine owns each box's value ARIA + roving tabindex + the hidden input; the field
  // owns the GROUP's shared label / description / error wiring. `aria-required` is NOT a
  // valid role="group" property, so it is intentionally omitted here and applied to each
  // visible textbox segment below.
  const groupAria = {
    role: 'group',
    'aria-labelledby': ids.label,
    'aria-describedby': fieldAria['aria-describedby'],
    'aria-invalid': fieldAria['aria-invalid'],
    'aria-errormessage': fieldAria['aria-errormessage'],
  } as const;

  const api = useZag(pinInputBehavior, {
    id: baseId,
    // Pin the machine's label id to the field-a11y label part id, so the group's
    // aria-labelledby targets the SAME node the machine labels (one label id, no drift).
    ids: { label: ids.label },
    count,
    type: valueType,
    mask,
    otp,
    placeholder,
    value,
    defaultValue,
    disabled,
    readOnly,
    invalid,
    required,
    name,
    form,
    onValueChange: (details) => {
      syncForm(value ?? details.value);
      onValueChange?.(details.value, details.valueAsString);
    },
    onValueComplete: (details) => {
      // Browser validation must be current inside a synchronous requestSubmit callback.
      syncForm(details.value);
      onValueComplete?.(details.value, details.valueAsString);
    },
  });
  const latest = useRef({ api, value });
  latest.current = { api, value };
  useEffect(() => {
    const input = hidden.current;
    if (!input) return;
    return listenPinReset(input, () => {
      const { api: current, value: controlled } = latest.current;
      if (controlled === undefined) current.setValue(initialValue.current);
      input.value =
        controlled === undefined
          ? initialValue.current.slice(0, count).join('')
          : controlled.slice(0, count).join('');
    });
  }, [count]);
  useEffect(() => syncForm(api.value), [api.value, syncForm]);
  const segmentNoun = valueType === 'numeric' ? 'digit' : 'character';

  return (
    <div
      {...api.getRootProps()}
      className="lab-field"
      data-lab-pin-input=""
      data-type={type}
      data-size={size}
      data-label-hidden={labelHidden || !label || undefined}
      data-readonly={readOnly || undefined}
      data-disabled={disabled || undefined}
      data-required={required || undefined}
      data-invalid={invalid || undefined}
    >
      {/* biome-ignore lint/a11y/noLabelWithoutControl: getLabelProps() spreads htmlFor → the hidden input id (the machine owns the association); Biome can't see through the spread. */}
      <label {...api.getLabelProps()} id={ids.label} className="lab-field-label">
        <span className="lab-field-label-text">{label}</span>
        {required ? (
          <span className="lab-field-required-mark" aria-hidden="true">
            {' *'}
          </span>
        ) : null}
      </label>
      {/* The control GROUP carries only semantics valid for role="group": the shared label,
          description, invalid state and error reference. N segments share ONE label. */}
      <div {...api.getControlProps()} {...groupAria} className="lab-pin-input-control">
        {api.items.map((index) => (
          // Keyed by the machine's own index: pin boxes never reorder, so the positional
          // index IS the stable key for getInputProps({ index }). Required is applied to
          // the real textbox the user reaches, not to the unsupported aggregate group.
          <span className="lab-pin-input-cell" key={index}>
            <input
              {...api.getInputProps({ index })}
              aria-required={fieldAria['aria-required']}
              aria-describedby={fieldAria['aria-describedby']}
              aria-errormessage={fieldAria['aria-errormessage']}
              aria-label={`${label || 'Pin input'}, ${segmentNoun} ${index + 1} of ${count}`}
              className="lab-pin-input-segment"
            />
            <span className="lab-pin-input-dot" aria-hidden="true" />
          </span>
        ))}
        <input
          {...api.getHiddenInputProps()}
          ref={hidden}
          onFocus={() => api.focus()}
          className="lab-pin-input-hidden"
        />
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
