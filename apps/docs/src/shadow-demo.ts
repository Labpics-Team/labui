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
import { ELEVATION_SHAPES, SHADOW_SLOTS, type ShadowSlotName } from '@labpics/ui-shadow';

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

  // The ladder geometry is the package's SINGLE source of truth — imported, not
  // re-declared, so the demo can never drift from the опора the package encodes.
  // Used only to re-project at a non-default angle for the advanced control.
  const ladderFor = (
    size: string,
  ): readonly { slot: ShadowSlotName; blur: number; offsetY: number }[] => {
    const level = ELEVATION_SHAPES.find((l) => l.name === size);
    if (!level) return [];
    return SHADOW_SLOTS.map((slot) => ({ slot, ...level.slots[slot] }));
  };

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
      if (deg === 0) {
        // Restore the literal contract — clear the inline override.
        el.style.removeProperty('box-shadow');
        continue;
      }
      const plies = ladderFor(size).map(({ slot, blur, offsetY }) => {
        const x = (offsetY * sin).toFixed(2);
        const y = (offsetY * cos).toFixed(2);
        return `${x}px ${y}px ${blur}px ${ink(slot)}`;
      });
      if (plies.length > 0) el.style.boxShadow = plies.join(', ');
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
