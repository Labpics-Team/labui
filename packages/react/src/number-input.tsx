/**
 * <NumberInput> — the native-React twin of the Lit `<lab-number-input>` (ADR-0001).
 *
 * Same axes, same `@zag-js/number-input` machine through the SAME Behaviors seam —
 * here via `useZag` (the React side) instead of the Lit `ZagController`. No Lit in
 * this path; Next's shallow WC-SSR never touches React. The machine owns the parsed
 * numeric value, min/max/step clamping, the `role="spinbutton"` + value ARIA
 * (`aria-valuenow/valuemin/valuemax/valuetext`), Arrow/PageUp-Down keyboard stepping,
 * and the +/- triggers that disable at the bounds — the component only spreads the
 * machine's prop-getters onto native elements and paints with the SAME --lab-* roles,
 * so parity is CSS, not a second behaviour implementation.
 *
 * REUSES the field a11y seam: the label / helper / error association is the SAME
 * shared `field-a11y` helper from @labpics/ui-core that the Lit element and the other
 * fields use — so the ARIA description contract is ONE source of truth across both
 * renderers. The machine owns the spinbutton role + value ARIA + aria-invalid; this
 * twin ADDS the field's describedby/errormessage/required over the machine's getters
 * (the exact split the Lit element uses).
 *
 * Client Component: a number input is interactive (value + stepping). It renders as a
 * leaf under a Server Component shell — never a `'use client'` page (dive-next P1).
 *
 * The axis types come from @labpics/ui-core (type-only — no Lit runtime), so the Lit
 * and React APIs share ONE source of truth and cannot drift.
 */
'use client';

import {
  type LabFieldSize,
  type LabFieldType,
  fieldAriaProps,
  fieldControlAria,
  fieldErrorIsActive,
  fieldPartIds,
} from '@labpics/ui-core';
import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import * as numberInputMachine from '@zag-js/number-input';
import { type ReactNode, useId } from 'react';
import { useZag } from './use-zag.js';
import './number-input.css';

export type { LabFieldSize as LabNumberInputSize, LabFieldType as LabNumberInputType };

type NumberInputSchema = SchemaOf<numberInputMachine.Service>;
type NumberInputApi = numberInputMachine.Api;

const numberInputModule: MachineModule<NumberInputSchema, NumberInputApi> = numberInputMachine;

export interface NumberInputProps {
  /** Sentiment of the field. */
  type?: LabFieldType;
  /** Control size. */
  size?: LabFieldSize;
  /** Visible label text — rendered into a real `<label htmlFor>`. */
  label: string;
  /** Visually hide the label, keeping it in the a11y tree. */
  labelHidden?: boolean;
  /** Helper / description text linked to the control via aria-describedby. */
  helper?: ReactNode;
  /** Error message; announced (role="alert") and linked only when `invalid`. */
  error?: ReactNode;
  /** Controlled value — when set, the consumer owns the value. */
  value?: string;
  /** Uncontrolled initial value — read once by the machine at init. */
  defaultValue?: string;
  /** Placeholder for the empty control. */
  placeholder?: string;
  /** Minimum value. */
  min?: number;
  /** Maximum value. */
  max?: number;
  /** Step the +/- and Arrow keys move by. */
  step?: number;
  /** Allow the mouse wheel to change the value while focused. */
  allowMouseWheel?: boolean;
  /** Non-editable: reads its value but cannot be changed. */
  readOnly?: boolean;
  /** Non-interactive and dimmed. */
  disabled?: boolean;
  /** Required — sets aria-required and native `required`. */
  required?: boolean;
  /** Invalid — drives aria-invalid / aria-errormessage and danger styling. */
  invalid?: boolean;
  /** Native form field name. */
  name?: string;
  /** Fires when the machine changes the value (machine is source of truth). */
  onValueChange?: (value: string, valueAsNumber: number) => void;
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
  readOnly = false,
  disabled = false,
  required = false,
  invalid = false,
  name,
  onValueChange,
}: NumberInputProps): ReactNode {
  const baseId = useId();
  const ids = fieldPartIds(baseId);
  const hasHelper = helper != null && helper !== '';
  const hasError = error != null && error !== '';
  const showError = fieldErrorIsActive({ invalid, hasError });
  // The machine owns the spinbutton role + value ARIA + aria-invalid; the field owns
  // the description wiring. Compute only the description attrs here and spread them
  // OVER the machine's input getter, the same split the Lit element uses.
  const fieldAria = fieldControlAria({ id: baseId, invalid, required, hasHelper, hasError });

  const api = useZag(numberInputModule, {
    id: baseId,
    value,
    defaultValue,
    min,
    max,
    step,
    disabled,
    readOnly,
    invalid,
    required,
    name,
    allowMouseWheel,
    onValueChange: onValueChange
      ? (details) => onValueChange(details.value, details.valueAsNumber)
      : undefined,
  });

  return (
    <div
      {...api.getRootProps()}
      className="lab-field"
      data-lab-number-input=""
      data-type={type}
      data-size={size}
      data-label-hidden={labelHidden || undefined}
      data-readonly={readOnly || undefined}
      data-disabled={disabled || undefined}
      data-required={required || undefined}
      data-invalid={invalid || undefined}
    >
      {/* biome-ignore lint/a11y/noLabelWithoutControl: getLabelProps() spreads htmlFor → the spinbutton input id (the machine owns the association); Biome can't see through the spread. */}
      <label {...api.getLabelProps()} className="lab-field-label">
        <span className="lab-field-label-text">{label}</span>
        {required ? (
          <span className="lab-field-required-mark" aria-hidden="true">
            {' *'}
          </span>
        ) : null}
      </label>
      <div {...api.getControlProps()} className="lab-field-control">
        <input
          {...api.getInputProps()}
          {...fieldAriaProps(fieldAria)}
          className="lab-number-input-input"
          placeholder={placeholder}
        />
        <div className="lab-number-input-triggers">
          <button
            {...api.getIncrementTriggerProps()}
            className="lab-number-input-trigger lab-number-input-trigger-inc"
          >
            +
          </button>
          <button
            {...api.getDecrementTriggerProps()}
            className="lab-number-input-trigger lab-number-input-trigger-dec"
          >
            {'−'}
          </button>
        </div>
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
