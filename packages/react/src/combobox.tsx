/**
 * <Combobox> — the native-React twin of the Lit `<lab-combobox>` (ADR-0001).
 *
 * A text input with a filterable listbox (autocomplete / typeahead). Same axes, same
 * `@zag-js/combobox` machine through the SAME Behaviors seam (here via `useZag`), and
 * the SAME shared `field-a11y` helper for the label / helper / error association — so
 * BOTH seams are one source of truth across renderers, not a second implementation.
 *
 * It FUSES the two established React canons:
 *   1. The COMPOUND + POSITIONED listbox (`<Select>`): the machine owns the control,
 *      the positioned listbox, single / multiple selection, Arrow/Home/End navigation,
 *      typeahead, Escape / outside-click dismiss, focus restoration, and
 *      role="combobox"/listbox/option + aria. The listbox renders into a `createPortal`
 *      at <body> (`portalled:true`) — the idiomatic React escape from clipping /
 *      stacking ancestors (the guarantee the Lit twin gets from `strategy:'fixed'`).
 *   2. The FORM-FIELD a11y (`<Input>`): `fieldControlAria` adds aria-describedby
 *      (helper + error) / aria-invalid / aria-errormessage / aria-required on top of
 *      what the machine already wires onto the input — merged, never overwritten.
 *
 * Filtering is the consumer's responsibility (Zag does not filter for you): the machine
 * fires `onInputValueChange`; this component narrows the visible items with the SHARED
 * `filterComboboxItems` from core (so narrowing is ONE rule, identical to the Lit
 * element) and rebuilds the collection. The machine owns highlight/selection over the
 * filtered set.
 *
 * Client Component: a combobox is interactive (input value, open state, selection,
 * positioning, keyboard). It is a leaf under a Server Component shell — never a
 * `'use client'` page (dive-next P1).
 *
 * The axis types and the item shape come from @labpics/ui-core/combobox (type-only —
 * no Lit runtime), so the Lit and React APIs share ONE source of truth.
 */
'use client';

import * as comboboxMachine from '@labpics/ui-core/behaviors/combobox';
import type {
  LabComboboxItem,
  LabComboboxPlacement,
  LabComboboxSize,
  LabComboboxType,
} from '@labpics/ui-core/combobox';
import {
  type MachineModule,
  type PropTypes,
  type SchemaOf,
  fieldControlAria,
  fieldControlAriaProps,
  fieldErrorIsActive,
  fieldPartIds,
  filterComboboxItems,
} from '@labpics/ui-core/shared';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useZag } from './use-zag.js';
import './combobox.css';

type ComboboxSchema = SchemaOf<comboboxMachine.Service<LabComboboxItem>>;
type ComboboxApi = comboboxMachine.Api<PropTypes, LabComboboxItem>;

const comboboxModule: MachineModule<ComboboxSchema, ComboboxApi> = comboboxMachine;

export interface ComboboxProps {
  /** The options. The machine resolves value/label/disabled through the collection. */
  items: ReadonlyArray<LabComboboxItem>;
  /** Field sentiment — drives the input border / label colour. */
  type?: LabComboboxType;
  /** Control size — drives input height and listbox font band. */
  size?: LabComboboxSize;
  /** Where the listbox sits relative to the input. */
  placement?: LabComboboxPlacement;
  /** Multiple-selection mode — the machine sets `aria-multiselectable`. */
  multiple?: boolean;
  /** Input non-interactive when true. */
  disabled?: boolean;
  /** Non-editable: the input reads its value but cannot be changed. */
  readOnly?: boolean;
  /** Required — sets aria-required and the native `required`. */
  required?: boolean;
  /** Invalid — drives aria-invalid / aria-errormessage and the danger styling. */
  invalid?: boolean;
  /** Native form field name for the combobox input. */
  name?: string;
  /** Placeholder shown in the input when empty. */
  placeholder?: string;
  /** Visible label text — rendered into a real `<label htmlFor>` (accessible name). */
  label: string;
  /** Visually hide the label, keeping it in the a11y tree. */
  labelHidden?: boolean;
  /** Helper / description text linked to the input via aria-describedby. */
  helper?: ReactNode;
  /** Error message; announced (role="alert") and linked only when `invalid`. */
  error?: ReactNode;
  /** Controlled selected value(s) — when set, the consumer owns the value. */
  value?: string[];
  /** Uncontrolled initial value(s) — read once by the machine at init. */
  defaultValue?: string[];
  /** Fires when the machine changes the selected value(s) (machine is source of truth). */
  onValueChange?: (value: string[]) => void;
  /** Fires when the input value (the typed query) changes. */
  onInputValueChange?: (inputValue: string) => void;
  /** Fires when the machine opens or closes the listbox. */
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

  // The consumer owns filtering: the visible subset is the source `items` narrowed by
  // the current query. The SHARED `filterComboboxItems` keeps this identical to the Lit
  // element (one rule, two renderers). State is the query string only; the visible list
  // is DERIVED from it (craft-frontend P2 — no duplicated state).
  const [query, setQuery] = useState('');
  const visibleItems = useMemo(() => filterComboboxItems(items, query), [items, query]);

  // The collection the machine resolves over — built from the VISIBLE items, memoised on
  // them so a stable visible list yields a stable collection (no needless resets).
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
    // Pin the input + label ids to the field-a11y part ids so the <label htmlFor> and
    // the aria-describedby target the SAME node the machine wires the combobox role onto.
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
    // Open the suggestion list on click/focus of the input (Zag defaults this off) —
    // matches the "open on focus / type" contract and the standard autocomplete UX,
    // identical to the Lit element.
    openOnClick: true,
    positioning: { placement, strategy: 'fixed' },
    onInputValueChange: (details) => {
      setQuery(details.inputValue);
      onInputValueChange?.(details.inputValue);
    },
    onValueChange: onValueChange ? (details) => onValueChange(details.value) : undefined,
    onOpenChange: onOpenChange ? (details) => onOpenChange(details.open) : undefined,
  });

  // The field a11y the machine does NOT own — merged onto the machine's input props.
  const hasHelper = helper != null && helper !== '';
  const hasError = error != null && error !== '';
  const a11y = fieldControlAria({ id: baseId, invalid, required, hasHelper, hasError });
  const showError = fieldErrorIsActive({ invalid, hasError });

  // Overlays are client-only: gate the body portal on mount so SSR/first hydration emit
  // nothing for the floating listbox.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const listbox = (
    <div {...api.getPositionerProps()} className="lab-combobox-positioner">
      <ul {...api.getContentProps()} className="lab-combobox-content" data-size={size}>
        {visibleItems.length === 0 ? (
          <li className="lab-combobox-empty" aria-hidden="true">
            No results
          </li>
        ) : (
          visibleItems.map((item) => (
            // Keyed by the STABLE value, never the index: the filtered list reorders /
            // shrinks every keystroke, and the machine keys its per-item getters by the
            // collection-resolved value, so a row never gets another option's props.
            <li key={item.value} {...api.getItemProps({ item })} className="lab-combobox-item">
              <span {...api.getItemTextProps({ item })} className="lab-combobox-item-text">
                {item.label}
              </span>
              <span
                {...api.getItemIndicatorProps({ item })}
                className="lab-combobox-item-indicator"
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

  return (
    <div
      {...api.getRootProps()}
      className="lab-field"
      data-lab-combobox=""
      data-type={type}
      data-size={size}
      data-label-hidden={labelHidden || undefined}
      data-readonly={readOnly || undefined}
      data-disabled={disabled || undefined}
      data-required={required || undefined}
      data-invalid={invalid || undefined}
    >
      {/* htmlFor is also what the machine's getLabelProps sets (→ the input id we pinned
          via `ids.input`); stating it explicitly satisfies the static a11y lint and is
          identical to the machine's value, so it is redundant, never a second source. */}
      <label {...api.getLabelProps()} htmlFor={ids.control} className="lab-combobox-label">
        <span className="lab-combobox-label-text">{label}</span>
        {required ? (
          <span className="lab-combobox-required-mark" aria-hidden="true">
            {' *'}
          </span>
        ) : null}
      </label>
      <div {...api.getControlProps()} className="lab-combobox-control">
        <input
          {...api.getInputProps()}
          {...fieldControlAriaProps(a11y)}
          className="lab-combobox-input"
        />
        {/* The machine's getTriggerProps sets aria-label ("Toggle suggestions"),
            aria-haspopup/expanded/controls and tabIndex=-1, so the caret button is an
            accessible, non-tab-stop toggle — no aria-hidden (it owns a real name). */}
        <button {...api.getTriggerProps()} className="lab-combobox-trigger">
          ▾
        </button>
      </div>
      {hasHelper ? (
        <span id={ids.helper} className="lab-combobox-helper">
          {helper}
        </span>
      ) : null}
      {showError ? (
        <span id={ids.error} className="lab-combobox-error" role="alert">
          {error}
        </span>
      ) : null}
      {mounted && createPortal(listbox, document.body)}
    </div>
  );
}
