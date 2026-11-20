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
import { tagsInputTranslations } from '@labpics/ui-core/tags-input';
import * as tagsInputMachine from '@zag-js/tags-input';
import { type ReactNode, useId } from 'react';
import { useArrayFieldForm } from './use-array-field-form.js';
import { useZag } from './use-zag.js';
import '@labpics/ui-core/input-extensions.css';

export type { LabFieldSize as LabTagsInputSize, LabFieldType as LabTagsInputType };

type TagsInputSchema = SchemaOf<tagsInputMachine.Service>;
type TagsInputApi = tagsInputMachine.Api;

const tagsInputModule: MachineModule<TagsInputSchema, TagsInputApi> = tagsInputMachine;

export interface TagsInputProps {
  label: string;
  type?: LabFieldType;
  size?: LabFieldSize;
  labelHidden?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  placeholder?: string;
  max?: number;
  delimiter?: string;
  editable?: boolean;
  addOnPaste?: boolean;
  allowDuplicates?: boolean;
  value?: string[];
  defaultValue?: string[];
  readOnly?: boolean;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  name?: string;
  onValueChange?: (value: string[]) => void;
  onInputValueChange?: (inputValue: string) => void;
}

function ariaProps(
  aria: Pick<FieldControlAria, 'aria-describedby' | 'aria-errormessage' | 'aria-required'>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(aria)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function TagsInput({
  label,
  type = 'neutral',
  size = 'm',
  labelHidden = false,
  helper,
  error,
  placeholder = 'Add a tag…',
  max,
  delimiter = ',',
  editable = true,
  addOnPaste = false,
  allowDuplicates = false,
  value,
  defaultValue,
  readOnly = false,
  disabled = false,
  required = false,
  invalid = false,
  name,
  onValueChange,
  onInputValueChange,
}: TagsInputProps): ReactNode {
  const baseId = useId();
  const ids = fieldPartIds(baseId);
  const hasHelper = helper != null && helper !== '';
  const hasError = error != null && error !== '';
  const showError = fieldErrorIsActive({ invalid, hasError });
  // The machine owns the input's aria-invalid + value; the field owns the description
  // wiring. Compute only the description attrs and spread them OVER the input getter, the
  // same split the Lit element uses.
  const fieldAria = fieldControlAria({ id: baseId, invalid, required, hasHelper, hasError });

  const api = useZag(tagsInputModule, {
    id: baseId,
    // Pin the input + label ids to the field-a11y part ids so the <label htmlFor> and the
    // aria-describedby target the SAME node the machine wires the input onto.
    ids: { input: ids.control, label: ids.label },
    max,
    delimiter,
    editable,
    addOnPaste,
    allowDuplicates,
    placeholder,
    value,
    defaultValue,
    disabled,
    readOnly,
    invalid,
    required,
    name,
    // Shared chip-control accessible names — identical to the Lit element (one rule, two
    // renderers), so the delete trigger and edit input announce the same.
    translations: tagsInputTranslations as tagsInputMachine.IntlTranslations,
    onValueChange: onValueChange ? (details) => onValueChange(details.value) : undefined,
    onInputValueChange: onInputValueChange
      ? (details) => onInputValueChange(details.inputValue)
      : undefined,
  });

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
      data-lab-tags-input=""
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
          <span className="lab-field-label-text">{label}</span>
          {required ? (
            <span className="lab-field-required-mark" aria-hidden="true">
              {' *'}
            </span>
          ) : null}
        </label>
        <div {...api.getControlProps()} className="lab-tags-input-control lab-extension-control">
          {api.value.map((tagValue, index) => {
            const itemProps = { index, value: tagValue };
            return (
              // Ключ — ИНДЕКС, не значение: при allow-duplicates одинаковые значения дали
              // бы дубль-ключи React (глючная реконсиляция при удалении/переупорядочке),
              // а иной стабильной идентичности у тега нет (api.value — голые строки).
              // Индекс здесь честен: список целиком машинный, строится заново из
              // api.value; чипы без локального состояния; пропсы машины несут
              // {index, value} независимо от key.
              // biome-ignore lint/suspicious/noArrayIndexKey: значение не уникально при allow-duplicates — индекс единственный корректный ключ
              <span
                key={index}
                {...api.getItemProps(itemProps)}
                className="lab-tags-input-item"
                data-lab-chip=""
                data-size="s"
                data-selected=""
                data-sharp=""
              >
                <span
                  {...api.getItemPreviewProps(itemProps)}
                  className="lab-tags-input-item-preview lab-chip-content"
                >
                  <span
                    {...api.getItemTextProps(itemProps)}
                    className="lab-tags-input-item-text lab-chip-label"
                  >
                    {tagValue}
                  </span>
                  <button
                    {...api.getItemDeleteTriggerProps(itemProps)}
                    className="lab-tags-input-item-delete lab-tags-input-delete"
                  >
                    <span className="lab-chip-close" aria-hidden="true" />
                  </button>
                </span>
                <input
                  {...api.getItemInputProps(itemProps)}
                  className="lab-tags-input-item-input lab-tags-input-edit"
                />
              </span>
            );
          })}
          <input
            {...api.getInputProps()}
            name={undefined}
            required={false}
            {...ariaProps(fieldAria)}
            className="lab-tags-input-input lab-field-control"
          />
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
