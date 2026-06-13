/*
 * Switch parity demo — the React half.
 *
 * Mounts the native-React <Switch> with the SAME specimens as the Lit
 * `<lab-switch>` markup in switch.html, so the Playwright suite can read both
 * renderers' computed styles (visual parity, ADR-0001) and drive each one's
 * machine behaviour (click / Space toggles, disabled blocks).
 *
 * It also registers the Lit element (side-effect import) and wires the theme
 * switcher, so the single page carries both renderers under one [data-theme].
 */
import '@labpics/ui-core/switch';
import { Switch } from '@labpics/ui-react';
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
if (!mount) throw new Error('Missing #react-root mount node in switch.html');

// The Switch owns its public prop API (no arbitrary prop passthrough — a clean,
// composable surface, craft-frontend P1), so the test id rides on a wrapper. The
// spec targets the `[data-lab-switch]` label inside each wrapper.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-accent-off">
      <Switch type="accent">Wi-Fi</Switch>
    </span>
    <span data-testid="react-accent-on">
      <Switch type="accent" defaultChecked>
        Wi-Fi
      </Switch>
    </span>
    <span data-testid="react-neutral-on">
      <Switch type="neutral" defaultChecked>
        Quiet
      </Switch>
    </span>
    <span data-testid="react-danger-on">
      <Switch type="danger" defaultChecked>
        Airplane
      </Switch>
    </span>
    <span data-testid="react-disabled">
      <Switch type="accent" disabled>
        Off
      </Switch>
    </span>
  </StrictMode>,
);
