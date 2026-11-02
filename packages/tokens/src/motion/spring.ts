/**
 * Lab UI spring serialization over the @labpics/motion physical owner.
 *
 * Lab UI does not implement spring physics. It only derives design-facing
 * metadata from a Motion SpringParams token and samples Motion's public solver
 * into the stable 25-point CSS linear() representation already shipped by the
 * design system.
 */
import { type SpringParams, spring as evaluateSpring } from '@labpics/motion/driver';

/** Default sample count for linear(): 24 segments to 25 evenly-spaced points. */
const DEFAULT_STEPS = 24;

export interface SpringPhysics extends SpringParams {
  /** Perceptual duration reconstructed from the owner's natural frequency. */
  readonly durationS: number;
  /** Design-facing bounce reconstructed from the owner's damping ratio. */
  readonly bounce: number;
  /** Dimensionless damping ratio. */
  readonly dampingRatio: number;
  /** Undamped angular frequency. */
  readonly omega0: number;
}
/**
 * Add presentation metadata to a physical spring owned by @labpics/motion.
 * This is an inverse representation transform, not a second spring model.
 */
export function describeSpringPhysics(params: SpringParams): SpringPhysics {
  // Public owner API performs its canonical validation.
  evaluateSpring(params, 0);

  const omega0 = Math.sqrt(params.stiffness / params.mass);
  const dampingRatio = params.damping / (2 * Math.sqrt(params.stiffness * params.mass));
  const rawBounce = 1 - dampingRatio;
  const bounce = Math.abs(rawBounce) < 1e-12 ? 0 : roundPair(rawBounce);
  const durationS = roundPair((2 * Math.PI) / omega0);

  return {
    ...params,
    durationS,
    bounce,
    dampingRatio,
    omega0,
  };
}
/** Unit-step position delegated to the @labpics/motion analytic solver. */
export function springPosition(params: SpringParams, t: number): number {
  if (t <= 0) return 0;
  return evaluateSpring(params, t).value;
}

/**
 * Serialize an owned spring into Lab UI's stable CSS linear() fallback.
 * Sampling density and decimal formatting are representation policy; physics
 * remains entirely in @labpics/motion.
 */
export function springLinear(p: SpringPhysics, steps: number = DEFAULT_STEPS): string {
  const points: number[] = [];
  for (let i = 0; i <= steps; i++) {
    if (i === steps) {
      points.push(1);
      break;
    }
    const t = (i / steps) * p.durationS;
    points.push(round(springPosition(p, t)));
  }
  return `linear(${points.join(', ')})`;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function roundPair(value: number): number {
  return Math.round(value * 1e12) / 1e12;
}
