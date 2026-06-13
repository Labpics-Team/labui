/**
 * <LabProofReact> — the React PROOF, NOT the production Button.
 *
 * The native-React twin of `<lab-proof>`: it proves the SAME `@zag-js/toggle`
 * behavior drives the React renderer through `useZag`, with no Lit anywhere in
 * the path (ADR-0001: Next's shallow WC-SSR never touches React). It paints with
 * the SAME semantic `--lab-*` roles, so visual parity with the Lit proof is a
 * matter of CSS, not logic.
 *
 * It is a Client Component: a toggle is interactive (state + onClick). A real
 * page renders it as a leaf under a Server Component shell — never a `use client`
 * page. Kept to one axis (pressed) so it stays a proof, not a half-built Button.
 */
'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useId } from 'react';
import * as toggle from '@zag-js/toggle';
import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import { useZag } from './use-zag.js';

type ToggleSchema = SchemaOf<toggle.Service>;
type ToggleApi = toggle.Api;

const toggleModule: MachineModule<ToggleSchema, ToggleApi> = toggle;

export interface LabProofReactProps {
  /** Whether the proof starts pressed. */
  defaultPressed?: boolean;
  /** Whether the proof is disabled. */
  disabled?: boolean;
  /** Fires when the pressed state changes (the machine is the source of truth). */
  onPressedChange?: (pressed: boolean) => void;
  /** Label content. */
  children?: ReactNode;
}

// Role-only styling. Every value is a `--lab-*` semantic role or dimension token;
// no hex. Pressed vs unpressed swaps the fill/label roles, matching the Lit proof.
const baseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--lab-space-sm, 0.5rem)',
  minHeight: '2.5rem',
  padding: 'var(--lab-space-sm, 0.5rem) var(--lab-space-md, 1rem)',
  borderRadius: 'var(--lab-radius-control, var(--lab-radius-lg))',
  border: '0.0625rem solid var(--lab-border-neutral)',
  font: 'inherit',
  fontSize: 'var(--lab-font-size-md, 1rem)',
  lineHeight: 'var(--lab-line-height-md, 1.5)',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease',
};

const unpressedStyle: CSSProperties = {
  backgroundColor: 'var(--lab-fill-neutral-tinted)',
  color: 'var(--lab-label-primary)',
};

const pressedStyle: CSSProperties = {
  backgroundColor: 'var(--lab-fill-accent)',
  color: 'var(--lab-label-on-accent)',
  borderColor: 'var(--lab-border-accent)',
};

export function LabProofReact(props: LabProofReactProps): ReactNode {
  const { children, ...machineProps } = props;
  const api = useZag(toggleModule, {
    id: useId(),
    defaultPressed: machineProps.defaultPressed,
    disabled: machineProps.disabled,
    onPressedChange: machineProps.onPressedChange,
  });

  const rootProps = api.getRootProps();
  const indicatorProps = api.getIndicatorProps();

  return (
    <button
      {...rootProps}
      style={{ ...baseStyle, ...(api.pressed ? pressedStyle : unpressedStyle) }}
    >
      <span
        {...indicatorProps}
        aria-hidden="true"
        style={{
          width: '0.5rem',
          height: '0.5rem',
          borderRadius: 'var(--lab-radius-full, 9999px)',
          backgroundColor: 'currentColor',
          opacity: api.pressed ? 1 : 0.5,
        }}
      />
      {children ?? 'Toggle'}
    </button>
  );
}
