/**
 * <PinInput> — the native-React twin of the Lit `<lab-pin-input>` (ADR-0001).
 *
 * A segmented code field: N single-character inputs that focus-advance as the user
 * types, fill across on paste, and optionally mask. Same axes, same `@zag-js/pin-input`
 * machine through the SAME Behaviors seam — here via `useZag` (the React side) instead of
 * the Lit `ZagController`. No Lit in this path; Next's shallow WC-SSR never touches React.
 * The machine owns each box's value + roving focus that auto-advances + keyboard +
 * paste-fill + masking (`type=password`) + the complete/invalid lifecycle — the component
 * only spreads the machine's prop-getters onto native elements and paints with the SAME
 * --lab-* roles, so parity is CSS, not a second behaviour implementation.
 *
 * REUSES the field a11y seam: the label / helper / error association is the SAME shared
 * `field-a11y` helper from @labpics/ui-core that the Lit element and the other fields use
 * — so the ARIA description contract is ONE source of truth across both renderers. A pin
 * input is a GROUP of boxes, so the field a11y lands on the control GROUP (role=group +
 * aria-labelledby → label + describedby/errormessage/required/invalid); the machine owns
 * each box's value ARIA + roving tabindex + the hidden form input.
 *
 * Segments keyed by `index` (the machine's own key): pin boxes never reorder, so the
 * positional index IS the stable key for `getInputProps({ index })`.
 *
 * Client Component: a pin input is interactive (value + focus dance). It renders as a leaf
 * under a Server Component shell — never a `'use client'` page (dive-next P1).
 *
 * The axis types come from @labpics/ui-core (type-only — no Lit runtime), so the Lit and
 * React APIs share ONE source of truth and cannot drift.
 */
'use client';

import {
  type FieldControlAria,
  type LabFieldSize,
  type LabFieldType,
  type MachineModule,
  type SchemaOf,
  fieldControlAria,
  fieldErrorIsActive,
  fieldPartIds,
} from '@labpics/ui-core';
import type { LabPinInputValueType } from '@labpics/ui-core/pin-input';
import * as pinInputMachine from '@zag-js/pin-input';
import { type ReactNode, useId } from 'react';
import { useZag } from './use-zag.js';
import './pin-input.css';

export type { LabFieldSize as LabPinInputSize, LabFieldType as LabPinInputType };

type PinInputSchema = SchemaOf<pinInputMachine.Service>;
type PinInputApi = pinInputMachine.Api;

const pinInputModule: MachineModule<PinInputSchema, PinInputApi> = pinInputMachine;

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
  /** Required — sets aria-required on the group and the native hidden input. */
  required?: boolean;
  /** Invalid — drives aria-invalid / aria-errormessage and danger styling. */
  invalid?: boolean;
  /** Native form field name (rides the machine's hidden input). */
  name?: string;
  /** Fires when the machine changes the value (machine is source of truth). */
  onValueChange?: (value: string[], valueAsString: string) => void;
  /** Fires when all segments are filled. */
  onValueComplete?: (value: string[], valueAsString: string) => void;
}

/** Strip `undefined` ARIA so React omits the attribute instead of rendering "undefined". */
function ariaProps(
  aria: Pick<
    FieldControlAria,
    'aria-describedby' | 'aria-invalid' | 'aria-errormessage' | 'aria-required'
  >,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(aria)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
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
  placeholder = '○',
  value,
  defaultValue,
  readOnly = false,
  disabled = false,
  required = false,
  invalid = false,
  name,
  onValueChange,
  onValueComplete,
}: PinInputProps): ReactNode {
  const baseId = useId();
  const ids = fieldPartIds(baseId);
  const hasHelper = helper != null && helper !== '';
  const hasError = error != null && error !== '';
  const showError = fieldErrorIsActive({ invalid, hasError });
  // The machine owns each box's value ARIA + roving tabindex + the hidden input; the field
  // owns the GROUP's description wiring. Compute it here and spread it OVER the control
  // group, the same split the Lit element uses (lifted to the group: N boxes, one label).
  // role="group" + aria-labelledby are part of THIS group association (the machine's
  // control carries no role), composed into one spread object so the group's a11y is a
  // single source — exactly the field-a11y the machine does not provide for N segments.
  const groupAria: Record<string, string> = {
    role: 'group',
    'aria-labelledby': ids.label,
    ...ariaProps(fieldControlAria({ id: baseId, invalid, required, hasHelper, hasError })),
  };

  const api = useZag(pinInputModule, {
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
    onValueChange: onValueChange
      ? (details) => onValueChange(details.value, details.valueAsString)
      : undefined,
    onValueComplete: onValueComplete
      ? (details) => onValueComplete(details.value, details.valueAsString)
      : undefined,
  });

  return (
    <div
      {...api.getRootProps()}
      className="lab-field"
      data-lab-pin-input=""
      data-type={type}
      data-size={size}
      data-label-hidden={labelHidden || undefined}
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
      {/* The control GROUP carries the field a11y the machine does NOT own: role="group" +
          aria-labelledby (the label) + the field description wiring (describedby / invalid /
          errormessage / required), composed in `groupAria` and spread OVER the machine's
          control getter. N segments share ONE label, so the group is the described unit, and
          a semantic <fieldset> can't take this div's place — getControlProps is spread onto
          it (the machine's control) and the flex track depends on the box. */}
      <div {...api.getControlProps()} {...groupAria} className="lab-pin-input-control">
        {api.items.map((index) => (
          // Keyed by the machine's own index: pin boxes never reorder, so the positional
          // index IS the stable key for getInputProps({ index }).
          <input
            key={index}
            {...api.getInputProps({ index })}
            aria-label={`${label}, digit ${index + 1} of ${count}`}
            className="lab-pin-input-segment"
          />
        ))}
        <input {...api.getHiddenInputProps()} className="lab-pin-input-hidden" />
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
