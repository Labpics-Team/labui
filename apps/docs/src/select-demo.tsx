/*
 * Select parity demo — the React half.
 *
 * Mounts the native-React <Select> with the SAME specimens as the Lit `<lab-select>`
 * markup in select.html, so the Playwright suite can drive each renderer's machine
 * (open on click, navigation, selection, Escape / outside-click dismiss, positioning)
 * and read both listboxes' computed styles (visual parity, ADR-0001).
 */
import '@labpics/ui-core/select';
// Per-component subpath (the tree-shaking seam): no edit to the React barrel.
import { Select } from '@labpics/ui-react/select';
import type { LabSelectItem } from '@labpics/ui-core/select';
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

const FRUITS: LabSelectItem[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'durian', label: 'Durian', disabled: true },
  { value: 'elderberry', label: 'Elderberry' },
];

const mount = document.querySelector<HTMLElement>('#react-root');
if (!mount) throw new Error('Missing #react-root mount node in select.html');

// The testid rides on a wrapper; the spec targets `.lab-select-trigger` inside each
// wrapper and the portalled `.lab-select-content` in <body>.
createRoot(mount).render(
  <StrictMode>
    <span data-testid="react-select">
      <Select label="Fruit" placeholder="Pick a fruit…" defaultValue={['banana']} items={FRUITS} />
    </span>
    <span data-testid="react-select-multi">
      <Select label="Fruits" placeholder="Pick fruits…" multiple items={FRUITS.slice(0, 3)} />
    </span>
  </StrictMode>,
);
