import { defaultConfig } from './default-config.js';
import type { TokensConfig, TokensConfigOverride } from './types.js';

/**
 * Merge a user override onto the default config.
 *
 * Shallow-per-section by design: a user who overrides `typography` replaces only
 * the fields they set, keeping the rest of the section's defaults. Records
 * (`steps`, `aliases`, `stepLabels`, `weights`) are merged key-by-key so a user
 * can add/retune one entry without redeclaring the whole scale; the order-
 * sensitive array `zIndex.levels` is replaced wholesale because a partial merge
 * would silently corrupt its meaning.
 */
export function resolveConfig(override: TokensConfigOverride = {}): TokensConfig {
  return {
    spacing: {
      ...defaultConfig.spacing,
      ...override.spacing,
      steps: { ...defaultConfig.spacing.steps, ...override.spacing?.steps },
      aliases: { ...defaultConfig.spacing.aliases, ...override.spacing?.aliases },
    },
    sizes: {
      ...defaultConfig.sizes,
      ...override.sizes,
      steps: { ...defaultConfig.sizes.steps, ...override.sizes?.steps },
      aliases: { ...defaultConfig.sizes.aliases, ...override.sizes?.aliases },
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
      // weights is an unordered named record — merge key-by-key so retuning one
      // role (e.g. semibold) does not delete the others (which the wholesale
      // spread of override.typography above would otherwise do).
      weights: { ...defaultConfig.typography.weights, ...override.typography?.weights },
      // fontFamily — фиксированная пара стеков, каждый order-sensitive внутри →
      // замена ЦЕЛИКОМ при оверрайде (как zIndex.levels), не частями.
      fontFamily: override.typography?.fontFamily ?? defaultConfig.typography.fontFamily,
      // fontFeatures — key-merge: клиент добавляет/ретюнит одну фичу, остальные
      // сохраняются (как steps/aliases/weights).
      fontFeatures: {
        ...defaultConfig.typography.fontFeatures,
        ...override.typography?.fontFeatures,
      },
    },
    borders: {
      ...defaultConfig.borders,
      ...override.borders,
      // widths is an unordered named record — merge key-by-key (retune one stroke
      // without dropping the others); focusRing merges field-by-field likewise.
      widths: { ...defaultConfig.borders.widths, ...override.borders?.widths },
      focusRing: { ...defaultConfig.borders.focusRing, ...override.borders?.focusRing },
    },
    states: {
      ...defaultConfig.states,
      ...override.states,
    },
  };
}
