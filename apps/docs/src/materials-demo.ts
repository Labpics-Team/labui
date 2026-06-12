/*
 * Materials demo — mode + theme switchers.
 *
 * The ONLY interactivity on the page: flip `data-material` and `data-theme` on
 * the document root. This is the whole proof of the task — one attribute on the
 * root re-skins EVERY `.lab-ambient` surface below, with zero component edits.
 * The surfaces read only `--lab-mat-*`; they never observe the mode.
 */

const root = document.documentElement;

/** The closed set of valid values per control — the single source of truth for
 * both the union of allowed strings and the runtime guard. */
const CONTROLS = {
  'data-material': ['ambient', 'glassy', 'solid'],
  'data-theme': ['dark', 'light'],
} as const;

function bindSelect(testId: string, attr: keyof typeof CONTROLS): void {
  const select = document.querySelector<HTMLSelectElement>(`[data-testid="${testId}"]`);
  if (!select) {
    return;
  }
  // Initialise the control from the current root attribute so refreshing keeps state.
  const current = root.getAttribute(attr);
  if (current) {
    select.value = current;
  }
  // The values are a closed set. Validate against it before writing to the root
  // — never trust a value onto the DOM unchecked, even from our own markup
  // (craft-frontend P11).
  const allowed = new Set<string>(CONTROLS[attr]);
  select.addEventListener('change', () => {
    if (allowed.has(select.value)) {
      root.setAttribute(attr, select.value);
    }
  });
}

bindSelect('mode-select', 'data-material');
bindSelect('theme-select', 'data-theme');
