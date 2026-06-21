import { resolveConfig } from '../config/merge.js';
import type { TokensConfig, TokensConfigOverride } from '../config/types.js';
import { buildTokens } from '../domain/build.js';
import { generateCss } from './css.js';
import { generateDtcg } from './dtcg.js';
import { generateTs } from './ts.js';

/** The three artifacts produced from one config — no divergence by construction. */
export interface GeneratedArtifacts {
  /** `:root { --lab-* }` stylesheet. */
  readonly css: string;
  /** Canonical DTCG document (JSON string). */
  readonly dtcg: string;
  /** Typed TS token module source. */
  readonly ts: string;
}

/**
 * Generate all artifacts from a config. Pure and idempotent: same config in,
 * byte-identical artifacts out. The single entry point the build script and
 * tests both use.
 */
export function generate(config: TokensConfig): GeneratedArtifacts {
  const tokens = buildTokens(config);
  return {
    css: generateCss(tokens),
    dtcg: generateDtcg(tokens),
    ts: generateTs(tokens),
  };
}

/** Convenience: resolve a (possibly partial) override and generate. */
export function generateFromOverride(override: TokensConfigOverride = {}): GeneratedArtifacts {
  return generate(resolveConfig(override));
}
