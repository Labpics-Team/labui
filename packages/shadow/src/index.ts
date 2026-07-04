/**
 * @labpics/ui-shadow — LabUI layered shadow stack.
 *
 * A pure, deterministic generator turns the owner's verbatim Figma ladder into
 * the `--lab-shadow-*` / `--lab-elevation-*` CSS contract. Five elevation SIZES
 * (XS/S/M/L/XL), each exactly four drop-shadow plies, with per-slot alphas fixed
 * across levels (.12/.04/.02/.01) and depth carried by geometry alone. The
 * default light is vertical (angle 0, offset-x 0); the anchor is neutral
 * `#101012` (never pure black) with an opt-in, weak surface tint. Semantic ROLES
 * (resting/raised/overlay/modal) are aliases onto sizes.
 *
 * Consumers read the generated `./shadow.css` and apply a size (`.lab-shadow-m`)
 * or a role (`.lab-elevation-raised`). This package owns the geometry only — it
 * never resolves colour or computes JND alphas (that is lab-colors' domain).
 */

export { generateShadowCss } from './generate-css.js';
export {
  DEFAULT_LIGHT_ANGLE_DEG,
  DEFAULT_TINT_STRENGTH,
  SHADOW_COLOR_FALLBACK_DARK,
  SHADOW_COLOR_FALLBACK_LIGHT,
  SHADOW_TRANSITION_DURATION,
  SHADOW_TRANSITION_EASING,
} from './config.js';
export {
  SHADOW_SLOTS,
  SLOT_ALPHA,
  SLOT_ALPHAS,
  type ShadowSlotName,
} from './domain/layer.js';
export {
  ELEVATION_LEVELS,
  ELEVATION_SHAPES,
  alphaVar,
  type ElevationLevelName,
  type ElevationLevelShape,
  type SlotGeometry,
} from './domain/elevation.js';
export {
  ELEVATION_ROLES,
  ROLE_TO_SIZE,
  type ElevationRoleName,
} from './domain/alias.js';
export {
  DARK_ALPHA_MULTIPLIER_DEFAULT,
  defaultAlpha,
  defaultAlphas,
  type ShadowTheme,
} from './domain/alpha-contract.js';
export {
  composeElevation,
  composePly,
  LIGHT_ANGLE_VAR,
  SHADOW_COLOR_VAR,
  SURFACE_TINT_VAR,
  TINT_STRENGTH_VAR,
} from './domain/box-shadow.js';

export const PACKAGE_NAME = '@labpics/ui-shadow';
