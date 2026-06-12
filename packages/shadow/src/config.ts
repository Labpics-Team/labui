/**
 * The single source of truth for the shadow stack. One config drives the
 * generated CSS contract — no values are authored in the stylesheet by hand.
 */

/**
 * The default global light angle, in degrees from vertical. 35deg gives a
 * natural slightly-from-above-left key light (the offset reads as depth, not as
 * a hard side-light). This is the ONE angle for the whole system; surfaces and
 * elevation levels never override it — they inherit `--lab-light-angle`.
 */
export const DEFAULT_LIGHT_ANGLE_DEG = 35;

/**
 * The default shadow-colour fallback. Per the owner's decision the shadow is
 * tinted by the surface (read from the `--lab-*` core contract), NOT pure black.
 * When a surface provides no tint, the colour falls back to the theme's dark
 * neutral anchor — light theme: Figma Neutral 12 (#101012); dark theme: same
 * anchor (the owner's stated shadow colour Dark=101012). This is a documented
 * anchor, never an inline `#000`.
 */
export const SHADOW_COLOR_FALLBACK_LIGHT = '#101012';
export const SHADOW_COLOR_FALLBACK_DARK = '#101012';
