/**
 * LabUI motion tokens — GENERATED. Do not edit by hand.
 *
 * Values are `var(--lab-motion-*)` references: the live CSS custom property
 * (and its `prefers-reduced-motion` remap) is the source of truth at paint
 * time. Import names give compile-time safety and autocomplete.
 */

export const motionDuration = {
  instant: 'var(--lab-motion-duration-instant)',
  fast: 'var(--lab-motion-duration-fast)',
  base: 'var(--lab-motion-duration-base)',
  slow: 'var(--lab-motion-duration-slow)',
  slower: 'var(--lab-motion-duration-slower)',
} as const;

export type MotionDurationToken = keyof typeof motionDuration;

export const motionEasing = {
  standard: 'var(--lab-motion-easing-standard)',
  decelerate: 'var(--lab-motion-easing-decelerate)',
  accelerate: 'var(--lab-motion-easing-accelerate)',
  emphasized: 'var(--lab-motion-easing-emphasized)',
} as const;

export type MotionEasingToken = keyof typeof motionEasing;

export const motionSpring = {
  toggle: 'var(--lab-motion-spring-toggle)',
  smooth: 'var(--lab-motion-spring-smooth)',
  expressive: 'var(--lab-motion-spring-expressive)',
} as const;

export type MotionSpringToken = keyof typeof motionSpring;

export const motionSpringDuration = {
  toggle: 'var(--lab-motion-spring-toggle-duration)',
  smooth: 'var(--lab-motion-spring-smooth-duration)',
  expressive: 'var(--lab-motion-spring-expressive-duration)',
} as const;

export type MotionSpringDurationToken = keyof typeof motionSpringDuration;

export const motionSemantic = {
  entrance: { duration: 'var(--lab-motion-entrance-duration)', easing: 'var(--lab-motion-entrance-easing)' },
  exit: { duration: 'var(--lab-motion-exit-duration)', easing: 'var(--lab-motion-exit-easing)' },
  transition: { duration: 'var(--lab-motion-transition-duration)', easing: 'var(--lab-motion-transition-easing)' },
  emphasis: { duration: 'var(--lab-motion-emphasis-duration)', easing: 'var(--lab-motion-emphasis-easing)', spring: 'var(--lab-motion-emphasis-spring)' },
} as const;

export type MotionSemanticToken = keyof typeof motionSemantic;

/** Калибровка тех же ролей для LabMotion runtime; не редактировать. */
export const motionSpringRuntime = {
  toggle: { response: 320, bounce: 0.22 },
  smooth: { response: 350, bounce: 0 },
  expressive: { response: 500, bounce: 0.3 },
} as const;

/** База относительной скорости runtime; CSS override сохраняет своё действие. */
export const motionSemanticRuntime = {
  entrance: { durationMs: 200 },
  exit: { durationMs: 100 },
  transition: { durationMs: 100 },
  emphasis: { durationMs: 300 },
} as const;
