/**
 * <Kbd> — the native-React twin of the Lit `<lab-kbd>` (ADR-0001).
 *
 * Same size axis, same semantic --lab-* roles, same structure (a real <kbd>
 * carrying the key text) — parity is CSS, not a second implementation. The native
 * <kbd> carries the "keyboard input" meaning to assistive tech for free.
 *
 * Presentational; marked a Client Component only for a consistent package
 * boundary and to ship the scoped stylesheet with it.
 */
'use client';

import type { LabKbdSize } from '@labpics/ui-core';
import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import './kbd.css';

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  /** Cap size. */
  size?: LabKbdSize;
  /** Key text (parity with the Lit default slot). */
  children?: ReactNode;
}

export const Kbd = forwardRef<HTMLElement, KbdProps>(function Kbd(
  { size = 'm', children, ...rest },
  ref,
) {
  return (
    <kbd {...rest} ref={ref} data-lab-kbd="" data-size={size}>
      {children}
    </kbd>
  );
});
