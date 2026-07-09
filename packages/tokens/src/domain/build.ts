import type { TokensConfig } from '../config/types.js';
import { buildBorders } from './borders.js';
import { buildOpacity } from './opacity.js';
import { buildRadii } from './radii.js';
import { buildSizes } from './sizes.js';
import { buildSpacing } from './spacing.js';
import { buildStates } from './states.js';
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
  readonly sizes: readonly ResolvedToken[];
  readonly sizesAliases: readonly ResolvedAlias[];
  readonly radii: readonly ResolvedToken[];
  readonly radiiAliases: readonly ResolvedAlias[];
  readonly zIndex: readonly ResolvedToken[];
  readonly fontSizes: readonly ResolvedToken[];
  readonly lineHeights: readonly ResolvedToken[];
  readonly fontWeights: readonly ResolvedToken[];
  readonly letterSpacings: readonly ResolvedToken[];
  readonly measures: readonly ResolvedToken[];
  /** Оболочка шрифта: семейство (--lab-font-family[-mono]) + фичи (--lab-font-feature-*). */
  readonly fonts: readonly ResolvedToken[];
  readonly strokes: readonly ResolvedToken[];
  readonly focusRing: readonly ResolvedToken[];
  /** Фракции стейт-оверлеев (#109): hover/pressed, проценты color-mix. */
  readonly states: readonly ResolvedToken[];
  /** Ось непрозрачности (задача 13): unitless доли + роли disabled/muted. */
  readonly opacity: readonly ResolvedToken[];
  readonly opacityAliases: readonly ResolvedAlias[];
}

/** Resolve a config into the full token set (pure; no I/O). */
export function buildTokens(config: TokensConfig): ResolvedTokens {
  const spacing = buildSpacing(config.spacing);
  const sizes = buildSizes(config.sizes);
  const radii = buildRadii(config.radii);
  const zIndex = buildZIndex(config.zIndex);
  const typography = buildTypography(config.typography);
  const borders = buildBorders(config.borders);
  const opacity = buildOpacity(config.opacity);

  return {
    spacing: spacing.tokens,
    spacingAliases: spacing.aliases,
    sizes: sizes.tokens,
    sizesAliases: sizes.aliases,
    radii: radii.tokens,
    radiiAliases: radii.aliases,
    zIndex,
    fontSizes: typography.fontSizes,
    lineHeights: typography.lineHeights,
    fontWeights: typography.fontWeights,
    letterSpacings: typography.letterSpacings,
    measures: typography.measures,
    fonts: typography.fonts,
    strokes: borders.strokes,
    focusRing: borders.focusRing,
    states: buildStates(config.states),
    opacity: opacity.tokens,
    opacityAliases: opacity.aliases,
  };
}
