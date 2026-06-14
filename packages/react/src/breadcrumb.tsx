/**
 * <Breadcrumb> — the native-React twin of the Lit `<lab-breadcrumb>` (ADR-0001).
 *
 * Same public axes, same semantic --lab-* roles, same native structure
 * (`<nav aria-label="Breadcrumb"><ol>` of links, the last crumb current) — so
 * parity with the Lit element is a matter of CSS, not a second implementation. No
 * Lit in this path.
 *
 * Presentational (no interaction state) — it carries no `'use client'` need of its
 * own: no state, effects, or handlers. It is marked a Client Component only so the
 * shared package boundary is consistent and the scoped stylesheet ships with it; a
 * Server Component may also render it directly via the Lit element.
 *
 * Axis types come from @labpics/ui-core (type-only — no Lit runtime), so the Lit
 * and React APIs share ONE source of truth and cannot drift.
 *
 * Hrefless non-current crumb (the Figma "disabled crumb"): an intermediate crumb
 * with no `href` is a non-navigable waypoint — it renders as a bare
 * `<span className="lab-breadcrumb-link">` with NO role and NO aria-current, exactly
 * like the Lit `<span part="link">`. Truthful inert text, never a destination-less
 * `<a>`.
 *
 * Separator type — a DELIBERATE, documented asymmetry with the Lit element
 * (ADR-0001): this React twin accepts a `ReactNode`, so callers may pass an icon
 * element as the separator. The Lit `separator` attribute is string-only (an HTML
 * attribute cannot carry a node); an icon separator there would need a per-gap
 * `<slot>` — a larger feature, deliberately out of scope. This is the one place the
 * two twins' separator APIs differ on purpose.
 */
'use client';

import type { LabBreadcrumbItem, LabBreadcrumbSize } from '@labpics/ui-core/breadcrumb';
import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import './breadcrumb.css';

export interface BreadcrumbProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** The crumbs, root → current. The last crumb is rendered as the current page. */
  items: ReadonlyArray<LabBreadcrumbItem>;
  /** Text + spacing density. */
  size?: LabBreadcrumbSize;
  /**
   * The glyph/node drawn between crumbs. Defaults to a `/`. Accepts any
   * `ReactNode` (e.g. an icon element) — a deliberate superset of the Lit
   * element, whose `separator` attribute is string-only. See the file header.
   */
  separator?: ReactNode;
}

export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(function Breadcrumb(
  { items, size = 'm', separator = '/', ...rest },
  ref,
) {
  const lastIndex = items.length - 1;
  return (
    <nav {...rest} ref={ref} aria-label="Breadcrumb" data-lab-breadcrumb="" data-size={size}>
      <ol className="lab-breadcrumb-list">
        {items.map((item, index) => {
          const isCurrent = index === lastIndex;
          const key = `${index}-${item.label}`;
          return (
            <li key={key} className="lab-breadcrumb-item">
              {isCurrent ? (
                <span className="lab-breadcrumb-current" aria-current="page">
                  {item.label}
                </span>
              ) : item.href != null ? (
                <a className="lab-breadcrumb-link" href={item.href}>
                  {item.label}
                </a>
              ) : (
                // Hrefless non-current crumb (Figma "disabled crumb"): a bare
                // <span> — no role, no aria-current. Truthful inert text, not a
                // destination-less <a>. Parity with the Lit <span part="link">.
                <span className="lab-breadcrumb-link">{item.label}</span>
              )}
              {isCurrent ? null : (
                <span className="lab-breadcrumb-separator" aria-hidden="true">
                  {separator}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
});
