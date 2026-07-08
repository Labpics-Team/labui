/**
 * Domain model for LabUI motion tokens.
 *
 * Motion is a separate token domain from the dimension scales: its DTCG types
 * are `duration` and `cubicBezier` (plus a spring expressed through
 * `$extensions`), and it carries a first-class reduced-motion contract. It
 * therefore lives in its own module and emits its own artifacts
 * (`motion.css` / `motion.dtcg.json` / `motion.ts`) rather than extending the
 * dimension generator.
 *
 * Two tiers, exactly like the rest of the system:
 *  - PHYSICAL: durations, easing curves, springs — concrete values.
 *  - SEMANTIC: entrance / exit / transition / emphasis — references into the
 *    physical tier, never duplicated values.
 *
 * Every physical value carries a {@link Provenance}: it is either (b) grounded
 * in a cited source from the owner's research, or (e) an honest design-choice.
 * A fake-(b) — an invented number wearing a citation — is forbidden and is
 * blocked structurally by the schema tests.
 */

/**
 * Provenance class (ADR-0002 discipline, lab-colors constant taxonomy).
 * Motion has no (a) "measured" values — nothing here is physically measured;
 * curves are grounded and springs are derived — so only (b) and (e) apply.
 */
export type ProvenanceClass =
  | 'b' // grounded: value traced to a cited source from the owner's research
  | 'e'; // design-choice: an honest, declared decision (no external source claimed)

export interface Provenance {
  readonly class: ProvenanceClass;
  /**
   * For (b): where the value is grounded (research section / industry system).
   * For (e): the rationale for the choice. MUST be non-empty for (b) — a (b)
   * without a source is a fake-(b) and the schema test rejects it.
   */
  readonly source: string;
}

/** A duration primitive. DTCG `$type: "duration"`, value `{ value, unit: "ms" }`. */
export interface DurationSpec {
  readonly name: string;
  readonly ms: number;
  readonly provenance: Provenance;
  readonly description?: string;
}

/** An easing primitive. DTCG `$type: "cubicBezier"`, value `[x1, y1, x2, y2]`. */
export interface EasingSpec {
  readonly name: string;
  /**
   * Cubic-bezier control points `[x1, y1, x2, y2]`. Per DTCG 2025.10 the x
   * coordinates are restricted to `[0, 1]` but the y coordinates may be any
   * real number — a `y > 1` encodes overshoot (the single restrained bounce
   * used by `emphasized`).
   */
  readonly bezier: readonly [number, number, number, number];
  readonly provenance: Provenance;
  readonly description?: string;
}

/** Spring category, mirroring Material 3's spatial/effects split. */
export type SpringCategory =
  | 'spatial' // position / size / transform — overshoot allowed (dampingRatio < 1)
  | 'effects'; // opacity / colour — no overshoot (dampingRatio = 1)

/**
 * A spring primitive, expressed in the human-perceptual canonical pair
 * `(duration, bounce)` per the research's Stage-0 recommendation (SwiftUI /
 * Motion.dev model). The physical triple `(stiffness, dampingRatio, mass)` is
 * derived, and a CSS `linear()` sample is generated as the faithful web
 * fallback. Springs are not a standard DTCG type — they degrade to their
 * cubic-bezier fallback for tools that do not read the extension.
 */
export interface SpringSpec {
  readonly name: string;
  readonly category: SpringCategory;
  /** Perceptual duration in seconds — the design-time knob. */
  readonly durationS: number;
  /** Overshoot in `[0, 1]`; `0` = critically damped (no bounce), `dampingRatio = 1 - bounce`. */
  readonly bounce: number;
  /** Name of the easing token used as the cubic-bezier fallback for this spring. */
  readonly fallbackEasing: string;
  /** Provenance of the `bounce` value (the overshoot decision). */
  readonly provenanceBounce: Provenance;
  /** Provenance of the perceptual `duration` value. */
  readonly provenanceDuration: Provenance;
  readonly description?: string;
}

/**
 * A semantic role. Points at physical tokens by name; the generators emit
 * `var()` references so a `:root` override of a physical token reaches every
 * consumer without a rebuild. Each role additionally declares its
 * reduced-motion target — this is the first-class reduced-motion contract.
 */
export interface SemanticSpec {
  readonly name: string;
  /** Physical duration token this role uses at full motion. */
  readonly duration: string;
  /** Physical easing token this role uses at full motion. */
  readonly easing: string;
  /** Optional physical spring token (only `emphasis` uses one). */
  readonly spring?: string;
  /**
   * Reduced-motion target for `prefers-reduced-motion: reduce`. `easing` is
   * always `'linear'` (all overshoot/spring character removed); `duration` is a
   * physical duration token — `fast` for appearance/disappearance (a
   * vestibular-safe opacity crossfade) or `instant` for movement/emphasis
   * (a hard snap).
   */
  readonly reduced: {
    readonly duration: string;
    readonly easing: 'linear';
  };
  readonly provenance: Provenance;
  readonly description?: string;
}

/** The complete motion token config — the single source of truth. */
export interface MotionConfig {
  readonly durations: readonly DurationSpec[];
  readonly easings: readonly EasingSpec[];
  readonly springs: readonly SpringSpec[];
  readonly semantics: readonly SemanticSpec[];
}
