/*
 * Alert-Dialog parity demo — the React half.
 *
 * Mounts the native-React <AlertDialog> with the SAME specimen as the Lit
 * `<lab-alert-dialog>` markup in alert-dialog.html, so the Playwright suite can verify
 * the role="alertdialog" contract (no outside-click dismissal, Escape cancels, trap +
 * scroll-lock) and read both panels' computed styles (visual parity, ADR-0001).
 */
import '@labpics/ui-core/alert-dialog';
import { AlertDialog } from '@labpics/ui-react/alert-dialog';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const root = document.documentElement;

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
if (!mount) throw new Error('Missing #react-root mount node in alert-dialog.html');

createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-alert">
      <AlertDialog
        heading="Delete this item?"
        description="This action cannot be undone."
        closable
        content={
          <>
            <button type="button" data-testid="react-alert-confirm">
              Delete
            </button>
            <button type="button" data-testid="react-alert-cancel">
              Cancel
            </button>
          </>
        }
      >
        Delete item
      </AlertDialog>
    </span>
  </StrictMode>,
);
