/**
 * Shadow demo controls — the only client JS on the page. The cards render with
 * HTML + the generated contract alone; this wires two controls:
 *
 *   - the theme toggle flips `data-theme`, proving light/dark is a variable swap
 *     (the anchor + alpha contract change, the box-shadow geometry does not);
 *   - the advanced light-angle slider sets the single global `--lab-light-angle`
 *     token. The DEFAULT build is vertical (angle 0) and emits a literal ladder
 *     that does not read the angle, so the slider re-projects the demo cards at
 *     runtime to visualise the config option — the same y·sin / y·cos formula
 *     the generator uses for a non-zero default angle.
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

const angle = document.querySelector<HTMLInputElement>('[data-testid="angle-input"]');
const angleOut = document.querySelector<HTMLOutputElement>('[data-testid="angle-output"]');

if (angle && angleOut) {
  // Reusable shared ink string — matches the generated contract's ply colour so
  // the re-projected demo shadow is the same ink, only the offset split changes.
  const ink = (slot: string): string =>
    `color-mix(in srgb, transparent, color-mix(in srgb, var(--lab-shadow-color), var(--lab-surface-shadow-tint, var(--lab-shadow-color)) calc(var(--lab-shadow-tint-strength) * 100%)) calc(var(--lab-shadow-alpha-${slot}) * 100%))`;

  // The owner ladder (blur r, vertical throw y) — the same opora table the
  // package encodes. Used only to re-project at a non-default angle for the demo.
  const LADDER: Record<string, ReadonlyArray<{ r: number; y: number }>> = {
    xs: [
      { r: 1, y: 0 },
      { r: 1, y: 1 },
      { r: 2, y: 2 },
      { r: 2, y: 4 },
    ],
    s: [
      { r: 2, y: 1 },
      { r: 2, y: 2 },
      { r: 4, y: 4 },
      { r: 8, y: 12 },
    ],
    m: [
      { r: 2, y: 1 },
      { r: 4, y: 4 },
      { r: 8, y: 12 },
      { r: 12, y: 24 },
    ],
    l: [
      { r: 8, y: 4 },
      { r: 12, y: 12 },
      { r: 16, y: 24 },
      { r: 24, y: 48 },
    ],
    xl: [
      { r: 36, y: 16 },
      { r: 48, y: 24 },
      { r: 64, y: 36 },
      { r: 96, y: 48 },
    ],
  };
  const SLOTS = ['s1', 's2', 's3', 's4'] as const;

  const sizeCards = Array.from(
    document.querySelectorAll<HTMLElement>('[data-testid^="card-"]'),
  ).map((el) => {
    const size = el.className.match(/lab-shadow-(xs|s|m|l|xl)\b/)?.[1];
    return { el, size };
  });

  const project = (deg: number): void => {
    const rad = (deg * Math.PI) / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    for (const { el, size } of sizeCards) {
      if (!size) continue;
      const rows = LADDER[size];
      if (!rows) continue;
      if (deg === 0) {
        // Restore the literal contract — clear the inline override.
        el.style.removeProperty('box-shadow');
        continue;
      }
      const plies = SLOTS.map((slot, i) => {
        const row = rows[i];
        if (!row) return '';
        const x = (row.y * sin).toFixed(2);
        const y = (row.y * cos).toFixed(2);
        return `${x}px ${y}px ${row.r}px ${ink(slot)}`;
      }).filter(Boolean);
      el.style.boxShadow = plies.join(', ');
    }
  };

  const applyAngle = (deg: string): void => {
    root.style.setProperty('--lab-light-angle', `${deg}deg`);
    angleOut.textContent = `${deg}°`;
    project(Number.parseInt(deg, 10) || 0);
  };

  applyAngle(angle.value);
  angle.addEventListener('input', () => applyAngle(angle.value));
}
