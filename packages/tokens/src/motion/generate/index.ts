import { buildMotion } from '../build.js';
import type { MotionConfig } from '../model.js';
import { generateMotionCss } from './css.js';
import { generateMotionDtcg } from './dtcg.js';
import { generateMotionTs } from './ts.js';

/** The three motion artifacts produced from one config — no divergence by construction. */
export interface GeneratedMotionArtifacts {
  /** `:root { --lab-motion-* }` stylesheet + reduced-motion `@media` block. */
  readonly css: string;
  /** Canonical DTCG document (JSON string). */
  readonly dtcg: string;
  /** Typed TS motion token module source. */
  readonly ts: string;
}

/**
 * Generate all motion artifacts from a config. Pure and idempotent: same config
 * in, byte-identical artifacts out. The single entry point the build script and
 * tests both use.
 */
export function generateMotion(config: MotionConfig): GeneratedMotionArtifacts {
  const motion = buildMotion(config);
  return {
    css: generateMotionCss(motion),
    dtcg: generateMotionDtcg(motion),
    ts: generateMotionTs(motion),
  };
}

export { generateMotionCss, generateMotionDtcg, generateMotionTs };
