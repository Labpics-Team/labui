import { defaultConfig } from './default-config.js';
import type { TokensConfig, TokensConfigOverride } from './types.js';

/**
 * Merge a user override onto the default config.
 *
 * Shallow-per-section by design: a user who overrides `typography` replaces only
 * the fields they set, keeping the rest of the section's defaults. Records
 * (`steps`, `aliases`, `stepLabels`) are merged key-by-key so a user can add a
 * step without redeclaring the whole scale; arrays (`zIndex.levels`,
 * `lineHeightBands`) are replaced wholesale because their order is meaningful
 * and a partial merge would silently corrupt it.
 */
export function resolveConfig(override: TokensConfigOverride = {}): TokensConfig {
  return {
    spacing: {
      ...defaultConfig.spacing,
      ...override.spacing,
      steps: { ...defaultConfig.spacing.steps, ...override.spacing?.steps },
      aliases: { ...defaultConfig.spacing.aliases, ...override.spacing?.aliases },
    },
    radii: {
      ...defaultConfig.radii,
      ...override.radii,
      steps: { ...defaultConfig.radii.steps, ...override.radii?.steps },
      aliases: { ...defaultConfig.radii.aliases, ...override.radii?.aliases },
    },
    zIndex: {
      ...defaultConfig.zIndex,
      ...override.zIndex,
      // levels is order-sensitive — replace wholesale if provided.
      levels: override.zIndex?.levels ?? defaultConfig.zIndex.levels,
    },
    typography: {
      ...defaultConfig.typography,
      ...override.typography,
      stepLabels: { ...defaultConfig.typography.stepLabels, ...override.typography?.stepLabels },
      // bands are order-sensitive — replace wholesale if provided.
      lineHeightBands:
        override.typography?.lineHeightBands ?? defaultConfig.typography.lineHeightBands,
    },
  };
}
