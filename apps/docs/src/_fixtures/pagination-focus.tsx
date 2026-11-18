import '@labpics/ui-core/pagination';
import type { LabPagination } from '@labpics/ui-core/pagination';
import { Pagination } from '@labpics/ui-react/pagination';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}
const lit = required<LabPagination>('[data-testid="lit-focus"]');
lit.addEventListener('page-change', (event) => {
  if (required<HTMLSelectElement>('[data-testid="lit-acceptance"]').value === 'refuse') return;
  const page = (event as CustomEvent<{ page: number }>).detail.page;
  setTimeout(() => {
    lit.page = page;
  }, 100);
});
required('[data-testid="lit-outside"]').addEventListener('click', () => {
  lit.progress = (lit.progress ?? 0) + 0.1;
});
function ReactFixture({ prefix = 'react' }: { prefix?: string }) {
  const [page, setPage] = useState(3);
  const [progress, setProgress] = useState(0.6);
  const [acceptance, setAcceptance] = useState('delayed');
  return (
    <>
      <label>
        React acceptance{' '}
        <select
          data-testid={`${prefix}-acceptance`}
          onChange={(event) => setAcceptance(event.target.value)}
        >
          <option value="delayed">Delayed</option>
          <option value="refuse">Refuse</option>
        </select>
      </label>
      <Pagination
        data-testid={`${prefix}-focus`}
        count={20}
        pageSize={1}
        page={page}
        variant="compact"
        progress={progress}
        onPageChange={(next) => {
          if (acceptance !== 'refuse') setTimeout(() => setPage(next), 100);
        }}
      />
      <button
        data-testid={`${prefix}-outside`}
        type="button"
        onClick={() => setProgress((value) => value + 0.1)}
      >
        Update progress
      </button>
    </>
  );
}
createRoot(required('#react-root')).render(
  <StrictMode>
    <ReactFixture />
  </StrictMode>,
);
const shadow = required('#react-shadow-root').attachShadow({ mode: 'open' });
for (const sheet of document.querySelectorAll('link[rel="stylesheet"]'))
  shadow.append(sheet.cloneNode());
const shadowMount = document.createElement('div');
shadow.append(shadowMount);
createRoot(shadowMount).render(
  <StrictMode>
    <ReactFixture prefix="react-shadow" />
  </StrictMode>,
);
