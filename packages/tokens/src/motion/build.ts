import type {
  MotionConfig,
  Provenance,
  SemanticSpec,
  SpringCategory,
  SpringSpec,
} from './model.js';
import {
  DURATION_NAMES,
  EASING_NAMES,
  durationPrimitive,
  easingPrimitive,
  springPrimitive,
  type DurationPrimitiveName,
  type EasingPrimitiveName,
} from './primitives.js';
import { describeSpringPhysics, type SpringPhysics, springLinear } from './spring.js';

/**
 * Resolve Lab UI semantic bindings over physical primitives owned by
 * @labpics/motion. The resolved intermediate feeds CSS, DTCG and TS generators.
 */

const PREFIX = 'lab';
const NS = 'motion';

export function motionVar(...segments: string[]): string {
  return '--' + PREFIX + '-' + NS + '-' + segments.join('-');
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
  readonly linear: string;
  readonly fallbackBezier: readonly [number, number, number, number];
  readonly fallbackEasingName: string;
  readonly cssVar: string;
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
  readonly durationRef: string;
  readonly easingRef: string;
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

export function buildMotion(config: MotionConfig): ResolvedMotion {
  const durations = DURATION_NAMES.map(resolveDuration);
  const easings = EASING_NAMES.map(resolveEasing);

  const durationNames = new Set(durations.map((d) => d.name));
  const easingNames = new Set(easings.map((e) => e.name));

  const springs = config.springs.map((s) => resolveSpring(s, easings));
  const springNames = new Set(springs.map((s) => s.name));

  const semantics = config.semantics.map((s) =>
    resolveSemantic(s, durationNames, easingNames, springNames),
  );

  return { durations, easings, springs, semantics };
}
function resolveDuration(name: DurationPrimitiveName): ResolvedDuration {
  const primitive = durationPrimitive(name);
  requireProvenance(primitive.provenance, 'duration "' + name + '"');
  if (!Number.isFinite(primitive.ms) || primitive.ms < 0) {
    throw new Error('Owned duration "' + name + '" is invalid: ' + primitive.ms);
  }
  return {
    name,
    ms: primitive.ms,
    cssVar: motionVar('duration', name),
    provenance: primitive.provenance,
    description: primitive.description,
  };
}

function resolveEasing(name: EasingPrimitiveName): ResolvedEasing {
  const primitive = easingPrimitive(name);
  requireProvenance(primitive.provenance, 'easing "' + name + '"');
  const [x1, y1, x2, y2] = primitive.bezier;
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new Error('Owned easing "' + name + '" has x control points outside [0,1]');
  }
  return {
    name,
    bezier: primitive.bezier,
    css: primitive.css,
    cssVar: motionVar('easing', name),
    provenance: primitive.provenance,
    description: primitive.description,
  };
}

function resolveSpring(
  spec: SpringSpec,
  easings: readonly ResolvedEasing[],
): ResolvedSpring {
  const primitive = springPrimitive(spec.primitive);
  const physics = describeSpringPhysics(primitive.params);
  const fallback = easings.find((e) => e.name === spec.fallbackEasing);
  if (!fallback) {
    throw new Error(
      'Spring "' + spec.name + '" references unknown fallback easing "' + spec.fallbackEasing + '"',
    );
  }
  if (spec.category === 'effects' && Math.abs(physics.bounce) > 1e-12) {
    throw new Error(
      'Spring "' + spec.name + '" is category "effects" but owner primitive overshoots',
    );
  }

  return {
    name: spec.name,
    category: spec.category,
    durationS: physics.durationS,
    durationMs: Math.round(physics.durationS * 1000),
    bounce: physics.bounce,
    physics,
    linear: springLinear(physics),
    fallbackBezier: fallback.bezier,
    fallbackEasingName: fallback.name,
    cssVar: motionVar('spring', spec.name),
    durationCssVar: motionVar('spring', spec.name, 'duration'),
    provenanceBounce: primitive.provenance,
    provenanceDuration: primitive.provenance,
    description: spec.description,
  };
}

function resolveSemantic(
  spec: SemanticSpec,
  durationNames: ReadonlySet<string>,
  easingNames: ReadonlySet<string>,
  springNames: ReadonlySet<string>,
): ResolvedSemantic {
  requireProvenance(spec.provenance, 'semantic "' + spec.name + '"');
  requireRef(durationNames, spec.duration, spec.name, 'duration');
  requireRef(easingNames, spec.easing, spec.name, 'easing');
  requireRef(durationNames, spec.reduced.duration, spec.name, 'reduced.duration');
  if (spec.spring !== undefined) {
    requireRef(springNames, spec.spring, spec.name, 'spring');
  }
  if (spec.reduced.easing !== 'linear') {
    throw new Error(
      'Semantic "' + spec.name + '" reduced easing must be linear',
    );
  }

  return {
    name: spec.name,
    durationName: spec.duration,
    easingName: spec.easing,
    springName: spec.spring,
    durationRef: 'var(' + motionVar('duration', spec.duration) + ')',
    easingRef: 'var(' + motionVar('easing', spec.easing) + ')',
    springRef: spec.spring ? 'var(' + motionVar('spring', spec.spring) + ')' : undefined,
    cssVars: {
      duration: motionVar(spec.name, 'duration'),
      easing: motionVar(spec.name, 'easing'),
      spring: spec.spring ? motionVar(spec.name, 'spring') : undefined,
    },
    reduced: {
      durationName: spec.reduced.duration,
      durationRef: 'var(' + motionVar('duration', spec.reduced.duration) + ')',
      easing: spec.reduced.easing,
    },
    provenance: spec.provenance,
    description: spec.description,
  };
}

function requireProvenance(provenance: Provenance, where: string): void {
  if (provenance.source.trim() === '') {
    if (provenance.class === 'b') {
      throw new Error('Provenance for ' + where + ' is class (b) but has no source — fake-(b) forbidden');
    }
    throw new Error('Provenance for ' + where + ' has an empty source');
  }
}

function requireRef(
  known: ReadonlySet<string>,
  ref: string,
  role: string,
  field: string,
): void {
  if (!known.has(ref)) {
    throw new Error(
      'Semantic "' + role + '" ' + field + ' references unknown token "' + ref + '"',
    );
  }
}
