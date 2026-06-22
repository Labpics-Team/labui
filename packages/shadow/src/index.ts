/**
 * @labpics/ui-shadow — LabUI layered shadow stack.
 *
 * A pure, deterministic generator turns one config into the `--lab-shadow-*` /
 * `--lab-elevation-*` CSS contract. The stack is four semantic layers
 * (Minor/Ambient/Penumbra/Major) composed into four elevation roles
 * (resting/raised/overlay/modal), surface-tinted (never pure black), with one
 * global light angle and per-layer alphas behind the `--lab-shadow-alpha-*`
 * contract (stub = Figma provisional; final = lab-colors JND calibration).
 *
 * Consumers read the generated `./shadow.css` and apply `--lab-elevation-*`.
 * This package owns the geometry only — it never resolves colour or computes
 * JND alphas (that is lab-colors' domain).
 */

export { generateShadowCss } from './generate-css.js';
export {
  DEFAULT_LIGHT_ANGLE_DEG,
  SHADOW_COLOR_FALLBACK_DARK,
  SHADOW_COLOR_FALLBACK_LIGHT,
} from './config.js';
export {
  SHADOW_LAYERS,
  LAYER_SHAPES,
  type ShadowLayerName,
  type ShadowLayerShape,
} from './domain/layer.js';
export {
  ELEVATION_LEVELS,
  ELEVATION_SHAPES,
  alphaVar,
  type ElevationLevelName,
  type ElevationLevelShape,
} from './domain/elevation.js';
export {
  provisionalAlpha,
  provisionalAlphas,
  type ShadowTheme,
} from './domain/alpha-contract.js';
export {
  composeElevation,
  composeLayer,
  LIGHT_ANGLE_VAR,
  SHADOW_COLOR_VAR,
  SURFACE_TINT_VAR,
} from './domain/box-shadow.js';
