import { describe, expect, it } from 'vitest';
import { lensBand, lensDisplacement } from '../src/engine/glass-optics';
import { __computeDisplacementField } from '../src/engine/liquid-glass';
import { type CornerRadii, roundedShapeGeometry } from '../src/engine/rounded-shape';

describe('shape-normal glass optics', () => {
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
