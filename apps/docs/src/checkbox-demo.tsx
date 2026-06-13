/*
 * Checkbox parity demo — the React half.
 *
 * Mounts the native-React <Checkbox> with the SAME specimens as the Lit
 * `<lab-checkbox>` markup in checkbox.html — including the HONEST indeterminate
 * (mixed) state — so the Playwright suite can read both renderers' computed
 * styles (visual parity) and drive each one's machine behaviour, including the
 * real aria-checked="mixed".
 */
import '@labpics/ui-core/checkbox';
import { Checkbox } from '@labpics/ui-react';
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
if (!mount) throw new Error('Missing #react-root mount node in checkbox.html');

// Test ids ride on wrappers (the Checkbox owns its prop API — no passthrough).
// The spec targets the `[data-lab-checkbox]` label inside each wrapper.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-unchecked">
      <Checkbox type="accent">Terms</Checkbox>
    </span>
    <span data-testid="react-checked">
      <Checkbox type="accent" defaultChecked>
        Terms
      </Checkbox>
    </span>
    <span data-testid="react-mixed">
      <Checkbox type="accent" defaultChecked="indeterminate">
        Some
      </Checkbox>
    </span>
    <span data-testid="react-neutral">
      <Checkbox type="neutral" defaultChecked>
        Neutral
      </Checkbox>
    </span>
    <span data-testid="react-danger">
      <Checkbox type="danger" defaultChecked>
        Danger
      </Checkbox>
    </span>
    <span data-testid="react-disabled">
      <Checkbox type="accent" disabled>
        Off
      </Checkbox>
    </span>
  </StrictMode>,
);
