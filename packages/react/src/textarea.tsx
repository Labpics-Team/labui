/** Native React textarea with the shared authored outline, ARIA and size fallback. */
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
  TextareaResize,
  normalizeTextareaValue,
  textareaRows,
} from '@labpics/ui-core/textarea/runtime';
import {
  type CSSProperties,
  type ChangeEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import '@labpics/ui-core/input.css';

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

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

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
  const root = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLTextAreaElement | null>(null);
  const resizeRef = useRef<TextareaResize>();
  const [filled, setFilled] = useState(!!(value ?? defaultValue));
  const resolvedRows = textareaRows(rows);
  // React 18 restores textarea.textContent on hydration even if the person has
  // already edited it. Capture the native dirty value before that commit.
  const [initialEdit] = useState(() => {
    if (typeof document === 'undefined' || typeof HTMLTextAreaElement === 'undefined') return;
    const control = document.getElementById(ids.control);
    if (!(control instanceof HTMLTextAreaElement) || control.value === control.defaultValue) return;
    return {
      value: control.value,
      start: control.selectionStart,
      end: control.selectionEnd,
      direction: control.selectionDirection,
    };
  });
  const pendingEdit = useRef(initialEdit);

  // Share the native control with the caller without replacing its ref.
  const setControlRef = useCallback(
    (control: HTMLTextAreaElement | null): void => {
      controlRef.current = control;
      if (typeof ref === 'function') ref(control);
      else if (ref) ref.current = control;
    },
    [ref],
  );

  useClientLayoutEffect(() => {
    const edit = pendingEdit.current;
    const control = controlRef.current;
    if (!edit || !control) return;
    pendingEdit.current = undefined;
    control.value = edit.value;
    control.setSelectionRange(edit.start, edit.end, edit.direction);
    setFilled(!!edit.value);
    if (value !== undefined) onValueChange?.(edit.value);
  }, [onValueChange, value]);

  useClientLayoutEffect(() => {
    const control = controlRef.current;
    if (!control) return;
    const resize = new TextareaResize(control);
    resizeRef.current = resize;
    resize.setEnabled(autoResize);
    const onReset = (event: Event) =>
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        setFilled(!!control.value);
        resize.update();
      });
    const form = control.form;
    form?.addEventListener('reset', onReset);
    return () => {
      resize.disconnect();
      form?.removeEventListener('reset', onReset);
    };
  }, [autoResize, rest.form]);

  useClientLayoutEffect(() => {
    const control = controlRef.current;
    control?.setCustomValidity(
      showError ? (root.current?.querySelector('.lab-field-error')?.textContent ?? '') : '',
    );
    resizeRef.current?.update();
  }, [showError, error, value, defaultValue, resolvedRows, size]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    setFilled(!!event.target.value);
    resizeRef.current?.update();
    onValueChange?.(event.target.value);
  };

  return (
    <div
      ref={root}
      className="lab-field"
      data-lab-textarea=""
      data-type={type}
      data-size={size}
      data-label-hidden={labelHidden || undefined}
      data-unlabelled={!label || undefined}
      data-filled={(value === undefined ? filled : !!value) || undefined}
      style={{ '--_textarea-rows': resolvedRows } as CSSProperties}
      data-auto-resize={autoResize || undefined}
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
        <textarea
          {...rest}
          {...fieldControlAriaProps(a11y)}
          ref={setControlRef}
          id={ids.control}
          className="lab-field-control"
          value={value === undefined ? undefined : normalizeTextareaValue(value)}
          defaultValue={
            defaultValue === undefined ? undefined : normalizeTextareaValue(defaultValue)
          }
          name={name}
          rows={resolvedRows}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          onChange={handleChange}
        />
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
