/*
 * Dialog parity demo — the React half.
 *
 * Mounts the native-React <Dialog> with the SAME specimens as the Lit `<lab-dialog>`
 * markup in dialog.html, so the Playwright suite can drive each renderer's machine
 * (open on click, focus management, Escape / outside-click dismiss, modal trap +
 * scroll-lock) and read both panels' computed styles (visual parity, ADR-0001).
 */
import '@labpics/ui-core/dialog';
// Per-component subpath (the tree-shaking seam): no edit to the React barrel.
import { Dialog } from '@labpics/ui-react/dialog';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { wireThemeSwitch } from './theme-switch.js';

wireThemeSwitch();

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in dialog.html');

// The testid rides on a wrapper; the spec targets `.lab-dialog-trigger` inside each
// wrapper and the portalled `.lab-dialog-content` in <body>.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-dialog">
      <Dialog
        heading="Settings"
        description="Choose how this dialog behaves."
        closable
        content={
          <>
            <p>
              A blocking task. Tab cycles within the dialog; Escape or an outside click closes it.
            </p>
            <a href="https://labpics.example/learn" data-testid="react-dialog-link">
              Learn more
            </a>
            <button type="button" data-testid="react-dialog-action">
              Action
            </button>
          </>
        }
      >
        Open
      </Dialog>
    </span>
    <span data-testid="react-dialog-nonmodal">
      <Dialog
        heading="Non-modal"
        description="A light panel that does not lock the page."
        modal={false}
        closable
        content={
          <>
            <p>
              Non-modal: no scroll-lock, no scrim, but still dismisses on Escape / outside-click.
            </p>
            <button type="button" data-testid="react-dialog-nonmodal-action">
              Action
            </button>
          </>
        }
      >
        Open non-modal
      </Dialog>
    </span>
  </StrictMode>,
);
