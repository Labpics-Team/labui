/**
 * <TagsInput> — the native-React twin of the Lit `<lab-tags-input>` (ADR-0001).
 *
 * A tokenized text field: a text input plus a row of removable tag chips. Enter adds a
 * tag, Backspace removes the last, each chip has a delete button and (optionally)
 * edit-in-place, paste splits on a delimiter, with a max-tags cap. Same axes, same
 * `@zag-js/tags-input` machine through the SAME Behaviors seam — here via `useZag` (the
 * React side) instead of the Lit `ZagController`. No Lit in this path. The machine owns
 * the tag array + the input + the highlighted-tag navigation + add/remove/edit + the
 * paste-split + max/overflow validity + each chip's delete trigger and its accessible
 * name — the component only spreads the machine's prop-getters onto native elements and
 * paints with the SAME --lab-* roles, so parity is CSS, not a second behaviour
 * implementation.
 *
 * REUSES the field a11y seam: the label / helper / error association is the SAME shared
 * `field-a11y` helper from @labpics/ui-core that the Lit element and the other fields use.
 * The text input IS the field's control (the machine's `<label htmlFor>` targets it), so
 * the field a11y lands on the INPUT: fieldControlAria adds aria-describedby (helper +
 * error) / aria-errormessage / aria-required over the machine's input getter — merged,
 * never overwritten (disjoint from the machine's aria-invalid).
 *
 * Chips keyed by stable VALUE (the select/combobox canon): tags reorder/remove, and the
 * machine keys its item ids by value, so a chip never receives another tag's getters.
 *
 * Client Component: a tags input is interactive (tag array + input + keyboard). It renders
 * as a leaf under a Server Component shell — never a `'use client'` page (dive-next P1).
 *
 * The axis types and the chip-control translations come from @labpics/ui-core (the
 * translations are runtime, shared so the delete-trigger / edit-input names are identical
 * across renderers), so the Lit and React APIs share ONE source of truth.
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
import { tagsInputTranslations } from '@labpics/ui-core/tags-input';
import * as tagsInputMachine from '@zag-js/tags-input';
import { type ReactNode, useId } from 'react';
import { useZag } from './use-zag.js';
import './tags-input.css';

export type { LabFieldSize as LabTagsInputSize, LabFieldType as LabTagsInputType };

type TagsInputSchema = SchemaOf<tagsInputMachine.Service>;
type TagsInputApi = tagsInputMachine.Api;

const tagsInputModule: MachineModule<TagsInputSchema, TagsInputApi> = tagsInputMachine;

export interface TagsInputProps {
  /** Visible label text — rendered into a real `<label htmlFor>` (accessible name). */
  label: string;
  /** Sentiment of the field. */
  type?: LabFieldType;
  /** Control size. */
  size?: LabFieldSize;
  /** Visually hide the label, keeping it in the a11y tree. */
  labelHidden?: boolean;
  /** Helper / description text linked to the input via aria-describedby. */
  helper?: ReactNode;
  /** Error message; announced (role="alert") and linked only when `invalid`. */
  error?: ReactNode;
  /** Placeholder text for the empty input. */
  placeholder?: string;
  /** Maximum number of tags. Overflow drives the invalid state. */
  max?: number;
  /** The character that adds a tag and splits a pasted value (default ","). */
  delimiter?: string;
  /** Allow editing a chip in place (Enter / double-click). */
  editable?: boolean;
  /** Add a tag when a value is pasted (split on the delimiter). */
  addOnPaste?: boolean;
  /** Allow duplicate tag values. */
  allowDuplicates?: boolean;
  /** Controlled tag value(s) — when set, the consumer owns the value. */
  value?: string[];
  /** Uncontrolled initial tag value(s) — read once by the machine at init. */
  defaultValue?: string[];
  /** Non-editable: the chips read their value but cannot be changed. */
  readOnly?: boolean;
  /** Non-interactive and dimmed. */
  disabled?: boolean;
  /** Required — sets aria-required on the input and the native hidden input. */
  required?: boolean;
  /** Invalid — drives aria-invalid / aria-errormessage and danger styling. */
  invalid?: boolean;
  /** Native form field name (rides the machine's hidden input). */
  name?: string;
  /** Fires when the machine updates the tag value(s) (machine is source of truth). */
  onValueChange?: (value: string[]) => void;
  /** Fires when the typed input value changes. */
  onInputValueChange?: (inputValue: string) => void;
}

/** Strip `undefined` ARIA so React omits the attribute instead of rendering "undefined". */
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

  return (
    <div
      {...api.getRootProps()}
      className="lab-field"
      data-lab-tags-input=""
      data-type={type}
      data-size={size}
      data-label-hidden={labelHidden || undefined}
      data-readonly={readOnly || undefined}
      data-disabled={disabled || undefined}
      data-required={required || undefined}
      data-invalid={invalid || undefined}
    >
      <label {...api.getLabelProps()} htmlFor={ids.control} className="lab-field-label">
        <span className="lab-field-label-text">{label}</span>
        {required ? (
          <span className="lab-field-required-mark" aria-hidden="true">
            {' *'}
          </span>
        ) : null}
      </label>
      <div {...api.getControlProps()} className="lab-tags-input-control">
        {api.value.map((tagValue, index) => {
          const itemProps = { index, value: tagValue };
          return (
            // Keyed by the STABLE value, never the index: tags reorder/remove, and the
            // machine keys its per-chip getters by value, so a chip never gets another
            // tag's delete trigger / highlight / edit state.
            <span key={tagValue} {...api.getItemProps(itemProps)} className="lab-tags-input-item">
              <span {...api.getItemPreviewProps(itemProps)} className="lab-tags-input-item-preview">
                <span {...api.getItemTextProps(itemProps)} className="lab-tags-input-item-text">
                  {tagValue}
                </span>
                <button
                  {...api.getItemDeleteTriggerProps(itemProps)}
                  className="lab-tags-input-item-delete"
                >
                  ×
                </button>
              </span>
              <input {...api.getItemInputProps(itemProps)} className="lab-tags-input-item-input" />
            </span>
          );
        })}
        <input
          {...api.getInputProps()}
          {...ariaProps(fieldAria)}
          className="lab-tags-input-input"
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
