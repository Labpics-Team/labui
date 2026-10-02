/**
 * Internal build-time motion token pipeline.
 *
 * The package root exports only committed generated references. These helpers
 * remain available to package scripts and tests, not runtime consumers.
 */
export { buildMotion, motionVar } from './build.js';
export type {
  ResolvedDuration,
  ResolvedEasing,
  ResolvedMotion,
  ResolvedSemantic,
  ResolvedSpring,
} from './build.js';
export { defaultMotionConfig } from './config.js';
export {
  type GeneratedMotionArtifacts,
  generateMotion,
  generateMotionCss,
  generateMotionDtcg,
  generateMotionTs,
} from './generate/index.js';
export type {
  MotionConfig,
  MotionSpringPrimitive,
  Provenance,
  ProvenanceClass,
  SemanticSpec,
  SpringCategory,
  SpringSpec,
} from './model.js';
export {
  DURATION_NAMES,
  EASING_NAMES,
  SPRING_NAMES,
  type DurationPrimitiveName,
  type EasingPrimitiveName,
  type SpringPrimitiveName,
} from './primitives.js';
export {
  describeSpringPhysics,
  type SpringPhysics,
  springLinear,
  springPosition,
} from './spring.js';
