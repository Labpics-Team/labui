/** React DOM-ввод: общие с Lit CSS, размеры и связи подписи/helper/error. */
'use client';

import {
  type LabFieldSize,
  type LabFieldType,
  fieldControlAria,
  fieldControlAriaProps,
  fieldErrorIsActive,
  fieldPartIds,
} from '@labpics/ui-core';
import {
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from 'react';
import '@labpics/ui-core/input.css';

export type { LabFieldSize as LabInputSize, LabFieldType as LabInputType };
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

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
  /** Штатные слоты по краям поля: знак или короткое действие. */
  leading?: ReactNode;
  trailing?: ReactNode;
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
    leading,
    trailing,
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
  const root = useRef<HTMLDivElement>(null);
  useClientLayoutEffect(() => {
    const input = root.current?.querySelector('input');
    input?.setCustomValidity(
      showError ? (root.current?.querySelector('.lab-field-error')?.textContent ?? '') : '',
    );
  }, [showError, error]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onValueChange?.(event.target.value);
  };

  return (
    <div
      ref={root}
      className="lab-field"
      data-lab-input=""
      data-type={type}
      data-size={size}
      data-label-hidden={labelHidden || undefined}
      data-unlabelled={!label || undefined}
      data-leading={leading != null || undefined}
      data-trailing={trailing != null || undefined}
      data-readonly={readOnly || undefined}
      data-disabled={disabled || undefined}
      data-required={required || undefined}
      data-invalid={invalid || undefined}
    >
      <div className="lab-input-frame">
        <label id={ids.label} className="lab-field-label" htmlFor={ids.control}>
          <span className="lab-field-label-text">{label}</span>
          {required ? (
            <span className="lab-field-required-mark" aria-hidden="true">
              {' *'}
            </span>
          ) : null}
        </label>
        {leading != null ? (
          <span className="lab-input-adornment lab-input-leading">{leading}</span>
        ) : null}
        <input
          {...rest}
          {...fieldControlAriaProps(a11y)}
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
        {trailing != null ? (
          <span className="lab-input-adornment lab-input-trailing">{trailing}</span>
        ) : null}
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
});
