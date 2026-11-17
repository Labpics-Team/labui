import { describe, expect, it } from 'vitest';
import { contourGeometry, materialContour } from '../src/engine/contour';
import { sdRoundRect } from '../src/engine/lg-math';

describe('shared author contour', () => {
  it('reduces to the circular source and bounds its numerical distance', () => {
    const c = materialContour(170, 120, 32, 0);
    const normal = new Float64Array(2);
    for (let y = 0.25; y < 120; y += 3)
      for (let x = 0.25; x < 170; x += 3) {
        const distance = contourGeometry(c, x, y, normal);
        expect(Math.abs(distance + sdRoundRect(x, y, 170, 120, 32))).toBeLessThan(1 / 4096 + 1e-9);
        expect(Math.abs(Math.hypot(...normal) - 1)).toBeLessThan(1e-9);
      }
  });

  it('preserves the authored radius and smooth transition without overlapping corners', () => {
    const source = materialContour(170, 170, 50, 0.6);
    expect(source).toBe(materialContour(170, 170, 50, 0.6));
    expect(source.corners[0]?.x).toBe(80);
    const normal = new Float64Array(2);
    // Figma retains its original circular arc through the corner diagonal.
    const diagonal = 50 - 50 / Math.SQRT2;
    expect(Math.abs(contourGeometry(source, diagonal, diagonal, normal))).toBeLessThan(1 / 4096);
    expect(contourGeometry(source, 80, 2, normal)).toBe(2);
    expect([...normal]).toEqual([0, 1]);
    const pill = materialContour(120, 80, 40, 0.6);
    expect(pill.smoothing).toBe(0);
    expect(pill.radii).toEqual(Array(8).fill(40));
    const sheet = materialContour(375, 40, [32, 32, 32, 32, 0, 0, 0, 0], 0.6);
    expect(sheet.smoothing).toBe(0.25);
    expect(sheet.corners[0]?.y).toBe(40);
  });

  it('keeps symmetry and monotonic distance required by the retained quarter field', () => {
    const c = materialContour(171, 121, 30, 0.6);
    const left = new Float64Array(2);
    const right = new Float64Array(2);
    for (let y = 0.5; y < 60; y += 2) {
      let previous = Number.NEGATIVE_INFINITY;
      for (let x = 0.5; x <= 85.5; x += 2) {
        const distance = contourGeometry(c, x, y, left);
        expect(distance).toBeGreaterThanOrEqual(previous - 1e-10);
        previous = distance;
        expect(contourGeometry(c, 171 - x, y, right)).toBeCloseTo(distance, 10);
        expect(right[0]).toBeCloseTo(-(left[0] ?? 0), 10);
        expect(right[1]).toBeCloseTo(left[1] ?? 0, 10);
      }
    }
  });
});
