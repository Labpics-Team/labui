/*
 * Pagination parity demo — the React half.
 *
 * Mounts the native-React <Pagination> with the SAME data shape as the Lit
 * `<lab-pagination>` in pagination.html, so the Playwright suite can read both
 * renderers' computed styles (visual parity, ADR-0001) and drive each one's
 * machine behaviour (clicking a page / prev / next).
 *
 * It registers the Lit element (side-effect import) and wires the theme switcher,
 * so the page carries both renderers under one [data-theme].
 */
import '@labpics/ui-core/pagination';
import { Pagination } from '@labpics/ui-react/pagination';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

const root = document.documentElement;

/**
 * Controlled wrapper: the consumer owns `page`. The component reports a requested
 * page via `onPageChange`; this state machine accepts it. We also surface the last
 * reported page on a window flag so the Playwright suite can assert the onPageChange
 * contract (the React mirror of the Lit `page-change` CustomEvent).
 */
function ControlledPagination() {
  const [page, setPage] = useState(3);
  return (
    <Pagination
      count={200}
      pageSize={10}
      page={page}
      onPageChange={(next) => {
        (window as unknown as { __reactPageChange?: number }).__reactPageChange = next;
        setPage(next);
      }}
    />
  );
}

const THEMES = ['dark', 'light'] as const;
type Theme = (typeof THEMES)[number];

function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

const select = document.querySelector<HTMLSelectElement>('[data-testid="theme-select"]');
if (select) {
  const current = root.getAttribute('data-theme');
  if (current) select.value = current;
  select.addEventListener('change', () => {
    if (isTheme(select.value)) root.setAttribute('data-theme', select.value);
  });
}

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in pagination.html');

createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-pagination">
      <Pagination count={200} pageSize={10} defaultPage={8} />
    </span>
    <span data-testid="react-pagination-siblings0">
      <Pagination count={200} pageSize={10} siblingCount={0} defaultPage={8} />
    </span>
    <span data-testid="react-pagination-controlled">
      <ControlledPagination />
    </span>
  </StrictMode>,
);
