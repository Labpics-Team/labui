import { DEFAULT_LIGHT_ANGLE_DEG, SHADOW_COLOR_ROLE } from './config.js';
import { ROLE_TO_SIZE } from './domain/alias.js';
import { DARK_ALPHA_MULTIPLIER_DEFAULT } from './domain/alpha-contract.js';
import { ELEVATION_SHAPES } from './domain/elevation.js';
import { SHADOW_SLOTS, SLOT_ALPHA } from './domain/layer.js';

/** Platform-neutral view of the same authored ladder used by CSS. Dimensions
 * are logical Figma pixels; blur is the CSS/Figma radius, not Gaussian sigma.
 */
export const shadowProfile = {
  version: 1,
  colorRole: SHADOW_COLOR_ROLE,
  lightAngle: DEFAULT_LIGHT_ANGLE_DEG,
  darkAlphaMultiplier: DARK_ALPHA_MULTIPLIER_DEFAULT,
  roles: ROLE_TO_SIZE,
  levels: Object.fromEntries(
    ELEVATION_SHAPES.map((level) => [
      level.name,
      SHADOW_SLOTS.map((slot) => ({
        slot,
        x: 0,
        y: level.slots[slot].offsetY,
        blur: level.slots[slot].blur,
        spread: 0,
        colorRole: SHADOW_COLOR_ROLE,
        opacity: SLOT_ALPHA[slot],
      })),
    ]),
  ),
} as const;
