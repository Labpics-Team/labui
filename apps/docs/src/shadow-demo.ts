/**
 * Shadow demo controls — the only client JS on the page. The elevation cards
 * render with HTML alone; this just wires the two interactive controls:
 *
 *   - the light-angle slider re-sets the single global `--lab-light-angle`
 *     token, so every ply of every card re-derives its x/y offset live;
 *   - the theme toggle flips `data-theme`, proving light/dark is a variable
 *     swap (the alphas + tint anchor change, the box-shadow formula does not).
 *
 * Feature-detected and null-guarded so a missing element never throws.
 */
const root = document.documentElement;

const angle = document.querySelector<HTMLInputElement>('[data-testid="angle-input"]');
const angleOut = document.querySelector<HTMLOutputElement>('[data-testid="angle-output"]');
const themeToggle = document.querySelector<HTMLButtonElement>('[data-testid="theme-toggle"]');

if (angle && angleOut) {
  const applyAngle = (deg: string): void => {
    root.style.setProperty('--lab-light-angle', `${deg}deg`);
    angleOut.textContent = `${deg}°`;
  };
  applyAngle(angle.value);
  angle.addEventListener('input', () => applyAngle(angle.value));
}

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
