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
 * PROVENANCE: the frozen hashes were captured from the PRE-rim-skip arithmetic
 * (the original ¼-symmetric double loop) via an offline harness that hashed a
 * faithful copy of those exact loops; the optimised engine was then proven to
 * reproduce them across the whole corpus. So a match here means the optimisation
 * changed nothing an eye could ever see.
 *
 * ⚠️ REGENERATING these constants is a DELIBERATE act — do it ONLY when the lens
 * LOOK is intentionally changed (a falloff/encoding/geometry change signed off by
 * the surface owner), never as a reflex to make a red test green. A surprise red
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
    hash: '1060c94260336865ae6018f8cdcf21ccde90848c4f70f8f9cdee6e66e0192cd7',
    unit: 7.049998376460712,
    W: 48,
    H: 48,
  },
  'small-square-dpr2': {
    hash: 'a7df5cb366a0b6b95053a6d45931ec7756438e094ae671f8fe3963ea4df6bb71',
    unit: 7.1249999989713855,
    W: 96,
    H: 96,
  },
  'small-radius0': {
    hash: 'c036fd8d99ec04fd458cd2915f8b5126911a2529c63d549a41f969f1ad999d71',
    unit: 7.049965160836309,
    W: 48,
    H: 48,
  },
  'small-radius-over-half': {
    hash: '23de2743539c930d111b1ff019e6832578c7044470ada4a451585e9023503a6a',
    unit: 7.049999983748691,
    W: 48,
    H: 48,
  },
  'medium-card': {
    hash: '1b1014042f4dc6818ca0438bba2cf0cbf30afb1b715c8d14eb4e423c0a51b9ba',
    unit: 47.84999983680274,
    W: 320,
    H: 200,
  },
  'medium-card-dpr2': {
    hash: 'e79765dc8474e1e706337fe891b8e0548baddbce814a74cd3e74c3065c0b455d',
    unit: 47.92499999331617,
    W: 640,
    H: 400,
  },
  'medium-radius0': {
    hash: '447298ab53ecf617c1145a2f002a76fff8d3aa4ad0bfc560f76dbae345aa3ff6',
    unit: 47.84996899136978,
    W: 320,
    H: 200,
  },
  'medium-circleish': {
    hash: 'c3197691b00445a06d68bfbecafeae00916132e61d3120dff556f47c5d040ca2',
    unit: 47.84999999999278,
    W: 320,
    H: 320,
  },
  'medium-deep-band': {
    hash: '94b4ca6da8af6c413eef95170691916b1930866f11184529d6290926f5b2f8d4',
    unit: 47.84999999936035,
    W: 320,
    H: 320,
  },
  'large-panel': {
    hash: '69b3af69f1076220f857dba21db5b1fe88b886835d29b33de4c594a415bd3ee5',
    unit: 153.44999947664326,
    W: 1024,
    H: 1024,
  },
  'large-panel-dpr2': {
    hash: '9820635c438175e549e5d79c9bba6ab1318ce9f9cfea44d7d102a08ef76616d4',
    unit: 153.52499997858874,
    W: 2048,
    H: 1536,
  },
  'large-radius0': {
    hash: '1ddb2d40b4dc7131328023e89294e07f30fadbd6b8bbdda6c812456e4095a54f',
    unit: 153.44990055853066,
    W: 1024,
    H: 1024,
  },
  'large-circle': {
    hash: 'bc0e9ab1228b330b885a625b79f1cdd233128d4dea0261cce0ba1cec7b6e77dd',
    unit: 153.44999999999865,
    W: 1024,
    H: 1024,
  },
  'large-thin-band': {
    hash: '8066e52946b9a181f6e2386828e3c4ee3c77d9e8370a7f62b018d12faa7938c8',
    unit: 153.44967891562598,
    W: 1024,
    H: 1024,
  },
  'wide-thin': {
    hash: '12b4045b94cef4458a68991ab1c680ed74929447c711df543b6635a4d5ee1eed',
    unit: 153.44999872372202,
    W: 1024,
    H: 64,
  },
  'tall-thin': {
    hash: 'eabb3e68e0685d07946fe78de2c2997caa09b66c7b867e1ef121cd1a979a1e72',
    unit: 153.44999872372202,
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
    unit: 0.14854186737926495,
    W: 2,
    H: 2,
  },
  'odd-dims': {
    hash: '81c64deb6336344e6d35261799b12b0765da6e517d5b7b2c04a187d1881834ff',
    unit: 47.999999946887485,
    W: 321,
    H: 201,
  },
  'dpr3-clamped': {
    hash: '2b101889d472be94a3543dcb269067a09abe80af9553bcc23e58562039c27b88',
    unit: 47.92499999331617,
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
