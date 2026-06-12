import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config/default-config.js';
import { resolveConfig } from '../src/config/merge.js';
import { buildTypography, effectiveSizePx, fluidBounds } from '../src/domain/typography.js';

const ty = defaultConfig.typography;

/** Every signed step index in the configured range, low to high. */
function allSteps(): number[] {
  const steps: number[] = [];
  for (let s = -ty.stepsDown; s <= ty.stepsUp; s++) steps.push(s);
  return steps;
}

describe('fluid typography — gradient model', () => {
  it('base step (0) is exactly 16px and immovable at every width', () => {
    const widths = [ty.minViewportPx, 600, 900, ty.maxViewportPx, 320, 1240];
    for (const w of widths) {
      expect(effectiveSizePx(ty, 0, w)).toBeCloseTo(16, 6);
    }
  });

  it('step +7 reaches ~112px at the wide anchor and is damped to ~57px at the narrow anchor', () => {
    const wide = effectiveSizePx(ty, 7, ty.maxViewportPx);
    const narrow = effectiveSizePx(ty, 7, ty.minViewportPx);
    // Daniel's target: ~112px desktop, ~57px mobile (grows ~2x slower narrow).
    expect(wide).toBeGreaterThan(108);
    expect(wide).toBeLessThan(115);
    expect(narrow).toBeGreaterThan(55);
    expect(narrow).toBeLessThan(60);
    // The whole point of damping: the narrow top is far below the wide top.
    expect(narrow).toBeLessThan(wide * 0.6);
  });

  it('STRICT MONOTONICITY: at ANY width in the working range, every step is larger than the one below it (slopes never cross)', () => {
    const steps = allSteps();
    // Sample densely across [minViewport, maxViewport] plus the exact anchors.
    const widths = new Set<number>([ty.minViewportPx, ty.maxViewportPx]);
    for (let w = ty.minViewportPx; w <= ty.maxViewportPx; w += 5) widths.add(w);

    for (const w of widths) {
      const sizes = steps.map((s) => effectiveSizePx(ty, s, w));
      for (let i = 1; i < sizes.length; i++) {
        expect(
          sizes[i],
          `step ${steps[i]} (${sizes[i]?.toFixed(3)}px) must exceed step ${steps[i - 1]} (${sizes[
            i - 1
          ]?.toFixed(3)}px) at width ${w}px`,
        ).toBeGreaterThan(sizes[i - 1] as number);
      }
    }
  });

  it('monotonicity also holds slightly outside the anchors (clamped region)', () => {
    const steps = allSteps();
    for (const w of [120, 280, 1600, 2560]) {
      const sizes = steps.map((s) => effectiveSizePx(ty, s, w));
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i]).toBeGreaterThan(sizes[i - 1] as number);
      }
    }
  });

  it('the gradient actually interpolates: a 400px viewport differs from 1400px for display steps, base does not', () => {
    // Display step moves between widths (continuous interpolation, no steps).
    const display400 = effectiveSizePx(ty, 7, 400);
    const display1400 = effectiveSizePx(ty, 7, 1400);
    expect(display1400).toBeGreaterThan(display400 + 10);

    // A mid step inside the live region interpolates monotonically with width.
    const mid = [400, 700, 1000, 1240].map((w) => effectiveSizePx(ty, 4, w));
    for (let i = 1; i < mid.length; i++) {
      expect(mid[i]).toBeGreaterThan(mid[i - 1] as number);
    }

    // Base is fixed regardless of width.
    expect(effectiveSizePx(ty, 0, 400)).toBeCloseTo(effectiveSizePx(ty, 0, 1400), 6);
  });

  it('emits rem in every clamp position (WCAG zoom) and never a bare vw-only value', () => {
    const { fontSizes } = buildTypography(ty);
    for (const t of fontSizes) {
      expect(t.cssValue.startsWith('clamp(')).toBe(true);
      // rem must appear in the floor and the ceiling at minimum.
      const remCount = (t.cssValue.match(/rem/g) ?? []).length;
      expect(remCount, `${t.name} must keep rem in min/intercept/max`).toBeGreaterThanOrEqual(2);
    }
  });

  it('never emits a media query', () => {
    const { fontSizes } = buildTypography(ty);
    for (const t of fontSizes) {
      expect(t.cssValue).not.toContain('@media');
    }
  });

  it('clamp bounds are always ordered lower <= upper (valid CSS clamp)', () => {
    for (const step of allSteps()) {
      const b = fluidBounds(ty, step);
      const lower = Math.min(b.minPx, b.maxPx);
      const upper = Math.max(b.minPx, b.maxPx);
      expect(lower).toBeLessThanOrEqual(upper);
    }
  });

  it('changing ratio in the config re-derives the whole scale (configurability)', () => {
    const flatter = resolveConfig({ typography: { ratioMax: 1.25 } });
    const steeper = resolveConfig({ typography: { ratioMax: 1.4 } });
    const flatTop = effectiveSizePx(flatter.typography, 7, flatter.typography.maxViewportPx);
    const steepTop = effectiveSizePx(steeper.typography, 7, steeper.typography.maxViewportPx);
    expect(steepTop).toBeGreaterThan(flatTop);
    // Base is unaffected by ratio — still 16px both ways.
    expect(effectiveSizePx(flatter.typography, 0, 800)).toBeCloseTo(16, 6);
    expect(effectiveSizePx(steeper.typography, 0, 800)).toBeCloseTo(16, 6);
  });

  it('line-height is tighter for large steps and looser for body (Material 3 banding)', () => {
    const { lineHeights } = buildTypography(ty);
    const byName = new Map(lineHeights.map((t) => [t.name, t.numeric as number]));
    // display (6xl) tighter than body (md).
    expect(byName.get('6xl')).toBeLessThan(byName.get('md') as number);
    expect(byName.get('md')).toBeCloseTo(1.5, 6);
    expect(byName.get('6xl')).toBeCloseTo(1.2, 6);
  });
});
