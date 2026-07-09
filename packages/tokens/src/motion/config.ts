import type { MotionConfig } from './model.js';

/**
 * The default LabUI motion config — the single source of truth.
 *
 * Character: Apple-level restraint. The defaults do not shout — `standard`,
 * `decelerate` and `accelerate` never overshoot; `emphasized` is the ONE curve
 * that carries a single, restrained overshoot, reserved for the `emphasis`
 * role. No carousels.
 *
 * Provenance discipline (ADR-0002): every physical value is either (b) grounded
 * in the owner's research or (e) an honest design-choice. Each `source` field
 * names the research section the value comes from (for (b)) or the rationale
 * (for (e)). See docs/motion-tokens.md for the full provenance table.
 *
 * Research sections referenced below:
 *  - §1.1  Material 3 official duration + easing tokens
 *  - §1.2  Material 3 Expressive spring system (spatial/effects, web fallbacks)
 *  - §2    Fluent 2 duration + curve tokens
 *  - §3    Carbon duration + easing tokens
 *  - §6    spring parametrisation (duration+bounce, dampingRatio = 1 − bounce)
 *  - Stage 0 / Stage 2  recommendation: canonical (duration, bounce) + fallbacks
 */
export const defaultMotionConfig: MotionConfig = {
  // ── PHYSICAL: durations ────────────────────────────────────────────────────
  // Compact 5-step scale. Concrete ms are grounded on the convergent industrial
  // grids (M3 §1.1 50–1000ms, Fluent §2 50–500ms, Carbon §3 70–700ms): the
  // 100/200/300/500 spine is where all three agree.
  durations: [
    {
      name: 'instant',
      ms: 0,
      provenance: {
        class: 'e',
        source:
          'design-choice: explicit zero anchor (repo law — every scale defines its zero) and the reduced-motion snap target',
      },
      description: 'no animation — the zero anchor and reduced-motion snap',
    },
    {
      name: 'fast',
      ms: 100,
      provenance: {
        class: 'b',
        source: 'Fluent durationFaster = 100ms (§2); M3 short2 = 100ms (§1.1)',
      },
      description: 'micro-interactions — hover, small state changes',
    },
    {
      name: 'base',
      ms: 200,
      provenance: {
        class: 'b',
        source: 'Fluent durationNormal = 200ms (§2); M3 short4 = 200ms (§1.1)',
      },
      description: 'the default — most component transitions',
    },
    {
      name: 'slow',
      ms: 300,
      provenance: {
        class: 'b',
        source: 'M3 medium2 = 300ms (§1.1); Carbon moderate-02 = 240ms neighbour (§3)',
      },
      description: 'larger elements, more deliberate moves',
    },
    {
      name: 'slower',
      ms: 500,
      provenance: {
        class: 'b',
        source: 'M3 long2 = 500ms (§1.1); Fluent upper duration band ≈ 500ms (§2)',
      },
      description: 'full-screen / large surface transitions',
    },
  ],

  // ── PHYSICAL: easing curves ────────────────────────────────────────────────
  // Three restrained defaults grounded on M3's official easing tokens, plus the
  // single overshoot curve for emphasis.
  easings: [
    {
      name: 'standard',
      bezier: [0.2, 0, 0, 1],
      provenance: {
        class: 'b',
        source: 'M3 easing-standard official = cubic-bezier(0.2,0,0,1) (§1.1)',
      },
      description: 'general-purpose — both ends eased',
    },
    {
      name: 'decelerate',
      bezier: [0, 0, 0, 1],
      provenance: {
        class: 'b',
        source: 'M3 easing-standard-decelerate official = cubic-bezier(0,0,0,1) (§1.1)',
      },
      description: 'entrances — fast in, gentle settle',
    },
    {
      name: 'accelerate',
      bezier: [0.3, 0, 1, 1],
      provenance: {
        class: 'b',
        source: 'M3 easing-standard-accelerate official = cubic-bezier(0.3,0,1,1) (§1.1)',
      },
      description: 'exits — gentle start, quick out',
    },
    {
      name: 'emphasized',
      bezier: [0.38, 1.21, 0.22, 1],
      provenance: {
        class: 'b',
        source:
          'M3 Expressive Spatial default web-fallback = cubic-bezier(0.38,1.21,0.22,1) (§1.2). Caveat: secondary source (CodePen repro of the M3 spec) — verify against m3.material.io before a value bump. y1=1.21 is the single restrained overshoot.',
      },
      description: 'the one restrained overshoot — for emphasis only',
    },
  ],

  // ── PHYSICAL: springs ──────────────────────────────────────────────────────
  // Two springs — one per M3 category. `smooth` (effects, no overshoot) is the
  // physics-based, interruptible alternative to the cubic-bezier easings for
  // opacity/colour; `expressive` (spatial, gentle overshoot) backs the emphasis
  // role. Canonical (duration, bounce); the physical triple and the linear()
  // fallback are derived (see spring.ts).
  springs: [
    {
      name: 'smooth',
      category: 'effects',
      durationS: 0.35,
      bounce: 0,
      fallbackEasing: 'decelerate',
      provenanceBounce: {
        class: 'b',
        source:
          'bounce 0 = critical damping, no overshoot (§6; matches M3 effects dampingRatio = 1, §1.2)',
      },
      provenanceDuration: {
        class: 'e',
        source: 'design-choice: 0.35s, aligned to the base/slow duration band',
      },
      description: 'effects spring — opacity/colour, interruptible, no bounce',
    },
    {
      name: 'expressive',
      category: 'spatial',
      durationS: 0.5,
      bounce: 0.3,
      fallbackEasing: 'emphasized',
      provenanceBounce: {
        class: 'e',
        source:
          'design-choice: bounce 0.3 (dampingRatio 0.7) → ~4.6% overshoot, a restrained bounce. Category grounded on M3 Expressive spatial (damping < standard, §1.2); the (duration,bounce) model is grounded (§6 / Stage 0).',
      },
      provenanceDuration: {
        class: 'e',
        source: 'design-choice: 0.5s perceptual duration, aligned to the slower band',
      },
      description: 'spatial spring — the single restrained overshoot, for emphasis',
    },
  ],

  // ── SEMANTIC: entrance / exit / transition / emphasis ──────────────────────
  // Roles reference physical tokens by name (no duplicated values). Direction
  // pairings (decelerate→entrance, accelerate→exit) are grounded on M3 (§1.1);
  // the exit-faster-than-entrance duration is an (e) HIG/Material convention.
  semantics: [
    {
      name: 'entrance',
      duration: 'base',
      easing: 'decelerate',
      reduced: { duration: 'fast', easing: 'linear' },
      provenance: {
        class: 'b',
        source: 'M3: incoming elements use the decelerate easing (§1.1)',
      },
      description: 'element appears — decelerate, settles into place',
    },
    {
      name: 'exit',
      duration: 'fast',
      easing: 'accelerate',
      reduced: { duration: 'fast', easing: 'linear' },
      provenance: {
        class: 'b',
        source:
          'M3: outgoing elements use the accelerate easing (§1.1); exit faster than entrance is an (e) HIG/Material convention',
      },
      description: 'element leaves — accelerate, quicker than entrance',
    },
    {
      name: 'transition',
      duration: 'fast',
      easing: 'standard',
      reduced: { duration: 'instant', easing: 'linear' },
      provenance: {
        class: 'e',
        source:
          'design-choice: wiring task 125 retuned base->fast. The shipped culture converged on 120ms micro-feedback (74/74 live transition sites are hover/state changes, none used 200ms); fast = 100ms sits one frame from 120ms (sub-JND) and matches M3 short2/Fluent durationFaster. Easing grounded on M3 standard (§1.1).',
      },
      description: 'in-place state change / move — standard easing',
    },
    {
      name: 'emphasis',
      duration: 'slow',
      easing: 'emphasized',
      spring: 'expressive',
      reduced: { duration: 'instant', easing: 'linear' },
      provenance: {
        class: 'e',
        source:
          'design-choice: the one attention moment that overshoots. Easing grounded (§1.2); backing spring = expressive.',
      },
      description: 'attention moment — the restrained overshoot lives here',
    },
  ],
};
