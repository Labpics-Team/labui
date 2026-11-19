/**
 * <Select> — the native-React twin of the Lit `<lab-select>` (ADR-0001), and the
 * COMPOUND + POSITIONED React canon.
 *
 * Same axes, same `@zag-js/select` machine through the SAME Behaviors seam — here
 * via `useZag`. The machine owns open-on-click, the positioned listbox, single /
 * multiple selection, Arrow/Home/End navigation, typeahead, Escape/outside-click
 * dismiss, focus restoration, `role="combobox"`/`listbox`/`option` + aria, and a
 * hidden native `<select>` for forms. The component only spreads prop-getters and
 * paints with the SAME `--lab-*` roles, so parity is CSS, not a second behaviour.
 *
 * Compound shape — driven by the COLLECTION, not parent+leaf children:
 *   A select's options are DATA (the `collection`), and the machine resolves each
 *   option's value/label/disabled through it. Unlike RadioGroup (a parent context
 *   provider + `<Radio>` leaves), the idiomatic select renders the collection's
 *   items and spreads `getItemProps({ item })` per item — so the React twin takes
 *   the SAME declarative `items` prop as the Lit element. This keeps the option
 *   set and the collection in lockstep (no provider/child drift) and lets both
 *   renderers describe an option identically (ONE source of truth for the shape).
 *
 * ── The overlay canon (React half) ───────────────────────────────────────────
 * The listbox renders into a `createPortal` at `document.body` (`portalled:true`),
 * the idiomatic React escape from clipping/stacking ancestors — the guarantee the
 * Lit twin gets from `strategy:'fixed'` in its shadow root. The portal is gated on
 * a `mounted` flag so the server emits nothing for it (a select is client-only).
 *
 * Client Component: a select is interactive (open state, selection, positioning,
 * keyboard). It is a leaf under a Server Component shell — never a `'use client'`
 * page (dive-next P1).
 *
 * The axis types and the item shape come from @labpics/ui-core/select (type-only —
 * no Lit runtime), so the Lit and React APIs share ONE source of truth.
 */
'use client';

import type { LabSelectItem, LabSelectPlacement, LabSelectSize } from '@labpics/ui-core/select';
import { selectBehavior } from '@labpics/ui-core/select/behavior';
import * as selectMachine from '@zag-js/select';
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Chip } from './chip.js';
import { useZag } from './use-zag.js';
import '@labpics/ui-core/select.css';

export interface SelectProps {
  /** The options. The machine resolves value/label/disabled through the collection. */
  items: ReadonlyArray<LabSelectItem>;
  /** Control size — drives trigger height and listbox font band. */
  size?: LabSelectSize;
  /** Where the listbox sits relative to the trigger. */
  placement?: LabSelectPlacement;
  /** Multiple-selection mode — the machine sets `aria-multiselectable`. */
  multiple?: boolean;
  /** Trigger non-interactive when true. */
  disabled?: boolean;
  /** Native form field name for the hidden `<select>`. */
  name?: string;
  form?: string;
  required?: boolean;
  dir?: 'ltr' | 'rtl';
  /** Internal Multiselect caption; false retains its accessible name. */
  showLabel?: boolean;
  /** Decorative icon before a Dropdown value. */
  leading?: ReactNode;
  /** Verb announced by a chip removal button. */
  removeLabel?: string;
  /** Placeholder shown in the trigger when nothing is selected. */
  placeholder?: string;
  /** Optional control label, wired as the machine's label part (accessible name). */
  label?: ReactNode;
  /** Controlled selected value(s) — when set, the consumer owns the value. */
  value?: string[];
  /** Uncontrolled initial value(s) — read once by the machine at init. */
  defaultValue?: string[];
  /** Fires when the machine changes the selected value(s) (machine is source of truth). */
  onValueChange?: (value: string[]) => void;
  /** Fires when the machine opens or closes the listbox. */
  onOpenChange?: (open: boolean) => void;
}

export function Select({
  items,
  size = 'm',
  placement = 'bottom-start',
  multiple = false,
  disabled = false,
  name,
  form,
  required = false,
  dir,
  showLabel = true,
  leading,
  removeLabel = 'Remove',
  placeholder = 'Select…',
  label,
  value,
  defaultValue,
  onValueChange,
  onOpenChange,
}: SelectProps): ReactNode {
  // Build the collection from `items` — the machine's value resolver. Memoised on
  // the item list so a stable list yields a stable collection (no needless resets).
  const collection = useMemo(
    () =>
      selectMachine.collection<LabSelectItem>({
        items: [...items],
        itemToValue: (item) => item.value,
        itemToString: (item) => item.label,
        isItemDisabled: (item) => item.disabled ?? false,
      }),
    [items],
  );

  const hiddenSelect = useRef<HTMLSelectElement>(null);
  const [, refresh] = useState(0);
  const id = useId();
  const api = useZag(selectBehavior, {
    id,
    ids: { hiddenSelect: `${id}-native` },
    collection,
    multiple,
    disabled,
    name,
    form,
    required,
    dir,
    value,
    defaultValue,
    positioning: { placement, strategy: 'fixed' },
    onValueChange: (details) => {
      onValueChange?.(details.value);
      // Rejected native/autofill requests must restore the accepted DOM selection.
      refresh((revision) => revision + 1);
    },
    onOpenChange: onOpenChange ? (details) => onOpenChange(details.open) : undefined,
  });

  // Overlays are client-only: gate the body portal on mount so SSR/first hydration
  // emit nothing for the floating listbox.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // The collection may change without a value-change effect. Always project the
  // accepted array, including [] and [''], instead of assigning it to scalar value.
  useEffect(() => {
    const select = hiddenSelect.current;
    if (!select) return;
    const selected = new Set(api.value);
    let hasSelection = false;
    for (const option of select.options) {
      option.selected = selected.has(option.value);
      if (value !== undefined) option.defaultSelected = option.selected;
      hasSelection ||= option.selected;
    }
    if (!hasSelection) select.selectedIndex = -1;
  });

  const listbox = (
    <div {...api.getPositionerProps()} className="lab-select-positioner">
      <ul {...api.getContentProps()} className="lab-select-content" data-size={size}>
        {items.map((item) => (
          // Keyed by the STABLE value, never the index: the machine keys its
          // per-item getters by the collection-resolved value, and the id it puts
          // on the option is what aria-activedescendant points at. React's key and
          // the machine's value agree, so a row never gets another option's props.
          <li key={item.value} {...api.getItemProps({ item })} className="lab-select-item">
            <span {...api.getItemTextProps({ item })} className="lab-select-item-text">
              {item.label}
            </span>
            <span
              {...api.getItemIndicatorProps({ item })}
              className="lab-select-item-indicator"
              aria-hidden="true"
            >
              ✓
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  const caption =
    label != null ? (
      <span
        {...api.getLabelProps()}
        className={`lab-select-label ${multiple && showLabel ? '' : 'lab-select-label-hidden'}`}
      >
        {label}
      </span>
    ) : null;
  const triggerProps = api.getTriggerProps();
  return (
    <div
      {...api.getRootProps()}
      className="lab-select-root"
      data-lab-select=""
      data-size={size}
      data-multiple={multiple || undefined}
      data-disabled={api.disabled || undefined}
      data-label-visible={(label != null && multiple && showLabel) || undefined}
    >
      {!multiple && caption}
      <div {...api.getControlProps()} className="lab-select-control">
        {multiple && caption}
        <button
          {...triggerProps}
          className="lab-select-trigger"
          aria-label={label == null ? placeholder : undefined}
        >
          <span className="lab-select-value">
            {!multiple && leading != null && (
              <span className="lab-select-leading" aria-hidden="true">
                {leading}
              </span>
            )}
            <span
              {...api.getValueTextProps()}
              className="lab-select-value-text"
              hidden={multiple && api.value.length > 0}
            >
              {api.valueAsString || placeholder}
            </span>
          </span>
          <span {...api.getIndicatorProps()} className="lab-select-indicator" aria-hidden="true" />
        </button>
        {multiple && api.value.length > 0 && (
          <div className="lab-select-chips">
            {api.value.map((selected) => {
              const item = items.find((item) => item.value === selected);
              const text = item?.label ?? selected;
              return (
                <Chip
                  key={selected}
                  mode="remove"
                  size="s"
                  sharp
                  disabled={api.disabled || item?.disabled}
                  aria-label={`${removeLabel} ${text}`}
                  onRemove={() => {
                    api.setValue(api.value.filter((entry) => entry !== selected));
                    api.focus();
                  }}
                >
                  {text}
                </Chip>
              );
            })}
          </div>
        )}
        {multiple && (
          <fieldset className="lab-select-outline" aria-hidden="true">
            <legend>{label}</legend>
          </fieldset>
        )}
      </div>
      <select {...api.getHiddenSelectProps()} ref={hiddenSelect} className="lab-select-hidden">
        {items.map((item) => (
          <option key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </option>
        ))}
      </select>
      {mounted && createPortal(listbox, document.body)}
    </div>
  );
}
