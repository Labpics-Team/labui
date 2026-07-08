import type {
  DurationSpec,
  EasingSpec,
  MotionConfig,
  Provenance,
  SemanticSpec,
  SpringCategory,
  SpringSpec,
} from './model.js';
import { resolveSpringPhysics, type SpringPhysics, springLinear } from './spring.js';

/**
 * Resolve the motion config into the framework-free intermediate every
 * generator (CSS / DTCG / TS) renders from — guaranteeing no divergence, the
 * same contract the dimension pipeline holds.
 *
 * Resolution also VALIDATES the schema: every semantic reference must point at
 * a real physical token, and every (b) provenance must carry a source. A broken
 * reference or a fake-(b) fails the build loudly instead of emitting a silently
 * corrupt artifact.
 */

const PREFIX = 'lab';
const NS = 'motion';

/** `--lab-motion-<segments...>`. The one place motion var names are built. */
export function motionVar(...segments: string[]): string {
  return `--${PREFIX}-${NS}-${segments.join('-')}`;
}

export interface ResolvedDuration {
  readonly name: string;
  readonly ms: number;
  readonly cssVar: string;
  readonly provenance: Provenance;
  readonly description?: string;
}

export interface ResolvedEasing {
  readonly name: string;
  readonly bezier: readonly [number, number, number, number];
  /** `cubic-bezier(...)` CSS string. */
  readonly css: string;
  readonly cssVar: string;
  readonly provenance: Provenance;
  readonly description?: string;
}

export interface ResolvedSpring {
  readonly name: string;
  readonly category: SpringCategory;
  readonly durationS: number;
  readonly durationMs: number;
  readonly bounce: number;
  readonly physics: SpringPhysics;
  /** Generated CSS `linear(...)` sample — the faithful web fallback. */
  readonly linear: string;
  /** Cubic-bezier fallback (the referenced easing's points) for degraded tools. */
  readonly fallbackBezier: readonly [number, number, number, number];
  readonly fallbackEasingName: string;
  /** `--lab-motion-spring-<name>` (holds the `linear()`). */
  readonly cssVar: string;
  /** `--lab-motion-spring-<name>-duration` (holds `<ms>ms`, pairs with the linear()). */
  readonly durationCssVar: string;
  readonly provenanceBounce: Provenance;
  readonly provenanceDuration: Provenance;
  readonly description?: string;
}

export interface ResolvedSemantic {
  readonly name: string;
  readonly durationName: string;
  readonly easingName: string;
  readonly springName?: string;
  /** `var(--lab-motion-duration-<duration>)`. */
  readonly durationRef: string;
  /** `var(--lab-motion-easing-<easing>)`. */
  readonly easingRef: string;
  /** `var(--lab-motion-spring-<spring>)`, when the role has a spring. */
  readonly springRef?: string;
  readonly cssVars: {
    readonly duration: string;
    readonly easing: string;
    readonly spring?: string;
  };
  readonly reduced: {
    readonly durationName: string;
    readonly durationRef: string;
    readonly easing: 'linear';
  };
  readonly provenance: Provenance;
  readonly description?: string;
}

export interface ResolvedMotion {
  readonly durations: readonly ResolvedDuration[];
  readonly easings: readonly ResolvedEasing[];
  readonly springs: readonly ResolvedSpring[];
  readonly semantics: readonly ResolvedSemantic[];
}

/** Resolve a motion config into the full token set (pure; no I/O). */
export function buildMotion(config: MotionConfig): ResolvedMotion {
  const durations = config.durations.map(resolveDuration);
  const easings = config.easings.map(resolveEasing);

  const durationNames = new Set(durations.map((d) => d.name));
  const easingNames = new Set(easings.map((e) => e.name));

  const springs = config.springs.map((s) => resolveSpring(s, easings));
  const springNames = new Set(springs.map((s) => s.name));

  const semantics = config.semantics.map((s) =>
    resolveSemantic(s, durationNames, easingNames, springNames),
  );

  return { durations, easings, springs, semantics };
}

function resolveDuration(d: DurationSpec): ResolvedDuration {
  requireProvenance(d.provenance, `duration "${d.name}"`);
  if (!Number.isFinite(d.ms) || d.ms < 0) {
    throw new Error(`Duration "${d.name}" must be a non-negative number, got ${d.ms}`);
  }
  return {
    name: d.name,
    ms: d.ms,
    cssVar: motionVar('duration', d.name),
    provenance: d.provenance,
    description: d.description,
  };
}

function resolveEasing(e: EasingSpec): ResolvedEasing {
  requireProvenance(e.provenance, `easing "${e.name}"`);
  const [x1, y1, x2, y2] = e.bezier;
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    // DTCG 2025.10: cubicBezier x coordinates are restricted to [0, 1].
    throw new Error(
      `Easing "${e.name}" has an x control point outside [0,1] (${x1}, ${x2}) — invalid cubic-bezier`,
    );
  }
  return {
    name: e.name,
    bezier: e.bezier,
    css: `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`,
    cssVar: motionVar('easing', e.name),
    provenance: e.provenance,
    description: e.description,
  };
}

function resolveSpring(s: SpringSpec, easings: readonly ResolvedEasing[]): ResolvedSpring {
  requireProvenance(s.provenanceBounce, `spring "${s.name}" bounce`);
  requireProvenance(s.provenanceDuration, `spring "${s.name}" duration`);
  const fallback = easings.find((e) => e.name === s.fallbackEasing);
  if (!fallback) {
    throw new Error(`Spring "${s.name}" references unknown fallback easing "${s.fallbackEasing}"`);
  }
  if (s.category === 'effects' && s.bounce !== 0) {
    // Effects springs (opacity/colour) must be critically damped — no overshoot.
    throw new Error(
      `Spring "${s.name}" is category "effects" but has bounce ${s.bounce}; effects must be 0`,
    );
  }
  const physics = resolveSpringPhysics(s.durationS, s.bounce);
  return {
    name: s.name,
    category: s.category,
    durationS: s.durationS,
    durationMs: Math.round(s.durationS * 1000),
    bounce: s.bounce,
    physics,
    linear: springLinear(physics),
    fallbackBezier: fallback.bezier,
    fallbackEasingName: fallback.name,
    cssVar: motionVar('spring', s.name),
    durationCssVar: motionVar('spring', s.name, 'duration'),
    provenanceBounce: s.provenanceBounce,
    provenanceDuration: s.provenanceDuration,
    description: s.description,
  };
}

function resolveSemantic(
  s: SemanticSpec,
  durationNames: ReadonlySet<string>,
  easingNames: ReadonlySet<string>,
  springNames: ReadonlySet<string>,
): ResolvedSemantic {
  requireProvenance(s.provenance, `semantic "${s.name}"`);
  requireRef(durationNames, s.duration, s.name, 'duration');
  requireRef(easingNames, s.easing, s.name, 'easing');
  requireRef(durationNames, s.reduced.duration, s.name, 'reduced.duration');
  if (s.spring !== undefined) {
    requireRef(springNames, s.spring, s.name, 'spring');
  }
  if (s.reduced.easing !== 'linear') {
    // Reduced-motion must strip all overshoot/spring character.
    throw new Error(
      `Semantic "${s.name}" reduced easing must be 'linear', got "${s.reduced.easing}"`,
    );
  }
  return {
    name: s.name,
    durationName: s.duration,
    easingName: s.easing,
    springName: s.spring,
    durationRef: `var(${motionVar('duration', s.duration)})`,
    easingRef: `var(${motionVar('easing', s.easing)})`,
    springRef: s.spring ? `var(${motionVar('spring', s.spring)})` : undefined,
    cssVars: {
      duration: motionVar(s.name, 'duration'),
      easing: motionVar(s.name, 'easing'),
      spring: s.spring ? motionVar(s.name, 'spring') : undefined,
    },
    reduced: {
      durationName: s.reduced.duration,
      durationRef: `var(${motionVar('duration', s.reduced.duration)})`,
      easing: s.reduced.easing,
    },
    provenance: s.provenance,
    description: s.description,
  };
}

/** A (b) provenance with an empty source is a fake-(b) — reject it at build time. */
function requireProvenance(p: Provenance, where: string): void {
  if (p.class === 'b' && p.source.trim() === '') {
    throw new Error(`Provenance for ${where} is class (b) but has no source — fake-(b) forbidden`);
  }
  if (p.source.trim() === '') {
    throw new Error(`Provenance for ${where} has an empty source`);
  }
}

function requireRef(known: ReadonlySet<string>, ref: string, role: string, field: string): void {
  if (!known.has(ref)) {
    throw new Error(`Semantic "${role}" ${field} references unknown token "${ref}"`);
  }
}
