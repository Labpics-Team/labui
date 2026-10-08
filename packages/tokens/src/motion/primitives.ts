/**
 * Build-time bridge to the physical motion owner.
 *
 * Lab UI selects a deliberately small primitive vocabulary, but never copies
 * its numeric values. @labpics/motion owns durations, easing coordinates,
 * spring parameters and the spring solver. This module translates that public
 * owner contract into the representation needed by the Lab UI token generator.
 */
import {
  duration as motionDuration,
  easing as motionEasing,
  spring as motionSpring,
} from '@labpics/motion/tokens';
import type { SpringParams } from '@labpics/motion/driver';

import type { Provenance } from './model.js';

export const DURATION_NAMES = ['instant', 'fast', 'base', 'slow', 'slower'] as const;
export type DurationPrimitiveName = (typeof DURATION_NAMES)[number];

export const EASING_NAMES = ['standard', 'decelerate', 'accelerate', 'emphasized'] as const;
export type EasingPrimitiveName = (typeof EASING_NAMES)[number];

export const SPRING_NAMES = ['smooth', 'expressive'] as const;
export type SpringPrimitiveName = (typeof SPRING_NAMES)[number];
const durationDescription: Record<DurationPrimitiveName, string> = {
  instant: 'no animation — the zero anchor and reduced-motion snap',
  fast: 'micro-interactions — hover, small state changes',
  base: 'the default — most component transitions',
  slow: 'larger elements, more deliberate moves',
  slower: 'full-screen / large surface transitions',
};

const easingDescription: Record<EasingPrimitiveName, string> = {
  standard: 'general-purpose — both ends eased',
  decelerate: 'entrances — fast in, gentle settle',
  accelerate: 'exits — gentle start, quick out',
  emphasized: 'the one restrained overshoot — for emphasis only',
};

export function physicalProvenance(token: string): Provenance {
  return {
    class: 'b',
    source: `physical primitive owned by @labpics/motion/tokens (${token}); Lab UI only binds semantic roles`,
  };
}
export function durationPrimitive(name: DurationPrimitiveName): {
  readonly ms: number;
  readonly provenance: Provenance;
  readonly description: string;
} {
  return {
    ms: motionDuration[name],
    provenance: physicalProvenance(`duration.${name}`),
    description: durationDescription[name],
  };
}

export function easingPrimitive(name: EasingPrimitiveName): {
  readonly bezier: readonly [number, number, number, number];
  readonly css: string;
  readonly provenance: Provenance;
  readonly description: string;
} {
  const css = motionEasing[name].css;
  return {
    bezier: parseCubicBezier(css),
    css,
    provenance: physicalProvenance(`easing.${name}`),
    description: easingDescription[name],
  };
}
export function springPrimitive(name: SpringPrimitiveName): {
  readonly params: SpringParams;
  readonly provenance: Provenance;
} {
  return {
    params: motionSpring[name],
    provenance: physicalProvenance(`spring.${name}`),
  };
}

function parseCubicBezier(css: string): readonly [number, number, number, number] {
  const match = /^cubic-bezier\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)$/.exec(css);
  if (!match) {
    throw new Error(`@labpics/motion easing is not cubic-bezier(): ${css}`);
  }
  const points = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])] as const;
  if (points.some((point) => !Number.isFinite(point))) {
    throw new Error(`@labpics/motion easing has invalid control points: ${css}`);
  }
  return points;
}
