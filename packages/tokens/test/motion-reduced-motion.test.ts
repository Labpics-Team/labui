import { describe, expect, it } from 'vitest';
import { buildMotion } from '../src/motion/build.js';
import { defaultMotionConfig } from '../src/motion/config.js';
import { generateMotion } from '../src/motion/generate/index.js';

/**
 * Reduced-motion completeness + semantic→physical parity locks.
 *
 * Reduced-motion is a first-class part of the contract: EVERY semantic role
 * must have an explicit remap, and no remap may carry overshoot. The parity
 * lock guarantees every semantic reference resolves to a real physical token.
 */

interface DtcgSemanticNode {
  $type: string;
  $value: { duration?: string; timingFunction?: string };
  $extensions?: {
    'com.labpics.motion'?: {
      reducedMotion?: { duration: string; timingFunction: number[] };
      spring?: string;
    };
  };
}

const motion = buildMotion(defaultMotionConfig);
const artifacts = generateMotion(defaultMotionConfig);
const doc = JSON.parse(artifacts.dtcg) as {
  motion: {
    duration: Record<string, unknown>;
    easing: Record<string, unknown>;
    spring: Record<string, unknown>;
    entrance: DtcgSemanticNode;
    exit: DtcgSemanticNode;
    transition: DtcgSemanticNode;
    emphasis: DtcgSemanticNode;
  };
};

const SEMANTIC_ROLES = ['entrance', 'exit', 'transition', 'emphasis'] as const;

describe('reduced-motion — CSS @media block', () => {
  it('emits a prefers-reduced-motion: reduce block', () => {
    expect(artifacts.css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('remaps EVERY semantic role inside the reduced block (duration + easing)', () => {
    const reducedBlock = artifacts.css.split('@media (prefers-reduced-motion: reduce)')[1];
    expect(reducedBlock).toBeDefined();
    for (const sem of motion.semantics) {
      expect(reducedBlock).toContain(`${sem.cssVars.duration}:`);
      expect(reducedBlock).toContain(`${sem.cssVars.easing}:`);
    }
  });

  it('every reduced-motion easing is linear — no overshoot survives', () => {
    const reducedBlock = artifacts.css.split('@media (prefers-reduced-motion: reduce)')[1];
    for (const sem of motion.semantics) {
      // The role's easing is redefined to the literal `linear`, never a curve.
      expect(reducedBlock).toContain(`${sem.cssVars.easing}: linear;`);
      expect(reducedBlock).not.toContain(
        `${sem.cssVars.easing}: var(--lab-motion-easing-emphasized)`,
      );
    }
  });

  it('a semantic spring collapses to linear under reduced-motion', () => {
    const reducedBlock = artifacts.css.split('@media (prefers-reduced-motion: reduce)')[1];
    for (const sem of motion.semantics) {
      if (sem.cssVars.spring) {
        expect(reducedBlock).toContain(`${sem.cssVars.spring}: linear;`);
      }
    }
  });
});

describe('reduced-motion — DTCG completeness', () => {
  it('every semantic node declares a reducedMotion mapping with a linear timing function', () => {
    for (const role of SEMANTIC_ROLES) {
      const node = doc.motion[role];
      const reduced = node.$extensions?.['com.labpics.motion']?.reducedMotion;
      expect(reduced, `role "${role}" missing reducedMotion`).toBeDefined();
      expect(reduced?.timingFunction).toEqual([0, 0, 1, 1]); // linear
      expect(reduced?.duration.startsWith('{motion.duration.')).toBe(true);
    }
  });
});

describe('semantic → physical parity — no dangling references', () => {
  const durationNames = new Set(Object.keys(doc.motion.duration));
  const easingNames = new Set(Object.keys(doc.motion.easing));
  const springNames = new Set(Object.keys(doc.motion.spring));

  /** Strip the DTCG alias braces: `{motion.duration.base}` → `base`. */
  function tail(ref: string): string {
    return ref.replace(/^\{motion\.[a-z]+\./, '').replace(/\}$/, '');
  }

  it('every semantic duration + easing + reduced + spring reference resolves', () => {
    for (const role of SEMANTIC_ROLES) {
      const node = doc.motion[role];
      expect(durationNames.has(tail(node.$value.duration ?? ''))).toBe(true);
      expect(easingNames.has(tail(node.$value.timingFunction ?? ''))).toBe(true);

      const ext = node.$extensions?.['com.labpics.motion'];
      expect(durationNames.has(tail(ext?.reducedMotion?.duration ?? ''))).toBe(true);
      if (ext?.spring) {
        expect(springNames.has(tail(ext.spring))).toBe(true);
      }
    }
  });

  it('the semantic tier duplicates NO physical value — it only references', () => {
    // A semantic $value.duration/timingFunction is always an alias string, never
    // an inline number/array — this is what keeps the two-tier split honest.
    for (const role of SEMANTIC_ROLES) {
      const node = doc.motion[role];
      expect(typeof node.$value.duration).toBe('string');
      expect(node.$value.duration?.startsWith('{motion.')).toBe(true);
      expect(typeof node.$value.timingFunction).toBe('string');
      expect(node.$value.timingFunction?.startsWith('{motion.')).toBe(true);
    }
  });
});
