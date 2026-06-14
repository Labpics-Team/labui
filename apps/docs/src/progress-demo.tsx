/*
 * Progress parity demo — the React half.
 *
 * Mounts the native-React <Progress> with the SAME specimens as the Lit
 * `<lab-progress>` markup in progress.html, so the Playwright suite can read both
 * renderers' computed styles (visual parity, ADR-0001) and assert each one's machine
 * output (role="progressbar", aria-value*, indeterminate honesty).
 *
 * It registers the Lit element (side-effect import) and wires the theme switcher, so
 * the page carries both renderers under one [data-theme]. The indeterminate specimen
 * passes value={null} — the genuine indeterminate signal, never a fake number.
 */
import '@labpics/ui-core/progress';
import { Progress } from '@labpics/ui-react/progress';
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
if (!mount) throw new Error('Missing #react-root mount node in progress.html');

createRoot(mount).render(
  <StrictMode>
    <div data-testid="react-progress" className="specimens">
      <span data-testid="react-determinate">
        <Progress value={60} label="Uploading" showValueText />
      </span>
      <span data-testid="react-complete">
        <Progress value={100} label="Done" />
      </span>
      <span data-testid="react-indeterminate">
        <Progress value={null} label="Working" />
      </span>
      {/* NON-DEFAULT RANGE: min=10, max=50, value=30 ⇒ 50%. The twin of the Lit
          `lit-ranged` specimen — proves the percent maths spans the real range. */}
      <span data-testid="react-ranged">
        <Progress value={30} min={10} max={50} label="Ranged" showValueText />
      </span>
    </div>
  </StrictMode>,
);
