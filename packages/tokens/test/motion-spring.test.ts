import { spring as evaluateSpring } from '@labpics/motion/driver';
import { spring as motionSpring, springFromDurationBounce } from '@labpics/motion/tokens';
import { describe, expect, it } from 'vitest';

import { describeSpringPhysics, springLinear, springPosition } from '../src/motion/spring.js';

function points(linear: string): number[] {
  const inner = linear.replace(/^linear\(/, '').replace(/\)$/, '');
  return inner.split(',').map((value) => Number(value.trim()));
}

describe('spring owner boundary', () => {
  it('reconstructs design-facing metadata without changing owner physics', () => {
    for (const name of ['smooth', 'expressive'] as const) {
      const owner = motionSpring[name];
      const described = describeSpringPhysics(owner);
      const roundTrip = springFromDurationBounce(described.durationS, described.bounce);

      expect(described.mass).toBe(owner.mass);
      expect(described.stiffness).toBe(owner.stiffness);
      expect(described.damping).toBe(owner.damping);
      expect(roundTrip.mass).toBeCloseTo(owner.mass, 12);
      expect(roundTrip.stiffness).toBeCloseTo(owner.stiffness, 10);
      expect(roundTrip.damping).toBeCloseTo(owner.damping, 10);
    }
  });

  it('delegates position solving to @labpics/motion', () => {
    const physics = describeSpringPhysics(motionSpring.expressive);
    for (const t of [0, 0.05, 0.1, 0.25, 0.5, 1]) {
      expect(springPosition(physics, t)).toBe(evaluateSpring(motionSpring.expressive, t).value);
    }
  });
});

describe('Lab UI CSS spring serialization', () => {
  it('begins at 0 and ends exactly at rest', () => {
    for (const name of ['smooth', 'expressive'] as const) {
      const values = points(springLinear(describeSpringPhysics(motionSpring[name])));
      expect(values[0]).toBe(0);
      expect(values[values.length - 1]).toBe(1);
    }
  });
  it('keeps effects smooth and expressive motion restrained', () => {
    const smooth = points(springLinear(describeSpringPhysics(motionSpring.smooth)));
    const expressive = points(springLinear(describeSpringPhysics(motionSpring.expressive)));

    expect(Math.max(...smooth)).toBeLessThanOrEqual(1);
    expect(Math.max(...expressive)).toBeGreaterThan(1);
    expect(Math.max(...expressive)).toBeLessThan(1.15);
  });

  it('is deterministic for the same owner primitive', () => {
    const physics = describeSpringPhysics(motionSpring.expressive);
    expect(springLinear(physics)).toBe(springLinear(physics));
  });
});
