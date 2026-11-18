'use client';

import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import {
  type LabPaginationVariant,
  compactPages,
  paginationCount,
  paginationHref,
  paginationKeyPage,
  paginationPage,
  paginationPageSize,
  paginationProgress,
  paginationSiblings,
} from '@labpics/ui-core/pagination/contract';
import { mountMaterialRuntime } from '@labpics/ui-materials';
import * as paginationMachine from '@zag-js/pagination';
import {
  Fragment,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useZag } from './use-zag.js';
import '@labpics/ui-core/pagination.css';
import '@labpics/ui-materials/material.css';

const module: MachineModule<
  SchemaOf<paginationMachine.Service>,
  paginationMachine.Api
> = paginationMachine;
export interface PaginationProps
  extends Omit<HTMLAttributes<HTMLElement>, 'onChange' | 'defaultValue'> {
  count: number;
  pageSize?: number;
  page?: number;
  defaultPage?: number;
  siblingCount?: number;
  variant?: LabPaginationVariant;
  disabled?: boolean;
  ambient?: boolean;
  /** Compact progress is supplied by the application's media clock, 0…1. */
  progress?: number;
  /** Native destination template with {page} and optional {pageSize}. */
  href?: string;
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
  pageLabel?: string;
  onPageChange?: (page: number) => void;
}

export function Pagination({
  count,
  pageSize = 10,
  page,
  defaultPage = 1,
  siblingCount = 1,
  variant = 'numbered',
  disabled = false,
  ambient = false,
  progress,
  href = '',
  label = 'Pagination',
  previousLabel = 'Previous page',
  nextLabel = 'Next page',
  pageLabel = 'Page {page}',
  onPageChange,
  ...rest
}: PaginationProps): ReactNode {
  const total = Math.ceil(paginationCount(count) / paginationPageSize(pageSize));
  const [internal, setInternal] = useState(() => paginationPage(defaultPage, total));
  const selected = paginationPage(page ?? internal, total);
  const root = useRef<HTMLElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (page === undefined) setInternal((value) => paginationPage(value, total));
  }, [page, total]);
  useEffect(() => {
    if (restoreFocus.current) {
      root.current?.querySelector<HTMLElement>(`[data-page='${selected}']`)?.focus();
      restoreFocus.current = false;
    }
  });
  useEffect(() => {
    if (variant === 'compact' && ambient && root.current) return mountMaterialRuntime(root.current);
  }, [variant, ambient]);
  const api = useZag(module, {
    id: useId(),
    count: paginationCount(count),
    pageSize: paginationPageSize(pageSize),
    page: selected,
    siblingCount: paginationSiblings(siblingCount),
    onPageChange: (details) => {
      if (disabled) return;
      if (page === undefined) setInternal(details.page);
      onPageChange?.(details.page);
    },
  });
  const compact = variant === 'compact';
  const pages = compact
    ? compactPages(selected, total).map((value) => ({ type: 'page' as const, value }))
    : api.pages;
  const request = (event: MouseEvent, next: number, unavailable: boolean) => {
    if (unavailable) {
      event.preventDefault();
      return;
    }
    if (
      !event.defaultPrevented &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey
    )
      api.setPage(next);
  };
  const keyPage = (event: KeyboardEvent<HTMLElement>) => {
    rest.onKeyDown?.(event);
    if (
      event.defaultPrevented ||
      !compact ||
      href ||
      disabled ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const next = paginationKeyPage(
      event.key,
      selected,
      total,
      getComputedStyle(event.currentTarget).direction === 'rtl',
    );
    if (next === undefined) return;
    event.preventDefault();
    restoreFocus.current = true;
    api.setPage(next);
    root.current?.querySelector<HTMLElement>(`[data-page='${selected}']`)?.focus();
  };
  const control = (value: number, kind: 'page' | 'prev' | 'next', receding = false) => {
    const current = kind === 'page' && value === selected;
    const unavailable = disabled || value < 1 || value > total;
    const ratio = current && compact ? paginationProgress(progress) : undefined;
    const props = {
      className: `lab-pagination-control ${kind === 'page' ? 'lab-pagination-item' : `lab-pagination-trigger lab-pagination-${kind}`}`,
      'aria-label':
        kind === 'prev'
          ? previousLabel
          : kind === 'next'
            ? nextLabel
            : pageLabel.replaceAll('{page}', String(value)),
      'aria-current': current ? ('page' as const) : undefined,
      'data-page': kind === 'page' ? value : undefined,
      'data-receding': receding ? '' : undefined,
      'data-progress': ratio !== undefined ? '' : undefined,
      tabIndex: unavailable || (compact && !href && !current) ? -1 : 0,
      onClick: (event: MouseEvent) => request(event, value, unavailable),
    };
    const content =
      kind !== 'page' ? (
        <span className="lab-pagination-chevron" aria-hidden="true" />
      ) : compact ? (
        <span className="lab-pagination-dot" aria-hidden="true">
          {ratio !== undefined && (
            <span className="lab-pagination-progress" style={{ transform: `scaleX(${ratio})` }} />
          )}
        </span>
      ) : (
        value
      );
    return href ? (
      <a
        {...props}
        href={unavailable ? undefined : paginationHref(href, value, paginationPageSize(pageSize))}
        aria-disabled={unavailable || undefined}
      >
        {content}
      </a>
    ) : (
      <button {...props} type="button" disabled={unavailable}>
        {content}
      </button>
    );
  };
  return (
    <nav
      {...rest}
      ref={root}
      data-lab-pagination=""
      data-variant={compact ? 'compact' : 'numbered'}
      data-ambient={compact && ambient ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      aria-label={label}
      onKeyDown={keyPage}
    >
      {compact && ambient && (
        <span
          className="lab-pagination-surface lab-material lab-material--base"
          aria-hidden="true"
        />
      )}
      {!compact && control(selected - 1, 'prev')}
      {pages.map((entry, index) =>
        entry.type === 'page' ? (
          <Fragment key={`page-${entry.value}`}>
            {control(
              entry.value,
              'page',
              compact &&
                ((index === 0 && entry.value > 1) ||
                  (index === pages.length - 1 && entry.value < total)),
            )}
          </Fragment>
        ) : (
          <span
            className="lab-pagination-ellipsis"
            key={`ellipsis-${index === 1 ? 'start' : 'end'}`}
            aria-hidden="true"
          >
            <span className="lab-pagination-dots">
              <i />
              <i />
              <i />
            </span>
          </span>
        ),
      )}
      {!compact && control(selected + 1, 'next')}
    </nav>
  );
}
