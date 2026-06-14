/*
 * Number Input parity demo — the React half.
 *
 * Mounts the native-React <NumberInput> with the SAME specimens as the Lit
 * `<lab-number-input>` markup in number-input.html, so the Playwright suite can drive
 * each renderer's machine (spinbutton stepping, +/- triggers, clamping) and read both
 * renderers' computed styles (visual parity, ADR-0001) and the SAME field-a11y wiring.
 *
 * It registers the Lit element (side-effect import) and wires the theme switcher, so
 * the page carries both renderers under one [data-theme].
 */
import '@labpics/ui-core/number-input';
import { NumberInput } from '@labpics/ui-react/number-input';
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
if (!mount) throw new Error('Missing #react-root mount node in number-input.html');

// Test ids ride on wrappers (the NumberInput owns its prop API — no passthrough). The
// spec targets the `[data-lab-number-input]` field inside each wrapper.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-neutral">
      <NumberInput label="Quantity" defaultValue="3" min={0} max={10} helper="Between 0 and 10." />
    </span>
    <span data-testid="react-invalid">
      <NumberInput
        type="danger"
        invalid
        label="Quantity"
        defaultValue="12"
        min={0}
        max={10}
        error="Must be 10 or fewer."
      />
    </span>
    <span data-testid="react-at-min">
      <NumberInput label="At minimum" defaultValue="0" min={0} max={10} />
    </span>
    <span data-testid="react-required">
      <NumberInput label="Count" required />
    </span>
    <span data-testid="react-disabled">
      <NumberInput label="Locked" defaultValue="5" disabled />
    </span>
    <span data-testid="react-size-s">
      <NumberInput size="s" label="Small" />
    </span>
    <span data-testid="react-size-l">
      <NumberInput size="l" label="Large" />
    </span>
  </StrictMode>,
);
