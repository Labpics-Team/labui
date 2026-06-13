/*
 * Popover parity demo — the React half.
 *
 * Mounts the native-React <Popover> with the SAME specimens as the Lit
 * `<lab-popover>` markup in popover.html, so the Playwright suite can drive each
 * renderer's machine (open on click, focus management, Escape / outside-click
 * dismiss, modal trap, positioning) and read both panels' computed styles
 * (visual parity, ADR-0001).
 */
import '@labpics/ui-core/popover';
// Per-component subpath (the tree-shaking seam): no edit to the React barrel.
import { Popover } from '@labpics/ui-react/popover';
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
if (!mount) throw new Error('Missing #react-root mount node in popover.html');

// The testid rides on a wrapper; the spec targets `.lab-popover-trigger` inside each
// wrapper and the portalled `.lab-popover-content` in <body>.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-pop">
      <Popover
        placement="bottom"
        heading="Settings"
        description="Choose how this panel behaves."
        closable
        content={
          <>
            Applies immediately; dismiss on Escape or outside-click.{' '}
            <a href="https://labpics.example/learn" data-testid="react-pop-link">
              Learn more
            </a>
          </>
        }
      >
        Open
      </Popover>
    </span>
    <span data-testid="react-pop-modal">
      <Popover
        placement="bottom"
        heading="Confirm"
        modal
        closable
        content={
          <>
            Modal: focus is trapped here.{' '}
            <button type="button" data-testid="react-pop-modal-action">
              Action
            </button>
          </>
        }
      >
        Open modal
      </Popover>
    </span>
  </StrictMode>,
);
