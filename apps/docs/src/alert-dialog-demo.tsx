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
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

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
