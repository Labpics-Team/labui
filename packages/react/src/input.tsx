/**
 * <Input> — the native-React twin of the Lit `<lab-input>` (ADR-0001).
 *
 * Same axes, same form-field a11y wiring computed by the SAME shared `field-a11y`
 * helper from @labpics/ui-core — so the label/helper/error association is ONE
 * source of truth across both renderers, not a second implementation. No Lit in
 * this path.
 *
 * Presentational (no machine): `@zag-js` has no plain text-input machine because
 * the native `<input>` owns value/caret/editing — the Lit element opts out of the
 * Behaviors seam for the same reason, and this twin opts out identically. It is
 * marked a Client Component only so the shared package boundary is consistent and
 * the scoped stylesheet ships with it; it renders as a leaf under a Server
 * Component shell, never a `'use client'` page (dive-next P1).
 *
 * Parity is CSS: the Lit element scopes its styles via `:host([type])` in a shadow
 * root; this twin paints the SAME --lab-* roles via `input.css` against the matching
 * `[data-lab-input]` + `data-*`. Same roles, same structure, same states ⇒ same paint.
 */
'use client';

import {
  type FieldControlAria,
  type LabFieldSize,
  type LabFieldType,
  fieldControlAria,
  fieldErrorIsActive,
  fieldPartIds,
} from '@labpics/ui-core';
import {
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  forwardRef,
  useId,
} from 'react';
import './input.css';

export type { LabFieldSize as LabInputSize, LabFieldType as LabInputType };

/** Native input attributes a field forwards but never overrides. */
type ForwardedInputAttrs = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'id'
  | 'type'
  | 'size'
  | 'value'
  | 'defaultValue'
  | 'disabled'
  | 'readOnly'
  | 'required'
  | 'placeholder'
  | 'name'
  | 'aria-describedby'
  | 'aria-invalid'
  | 'aria-errormessage'
  | 'aria-required'
  | 'onChange'
  | 'onInput'
>;

export interface InputProps extends ForwardedInputAttrs {
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
  /** Native input type (text | email | password | …). */
  inputType?: InputHTMLAttributes<HTMLInputElement>['type'];
  /** Controlled value. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  /** Placeholder for the empty control. */
  placeholder?: string;
  /** Native form field name. */
  name?: string;
  /** Non-editable: reads its value but cannot be changed. */
  readOnly?: boolean;
  /** Non-interactive and dimmed. */
  disabled?: boolean;
  /** Required — sets aria-required and native `required`. */
  required?: boolean;
  /** Invalid — drives aria-invalid / aria-errormessage and danger styling. */
  invalid?: boolean;
  /** Fires on every edit with the current value. */
  onValueChange?: (value: string) => void;
}

/** Strip `undefined` ARIA so React omits the attribute instead of rendering "undefined". */
function ariaProps(aria: FieldControlAria): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(aria)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    type = 'neutral',
    size = 'm',
    label,
    labelHidden = false,
    helper,
    error,
    inputType = 'text',
    value,
    defaultValue,
    placeholder,
    name,
    readOnly = false,
    disabled = false,
    required = false,
    invalid = false,
    onValueChange,
    ...rest
  },
  ref,
) {
  const baseId = useId();
  const ids = fieldPartIds(baseId);
  const hasHelper = helper != null && helper !== '';
  const hasError = error != null && error !== '';
  const a11y = fieldControlAria({ id: baseId, invalid, required, hasHelper, hasError });
  const showError = fieldErrorIsActive({ invalid, hasError });

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onValueChange?.(event.target.value);
  };

  return (
    <div
      className="lab-field"
      data-lab-input=""
      data-type={type}
      data-size={size}
      data-label-hidden={labelHidden || undefined}
      data-readonly={readOnly || undefined}
      data-disabled={disabled || undefined}
      data-required={required || undefined}
      data-invalid={invalid || undefined}
    >
      <label id={ids.label} className="lab-field-label" htmlFor={ids.control}>
        <span className="lab-field-label-text">{label}</span>
        {required ? (
          <span className="lab-field-required-mark" aria-hidden="true">
            {' *'}
          </span>
        ) : null}
      </label>
      <input
        {...rest}
        {...ariaProps(a11y)}
        ref={ref}
        id={ids.control}
        className="lab-field-control"
        type={inputType}
        value={value}
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        onChange={handleChange}
      />
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
});
