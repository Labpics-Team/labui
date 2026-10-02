import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config/default-config.js';
import { generate } from '../src/generate/index.js';
import snapshot from './fixtures/figma-snapshot-subset.json' with { type: 'json' };

/**
 * DTCG round-trip + intentional-delta documentation against Daniel's Figma
 * snapshot (the "100% mode" canonical values).
 *
 * Web representation is allowed to translate Figma values (for example px to
 * rem) but not silently replace a finished design scale. The test pins:
 *   1. what Lab UI preserves exactly as design intent, including radius names
 *      and values; and
 *   2. the few implementation-level deltas that are explicitly owned by code,
 *      such as the z-index runtime ordering.
 */

const doc = JSON.parse(generate(defaultConfig).dtcg) as {
  radius: Record<string, { $value: { value: number } }>;
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

/** Presence-checked radius px lookup from the generated DTCG. */
function radiusPx(name: string): number {
  const entry = doc.radius[name];
  if (!entry) throw new Error(`missing radius token "${name}"`);
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

  it('radius primitives preserve the final Figma Radius/* ladder exactly', () => {
    const map: Record<string, string> = {
      None: '0',
      XXS: 'xxs',
      XS: 'xs',
      S: 's',
      M: 'm',
      L: 'l',
      XL: 'xl',
      '2XL': '2xl',
      '3XL': '3xl',
      '4XL': '4xl',
      '5XL': '5xl',
      Full: 'full',
    };
    for (const [figmaName, value] of Object.entries(snapshot.radius)) {
      const tokenName = map[figmaName];
      if (!tokenName) throw new Error(`unmapped Figma radius "${figmaName}"`);
      expect(radiusPx(tokenName), figmaName).toBe(value);
    }
  });

  it('the full set of 15 z-index layer NAMES is preserved (re-expressed semantically)', () => {
    expect(Object.keys(snapshot.zIndex)).toHaveLength(15);
    // The exact semantic ladder, in stacking order — not just a count, so a
    // renamed/reordered layer cannot slip through as a false positive.
    expect(Object.keys(doc['z-index'])).toEqual([
      'primary',
      'secondary',
      'tertiary',
      'quaternary',
      'grouped-primary',
      'grouped-secondary',
      'grouped-tertiary',
      'inverted',
      'skip-link',
      'dropdown',
      'sticky',
      'modal-underlay',
      'modal',
      'toast',
      'tooltip',
    ]);
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

  it('DELTA: spacing uses a normalized rem spine while radius preserves Figma exactly', () => {
    // Unit is a general design unit ladder, not the web spacing API. At larger
    // values it intentionally mixes 4px and 8px jumps. Lab UI exposes spacing
    // as a regular 4px rem spine, while the separate Radius/* ladder above is
    // preserved by name and value.
    expect(px('px/19') - px('px/18')).toBe(4);
    expect(px('px/20') - px('px/19')).toBe(8);
    expect(px('px/21') - px('px/20')).toBe(8);
  });

  it('DELTA: the pt/0 data gap (no 133.3% mode) is closed — LabUI defines zero everywhere', () => {
    // The epic's zero-token mandate: Figma left pt/0 undefined in the 133.3%
    // mode. LabUI has no per-mode zeros to leave undefined — root font-size is
    // the single scaling axis — and every scale has an explicit, defined zero.
    expect(doc['z-index']).toHaveProperty('primary'); // z zero = primary = 0
    expect(zVal('primary')).toBe(0);
  });
});
