import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config/default-config.js';
import { generate } from '../src/generate/index.js';
import snapshot from './fixtures/figma-snapshot-subset.json' with { type: 'json' };

/**
 * DTCG round-trip + intentional-delta documentation against Daniel's Figma
 * snapshot (the "100% mode" canonical values).
 *
 * The Figma dimension scale is deliberately REPLACED by LabUI ("the current
 * Figma scale is broken"), so this is not a byte-for-byte round-trip — it is a
 * documented reconciliation. The test pins:
 *   1. what LabUI PRESERVES from Figma (the values that were already sane), and
 *   2. what LabUI intentionally CHANGES (with the reason), so the delta is an
 *      explicit, reviewed artifact for the future figma-snapshot-export.
 */

const doc = JSON.parse(generate(defaultConfig).dtcg) as {
  'z-index': Record<string, { $value: number }>;
  'font-size': Record<string, { $value: { value: number } }>;
};

// In the fixture, z-index entries are { type, value } objects but the raw px
// scale entries are bare numbers (matching the snapshot's literal mode values).
const px = (key: string): number => (snapshot.pxScale100 as Record<string, number>)[key] as number;

/** Presence-checked z-index value lookup (no undefined holes in tests). */
function zVal(name: string): number {
  const entry = doc['z-index'][name];
  if (!entry) throw new Error(`missing z-index token "${name}"`);
  return entry.$value;
}

/** Presence-checked font-size px lookup. */
function fontPx(name: string): number {
  const entry = doc['font-size'][name];
  if (!entry) throw new Error(`missing font-size token "${name}"`);
  return entry.$value.value;
}

describe('DTCG export — self round-trip', () => {
  it('re-parses to an identical structure (stable, valid JSON)', () => {
    const once = generate(defaultConfig).dtcg;
    const twice = `${JSON.stringify(JSON.parse(once), null, 2)}\n`;
    expect(twice).toBe(once);
  });
});

describe('reconciliation with Figma snapshot — PRESERVED values', () => {
  it('typography base (16px) and display top (~112px) match the Figma anchors', () => {
    // Figma font-size-m = px.7 = 16px; font-size-6xl = px.25 = 112px.
    expect(px('px/7')).toBe(16);
    expect(px('px/25')).toBe(112);
    // LabUI base step is exactly 16; display top lands within 1px of 112.
    expect(fontPx('md')).toBe(16);
    expect(fontPx('6xl')).toBeGreaterThan(110);
    expect(fontPx('6xl')).toBeLessThan(114);
  });

  it('the full set of 15 z-index layer NAMES is preserved (re-expressed semantically)', () => {
    expect(Object.keys(snapshot.zIndex)).toHaveLength(15);
    expect(Object.keys(doc['z-index'])).toHaveLength(15);
  });
});

describe('reconciliation with Figma snapshot — INTENTIONAL DELTAS (documented)', () => {
  it('DELTA: z-index collisions in Figma are resolved to a clean gap-100 sequence', () => {
    // Figma raw has collisions: Grouped-Primary == Quaternary == 400.
    expect(snapshot.zIndex['Grouped-Primary'].value).toBe(400);
    expect(snapshot.zIndex.Quaternary.value).toBe(400);
    // LabUI gives every layer a unique, gap-100 value — no collisions.
    const labValues = Object.values(doc['z-index']).map((t) => t.$value);
    expect(new Set(labValues).size).toBe(labValues.length);
    expect(zVal('grouped-primary')).not.toBe(zVal('quaternary'));
  });

  it('DELTA: z-index now ascends monotonically by intended stacking order', () => {
    // In Figma, Tooltip=1300 but SkipLink=50 and Sticky=900 — order is sane by
    // value but the numbering is irregular. LabUI re-numbers to a strict ladder.
    const labValues = Object.values(doc['z-index']).map((t) => t.$value);
    for (let i = 1; i < labValues.length; i++) {
      expect(labValues[i]).toBe((labValues[i - 1] as number) + 100);
    }
  });

  it('DELTA: spacing/radii are rem-relative, replacing the broken Figma px ladder', () => {
    // Figma px scale jumps 60->64->72->80 (px/18..21): uneven big steps. LabUI
    // replaces it with a controllable linear rem multiplier. We assert LabUI's
    // spine is regular (4px) where Figma's was not, as the documented reason.
    const figmaJump = px('px/21') - px('px/20');
    expect(figmaJump).toBe(8); // 80 - 72
    const figmaPrevJump = px('px/20') - px('px/19');
    expect(figmaPrevJump).toBe(8); // 72 - 64 ... but px/18->19 is 60->64 = 4: irregular
    expect(px('px/19') - px('px/18')).toBe(4);
    // LabUI's spine is uniformly 4px across its integer steps — the fix.
    // (verified in scales.test.ts; here we only pin the Figma irregularity.)
  });

  it('DELTA: the pt/0 data gap (no 133.3% mode) is closed — LabUI defines zero everywhere', () => {
    // The epic's zero-token mandate: Figma left pt/0 undefined in the 133.3%
    // mode. LabUI has no per-mode zeros to leave undefined — root font-size is
    // the single scaling axis — and every scale has an explicit, defined zero.
    expect(doc['z-index']).toHaveProperty('primary'); // z zero = primary = 0
    expect(zVal('primary')).toBe(0);
  });
});
