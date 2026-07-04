/**
 * The single source of truth for the shadow stack. One config drives the
 * generated CSS contract — no values are authored in the stylesheet by hand.
 */

/**
 * The default global light angle, in degrees from vertical. 0 = light straight
 * overhead → shadow straight down, offset-x = 0. This is the owner's data
 * default (every offset.x = 0 in the Figma export). The angle is a CONFIG
 * OPTION, not a demo handle: at 0 the generated CSS reproduces the opora ladder
 * verbatim; a non-zero value rotates every ply via the one `--lab-light-angle`.
 */
export const DEFAULT_LIGHT_ANGLE_DEG = 0;

/**
 * The neutral shadow-colour anchor. Per the owner's verdict the default shadow
 * is neutral — the theme's dark anchor, Figma N12 `#101012` (NOT pure black,
 * which dirties colour). Light and dark themes share this anchor; a theme swap
 * changes the alpha multiplier, not the anchor hue.
 */
export const SHADOW_COLOR_FALLBACK_LIGHT = '#101012';
export const SHADOW_COLOR_FALLBACK_DARK = '#101012';

/**
 * Default per-surface tint strength = 0 → the shadow is fully neutral until a
 * surface opts in. Opt-in is weak by design (owner verdict): the tint nudges
 * hue, it never replaces the dark anchor, so the composite stays darker than the
 * surface.
 */
export const DEFAULT_TINT_STRENGTH = 0;

/**
 * Motion tokens for elevation transitions. Levels animate smoothly between each
 * other (owner verdict "переходы между уровнями плавные"): a surface that
 * changes elevation (hover/focus/state) eases its `box-shadow` rather than
 * snapping. Duration + easing are tokens so the whole system tunes in one place.
 */
export const SHADOW_TRANSITION_DURATION = '160ms';
export const SHADOW_TRANSITION_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
