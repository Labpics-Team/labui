/**
 * <Badge> — the native-React twin of the Lit `<lab-badge>` (ADR-0001).
 *
 * Same public axes, same semantic --lab-* roles, same structure (an optional
 * leading dot + a label) — so parity with the Lit element is a matter of CSS, not
 * a second implementation. No Lit in this path.
 *
 * Presentational (no interaction state) — it renders as a leaf under a Server
 * Component shell, but it carries no `'use client'` need of its own: it has no
 * state, effects, or handlers. It is marked a Client Component only so the shared
 * package boundary is consistent and the scoped stylesheet ships with it; a
 * Server Component may also render it directly via the Lit element.
 *
 * The axis types come from @labpics/ui-core (type-only — no Lit runtime), so the
 * Lit and React APIs share ONE source of truth and cannot drift.
 */
'use client';

import type { LabBadgeColor, LabBadgeType } from '@labpics/ui-core';
import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import './badge.css';

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  /** Sentiment / accent colour family. */
  color?: LabBadgeColor;
  /** Surface treatment: opaque fill vs. low-alpha tint. */
  type?: LabBadgeType;
  /** Dimmed, non-interactive presentation. */
  disabled?: boolean;
  /** Leading dot/icon indicator (parity with the Lit `dot` slot). */
  dot?: ReactNode;
  /** Label content (parity with the Lit default slot). */
  children?: ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { color = 'neutral', type = 'fill', disabled = false, dot, children, ...rest },
  ref,
) {
  return (
    <span
      {...rest}
      ref={ref}
      data-lab-badge=""
      data-color={color}
      data-type={type}
      data-disabled={disabled || undefined}
    >
      {dot != null ? (
        <span className="lab-badge-dot" aria-hidden="true">
          {dot}
        </span>
      ) : null}
      {children}
    </span>
  );
});
