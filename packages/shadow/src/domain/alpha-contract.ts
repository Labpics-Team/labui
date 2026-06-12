import { SHADOW_LAYERS, type ShadowLayerName } from './layer.js';

/**
 * PROVISIONAL per-layer alphas, in real alpha units (0..1), sourced from the
 * owner's Figma FX/Shadow stack:
 *   - light: Minor @1 / Ambient @2 / Penumbra @4 / Major @12 (% → /100);
 *   - dark:  Minor @2 / Ambient @4 / Penumbra @12 / Major @20.
 *
 * These are the STUB values behind the `--lab-shadow-alpha-*` contract. They are
 * NOT a placeholder in the wrong units — they are honest Figma percentages
 * converted to alpha. The FINAL values come from lab-colors' JND calibration
 * (surface-jnd-contracts); when published they are written to the same contract
 * names and the stack re-derives untouched. Source is documented, not hardcoded
 * geometry.
 */
export type ShadowTheme = 'light' | 'dark';

type AlphaByLayer = Readonly<Record<ShadowLayerName, number>>;

const FIGMA_PROVISIONAL_ALPHAS: Readonly<Record<ShadowTheme, AlphaByLayer>> = {
  light: { minor: 0.01, ambient: 0.02, penumbra: 0.04, major: 0.12 },
  dark: { minor: 0.02, ambient: 0.04, penumbra: 0.12, major: 0.2 },
};

/**
 * The provisional alpha for a layer in a theme. The single read-point for the
 * Figma stub values so the source stays documented in exactly one place.
 */
export function provisionalAlpha(theme: ShadowTheme, layer: ShadowLayerName): number {
  return FIGMA_PROVISIONAL_ALPHAS[theme][layer];
}

/** Ordered list of provisional alphas for a theme, layer order = stack order. */
export function provisionalAlphas(theme: ShadowTheme): readonly number[] {
  const byLayer = FIGMA_PROVISIONAL_ALPHAS[theme];
  return SHADOW_LAYERS.map((layer) => byLayer[layer]);
}
