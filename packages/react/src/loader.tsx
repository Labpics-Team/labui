/**
 * <Loader> — the native-React twin of the Lit `<lab-loader>` (ADR-0001).
 *
 * Same size axis, same indeterminate spinner drawn from currentColor, same a11y
 * contract (role="status" + aria-busy, visually-hidden accessible name) — parity
 * is CSS, not a second implementation.
 *
 * HONESTY (owner's iron rule): indeterminate only — no fake `value`/`percent`
 * prop. A real determinate progress bar is a separate component (Progress).
 *
 * Presentational; marked a Client Component for a consistent package boundary and
 * to ship the scoped stylesheet with it.
 */
'use client';

import type { LabLoaderSize } from '@labpics/ui-core';
import { type HTMLAttributes, forwardRef } from 'react';
import './loader.css';

export interface LoaderProps extends HTMLAttributes<HTMLOutputElement> {
  /** Spinner size. */
  size?: LabLoaderSize;
  /** Accessible name announced to assistive tech. */
  label?: string;
}

export const Loader = forwardRef<HTMLOutputElement, LoaderProps>(function Loader(
  { size = 'm', label = 'Loading…', ...rest },
  ref,
) {
  // <output> carries an implicit role="status" — the semantically correct status
  // region, no explicit role attribute needed. aria-busy marks the live in-flight
  // state. The Lit twin is a custom element, which cannot be an <output>, so it
  // sets role="status" on its host; both expose the same status role to AT.
  return (
    <output {...rest} ref={ref} data-lab-loader="" data-size={size} aria-busy="true">
      <span className="lab-loader-spinner" aria-hidden="true" />
      <span className="lab-loader-label">{label}</span>
    </output>
  );
});
