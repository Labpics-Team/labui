import { describe, expect, it } from 'vitest';
import { type Rgba, compositeOver, relativeLuminance } from '../src/luminance';
import {
  type BackdropCorridor,
  type LabelCandidate,
  WCAG_AA_NORMAL,
  cornerCorridor,
  evaluateTier,
  unionCorridor,
} from '../src/material-guarantee';

/*
 * ADR-0004 Решение 2 — the corridor generalisation. The α-boundary guarantee is
 * one class of math parametrised by the reachable BACKDROP corridor. The material
 * case (unknown live backdrop) is the corridor [black, white]; a known image
 * region narrows it to the per-channel extremes actually under the label. This
 * suite proves: (1) the default corridor is byte-identical to the old black/white
 * behaviour, (2) narrowing the corridor is a strict, monotone tightening that can
 * flip an unguaranteed tier to guaranteed, (3) corner/union corridors bound the
 * reachable composite luminance from outside (conservative — never over-promises).
 *
 * Classes: A (pure-math unit, RED-provable) + C (property sweep over backdrops).
 */

const WHITE: LabelCandidate = { name: 'white', colour: { r: 255, g: 255, b: 255, a: 1 } };
const NEAR_BLACK: LabelCandidate = { name: 'near-black', colour: { r: 16, g: 16, b: 18, a: 1 } };
const POLARITY = [WHITE, NEAR_BLACK] as const;

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const FULL_WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

describe('corridor default = black/white (backward compatible)', () => {
  it('omitting the backdrop corridor reproduces the black/white extrema exactly', () => {
    const tint: Rgba = { r: 128, g: 128, b: 128, a: 0.6 };
    const fill = { tint, base: BLACK };
    const legacy = evaluateTier('soft', 'light', fill, POLARITY);
    const explicit = evaluateTier('soft', 'light', fill, POLARITY, {
      backdrop: { min: BLACK, max: FULL_WHITE },
    });
    // Same numbers to the bit — the default IS the full [black, white] corridor.
    expect(explicit.effLow).toBe(legacy.effLow);
    expect(explicit.effHigh).toBe(legacy.effHigh);
    expect(legacy.effLow).toBe(relativeLuminance(compositeOver(tint, BLACK)));
    expect(legacy.effHigh).toBe(relativeLuminance(compositeOver(tint, FULL_WHITE)));
  });
});

describe('narrowing the corridor is a strict, monotone tightening', () => {
  it('a narrower corridor never widens [effLow, effHigh]', () => {
    const tint: Rgba = { r: 191, g: 120, b: 40, a: 0.44 };
    const fill = { tint, base: BLACK };
    const full = evaluateTier('soft', 'light', fill, POLARITY);
    const narrow = evaluateTier('soft', 'light', fill, POLARITY, {
      backdrop: { min: { r: 60, g: 60, b: 60, a: 1 }, max: { r: 200, g: 200, b: 200, a: 1 } },
    });
    expect(narrow.effLow).toBeGreaterThanOrEqual(full.effLow);
    expect(narrow.effHigh).toBeLessThanOrEqual(full.effHigh);
  });

  it('a sheer tier UNGUARANTEED over [black,white] becomes guaranteed over a tight known corridor', () => {
    // α=.3 white-ish tint: over the full band the white label washes out (unguaranteed).
    const tint: Rgba = { r: 191, g: 191, b: 191, a: 0.3 };
    const fill = { tint, base: { r: 13, g: 13, b: 13, a: 1 } };
    const full = evaluateTier('subtle', 'light', fill, POLARITY);
    expect(full.guaranteed).toBe(false);
    // …but if the real backdrop under the label is known to be dark [0..40], the
    // near-black polarity label holds — the corridor solver proves it.
    const dark = evaluateTier('subtle', 'light', fill, POLARITY, {
      backdrop: { min: BLACK, max: { r: 40, g: 40, b: 40, a: 1 } },
    });
    expect(dark.guaranteed).toBe(true);
    expect(dark.worstContrast).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });
});

describe('cornerCorridor — per-channel extremes bound the reachable set from outside', () => {
  it('bounds composite luminance over an ARBITRARY set of backdrop colours', () => {
    const tint: Rgba = { r: 100, g: 150, b: 200, a: 0.5 };
    const backdrops: Rgba[] = [
      { r: 10, g: 200, b: 30, a: 1 },
      { r: 220, g: 5, b: 250, a: 1 },
      { r: 128, g: 128, b: 0, a: 1 },
    ];
    const corridor = cornerCorridor(backdrops);
    const verdict = evaluateTier('base', 'light', { tint, base: BLACK }, POLARITY, {
      backdrop: corridor,
    });
    for (const bd of backdrops) {
      const l = relativeLuminance(compositeOver(tint, bd));
      expect(l).toBeGreaterThanOrEqual(verdict.effLow - 1e-9);
      expect(l).toBeLessThanOrEqual(verdict.effHigh + 1e-9);
    }
  });

  it('cornerCorridor of the whole cube is exactly [black, white]', () => {
    const corridor = cornerCorridor([BLACK, FULL_WHITE, { r: 255, g: 0, b: 0, a: 1 }]);
    expect(corridor.min).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(corridor.max).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });
});

describe('unionCorridor — a label crossing two backgrounds sees the union', () => {
  it('the union corridor contains both source corridors', () => {
    const a: BackdropCorridor = {
      min: { r: 10, g: 10, b: 10, a: 1 },
      max: { r: 80, g: 80, b: 80, a: 1 },
    };
    const b: BackdropCorridor = {
      min: { r: 200, g: 100, b: 50, a: 1 },
      max: { r: 240, g: 180, b: 120, a: 1 },
    };
    const u = unionCorridor(a, b);
    expect(u.min).toEqual({ r: 10, g: 10, b: 10, a: 1 });
    expect(u.max).toEqual({ r: 240, g: 180, b: 120, a: 1 });
  });
});
