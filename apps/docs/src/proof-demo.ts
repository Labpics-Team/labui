/*
 * Core-scaffold PROOF demo.
 *
 * Registers `<lab-proof>` (the proof element, NOT the production Button) on the
 * client and wires the theme switcher. The proof's whole job is to exercise the
 * scaffold seam in a real browser: the Zag toggle machine drives the element,
 * tokens style it, and `[data-theme]` on the root re-skins it with zero edits.
 *
 * The page also carries a SERVER-rendered `<lab-proof>` island (injected at
 * build time via the SSR shim — see vite.config.ts) so the smoke can assert real
 * declarative shadow DOM in the delivered HTML, before any JS runs.
 */
import '@labpics/ui-core/proof';

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
    // Never write an unchecked value onto the DOM, even from our own markup.
    if (isTheme(select.value)) root.setAttribute('data-theme', select.value);
  });
}
