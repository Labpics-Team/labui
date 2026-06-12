/*
 * Materials demo — mode + theme switchers.
 *
 * The ONLY interactivity on the page: flip `data-material` and `data-theme` on
 * the document root. This is the whole proof of the task — one attribute on the
 * root re-skins EVERY `.lab-ambient` surface below, with zero component edits.
 * The surfaces read only `--lab-mat-*`; they never observe the mode.
 */

type Material = 'ambient' | 'glassy' | 'solid';
type Theme = 'dark' | 'light';

const root = document.documentElement;

function bindSelect<T extends string>(testId: string, attr: string): void {
  const select = document.querySelector<HTMLSelectElement>(`[data-testid="${testId}"]`);
  if (!select) {
    return;
  }
  // Initialise the control from the current root attribute so refreshing keeps state.
  const current = root.getAttribute(attr);
  if (current) {
    select.value = current;
  }
  select.addEventListener('change', () => {
    root.setAttribute(attr, select.value as T);
  });
}

bindSelect<Material>('mode-select', 'data-material');
bindSelect<Theme>('theme-select', 'data-theme');
