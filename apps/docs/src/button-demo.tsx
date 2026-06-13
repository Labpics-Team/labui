/*
 * Button parity demo — the React half.
 *
 * Mounts the native-React <Button> with the SAME specimens as the Lit
 * `<lab-button>` markup in button.html, so the Playwright suite can read both
 * renderers' computed styles and assert they match (visual parity, ADR-0001) —
 * and drive each one's click/keyboard/a11y behaviour.
 *
 * It also registers the Lit element (side-effect import) and wires the theme
 * switcher, so the single page carries both renderers under one [data-theme].
 */
import '@labpics/ui-core/button';
import { Button } from '@labpics/ui-react';
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
if (!mount) throw new Error('Missing #react-root mount node in button.html');

createRoot(mount).render(
  <StrictMode>
    <Button data-testid="react-accent-fill" type="accent" kind="fill">
      Save
    </Button>
    <Button data-testid="react-neutral-tinted" type="neutral" kind="tinted">
      Cancel
    </Button>
    <Button data-testid="react-danger-border" type="danger" kind="border">
      Delete
    </Button>
    <Button data-testid="react-loading" type="accent" kind="fill" loading>
      Saving
    </Button>
    <Button data-testid="react-disabled" type="accent" kind="fill" disabled>
      Off
    </Button>
  </StrictMode>,
);
