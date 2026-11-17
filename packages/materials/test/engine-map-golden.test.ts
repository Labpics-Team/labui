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
 * PROVENANCE: refreshed 2026-11-18 for the accepted depth-bounded Snell profile
 * (base 0.4, index 2.8). This intentional optical change passed independent
 * Effects/Dock image review; the retained atlas remains byte-identical to each
 * bounded field. Evidence: docs/evidence/materials-20261117/glass-optics-refinement.md.
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
    hash: 'a8d8ccfd7989e10c4c4ae762c9cf4d1a305b447d1e8dda82f2318743483f82ae',
    unit: 47,
    W: 48,
    H: 48,
  },
  'small-square-dpr2': {
    hash: '80c9f9eb036b4657e49dd70902096f563134ac2cc2ceee6b77a88e42c7234660',
    unit: 47.5,
    W: 96,
    H: 96,
  },
  'small-radius0': {
    hash: 'a37743cf555254144c8368666e8c875a973e9c961ed43f56f45036ada2b7e6ce',
    unit: 47,
    W: 48,
    H: 48,
  },
  'small-radius-over-half': {
    hash: 'c4f4b5effccf0fe661c9b2069d2f579cdc6e62d09751d70c08724c1e58d6c250',
    unit: 47,
    W: 48,
    H: 48,
  },
  'medium-card': {
    hash: '1a409f74d4ba886cc800888d15d40552fc63b75c3affff66e80d8588de377895',
    unit: 79,
    W: 320,
    H: 200,
  },
  'medium-card-dpr2': {
    hash: '51450aebfe5e8eb145d6c3b0fd315cacb027cc8d690208ea182264c7a0afcc06',
    unit: 79.5,
    W: 640,
    H: 400,
  },
  'medium-radius0': {
    hash: '8fd1bb626e2c9f2c260fa99b56c0b0d6d333b717396a805bd57121f758d06687',
    unit: 79,
    W: 320,
    H: 200,
  },
  'medium-circleish': {
    hash: '5b92ca145c091a010afed1872a596019aa579b552214ccddc1eacfe0adee170c',
    unit: 79.7336433423158,
    W: 320,
    H: 320,
  },
  'medium-deep-band': {
    hash: 'b2438d79b3179dc5a745d6b1dba89c102f9a83ef88c61896d41f5e2d5bd6d46d',
    unit: 319,
    W: 320,
    H: 320,
  },
  'large-panel': {
    hash: '7bd0774f7eb5b3da58bf05b2243d1022ff0508ec7aaae94ad2af4ebd1afe9487',
    unit: 79,
    W: 1024,
    H: 1024,
  },
  'large-panel-dpr2': {
    hash: '11f092e88ea6d38da057fe3aa785d803e085a32fe253fd3453ba3bbcdee407c7',
    unit: 79.5,
    W: 2048,
    H: 1536,
  },
  'large-radius0': {
    hash: '40d5b5571b1046ca8ce494a79bc67a4223fca2bbb407876dfe8070fb134e4f3e',
    unit: 79,
    W: 1024,
    H: 1024,
  },
  'large-circle': {
    hash: 'd705cf26c0b53867e258550f828c46531621dabf3f9a9d5dca046898fc7d19dd',
    unit: 79.91198156107235,
    W: 1024,
    H: 1024,
  },
  'large-thin-band': {
    hash: '67652c4b9adb919bebd99caa7fc43cf7fa596ec1e7e7ca7439ca23f3664c8592',
    unit: 15.525016684090016,
    W: 1024,
    H: 1024,
  },
  'wide-thin': {
    hash: '9edb0be32d262001a0448f209badc9b849f69d2a1107cc8a4d2de9c9c3890cda',
    unit: 63,
    W: 1024,
    H: 64,
  },
  'tall-thin': {
    hash: 'c9ec6cee373dabd3c1a626732c31ebd7aba37096d76d9959bc378bcdaeb5b31d',
    unit: 63,
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
    unit: 0.9036036289687418,
    W: 2,
    H: 2,
  },
  'odd-dims': {
    hash: '440bb33ee5a52cbbab12d26ee12be2626372ab6d56f99f21969cbb2732a942c2',
    unit: 65,
    W: 321,
    H: 201,
  },
  'dpr3-clamped': {
    hash: 'c5bdcc272438cab82807995987c48ef4745974649a6d141fc99790947e5994a2',
    unit: 79.5,
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
      // Device dimensions and every encoded byte match exactly. Math.pow's last
      // Float64 bit differs across V8/platform versions; 1e-10 CSS px is far
      // below the displacement bitmap's 8-bit quantization, without hiding drift.
      expect(out.W).toBe((g as Golden).W);
      expect(out.H).toBe((g as Golden).H);
      expect(out.unit).toBeCloseTo((g as Golden).unit, 10);
      // …and every RGBA byte of the map (the exact bitmap that becomes the PNG /
      // feDisplacementMap atlas).
      expect(hashBytes(out.data)).toBe((g as Golden).hash);
    });
  }
});
