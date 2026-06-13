/**
 * <Checkbox> — the native-React twin of the Lit `<lab-checkbox>` (ADR-0001).
 *
 * Same axes, same `@zag-js/checkbox` machine through the SAME Behaviors seam —
 * here via `useZag`. The machine owns the HONEST tri-state (`true` / `false` /
 * `"indeterminate"`), `role` + `aria-checked` (incl. `"mixed"`), Space activation,
 * focus, and the hidden input whose `.indeterminate` DOM property it sets. The
 * component spreads the prop-getters onto native elements and paints with the
 * SAME --lab-* roles, so parity is CSS, not a second behaviour implementation.
 *
 * Client Component: a checkbox is interactive. It renders as a leaf under a Server
 * Component shell — never a `'use client'` page (dive-next P1).
 */
'use client';

import type { LabCheckboxChecked, LabCheckboxSize, LabCheckboxType } from '@labpics/ui-core';
import * as checkboxMachine from '@zag-js/checkbox';
import { type ReactNode, useId } from 'react';
import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import { useZag } from './use-zag.js';
import './checkbox.css';

type CheckboxSchema = SchemaOf<checkboxMachine.Service>;
type CheckboxApi = checkboxMachine.Api;

const checkboxModule: MachineModule<CheckboxSchema, CheckboxApi> = checkboxMachine;

export interface CheckboxProps {
  /** Semantic intent of the checked box. */
  type?: LabCheckboxType;
  /** Control size. */
  size?: LabCheckboxSize;
  /** Controlled tri-state value — boolean OR "indeterminate". */
  checked?: LabCheckboxChecked;
  /** Uncontrolled initial tri-state value — read once by the machine at init. */
  defaultChecked?: LabCheckboxChecked;
  /** Disables the control. */
  disabled?: boolean;
  /** Fires when the machine changes the tri-state value (machine is source of truth). */
  onCheckedChange?: (checked: LabCheckboxChecked) => void;
  /** Native form field name for the hidden input. */
  name?: string;
  /** Label content (parity with the Lit default slot). */
  children?: ReactNode;
}

export function Checkbox({
  type = 'accent',
  size = 'm',
  checked,
  defaultChecked,
  disabled = false,
  onCheckedChange,
  name,
  children,
}: CheckboxProps): ReactNode {
  const api = useZag(checkboxModule, {
    id: useId(),
    checked,
    defaultChecked,
    disabled,
    name,
    onCheckedChange: onCheckedChange ? (details) => onCheckedChange(details.checked) : undefined,
  });

  return (
    <label
      {...api.getRootProps()}
      data-lab-checkbox=""
      data-type={type}
      data-size={size}
      data-checked={(api.checked && !api.indeterminate) || undefined}
      data-indeterminate={api.indeterminate || undefined}
      data-disabled={api.disabled || undefined}
    >
      <span {...api.getControlProps()} className="lab-checkbox-control">
        {/* Mutually exclusive glyphs — the machine's state CSS picks which shows. */}
        <svg
          className="lab-checkbox-glyph lab-checkbox-glyph-check"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3.5 8.5l3 3 6-6.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg
          className="lab-checkbox-glyph lab-checkbox-glyph-mixed"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M3.5 8h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input {...api.getHiddenInputProps()} />
      </span>
      {children != null && <span className="lab-checkbox-label">{children}</span>}
    </label>
  );
}
