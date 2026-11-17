import { describe, expect, it } from 'vitest';
import { materialContour } from '../src/engine/contour';
import { glassAtlasPlan } from '../src/engine/glass-atlas';
import { lensReach } from '../src/engine/glass-optics';
import { __computeDisplacementField } from '../src/engine/liquid-glass';
import type { RoundedShape } from '../src/engine/rounded-shape';

describe('retained glass rim', () => {
  it('preserves every bounded field byte across Sheet detents and asymmetric corners', () => {
    const shapes: RoundedShape[] = [
      [32, 32, 32, 32, 0, 0, 0, 0],
      [45, 32, 12, 38, 24, 16, 4, 29],
      32,
      materialContour(375, 270, 32, 0.6),
      materialContour(375, 270, [0, 0, 0, 0, 32, 32, 32, 32], 0.6),
    ];
    for (const corner of shapes)
      for (const dpr of [1, 2]) {
        const plan = glassAtlasPlan(375, 270, corner, 100, dpr);
        expect(plan).not.toBeNull();
        if (!plan) continue;
        const atlas = __computeDisplacementField(plan.side, plan.side, corner, 100, dpr);
        const source = atlas.data.slice();
        const P = plan.padding * dpr;
        const mid = Math.floor(atlas.W / 2);
        for (const h of [270, 422, 540, 776]) {
          const field = __computeDisplacementField(375, h, corner, 100, dpr);
          expect(atlas.unit).toBe(field.unit);
          const actual = new Uint8ClampedArray(field.data.length);
          for (let y = 0; y < field.H; y++)
            for (let x = 0; x < field.W; x++) {
              const sx = x < P ? x : x >= field.W - P ? atlas.W - field.W + x : mid;
              const sy = y < P ? y : y >= field.H - P ? atlas.H - field.H + y : mid;
              const to = (y * field.W + x) * 4;
              const from = (sy * atlas.W + sx) * 4;
              actual.set(source.subarray(from, from + 4), to);
            }
          expect(Buffer.compare(Buffer.from(actual), Buffer.from(field.data))).toBe(0);
        }
      }
  });

  it('retains bounded optics for Flex, overlapping corners and fractional pixel grids', () => {
    expect(glassAtlasPlan(375, 40, [32, 32, 32, 32, 0, 0, 0, 0], 100, 2)).toBeNull();
    expect(glassAtlasPlan(375, 270, 140, 100, 2)).toBeNull();
    expect(glassAtlasPlan(375, 422, 32, 100, 1.25)).toBeNull();
    const threshold = 2 * lensReach(100);
    expect(glassAtlasPlan(375, threshold - 0.001, 32, 100, 2)).toBeNull();
    expect(glassAtlasPlan(375, threshold, 32, 100, 2)).not.toBeNull();
  });
});
