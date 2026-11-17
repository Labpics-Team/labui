/*
 * Golden lock for the displacement-map hot path (engine/liquid-glass.ts).
 *
 * The rim-skip optimisation in `__computeDisplacementField` (skip the SDF work in
 * the flat interior a `band`-px rim never reaches) is only sound if it is BYTE
 * IDENTICAL to the full double loop it replaces. This test freezes a SHA-256 of
 * every map in a fixed geometry corpus — small/medium/large, radius 0 / > half /
 * full circle, dpr 1-3, odd dims, 1px degenerate — plus the feDisplacementMap
 * `scale` unit and the device-pixel dimensions. Any change to the produced bytes
 * (a rounding drift, a mis-mirrored quadrant, an over-eager skip that drops a rim
 * pixel) flips a hash and fails here.
 *
 * PROVENANCE: refreshed 2026-11-17 for the intentional replacement of centre
 * pull by shape-normal Snell refraction. Four original Figma panes and the
 * before/after renders are in docs/evidence/materials-20261117/glass-optics.md.
 * Independent ray/ellipse checks live in glass-optics.test.ts. These hashes
 * guard later implementation changes; they do not establish Figma fidelity.
 *
 * ⚠️ REGENERATING these constants is a DELIBERATE act — do it ONLY when the lens
 * LOOK is intentionally changed (a falloff/encoding/geometry change signed off by
 * the surface implementation), never as a reflex to make a red test green. A surprise red
 * here on a "pure refactor" or "just perf" change means the change is NOT
 * byte-identical — fix the code, do not rebless the hashes.
 */
import { describe, expect, it } from 'vitest';
import { __computeDisplacementField } from '../src/engine/liquid-glass';
import { MAP_CORPUS, hashBytes } from './engine-map-corpus';

interface Golden {
  hash: string;
  unit: number;
  W: number;
  H: number;
}

// name → frozen {sha256(rgba), feDisplacementMap unit, device W×H}
const GOLDEN: Record<string, Golden> = {
  'small-square-dpr1': {
    hash: '640030b0104866223e249fa5ba694999b6e6d85401d1467e31503a3be0acf88e',
    unit: 47,
    W: 48,
    H: 48,
  },
  'small-square-dpr2': {
    hash: 'a90898b7aab778ed646503e085cb3d39f353cd7d6e1a7348c2a8c5fa7daa0308',
    unit: 47.5,
    W: 96,
    H: 96,
  },
  'small-radius0': {
    hash: '0948f6f0dbf1a5368f7b9ecbb772713dd3b01be61ecc37853fd0b00c88c100a6',
    unit: 47,
    W: 48,
    H: 48,
  },
  'small-radius-over-half': {
    hash: '67e40697405ae8e76c8cbe9540bd0a027ed4ff92bacc2fcd118083d8259023e4',
    unit: 47,
    W: 48,
    H: 48,
  },
  'medium-card': {
    hash: '1d70c889c28b3bf794934e32212a48226a0d7c079c6e0750959627cc7b5779c9',
    unit: 98.935015181053,
    W: 320,
    H: 200,
  },
  'medium-card-dpr2': {
    hash: 'd3aa257a4ec9d0487b7c923dbb0b3da64ced303ffbdedf3bcd46a1ca04af796d',
    unit: 100.2450725288023,
    W: 640,
    H: 400,
  },
  'medium-radius0': {
    hash: '005069e4d8e8dc0b2b499d1023b9fe685bd2330e4d15f774e3f8ef260d43d28e',
    unit: 94.2860619878011,
    W: 320,
    H: 200,
  },
  'medium-circleish': {
    hash: '78923964b917d8c11b889d0d3e7946e02650eb0f3fadd446d773ec188b65cb89',
    unit: 100.552362129812,
    W: 320,
    H: 320,
  },
  'medium-deep-band': {
    hash: 'c715169a9a72f972a9ebba3f0630b4f92cb386c53c429f568a2b820977fe7044',
    unit: 319,
    W: 320,
    H: 320,
  },
  'large-panel': {
    hash: '0ccad6a0af039591555053953123396bebbb8f068a0cc19af39c377ca8194a36',
    unit: 98.935015181053,
    W: 1024,
    H: 1024,
  },
  'large-panel-dpr2': {
    hash: '1cfac2f9fe3211941649039359030ad6a3f274114d5a72bb0c6acec02fdef448',
    unit: 100.2450725288023,
    W: 2048,
    H: 1536,
  },
  'large-radius0': {
    hash: '1ef226b4b5c67f8de434ba37b37bacf39be97bc8d7a932de988b0a29e164a8bb',
    unit: 94.2860619878011,
    W: 1024,
    H: 1024,
  },
  'large-circle': {
    hash: '07a80f21384ad999772a19fb165a1d06573236f21b5ac1c7c6d77c160e35f702',
    unit: 100.76596485200125,
    W: 1024,
    H: 1024,
  },
  'large-thin-band': {
    hash: '203df65e460677784efebf3f39071ef1844e71acd6d175eeb78c8973655bf5f8',
    unit: 18.27809417509815,
    W: 1024,
    H: 1024,
  },
  'wide-thin': {
    hash: '44c6306f924e34c1d26697b19d5b6b9875fb0211d651b5956d8a05fbc1e80854',
    unit: 98.935015181053,
    W: 1024,
    H: 64,
  },
  'tall-thin': {
    hash: '563e815e963ba211326af0e80b731d25a3d634f2f3750edfc81bc450cce811d1',
    unit: 98.935015181053,
    W: 64,
    H: 1024,
  },
  'degenerate-1px': {
    hash: '79dfad351f79ef0e65a11fff0a9ed44bf628f9390ff06b92ee4ee5e2477616ea',
    unit: 0.000002,
    W: 1,
    H: 1,
  },
  'degenerate-2px': {
    hash: '1ae9f9e9fcf6f8009922ce078009828da7b755b53fd88640c08adb2e4d9c2a48',
    unit: 0.9156552774318886,
    W: 2,
    H: 2,
  },
  'odd-dims': {
    hash: 'db6f8a057f6105987cc0d321b674d3a3169c7f2ccc0102ea642580c4371eff5c',
    unit: 80.72247420460846,
    W: 321,
    H: 201,
  },
  'dpr3-clamped': {
    hash: '7f5aba974094b316feefff1c5effe17449ed3a9b2cc1674882a59ddad678aa7a',
    unit: 100.2450725288023,
    W: 640,
    H: 640,
  },
};

describe('displacement map — byte-identity golden lock', () => {
  it('covers every corpus case (no silent gaps)', () => {
    expect(Object.keys(GOLDEN).sort()).toEqual([...MAP_CORPUS].map((c) => c.name).sort());
  });

  for (const c of MAP_CORPUS) {
    it(`${c.name} (${c.w}×${c.h}, r=${c.corner}, depth=${c.depth}, dpr=${c.dpr}) is byte-identical`, () => {
      const g = GOLDEN[c.name];
      expect(g, `no golden entry for ${c.name}`).toBeDefined();
      const out = __computeDisplacementField(c.w, c.h, c.corner, c.depth, c.dpr);
      // Device dimensions and the reconstruction scale must match exactly…
      expect(out.W).toBe((g as Golden).W);
      expect(out.H).toBe((g as Golden).H);
      expect(out.unit).toBe((g as Golden).unit);
      // …and every RGBA byte of the map (the exact bitmap that becomes the PNG /
      // feDisplacementMap atlas).
      expect(hashBytes(out.data)).toBe((g as Golden).hash);
    });
  }
});
