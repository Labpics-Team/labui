import type { MotionConfig } from './model.js';

/**
 * Lab UI semantic motion contract.
 *
 * Numeric durations, bezier coordinates, spring parameters and spring solving
 * belong to @labpics/motion. This config contains only design-system choices:
 * which owner primitives are exposed and how semantic UI roles bind to them.
 */
export const defaultMotionConfig: MotionConfig = {
  springs: [
    {
      name: 'smooth',
      primitive: 'smooth',
      category: 'effects',
      fallbackEasing: 'decelerate',
      description: 'effects spring — opacity/colour, interruptible, no bounce',
    },
    {
      name: 'expressive',
      primitive: 'expressive',
      category: 'spatial',
      fallbackEasing: 'emphasized',
      description: 'spatial spring — the single restrained overshoot, for emphasis',
    },
  ],

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
