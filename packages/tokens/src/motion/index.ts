/**
 * @labpics/ui-tokens — motion tier.
 *
 * A separate token domain from the dimension scales: DTCG `duration` /
 * `cubicBezier` primitives, a spring expressed through `$extensions`, and a
 * first-class reduced-motion contract. One typed config (`defaultMotionConfig`)
 * is the single source of truth; a pure generator turns it into three artifacts
 * with no divergence — `motion.css`, `motion.dtcg.json`, and the typed TS module
 * re-exported from the package root.
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
  DurationSpec,
  EasingSpec,
  MotionConfig,
  Provenance,
  ProvenanceClass,
  SemanticSpec,
  SpringCategory,
  SpringSpec,
} from './model.js';
export {
  resolveSpringPhysics,
  type SpringPhysics,
  springLinear,
  springPosition,
} from './spring.js';
