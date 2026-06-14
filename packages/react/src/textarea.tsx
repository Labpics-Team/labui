/**
 * <Textarea> — the native-React twin of the Lit `<lab-textarea>` (ADR-0001).
 *
 * Same axes, same form-field a11y wiring computed by the SAME shared `field-a11y`
 * helper from @labpics/ui-core — so the label/helper/error association is ONE
 * source of truth across both renderers. The only structural difference from
 * `<Input>` is the control (`<textarea>` vs `<input>`) and the multi-line extras
 * (`rows`, optional `autoResize`).
 *
 * Auto-resize honesty: when `autoResize` is set, the control grows to fit its
 * content — LOCAL view state computed from `scrollHeight` on input, the same way
 * the Lit element does it. Not a faked machine.
 *
 * Presentational Client Component (see <Input>): it renders as a leaf under a
 * Server Component shell, never a `'use client'` page (dive-next P1). Parity is
 * CSS: it paints the SAME --lab-* roles as the Lit element via `textarea.css`.
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
  type ReactNode,
  type TextareaHTMLAttributes,
  forwardRef,
  useCallback,
  useId,
} from 'react';
import './textarea.css';

export type { LabFieldSize as LabTextareaSize, LabFieldType as LabTextareaType };

/** Native textarea attributes a field forwards but never overrides. */
type ForwardedTextareaAttrs = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  | 'id'
  | 'value'
  | 'defaultValue'
  | 'disabled'
  | 'readOnly'
  | 'required'
  | 'placeholder'
  | 'name'
  | 'rows'
  | 'aria-describedby'
  | 'aria-invalid'
  | 'aria-errormessage'
  | 'aria-required'
  | 'onChange'
  | 'onInput'
>;

export interface TextareaProps extends ForwardedTextareaAttrs {
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
  /** Controlled value. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  /** Placeholder for the empty control. */
  placeholder?: string;
  /** Native form field name. */
  name?: string;
  /** Initial visible text rows. */
  rows?: number;
  /** Grow the control to fit its content as the user types. */
  autoResize?: boolean;
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

/** Grow a textarea to fit its content: reset, then track scrollHeight. */
function fitToContent(control: HTMLTextAreaElement): void {
  control.style.height = 'auto';
  control.style.height = `${control.scrollHeight}px`;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    type = 'neutral',
    size = 'm',
    label,
    labelHidden = false,
    helper,
    error,
    value,
    defaultValue,
    placeholder,
    name,
    rows = 3,
    autoResize = false,
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

  // Merge the forwarded ref with the auto-resize ref so the control fits to its
  // initial content on mount (e.g. a defaultValue) without clobbering the caller's ref.
  const setControlRef = useCallback(
    (control: HTMLTextAreaElement | null): void => {
      if (typeof ref === 'function') ref(control);
      else if (ref) ref.current = control;
      if (control && autoResize) fitToContent(control);
    },
    [ref, autoResize],
  );

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    if (autoResize) fitToContent(event.target);
    onValueChange?.(event.target.value);
  };

  return (
    <div
      className="lab-field"
      data-lab-textarea=""
      data-type={type}
      data-size={size}
      data-label-hidden={labelHidden || undefined}
      data-auto-resize={autoResize || undefined}
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
      <textarea
        {...rest}
        {...ariaProps(a11y)}
        ref={setControlRef}
        id={ids.control}
        className="lab-field-control"
        value={value}
        defaultValue={defaultValue}
        name={name}
        rows={rows}
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
