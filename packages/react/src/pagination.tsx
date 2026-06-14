/**
 * <Pagination> — the native-React twin of the Lit `<lab-pagination>` (ADR-0001).
 *
 * Same axes, same `@zag-js/pagination` machine through the SAME Behaviors seam —
 * here via `useZag` instead of the Lit `ZagController`. No Lit in this path. The
 * machine owns the page value, derives the page range (with ellipses) from
 * `count` + `pageSize`, wires `aria-current` and the prev/next disabled states;
 * the component only spreads the machine's prop-getters onto native `<button>`s
 * and paints with the SAME --lab-* roles, so parity is CSS, not a second
 * behaviour. `boundaryCount` is intentionally NOT exposed — the machine fixes it
 * at 1, and faking a knob would be a misleading stop-gap.
 *
 * Client Component: pagination is interactive (page navigation). It renders as a
 * leaf under a Server Component shell — never a `'use client'` page (dive-next P1).
 *
 * Axis types come from @labpics/ui-core (type-only — no Lit runtime), so the Lit
 * and React APIs share ONE source of truth and cannot drift.
 */
'use client';

import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import type { LabPaginationSize } from '@labpics/ui-core/pagination';
import * as paginationMachine from '@zag-js/pagination';
import { type ReactNode, useId } from 'react';
import { useZag } from './use-zag.js';
import './pagination.css';

type PaginationSchema = SchemaOf<paginationMachine.Service>;
type PaginationApi = paginationMachine.Api;

const paginationModule: MachineModule<PaginationSchema, PaginationApi> = paginationMachine;

export interface PaginationProps {
  /** Total number of data items the pages are derived from. */
  count: number;
  /** Items per page — `count / pageSize` gives the page total. */
  pageSize?: number;
  /** Controlled current page — when set, the consumer owns it. */
  page?: number;
  /** Uncontrolled initial page — read once by the machine at init. */
  defaultPage?: number;
  /** Pages shown either side of the current page. */
  siblingCount?: number;
  /** Control density. */
  size?: LabPaginationSize;
  /** Fires when the machine changes the page (machine is source of truth). */
  onPageChange?: (page: number) => void;
}

export function Pagination({
  count,
  pageSize = 10,
  page,
  defaultPage,
  siblingCount = 1,
  size = 'm',
  onPageChange,
}: PaginationProps): ReactNode {
  const api = useZag(paginationModule, {
    id: useId(),
    count,
    pageSize,
    page,
    defaultPage,
    siblingCount,
    onPageChange: onPageChange ? (details) => onPageChange(details.page) : undefined,
  });

  let ellipsisIndex = 0;
  return (
    <nav {...api.getRootProps()} data-lab-pagination="" data-size={size}>
      <button
        {...api.getPrevTriggerProps()}
        className="lab-pagination-trigger"
        // Capitalized accessible name, kept IDENTICAL to the Lit twin
        // (PREV_LABEL in lab-pagination.ts). It MUST stay after the spread: Zag's
        // getPrevTriggerProps emits a lowercase 'previous page' aria-label, and
        // last-wins JSX lets this override it. Reordering would resurrect the drift.
        aria-label="Previous page"
      >
        ‹
      </button>
      {api.pages.map((entry) => {
        if (entry.type === 'page') {
          return (
            <button
              key={`page-${entry.value}`}
              {...api.getItemProps({ type: 'page', value: entry.value })}
              className="lab-pagination-item"
            >
              {entry.value}
            </button>
          );
        }
        const index = ellipsisIndex;
        ellipsisIndex += 1;
        return (
          <span
            key={`ellipsis-${index}`}
            {...api.getEllipsisProps({ index })}
            className="lab-pagination-ellipsis"
            aria-hidden="true"
          >
            …
          </span>
        );
      })}
      <button
        {...api.getNextTriggerProps()}
        className="lab-pagination-trigger"
        // Capitalized accessible name, kept IDENTICAL to the Lit twin (NEXT_LABEL).
        // Must stay after the spread — see the prev trigger note above.
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}
