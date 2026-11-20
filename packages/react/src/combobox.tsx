'use client';

import {
  type MachineModule,
  type PropTypes,
  type SchemaOf,
  fieldControlAria,
  fieldControlAriaProps,
  fieldErrorIsActive,
  fieldPartIds,
  filterComboboxItems,
} from '@labpics/ui-core';
import type {
  LabComboboxItem,
  LabComboboxPlacement,
  LabComboboxSize,
  LabComboboxType,
} from '@labpics/ui-core/combobox';
import * as comboboxMachine from '@zag-js/combobox';
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useArrayFieldForm } from './use-array-field-form.js';
import { useZag } from './use-zag.js';
import '@labpics/ui-core/input-extensions.css';
import { comboboxBehavior, mountComboboxKeyboard } from '@labpics/ui-core/combobox/runtime';

type ComboboxSchema = SchemaOf<comboboxMachine.Service<LabComboboxItem>>;
type ComboboxApi = comboboxMachine.Api<PropTypes, LabComboboxItem>;

const comboboxModule: MachineModule<ComboboxSchema, ComboboxApi> = comboboxBehavior;

export interface ComboboxProps {
  items: ReadonlyArray<LabComboboxItem>;
  type?: LabComboboxType;
  size?: LabComboboxSize;
  placement?: LabComboboxPlacement;
  multiple?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
  name?: string;
  placeholder?: string;
  label: string;
  labelHidden?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  onInputValueChange?: (inputValue: string) => void;
  onOpenChange?: (open: boolean) => void;
}

export function Combobox({
  items,
  type = 'neutral',
  size = 'm',
  placement = 'bottom-start',
  multiple = false,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  name,
  placeholder,
  label,
  labelHidden = false,
  helper,
  error,
  value,
  defaultValue,
  onValueChange,
  onInputValueChange,
  onOpenChange,
}: ComboboxProps): ReactNode {
  const baseId = useId();
  const ids = fieldPartIds(baseId);

  // The collection follows the editable query; selected keys remain form values.
  const [query, setQuery] = useState('');
  const visibleItems = useMemo(() => filterComboboxItems(items, query), [items, query]);

  const collection = useMemo(
    () =>
      comboboxMachine.collection<LabComboboxItem>({
        items: [...visibleItems],
        itemToValue: (item) => item.value,
        itemToString: (item) => item.label,
        isItemDisabled: (item) => item.disabled ?? false,
      }),
    [visibleItems],
  );

  const api = useZag(comboboxModule, {
    id: baseId,
    ids: { input: ids.control, label: ids.label },
    collection,
    multiple,
    disabled,
    readOnly,
    required,
    invalid,
    name,
    placeholder,
    value,
    defaultValue,
    openOnClick: true,
    positioning: { placement, strategy: 'fixed', gutter: 4, overflowPadding: 16, sameWidth: true },
    onInputValueChange: (details) => {
      setQuery(details.reason === 'input-change' ? details.inputValue : '');
      onInputValueChange?.(details.inputValue);
    },
    onValueChange: onValueChange ? (details) => onValueChange(details.value) : undefined,
    onOpenChange: (details) => {
      if (details.open && details.reason !== 'input-change') setQuery('');
      onOpenChange?.(details.open);
    },
  });

  const hasHelper = helper != null && helper !== '';
  const hasError = error != null && error !== '';
  const a11y = fieldControlAria({ id: baseId, invalid, required, hasHelper, hasError });
  const showError = fieldErrorIsActive({ invalid, hasError });

  const positioner = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const latestApi = useRef(api);
  latestApi.current = api;
  useEffect(
    () =>
      inputRef.current
        ? mountComboboxKeyboard(inputRef.current, () => latestApi.current)
        : undefined,
    [],
  );
  const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
  useClientLayoutEffect(() => {
    const node = positioner.current;
    if (!node) return;
    const open = api.open && !disabled && !readOnly;
    if (open !== node.matches(':popover-open')) {
      if (open) node.showPopover();
      else node.hidePopover();
      if (open) api.reposition();
    }
  });

  const listbox = (
    <div
      {...api.getPositionerProps()}
      className="lab-combobox-positioner"
      {...{ popover: 'manual' }}
      ref={positioner}
    >
      <ul
        {...api.getContentProps()}
        className="lab-combobox-content lab-select-content"
        data-size={size}
      >
        {visibleItems.length === 0 ? (
          <li className="lab-combobox-empty" aria-hidden="true">
            No results
          </li>
        ) : (
          visibleItems.map((item) => (
            <li
              key={item.value}
              {...api.getItemProps({ item })}
              className="lab-combobox-item lab-select-item"
            >
              <span
                {...api.getItemTextProps({ item })}
                className="lab-combobox-item-text lab-select-item-text"
              >
                {item.label}
              </span>
              <span
                {...api.getItemIndicatorProps({ item })}
                className="lab-combobox-item-indicator lab-select-item-indicator"
                aria-hidden="true"
              >
                ✓
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );

  const formRoot = useArrayFieldForm({
    value: api.value,
    defaultValue,
    controlled: value !== undefined,
    required,
    invalid,
    error: typeof error === 'string' ? error : undefined,
    reset: api.setValue,
  });

  return (
    <div
      {...api.getRootProps()}
      ref={formRoot}
      className="lab-field"
      data-lab-combobox=""
      data-lab-input=""
      data-trailing=""
      data-type={type}
      data-size={size}
      data-label-hidden={labelHidden || undefined}
      data-readonly={readOnly || undefined}
      data-disabled={disabled || undefined}
      data-required={required || undefined}
      data-invalid={invalid || undefined}
    >
      {name &&
        api.value.map((selected, index) => (
          <input
            key={`${index}:${selected}`}
            type="hidden"
            name={name}
            value={selected}
            disabled={disabled}
          />
        ))}
      <div className="lab-input-frame">
        <label {...api.getLabelProps()} htmlFor={ids.control} className="lab-field-label">
          <span className="lab-combobox-label-text">{label}</span>
          {required ? (
            <span className="lab-combobox-required-mark" aria-hidden="true">
              {' *'}
            </span>
          ) : null}
        </label>
        <div {...api.getControlProps()} className="lab-extension-control">
          <input
            {...api.getInputProps()}
            ref={inputRef}
            name={undefined}
            required={false}
            {...fieldControlAriaProps(a11y)}
            className="lab-combobox-input lab-field-control"
          />
          <button {...api.getTriggerProps()} className="lab-combobox-trigger lab-extension-trigger">
            <span className="lab-extension-chevron" aria-hidden="true" />
          </button>
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
      {listbox}
    </div>
  );
}
