import { describe, expect, it } from 'vitest';
import { __computeDisplacementField } from '../src/engine/liquid-glass';
import {
  type CornerRadii,
  normalizeCornerRadii,
  resolveCornerRadii,
  roundedShapeGeometry,
  roundedShapeInside,
} from '../src/engine/rounded-shape';
import { boundaryReference, roundedBoundary } from './finite-boundary';

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

  it('resolves nested CSS math independently on both axes before overlap scaling', () => {
    const corner = (value: string) => resolveCornerRadii(200, 100, [value, '0px', '0px', '0px']);
    expect(corner('min(10%, 30px)')).toEqual([20, 10, 0, 0, 0, 0, 0, 0]);
    expect(corner('max(10%, 30px)')).toEqual([30, 30, 0, 0, 0, 0, 0, 0]);
    expect(corner('clamp(10px, 10%, 30px)')).toEqual([20, 10, 0, 0, 0, 0, 0, 0]);
    expect(corner('calc(min(10%, 30px) + 4px) max(5%, 12px)')).toEqual([24, 12, 0, 0, 0, 0, 0, 0]);
    expect(corner('calc((10% - 4px) * 2 / 4)')).toEqual([8, 3, 0, 0, 0, 0, 0, 0]);
    expect(corner('clamp(30px, 10%, 10px)')).toEqual([30, 30, 0, 0, 0, 0, 0, 0]);
    expect(resolveCornerRadii(30, 10, Array(4).fill('max(20%, 10px)'))).toBe(5);
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
        // These are finite sides: the top starts at rx, the left at ry.
        let reference = Math.min(
          Math.hypot(Math.max(0, rx - x), y),
          Math.hypot(x, Math.max(0, ry - y)),
          200 - x,
          150 - y,
        );
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

  it('finds the closest arc beyond its bounding rectangle and across all finite sides', () => {
    const normal = new Float64Array(2);
    const radii: CornerRadii = [60, 20, 0, 0, 0, 0, 0, 0];
    expect(roundedShapeGeometry(30, 25, 200, 150, radii, normal)).toBeCloseTo(21.824909, 5);
    expect(normal[0]).toBeGreaterThan(0);
    expect(normal[1]).toBeLessThan(1);
    for (const [w, h, raw] of [
      [200, 150, radii],
      [200, 150, [8, 70, 90, 12, 40, 45, 10, 30]],
      [100, 60, [100, 2, 0, 0, 0, 0, 0, 0]],
      [120, 1, [100, 0.001, 20, 0.5, 0, 0, 0, 0]],
      [40, 100, [1, 100, 30, 10, 10, 5, 0, 0]],
      [20, 10, [32, 7, 40, 20, 10, 10, 20, 20]],
      [120, 80, [0, 40, 20, 0, 0, 0, 10, 20]],
      [1, 1, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]],
    ] as const) {
      const used = normalizeCornerRadii(w, h, raw as CornerRadii);
      const boundary = roundedBoundary(w, h, used);
      for (const fx of [-0.05, 0.015, 0.15, 0.3, 0.49, 0.7, 0.98, 1.03])
        for (const fy of [-0.03, 0.04, 0.17, 0.41, 0.77, 0.99, 1.05]) {
          const x = w * fx;
          const y = h * fy;
          const expected = boundaryReference(boundary, x, y);
          const actual = roundedShapeGeometry(x, y, w, h, used, normal);
          expect(Math.abs(actual - expected.distance), `${w}×${h}, ${x},${y}`).toBeLessThan(4e-6);
          expect(Math.hypot(normal[0] ?? 0, normal[1] ?? 0)).toBeCloseTo(1, 9);
          // The normal must project back onto the same true finite boundary.
          const projected = boundaryReference(
            boundary,
            x - actual * (normal[0] ?? 0),
            y - actual * (normal[1] ?? 0),
          );
          expect(Math.abs(projected.distance)).toBeLessThan(4e-6);
        }
    }
  });

  it('keeps zero-area boxes outside the lens and returns finite boundary normals', () => {
    const normal = new Float64Array(2);
    for (const [w, h] of [
      [0, 0],
      [0, 20],
      [20, 0],
    ]) {
      if (w === undefined || h === undefined) throw new Error('Missing dimension');
      const radii = normalizeCornerRadii(w, h, [10, 20, 30, 40, 10, 20, 30, 40]);
      const distance = roundedShapeGeometry(0.5, 0.5, w, h, radii, normal);
      expect(distance).toBeLessThanOrEqual(0);
      expect(Number.isFinite(normal[0])).toBe(true);
      expect(Number.isFinite(normal[1])).toBe(true);
    }
  });

  it('returns the inward gradient even at a point exactly on an elliptical arc', () => {
    const normal = new Float64Array(2);
    const radii: CornerRadii = [60, 20, 0, 0, 0, 0, 0, 0];
    for (const angle of [0.21, 0.63, 1.05]) {
      const x = 60 * (1 - Math.cos(angle));
      const y = 20 * (1 - Math.sin(angle));
      const gx = Math.cos(angle) / 60;
      const gy = Math.sin(angle) / 20;
      const scale = Math.hypot(gx, gy);
      expect(Math.abs(roundedShapeGeometry(x, y, 200, 150, radii, normal))).toBeLessThan(1e-8);
      expect(normal[0]).toBeCloseTo(gx / scale, 7);
      expect(normal[1]).toBeCloseTo(gy / scale, 7);
    }
  });

  it('keeps the optimized symmetric map identical and refracts only inside each actual corner', () => {
    const symmetric = __computeDisplacementField(120, 80, 24, 18, 1);
    const bytes = symmetric.data.slice();
    const generic = __computeDisplacementField(120, 80, [24, 24, 24, 24, 24, 24, 24, 24], 18, 1);
    expect(generic.data).toEqual(bytes);
    // Cached normals use float32; their reconstruction-scale error remains
    // orders of magnitude below one displacement-map quantization step.
    expect(Math.abs(generic.unit - symmetric.unit)).toBeLessThan(1e-5);
    const asymmetric = __computeDisplacementField(120, 80, [0, 0, 24, 24, 16, 32, 0, 0], 18, 1);
    const at = (x: number, y: number) =>
      Array.from(asymmetric.data.slice((y * 120 + x) * 4, (y * 120 + x) * 4 + 2));
    expect(at(2, 2)).not.toEqual([128, 128]);
    expect(at(117, 2)).toEqual([128, 128]);
    expect(at(117, 77)).toEqual([128, 128]);
    expect(at(2, 77)).not.toEqual([128, 128]);
  });
});
