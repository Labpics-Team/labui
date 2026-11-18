import { describe, expect, it } from 'vitest';
import { contourGeometry, materialContour } from '../src/engine/contour';
import { sdRoundRect } from '../src/engine/lg-math';
import type { CornerRadii } from '../src/engine/rounded-shape';
import { boundaryReference, svgBoundary } from './finite-boundary';

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
    expect(contourGeometry(source, 80, 2, normal)).toBeCloseTo(2, 7);
    expect(Math.abs(normal[0] ?? 0)).toBeLessThan(1 / 1024);
    expect(normal[1]).toBeCloseTo(1, 7);
    const pill = materialContour(120, 80, 40, 0.6);
    expect(pill.smoothing).toBe(0);
    expect(pill.radii).toEqual(Array(8).fill(40));
    const sheet = materialContour(375, 40, [32, 32, 32, 32, 0, 0, 0, 0], 0.6);
    expect(sheet.smoothing).toBe(0.25);
    expect(sheet.corners[0]?.y).toBe(40);
  });

  it('matches the emitted SVG finite boundary outside corner rectangles and on narrow shapes', () => {
    const normal = new Float64Array(2);
    for (const [w, h, radii, smoothing] of [
      [200, 150, [60, 20, 0, 0, 0, 0, 0, 0], 0],
      [320, 200, [90, 30, 20, 70, 40, 40, 10, 15], 0.6],
      [40, 90, [3, 65, 30, 4, 10, 20, 0, 0], 0.7],
      [20, 10, [32, 7, 40, 20, 10, 10, 20, 20], 1],
      [100, 60, [20, 0, 0, 20, 0, 0, 30, 10], 1],
    ] as const) {
      const contour = materialContour(w, h, radii as CornerRadii, smoothing);
      const boundary = svgBoundary(contour.path);
      for (const fx of [-0.03, 0.01, 0.15, 0.3, 0.6, 0.95, 1.05])
        for (const fy of [-0.04, 0.025, 1 / 6, 0.4, 0.8, 0.98, 1.02]) {
          const x = w * fx;
          const y = h * fy;
          const expected = boundaryReference(boundary, x, y);
          const actual = contourGeometry(contour, x, y, normal);
          expect(Math.abs(actual - expected.distance), `${w}×${h}, ${x},${y}`).toBeLessThan(
            1 / 4096 + 3e-6,
          );
          expect(Math.hypot(normal[0] ?? 0, normal[1] ?? 0)).toBeCloseTo(1, 8);
          expect(
            Math.abs(
              boundaryReference(
                boundary,
                x - actual * (normal[0] ?? 0),
                y - actual * (normal[1] ?? 0),
              ).distance,
            ),
          ).toBeLessThan(1 / 4096 + 3e-6);
        }
    }
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
