import { describe, expect, it } from 'vitest';
import { resolveSpringPhysics, springLinear, springPosition } from '../src/motion/spring.js';

/**
 * Spring physics locks. The `linear()` fallback is DERIVED from the canonical
 * (duration, bounce) pair — these tests pin the derivation so the fallback can
 * never silently diverge from the parameters.
 */

/** Parse the numeric points out of a `linear(a, b, c, ...)` string. */
function points(linear: string): number[] {
  const inner = linear.replace(/^linear\(/, '').replace(/\)$/, '');
  return inner.split(',').map((s) => Number(s.trim()));
}

describe('resolveSpringPhysics — (duration, bounce) → physical triple', () => {
  it('dampingRatio = 1 − bounce; critical damping at bounce 0', () => {
    expect(resolveSpringPhysics(0.5, 0).dampingRatio).toBe(1);
    expect(resolveSpringPhysics(0.5, 0.3).dampingRatio).toBeCloseTo(0.7, 10);
  });

  it('mass = 1, stiffness = ω₀², damping = 2ζω₀ (research Stage 0 convention)', () => {
    const p = resolveSpringPhysics(0.5, 0.3);
    const omega0 = (2 * Math.PI) / 0.5;
    expect(p.mass).toBe(1);
    expect(p.omega0).toBeCloseTo(omega0, 10);
    expect(p.stiffness).toBeCloseTo(omega0 * omega0, 6);
    expect(p.damping).toBeCloseTo(2 * 0.7 * omega0, 6);
  });

  it('rejects non-positive duration and out-of-range bounce', () => {
    expect(() => resolveSpringPhysics(0, 0.2)).toThrow();
    expect(() => resolveSpringPhysics(0.5, -0.1)).toThrow();
    expect(() => resolveSpringPhysics(0.5, 1.5)).toThrow();
  });
});

describe('springPosition — unit step response', () => {
  it('starts at 0 and settles toward 1', () => {
    const p = resolveSpringPhysics(0.4, 0.2);
    expect(springPosition(p, 0)).toBe(0);
    // Far past the duration the spring has rested at 1.
    expect(springPosition(p, 5)).toBeCloseTo(1, 4);
  });
});

describe('springLinear — generated CSS linear() fallback', () => {
  it('always begins at 0 and ends exactly at the rest state 1', () => {
    for (const bounce of [0, 0.15, 0.3]) {
      const pts = points(springLinear(resolveSpringPhysics(0.4, bounce)));
      expect(pts[0]).toBe(0);
      expect(pts[pts.length - 1]).toBe(1);
    }
  });

  it('a critically-damped spring (bounce 0) never overshoots — all points ≤ 1', () => {
    const pts = points(springLinear(resolveSpringPhysics(0.35, 0)));
    for (const v of pts) {
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('an underdamped spring (bounce > 0) overshoots once then returns to 1', () => {
    const pts = points(springLinear(resolveSpringPhysics(0.5, 0.3)));
    const peak = Math.max(...pts);
    // Overshoot present (proves the bounce is real)...
    expect(peak).toBeGreaterThan(1);
    // ...but restrained — a gentle bounce, not a cartoon (well under 15%).
    expect(peak).toBeLessThan(1.15);
    // ...and it settles: the last point is back at 1.
    expect(pts[pts.length - 1]).toBe(1);
  });

  it('is deterministic — same input, byte-identical output', () => {
    const a = springLinear(resolveSpringPhysics(0.5, 0.3));
    const b = springLinear(resolveSpringPhysics(0.5, 0.3));
    expect(a).toBe(b);
  });
});
