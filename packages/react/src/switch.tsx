/**
 * <Switch> — the native-React twin of the Lit `<lab-switch>` (ADR-0001).
 *
 * Same axes, same `@zag-js/switch` machine through the SAME Behaviors seam — here
 * via `useZag` (the React side) instead of the Lit `ZagController`. No Lit in this
 * path; Next's shallow WC-SSR never touches React. The machine owns checked-state,
 * keyboard (Space/Enter), focus, `role="switch"` + `aria-checked`, and the hidden
 * form input — the component only spreads the machine's prop-getters onto native
 * elements and paints with the SAME --lab-* roles, so parity is CSS, not a second
 * behaviour implementation.
 *
 * Client Component: a switch is interactive (state + onChange). It renders as a
 * leaf under a Server Component shell — never a `'use client'` page (dive-next P1).
 *
 * The axis types come from @labpics/ui-core (type-only — no Lit runtime), so the
 * Lit and React APIs share ONE source of truth and cannot drift.
 */
'use client';

import type { LabSwitchSize, LabSwitchType } from '@labpics/ui-core';
import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import * as switchMachine from '@zag-js/switch';
import { type ReactNode, useId } from 'react';
import { useZag } from './use-zag.js';
import './switch.css';

type SwitchSchema = SchemaOf<switchMachine.Service>;
type SwitchApi = switchMachine.Api;

const switchModule: MachineModule<SwitchSchema, SwitchApi> = switchMachine;

export interface SwitchProps {
  /** Semantic intent of the switch's ON state. */
  type?: LabSwitchType;
  /** Control size. */
  size?: LabSwitchSize;
  /** Controlled checked state — when set, the consumer owns the value. */
  checked?: boolean;
  /** Uncontrolled initial state — read once by the machine at init. */
  defaultChecked?: boolean;
  /** Disables the control. */
  disabled?: boolean;
  /** Fires when the machine flips the checked state (machine is source of truth). */
  onCheckedChange?: (checked: boolean) => void;
  /** Native form field name for the hidden input. */
  name?: string;
  /** Icon shown inside the track when ON (parity with the Lit `icon-on` slot). */
  iconOn?: ReactNode;
  /** Icon shown inside the track when OFF (parity with the Lit `icon-off` slot). */
  iconOff?: ReactNode;
  /**
   * Accessible name for the no-visible-label case (e.g. an icon-only switch).
   * Parity with the Lit `aria-label`. A visible label (`children`) is preferred
   * over it via the machine's `aria-labelledby`.
   */
  'aria-label'?: string;
  /** Label content (parity with the Lit default slot). */
  children?: ReactNode;
}

export function Switch({
  type = 'accent',
  size = 'm',
  checked,
  defaultChecked,
  disabled = false,
  onCheckedChange,
  name,
  iconOn,
  iconOff,
  'aria-label': ariaLabel,
  children,
}: SwitchProps): ReactNode {
  const api = useZag(switchModule, {
    id: useId(),
    checked,
    defaultChecked,
    disabled,
    name,
    onCheckedChange: onCheckedChange ? (details) => onCheckedChange(details.checked) : undefined,
  });

  // The machine sets `aria-labelledby` on the hidden input pointing at the label
  // part. With a visible label that resolves and names the control; with NO
  // visible label it would dangle (and per ARIA outrank `aria-label`), so we drop
  // it and name the input via `aria-label` instead — exactly one real name source.
  const hasVisibleLabel = children != null;
  const hiddenInputProps = api.getHiddenInputProps();
  const inputProps = hasVisibleLabel
    ? hiddenInputProps
    : { ...hiddenInputProps, 'aria-labelledby': undefined, 'aria-label': ariaLabel };

  return (
    <label
      {...api.getRootProps()}
      data-lab-switch=""
      data-type={type}
      data-size={size}
      data-checked={api.checked || undefined}
      data-disabled={api.disabled || undefined}
    >
      <span {...api.getControlProps()} className="lab-switch-control">
        <span className="lab-switch-icon lab-switch-icon-on" aria-hidden="true">
          {iconOn}
        </span>
        <span className="lab-switch-icon lab-switch-icon-off" aria-hidden="true">
          {iconOff}
        </span>
        <span {...api.getThumbProps()} className="lab-switch-thumb" />
      </span>
      {/* The hidden input is a SIBLING of the (aria-hidden) control, NOT a
          descendant, so it stays in the accessibility tree. */}
      <input {...inputProps} />
      {hasVisibleLabel && (
        <span {...api.getLabelProps()} className="lab-switch-label">
          {children}
        </span>
      )}
    </label>
  );
}
