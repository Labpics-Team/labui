/**
 * <Card> — the native-React twin of the Lit `<lab-card>` (ADR-0001).
 *
 * Same public axes, same semantic --lab-* roles, same structure (media / header /
 * body / footer regions on a single surface) — so parity with the Lit element is
 * a matter of CSS, not a second implementation. No Lit in this path.
 *
 * Presentational (no interaction state) — it renders as a leaf under a Server
 * Component shell, but it carries no `'use client'` need of its own: it has no
 * state, effects, or handlers. The Lit element opts out of the Zag seam for the
 * same reason (no machine-eligible state); this twin opts out identically — it is
 * a forwardRef'd `<article>`, not a state machine. It is marked a Client Component
 * only so the shared package boundary is consistent and the scoped stylesheet
 * ships with it; a Server Component may also render the Lit element directly.
 *
 * The Lit "slots" become React props: `media` / `header` / `footer` are the named
 * regions and `children` is the body — the idiomatic React shape for the same
 * composition. An empty region simply isn't rendered, so it adds no padding (the
 * parity of the Lit element's `data-empty` collapse).
 *
 * The axis types come from @labpics/ui-core (type-only — no Lit runtime), so the
 * Lit and React APIs share ONE source of truth and cannot drift.
 */
'use client';

import type { LabCardPadding, LabCardVariant } from '@labpics/ui-core';
import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import './card.css';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Surface treatment. */
  variant?: LabCardVariant;
  /** Inner spacing of the body region. */
  padding?: LabCardPadding;
  /** Hover + focus affordance for whole-card interactive targets. */
  interactive?: boolean;
  /** Edge-to-edge media region (parity with the Lit `media` slot). */
  media?: ReactNode;
  /** Header region (parity with the Lit `header` slot). */
  header?: ReactNode;
  /** Footer region (parity with the Lit `footer` slot). */
  footer?: ReactNode;
  /** Body content (parity with the Lit default slot). */
  children?: ReactNode;
}

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  {
    variant = 'elevated',
    padding = 'm',
    interactive = false,
    media,
    header,
    footer,
    children,
    ...rest
  },
  ref,
) {
  return (
    <article
      {...rest}
      ref={ref}
      data-lab-card=""
      data-variant={variant}
      data-padding={padding}
      data-interactive={interactive || undefined}
    >
      {media != null ? <div className="lab-card-media">{media}</div> : null}
      {header != null ? <header className="lab-card-header">{header}</header> : null}
      <div className="lab-card-body">{children}</div>
      {footer != null ? <footer className="lab-card-footer">{footer}</footer> : null}
    </article>
  );
});
