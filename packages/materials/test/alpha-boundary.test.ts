import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from '../src/luminance';
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

  it('L_eff bounds match α·L_tint and α·L_tint + (1−α) exactly', () => {
    const tint = { r: 128, g: 128, b: 128, a: 0.6 };
    const verdict = evaluateTier(
      'soft',
      'light',
      { tint, base: { r: 0, g: 0, b: 0, a: 1 } },
      POLARITY,
    );
    const lTint = relativeLuminance({ ...tint, a: 1 });
    expect(verdict.effLow).toBeCloseTo(0.6 * lTint, 10);
    expect(verdict.effHigh).toBeCloseTo(0.6 * lTint + 0.4, 10);
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

  // GOLDEN — locks the current unguaranteed set. This is the report's finding.
  // When the colours train replaces the provisional Figma alphas, this array is
  // the single place that re-baselines (and the diff is the proof of change).
  it('locks the current unguaranteed set (provisional Figma alphas)', () => {
    const EXPECTED_UNGUARANTEED = [
      'dark/elevated',
      'dark/muted',
      'dark/soft',
      'dark/subtle',
      'light/subtle',
    ];
    expect(unguaranteedKeys).toEqual(EXPECTED_UNGUARANTEED);
  });
});
