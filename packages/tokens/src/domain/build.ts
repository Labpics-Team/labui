import type { TokensConfig } from '../config/types.js';
import { buildRadii } from './radii.js';
import { buildSpacing } from './spacing.js';
import type { ResolvedAlias, ResolvedToken } from './token.js';
import { buildTypography } from './typography.js';
import { buildZIndex } from './zindex.js';

/**
 * The complete resolved token set — every scale turned into framework-free
 * {@link ResolvedToken}s. This is the single intermediate representation every
 * generator (CSS / TS / DTCG) renders from, guaranteeing no divergence.
 */
export interface ResolvedTokens {
  readonly spacing: readonly ResolvedToken[];
  readonly spacingAliases: readonly ResolvedAlias[];
  readonly radii: readonly ResolvedToken[];
  readonly radiiAliases: readonly ResolvedAlias[];
  readonly zIndex: readonly ResolvedToken[];
  readonly fontSizes: readonly ResolvedToken[];
  readonly lineHeights: readonly ResolvedToken[];
}

/** Resolve a config into the full token set (pure; no I/O). */
export function buildTokens(config: TokensConfig): ResolvedTokens {
  const spacing = buildSpacing(config.spacing);
  const radii = buildRadii(config.radii);
  const zIndex = buildZIndex(config.zIndex);
  const typography = buildTypography(config.typography);

  return {
    spacing: spacing.tokens,
    spacingAliases: spacing.aliases,
    radii: radii.tokens,
    radiiAliases: radii.aliases,
    zIndex,
    fontSizes: typography.fontSizes,
    lineHeights: typography.lineHeights,
  };
}
