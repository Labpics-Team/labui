/**
 * <RadioGroup> + <Radio> — the native-React twin of the Lit `<lab-radio-group>`
 * (ADR-0001), and the FIRST COMPOUND React component.
 *
 * Same axes, same `@zag-js/radio-group` machine through the SAME Behaviors seam —
 * here via `useZag`. The machine owns the single selected value, roving focus,
 * Arrow-key selection, `role="radiogroup"`, `aria-checked`, and a hidden native
 * radio input per item. The components only spread the machine's prop-getters
 * onto native elements and paint with the SAME --lab-* roles, so parity is CSS,
 * not a second behaviour implementation.
 *
 * Compound shape — the RENDERER-NATIVE composition (and why it differs from Lit):
 *   A Zag group machine is ONE instance with per-item getters. In React the
 *   idiomatic compound is a context-provider parent (`RadioGroup`) that owns the
 *   machine, plus leaf children (`Radio`) that read the shared `api` from context
 *   and call the per-value getters for their own node. React composition is
 *   functions sharing context — there is no shared DOM query root to honour — so,
 *   unlike the Lit element (one custom element rendering all parts from an
 *   `items` config in one shadow scope), the React twin is genuinely
 *   parent-plus-children. Same machine, two idiomatic compositions, one paint.
 *
 * Client Component: a radio group is interactive (selection + roving focus). It
 * renders as a leaf under a Server Component shell — never a `'use client'` page
 * (dive-next P1).
 *
 * The axis types come from @labpics/ui-core/radio-group (type-only — no Lit
 * runtime), so the Lit and React APIs share ONE source of truth and cannot drift.
 */
'use client';

import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import type {
  LabRadioGroupOrientation,
  LabRadioGroupSize,
  LabRadioGroupType,
} from '@labpics/ui-core/radio-group';
import * as radioGroupMachine from '@zag-js/radio-group';
import { type ReactNode, createContext, useContext, useId } from 'react';
import { useZag } from './use-zag.js';
import './radio-group.css';

type RadioGroupSchema = SchemaOf<radioGroupMachine.Service>;
type RadioGroupApi = radioGroupMachine.Api;

const radioGroupModule: MachineModule<RadioGroupSchema, RadioGroupApi> = radioGroupMachine;

/**
 * The shared machine API, handed from the `RadioGroup` provider down to each
 * `Radio` leaf. Null outside a provider — a `Radio` rendered alone is a usage
 * bug we surface loudly rather than render a dead control.
 */
const RadioGroupContext = createContext<RadioGroupApi | null>(null);

export interface RadioGroupProps {
  /** Semantic intent of the selected dot + ring. */
  type?: LabRadioGroupType;
  /** Control size. */
  size?: LabRadioGroupSize;
  /** Layout direction; the machine maps it to the roving Arrow keys. */
  orientation?: LabRadioGroupOrientation;
  /** Controlled selected value — when set, the consumer owns the value. */
  value?: string | null;
  /** Uncontrolled initial value — read once by the machine at init. */
  defaultValue?: string | null;
  /** Disables the whole group — every item becomes non-interactive. */
  disabled?: boolean;
  /** Native form field name for the hidden radio inputs. */
  name?: string;
  /** Optional group label, rendered as the machine's label part (accessible name). */
  label?: ReactNode;
  /** Fires when the machine changes the selected value (machine is source of truth). */
  onValueChange?: (value: string | null) => void;
  /** The `<Radio>` children. */
  children?: ReactNode;
}

export function RadioGroup({
  type = 'accent',
  size = 'm',
  orientation = 'horizontal',
  value,
  defaultValue,
  disabled = false,
  name,
  label,
  onValueChange,
  children,
}: RadioGroupProps): ReactNode {
  const api = useZag(radioGroupModule, {
    id: useId(),
    value,
    defaultValue,
    disabled,
    orientation,
    name,
    onValueChange: onValueChange ? (details) => onValueChange(details.value) : undefined,
  });

  return (
    <div {...api.getRootProps()} data-lab-radio-group="" data-type={type} data-size={size}>
      {label != null && (
        <span {...api.getLabelProps()} className="lab-radio-group-label">
          {label}
        </span>
      )}
      <RadioGroupContext.Provider value={api}>{children}</RadioGroupContext.Provider>
    </div>
  );
}

export interface RadioProps {
  /** The value selected when this radio is chosen. Unique within the group. */
  value: string;
  /** Whether THIS item is non-interactive (independent of group `disabled`). */
  disabled?: boolean;
  /** The label text shown next to the dot. */
  children?: ReactNode;
}

export function Radio({ value, disabled, children }: RadioProps): ReactNode {
  const api = useContext(RadioGroupContext);
  if (api === null) {
    throw new Error('<Radio> must be rendered inside a <RadioGroup>.');
  }
  const itemProps = { value, disabled };

  return (
    <label {...api.getItemProps(itemProps)} className="lab-radio-item">
      <span {...api.getItemControlProps(itemProps)} className="lab-radio-control">
        <span className="lab-radio-dot" />
      </span>
      <span {...api.getItemTextProps(itemProps)} className="lab-radio-text">
        {children}
      </span>
      <input {...api.getItemHiddenInputProps(itemProps)} />
    </label>
  );
}
