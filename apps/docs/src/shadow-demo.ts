/**
 * Shadow demo controls — the only client JS on the page. The cards render with
 * HTML + the generated contract alone; this wires exactly one control:
 *
 *   - the theme toggle flips `data-theme`, proving light/dark is a variable swap
 *     (the anchor + alpha contract change, the box-shadow geometry does not).
 *
 * The light angle is intentionally NOT a runtime control. The shipped ladder is
 * a literal vertical projection and does not read `--lab-light-angle`; a runtime
 * slider that re-projected the cards inline was a dead-end affordance (it set a
 * token nothing consumed, and its inline box-shadow re-projection was discarded
 * by the cascade — zero rendered effect). The angle is documented as a generator
 * input on the page instead of faked with a knob.
 *
 * Feature-detected and null-guarded so a missing element never throws.
 */
const root = document.documentElement;

const themeToggle = document.querySelector<HTMLButtonElement>('[data-testid="theme-toggle"]');

if (themeToggle) {
  const labelFor = (theme: string): string =>
    theme === 'dark' ? 'Switch to light' : 'Switch to dark';

  themeToggle.textContent = labelFor(root.getAttribute('data-theme') ?? 'light');

  themeToggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    themeToggle.textContent = labelFor(next);
  });
}
