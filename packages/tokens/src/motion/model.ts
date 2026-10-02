/**
 * Domain model for Lab UI motion roles.
 *
 * Physical motion primitives are owned by @labpics/motion and imported only at
 * build time. Lab UI owns the semantic binding layer: which primitive spring is
 * exposed, what fallback it uses, how entrance/exit/transition/emphasis map onto
 * primitives, and the reduced-motion policy.
 */

export type ProvenanceClass = 'b' | 'e';

export interface Provenance {
  readonly class: ProvenanceClass;
  readonly source: string;
}

/** Spring category: spatial motion may overshoot; effects motion may not. */
export type SpringCategory = 'spatial' | 'effects';

export type MotionSpringPrimitive = 'smooth' | 'expressive';
/**
 * A Lab UI binding to a physical spring primitive owned by @labpics/motion.
 * There are deliberately no duration, bounce, stiffness or damping fields here.
 */
export interface SpringSpec {
  readonly name: string;
  readonly primitive: MotionSpringPrimitive;
  readonly category: SpringCategory;
  readonly fallbackEasing: string;
  readonly description?: string;
}

/** A semantic UI role referencing physical primitive names. */
export interface SemanticSpec {
  readonly name: string;
  readonly duration: string;
  readonly easing: string;
  readonly spring?: string;
  readonly reduced: {
    readonly duration: string;
    readonly easing: 'linear';
  };
  readonly provenance: Provenance;
  readonly description?: string;
}

/** Lab UI owns bindings only; physical numeric tiers cannot be injected here. */
export interface MotionConfig {
  readonly springs: readonly SpringSpec[];
  readonly semantics: readonly SemanticSpec[];
}
