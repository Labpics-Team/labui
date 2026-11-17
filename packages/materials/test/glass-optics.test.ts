import { describe, expect, it } from 'vitest';
import { lensBand, lensDisplacement } from '../src/engine/glass-optics';
import { __computeDisplacementField } from '../src/engine/liquid-glass';
import { type CornerRadii, roundedShapeGeometry } from '../src/engine/rounded-shape';

describe('shape-normal glass optics', () => {
  it('does not change the optical model when one corner differs by a subpixel amount', () => {
    for (const [w, h, r, depth] of [
      [200, 100, 20, 60],
      [120, 32, 8, 80],
    ]) {
      if (w === undefined || h === undefined || r === undefined || depth === undefined)
        throw new Error('Missing geometry');
      const symmetric = __computeDisplacementField(w, h, r, depth, 1);
      const bytes = symmetric.data.slice();
      const almost = __computeDisplacementField(w, h, [r + 0.0001, r, r, r, r, r, r, r], depth, 1);
      // Two independent quantization steps bound the difference. A fast/general
      // model split previously displaced unchanged corners by more than11px.
      const tolerance = (symmetric.unit + almost.unit) / 255;
      for (let i = 0; i < bytes.length; i += 4) {
        for (let channel = 0; channel < 2; channel++) {
          const a = ((bytes[i + channel] ?? 128) / 255 - 0.5) * symmetric.unit;
          const b = ((almost.data[i + channel] ?? 128) / 255 - 0.5) * almost.unit;
          expect(Math.abs(a - b)).toBeLessThanOrEqual(tolerance);
        }
      }
    }
  });

  it('keeps refraction continuous where an asymmetric ellipse crosses the box centre', () => {
    const field = __computeDisplacementField(201, 101, [160, 100, 0, 0, 0, 0, 0, 0], 60, 1);
    const vertical = Array.from({ length: 11 }, (_, i) => {
      const at = (20 * field.W + 95 + i) * 4 + 1;
      return ((field.data[at] ?? 128) / 255 - 0.5) * field.unit;
    });
    // x100.5 is w/2, but belongs to an active smooth elliptical lens. A global
    // centre-axis clamp previously collapsed this to zero and created a stripe.
    for (const value of vertical) expect(value).toBeGreaterThan(20);
    for (let i = 1; i < vertical.length; i++)
      expect(Math.abs((vertical[i] ?? 0) - (vertical[i - 1] ?? 0))).toBeLessThan(2);
  });

  it('bends straight edges perpendicular to the edge, independently of a panel aspect ratio', () => {
    for (const width of [200, 800]) {
      const field = __computeDisplacementField(width, 100, 20, 60, 1);
      for (const x of [45, 95, width - 46]) {
        const at = (10 * width + x) * 4;
        expect(field.data[at]).toBe(128); // top edge has no horizontal pull
        expect(field.data[at + 1]).toBeGreaterThan(128);
      }
      const middle = (50 * width + width / 2) * 4;
      expect(field.data[middle]).toBe(128);
      expect(field.data[middle + 1]).toBe(128);
    }
  });

  it('projects the ellipse normal onto its actual boundary', () => {
    const radii: CornerRadii = [60, 20, 0, 0, 0, 0, 0, 0];
    const normal = new Float64Array(2);
    for (const [x, y] of [
      [30, 12],
      [20, 15],
      [50, 5],
    ]) {
      if (x === undefined || y === undefined) throw new Error('Missing probe');
      const d = roundedShapeGeometry(x, y, 200, 100, radii, normal);
      const nx = normal[0] ?? 0;
      const ny = normal[1] ?? 0;
      expect(Math.hypot(nx, ny)).toBeCloseTo(1, 9);
      const bx = x - d * nx;
      const by = y - d * ny;
      expect(((60 - bx) / 60) ** 2 + ((20 - by) / 20) ** 2).toBeCloseTo(1, 7);
      // The ellipse gradient and the ray are parallel at the intersection.
      expect((nx * (20 - by)) / 400 - (ny * (60 - bx)) / 3600).toBeCloseTo(0, 7);
    }
  });

  it('retains a clear interior and constrains depth to the local control', () => {
    const band = lensBand(80, 256, 256);
    expect(lensDisplacement(-1, band)).toBe(0);
    expect(lensDisplacement(band, band)).toBe(0);
    expect(lensDisplacement(band * 2, band)).toBe(0);
    expect(lensDisplacement(15, band)).toBeGreaterThan(lensDisplacement(30, band));
    expect(lensDisplacement(30, band)).toBeGreaterThan(lensDisplacement(45, band));
    expect(lensBand(100, 200, 32)).toBe(16);
  });
});
