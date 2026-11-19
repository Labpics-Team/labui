import '@labpics/ui-core/pagination';
import type { LabPagination } from '@labpics/ui-core/pagination';
import { Pagination } from '@labpics/ui-react/pagination';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();
function required<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}
const records = Array.from(
  { length: 60 },
  (_, index) => `Study ${String(index + 1).padStart(2, '0')}`,
);
function Records({ page }: { page: number }) {
  return <p data-testid="react-records">{records.slice((page - 1) * 3, page * 3).join(' · ')}</p>;
}
function Example() {
  const [page, setPage] = useState(3);
  const [compact, setCompact] = useState(3);
  return (
    <>
      <Records page={page} />
      <Pagination
        data-testid="react-pagination"
        count={records.length}
        pageSize={3}
        page={page}
        onPageChange={setPage}
      />
      <h3>Controlled refusal</h3>
      <Pagination
        data-testid="react-pagination-refusal"
        count={200}
        page={3}
        onPageChange={(next) => {
          required('#refused').textContent = String(next);
        }}
      />
      <h3>Compact</h3>
      <p data-testid="react-slide">Frame {compact}</p>
      <Pagination
        data-testid="react-compact"
        count={8}
        pageSize={1}
        page={compact}
        onPageChange={setCompact}
        variant="compact"
        progress={0.6}
      />
      <Pagination
        data-testid="react-ambient"
        count={5}
        pageSize={1}
        defaultPage={2}
        variant="compact"
        ambient
        progress={0.6}
      />
      <h3>Destinations</h3>
      <Pagination data-testid="react-links" count={60} pageSize={3} page={3} href="?page={page}" />
    </>
  );
}
const host = required<LabPagination>('lab-pagination[data-testid="lit-pagination"]');
const output = required('#lit-records');
const show = (page: number) => {
  output.textContent = records.slice((page - 1) * 3, page * 3).join(' · ');
};
host.addEventListener('page-change', (event) => {
  const value = (event as CustomEvent<{ page: number }>).detail.page;
  host.page = value;
  show(value);
});
show(3);
const compact = required('lab-pagination[data-testid="lit-compact"]');
compact.addEventListener('page-change', (event) => {
  required('#lit-slide').textContent =
    `Frame ${(event as CustomEvent<{ page: number }>).detail.page}`;
});
const mount = document.querySelector('#react-root');
if (!mount) throw new Error('Missing React root');
createRoot(mount).render(
  <StrictMode>
    <Example />
  </StrictMode>,
);
