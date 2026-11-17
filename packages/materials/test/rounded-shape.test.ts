import { describe, expect, it } from 'vitest';
import { __computeDisplacementField } from '../src/engine/liquid-glass';
import {
  type CornerRadii,
  resolveCornerRadii,
  roundedShapeInside,
} from '../src/engine/rounded-shape';

describe('CSS lens shape', () => {
  it('normalizes all radii together, including percentages and elliptical pairs', () => {
    expect(resolveCornerRadii(96, 32, ['8px', '32px', '8px', '32px'])).toEqual([
      6.4, 6.4, 25.6, 25.6, 6.4, 6.4, 25.6, 25.6,
    ]);
    expect(resolveCornerRadii(200, 100, ['50%', '50%', '50%', '50%'])).toEqual([
      100, 50, 100, 50, 100, 50, 100, 50,
    ]);
    expect(resolveCornerRadii(200, 100, ['calc(10% + 4px) 12px', '0px', '0px', '0px'])).toEqual([
      24, 12, 0, 0, 0, 0, 0, 0,
    ]);
    expect(resolveCornerRadii(200, 100, ['32px', '32px', '32px', '32px'])).toBe(32);
    expect(resolveCornerRadii(0, 0, ['0px', '0px', '0px', '0px'])).toBe(0);
  });

  it('matches an independently sampled ellipse boundary, including an eccentric corner', () => {
    for (const [rx, ry] of [
      [60, 20],
      [8, 70],
      [85, 60],
    ]) {
      if (!rx || !ry) throw new Error('Missing radius');
      const radii: CornerRadii = [rx, ry, 0, 0, 0, 0, 0, 0];
      for (const [x, y] of [
        [rx * 0.7, ry * 0.4],
        [rx * 0.9, ry * 0.8],
        [rx * 0.4, ry * 0.8],
      ]) {
        if (x === undefined || y === undefined) throw new Error('Missing point');
        let reference = Math.min(x, y, 200 - x, 150 - y);
        for (let i = 0; i <= 16384; i++) {
          const theta = (i * Math.PI) / (2 * 16384);
          reference = Math.min(
            reference,
            Math.hypot(x - rx + rx * Math.cos(theta), y - ry + ry * Math.sin(theta)),
          );
        }
        expect(roundedShapeInside(x, y, 200, 150, radii)).toBeCloseTo(reference, 4);
      }
    }
  });

  it('keeps the optimized symmetric map identical and refracts only inside each actual corner', () => {
    const symmetric = __computeDisplacementField(120, 80, 24, 18, 1);
    const bytes = symmetric.data.slice();
    const generic = __computeDisplacementField(120, 80, [24, 24, 24, 24, 24, 24, 24, 24], 18, 1);
    expect(generic.data).toEqual(bytes);
    expect(generic.unit).toBeCloseTo(symmetric.unit, 12);
    const asymmetric = __computeDisplacementField(120, 80, [0, 0, 24, 24, 16, 32, 0, 0], 18, 1);
    const at = (x: number, y: number) =>
      Array.from(asymmetric.data.slice((y * 120 + x) * 4, (y * 120 + x) * 4 + 2));
    expect(at(2, 2)).not.toEqual([128, 128]);
    expect(at(117, 2)).toEqual([128, 128]);
    expect(at(117, 77)).toEqual([128, 128]);
    expect(at(2, 77)).not.toEqual([128, 128]);
  });
});
