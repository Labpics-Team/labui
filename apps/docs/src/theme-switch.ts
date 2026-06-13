/*
 * Tiny shared theme switcher for the parity-demo fixtures. Wires a
 * [data-testid="theme-select"] <select> to flip [data-theme] on the document
 * root, so a single page carries both renderers under one theme and the parity
 * suite can prove a theme flip re-skins both with zero element edits.
 */
const THEMES = ['dark', 'light'] as const;
type Theme = (typeof THEMES)[number];

function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

export function wireThemeSwitch(): void {
  const root = document.documentElement;
  const select = document.querySelector<HTMLSelectElement>('[data-testid="theme-select"]');
  if (!select) return;
  const current = root.getAttribute('data-theme');
  if (current) select.value = current;
  select.addEventListener('change', () => {
    if (isTheme(select.value)) root.setAttribute('data-theme', select.value);
  });
}
