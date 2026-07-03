import { describe, expect, it } from 'vitest';
import { type Rgba, compositeOver, contrastRatio, relativeLuminance } from '../src/luminance';
import {
  type LabelCandidate,
  WCAG_AA_NORMAL,
  evaluateTier,
  guaranteeReport,
  verdictKey,
} from '../src/material-guarantee';
import { readContractMaterials } from './contract-values';

/*
 * The α-boundary guarantee — the design's core gate. A glass tier is
 * GUARANTEED only if its committed label clears the WCAG floor at BOTH backdrop
 * boundaries (L_bd = 0 and L_bd = 1). Provisional Figma alphas that fail are a
 * FINDING to surface, not to hide.
 *
 * Test classes: A (pure-math unit, RED-provable on known inputs) + B
 * (characterization/golden that locks the current unguaranteed set so a silent
 * regression trips the suite).
 */

const WHITE: LabelCandidate = { name: 'white', colour: { r: 255, g: 255, b: 255, a: 1 } };
const NEAR_BLACK: LabelCandidate = { name: 'near-black', colour: { r: 16, g: 16, b: 18, a: 1 } };
const POLARITY = [WHITE, NEAR_BLACK] as const;

describe('sRGB colour math (WCAG 2.1)', () => {
  it('white-on-black contrast is the 21:1 maximum', () => {
    const white = relativeLuminance({ r: 255, g: 255, b: 255, a: 1 });
    const black = relativeLuminance({ r: 0, g: 0, b: 0, a: 1 });
    expect(contrastRatio(white, black)).toBeCloseTo(21, 1);
  });
});

describe('evaluateTier — the α-boundary decision bites', () => {
  it('a DENSE tier (α high) holds its label across the whole backdrop range', () => {
    const verdict = evaluateTier(
      'base',
      'light',
      { tint: { r: 153, g: 153, b: 153, a: 0.9 }, base: { r: 92, g: 92, b: 92, a: 1 } },
      POLARITY,
    );
    // Dense band collapses onto the tint → both boundaries clear the floor.
    expect(verdict.label).toBe('near-black');
    expect(verdict.contrastLow).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    expect(verdict.contrastHigh).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    expect(verdict.guaranteed).toBe(true);
  });

  it('a SHEER tier (α low) fails at the bright-backdrop boundary → unguaranteed', () => {
    const verdict = evaluateTier(
      'subtle',
      'light',
      { tint: { r: 191, g: 191, b: 191, a: 0.3 }, base: { r: 13, g: 13, b: 13, a: 1 } },
      POLARITY,
    );
    // Committed to white on the dark solid canon, but a white backdrop washes it out.
    expect(verdict.label).toBe('white');
    expect(verdict.contrastHigh).toBeLessThan(WCAG_AA_NORMAL);
    expect(verdict.guaranteed).toBe(false);
  });

  it('effLow/effHigh are the REAL gamma-composite over black/white (browser paint space)', () => {
    const tint = { r: 128, g: 128, b: 128, a: 0.6 };
    const verdict = evaluateTier(
      'soft',
      'light',
      { tint, base: { r: 0, g: 0, b: 0, a: 1 } },
      POLARITY,
    );
    // The bound is the luminance of the tint composited per-channel in gamma sRGB
    // over pure black (min) and pure white (max) — NOT a blend of luminances.
    expect(verdict.effLow).toBeCloseTo(
      relativeLuminance(compositeOver(tint, { r: 0, g: 0, b: 0, a: 1 })),
      10,
    );
    expect(verdict.effHigh).toBeCloseTo(
      relativeLuminance(compositeOver(tint, { r: 255, g: 255, b: 255, a: 1 })),
      10,
    );
    expect(verdict.effLow).toBeLessThan(verdict.effHigh);
  });

  it('black/white are the TRUE luminance extrema — even over COLOURED backdrops (closes the class)', () => {
    // Monotonicity claim: no backdrop of any hue can push the composite luminance
    // outside [effLow, effHigh]. Sweep a grid of coloured backdrops and assert it.
    const tint: Rgba = { r: 191, g: 120, b: 40, a: 0.44 };
    const verdict = evaluateTier(
      'soft',
      'light',
      { tint, base: { r: 0, g: 0, b: 0, a: 1 } },
      POLARITY,
    );
    const EPS = 1e-9;
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const composited = relativeLuminance(compositeOver(tint, { r, g, b, a: 1 }));
          expect(composited).toBeGreaterThanOrEqual(verdict.effLow - EPS);
          expect(composited).toBeLessThanOrEqual(verdict.effHigh + EPS);
        }
      }
    }
  });

  it('INTERIOR worst-case: both endpoints legal, label INSIDE the band → NOT guaranteed', () => {
    // A near-transparent white tint spreads the band across almost the whole axis
    // (effLow≈0, effHigh≈1). A mid-grey label (L≈0.18) clears the WCAG floor at
    // BOTH endpoints, yet a backdrop exists that matches its luminance exactly →
    // 1:1 contrast. Endpoint-only logic would wrongly call this guaranteed.
    const midGrey: LabelCandidate = { name: 'mid-grey', colour: { r: 117, g: 117, b: 117, a: 1 } };
    const verdict = evaluateTier(
      'subtle',
      'light',
      { tint: { r: 255, g: 255, b: 255, a: 0.005 }, base: { r: 0, g: 0, b: 0, a: 1 } },
      [midGrey],
    );
    const labelLum = relativeLuminance(midGrey.colour);
    expect(labelLum).toBeGreaterThan(verdict.effLow);
    expect(labelLum).toBeLessThan(verdict.effHigh);
    // Both ENDS are legal…
    expect(verdict.contrastLow).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    expect(verdict.contrastHigh).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    // …but the INTERIOR worst-case collapses to 1:1, so the tier is NOT guaranteed.
    expect(verdict.worstContrast).toBeLessThan(WCAG_AA_NORMAL);
    expect(verdict.guaranteed).toBe(false);
  });
});

describe('guarantee over the LIVE contract (parsed from colors-stub/contract.css)', () => {
  const { fills, labelCandidatesByTheme } = readContractMaterials();
  const report = guaranteeReport(fills, labelCandidatesByTheme);
  const guaranteedKeys = new Set(report.guaranteed.map(verdictKey));
  const unguaranteedKeys = report.unguaranteed.map(verdictKey).sort();

  it('every (theme, tier) pair is evaluated once — 5 tiers × 2 themes', () => {
    expect(report.verdicts).toHaveLength(10);
  });

  it('the DENSE `base` tier is guaranteed in BOTH themes (the canon that always holds)', () => {
    expect(guaranteedKeys.has('light/base')).toBe(true);
    expect(guaranteedKeys.has('dark/base')).toBe(true);
  });

  it('the sheer `subtle` tier is UNGUARANTEED in both themes (provisional-alpha finding)', () => {
    expect(unguaranteedKeys).toContain('light/subtle');
    expect(unguaranteedKeys).toContain('dark/subtle');
  });

  // GOLDEN — locks the current unguaranteed set in REAL gamma-composite space.
  // Re-derived when the α-boundary moved off the blend-of-luminances onto the
  // browser's true composite (compositeOver): `light/soft` fell out of the
  // guaranteed set (blend read ~5.7:1, real paint ~4.1:1 — below AA), while
  // `dark/muted` and `dark/soft` JOINED it (the blend was wrongly pessimistic for
  // a dark tint over a bright backdrop; real composite is darker → white label
  // holds ≥AA). When the colours train replaces the provisional Figma alphas,
  // this array is the single place that re-baselines.
  it('locks the current unguaranteed set (real gamma-composite α-boundary)', () => {
    const EXPECTED_UNGUARANTEED = ['dark/elevated', 'dark/subtle', 'light/soft', 'light/subtle'];
    expect(unguaranteedKeys).toEqual(EXPECTED_UNGUARANTEED);
  });
});
