/**
 * Spring physics: the canonical `(duration, bounce)` pair → the physical triple
 * → a CSS `linear()` sample.
 *
 * The canonical model is the human-perceptual `(duration, bounce)` pair
 * (SwiftUI `Spring(duration:bounce:)` / Motion.dev), chosen per the research's
 * Stage-0 recommendation because it is the one representation that is both
 * designer-legible and deterministically convertible to every platform. From
 * it we derive the physical triple with the `dampingRatio` (dimensionless,
 * `1.0` = critical damping) convention shared by Compose / iOS / SwiftUI:
 *
 *   dampingRatio ζ = 1 − bounce            (research Stage 0: bounce = 1 − ζ)
 *   mass m         = 1                      (canonical default)
 *   ω₀             = 2π / duration          (perceptual-duration convention)
 *   stiffness k    = ω₀² · m
 *   damping c      = 2 · ζ · √(k·m) = 2 · ζ · ω₀ · m
 *
 * A cubic-bezier can encode at most one overshoot; a real spring can ring. So
 * the faithful web fallback is CSS `linear()` — the spring sampled into a list
 * of points — exactly as Motion.dev's `spring()` does. That is what a fast web
 * engine should emit, and it is generated here (never hand-typed), so the
 * fallback can never drift from the parameters.
 */

/** Fixed canonical mass — the `(duration, bounce)` model assumes m = 1. */
const MASS = 1;

/** Default sample count for `linear()` — 24 segments → 25 evenly-spaced points. */
const DEFAULT_STEPS = 24;

export interface SpringPhysics {
  /** Perceptual duration in seconds (design knob). */
  readonly durationS: number;
  /** Overshoot in `[0, 1]`. */
  readonly bounce: number;
  /** Dimensionless damping ratio ζ = 1 − bounce (1.0 = critical damping). */
  readonly dampingRatio: number;
  /** Canonical mass (1). */
  readonly mass: number;
  /** Stiffness k = ω₀²·m. */
  readonly stiffness: number;
  /** Damping coefficient c = 2ζ·ω₀·m. */
  readonly damping: number;
  /** Undamped angular frequency ω₀ = 2π / duration. */
  readonly omega0: number;
}

/** Derive the physical triple from the canonical `(duration, bounce)` pair. */
export function resolveSpringPhysics(durationS: number, bounce: number): SpringPhysics {
  if (durationS <= 0) {
    throw new Error(`Spring duration must be positive, got ${durationS}`);
  }
  if (bounce < 0 || bounce > 1) {
    throw new Error(`Spring bounce must be in [0, 1], got ${bounce}`);
  }
  const dampingRatio = 1 - bounce;
  const omega0 = (2 * Math.PI) / durationS;
  const stiffness = omega0 * omega0 * MASS;
  const damping = 2 * dampingRatio * omega0 * MASS;
  return { durationS, bounce, dampingRatio, mass: MASS, stiffness, damping, omega0 };
}

/**
 * Unit step response of the spring at time `t` (seconds): starts at 0, rests at
 * 1, with zero initial velocity. Underdamped springs (ζ < 1) exceed 1 before
 * settling — that overshoot is the visible bounce.
 */
export function springPosition(p: SpringPhysics, t: number): number {
  if (t <= 0) {
    return 0;
  }
  const z = p.dampingRatio;
  const w0 = p.omega0;
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    const decay = Math.exp(-z * w0 * t);
    return 1 - decay * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  if (z === 1) {
    const decay = Math.exp(-w0 * t);
    return 1 - decay * (1 + w0 * t);
  }
  // Overdamped (ζ > 1) — unused by the current tokens but kept correct.
  const s = w0 * Math.sqrt(z * z - 1);
  const r1 = -z * w0 + s;
  const r2 = -z * w0 - s;
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

/**
 * Sample the spring into a CSS `linear()` easing over its perceptual duration.
 * `steps` segments → `steps + 1` evenly-spaced points; the first is pinned to
 * `0` and the last to the rest state `1`, so the animation begins and ends
 * exactly settled while any interior overshoot is preserved.
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

/** Round to 4 decimal places — enough for smooth playback, keeps the string compact. */
function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
