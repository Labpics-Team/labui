import type { ElevationLevelShape } from './elevation.js';
import { alphaVar } from './elevation.js';
import { SHADOW_SLOTS, type ShadowSlotName } from './layer.js';

/**
 * The shadow colour custom property. Per the owner's verdict (2026-06-13) the
 * default shadow is NEUTRAL — the theme's dark anchor `#101012` (Figma N12, NOT
 * pure black: pure black dirties colour). `--lab-shadow-color` carries that
 * anchor; the theme block re-sets only its value, never the geometry.
 */
export const SHADOW_COLOR_VAR = '--lab-shadow-color';

/**
 * Per-surface shadow tint — STRICTLY OPT-IN and weak (owner verdict). A surface
 * may set this to its own hue; absent it, the shadow uses the neutral anchor.
 * Resolved INSIDE each ply (not frozen at :root) so it resolves at the consuming
 * element. Constrained by `--lab-shadow-tint-strength` so a tint can never
 * lighten the composite past the surface — on a dark theme the shadow stays a
 * shadow, never a glow.
 */
export const SURFACE_TINT_VAR = '--lab-surface-shadow-tint';

/**
 * How strongly an opt-in surface tint is mixed into the neutral anchor. Default
 * 0 = no tint (neutral anchor only). A surface opts in by raising this toward 1.
 * Kept low by design: the tint nudges hue, it does not replace the dark anchor,
 * which is what keeps the composite darker than the surface.
 */
export const TINT_STRENGTH_VAR = '--lab-shadow-tint-strength';

/**
 * The single global light-angle token. One light source for the whole system,
 * measured from vertical: 0deg = light straight overhead → shadow straight down,
 * offset-x = 0 (the owner's default, matching the verbatim ladder). Every level
 * derives its per-ply x/y from THIS token; there is never a per-level angle.
 */
export const LIGHT_ANGLE_VAR = '--lab-light-angle';

/**
 * The resolved shadow ink for one ply: the neutral anchor, optionally nudged
 * toward an opt-in surface tint by `--lab-shadow-tint-strength`, then mixed with
 * transparent at the slot's contract alpha. Because the base is always the dark
 * anchor and the tint only NUDGES it, the composite stays darker than the
 * surface — the owner's "shadow never lighter than the surface" constraint.
 */
function plyColor(slot: ShadowSlotName): string {
  const anchor = `var(${SHADOW_COLOR_VAR})`;
  const tint = `var(${SURFACE_TINT_VAR}, ${anchor})`;
  // Anchor nudged toward the opt-in tint by the (default 0) strength. At
  // strength 0 this is exactly the anchor — the neutral default.
  const ink = `color-mix(in srgb, ${anchor}, ${tint} calc(var(${TINT_STRENGTH_VAR}) * 100%))`;
  const alpha = `calc(var(${alphaVar(slot)}) * 100%)`;
  return `color-mix(in srgb, transparent, ${ink} ${alpha})`;
}

/**
 * Root font size the rem scale is derived against — the web-standard 1rem =
 * 16px anchor. Every ply geometry below is stored as the owner's verbatim
 * Figma px and converted to rem THROUGH this single constant, so the emitted
 * CSS scales with the user's root font size (zoom / OS text-size preference)
 * like the rest of the token system, instead of a frozen px literal.
 */
const REM_BASE_PX = 16;

/** Convert a Figma px value to a rem CSS length, e.g. `4` → `"0.25rem"`. */
function toRem(px: number): string {
  const value = Math.round((px / REM_BASE_PX) * 10000) / 10000;
  return `${value}rem`;
}

/**
 * Compose one ply as a CSS `box-shadow` value. The geometry is the owner's
 * verbatim Figma px (`blur`, `offsetY`), algorithmically converted to rem via
 * `toRem`; `offsetY` is the pure-vertical throw.
 *
 * - At the default vertical light (angle 0) we emit the LITERAL table form
 *   `0 {y}rem {blur}rem {color}` — so the generated CSS reproduces the opora
 *   table bit-for-bit (same rendered size at the default 16px root, and now
 *   scales with root font-size like every other dimension in the system).
 * - At any non-zero angle we emit the projection form, rotating the throw onto
 *   x/y via the one global token: x = y·sin(angle), y = y·cos(angle). One token
 *   rotates every ply of every level in lockstep.
 */
export function composePly(
  slot: ShadowSlotName,
  geo: { blur: number; offsetY: number },
  angleDeg: number,
): string {
  const color = plyColor(slot);
  if (angleDeg === 0) {
    // Verbatim ladder: vertical light, no horizontal offset.
    return `0 ${toRem(geo.offsetY)} ${toRem(geo.blur)} ${color}`;
  }
  const offsetX = `calc(${toRem(geo.offsetY)} * sin(var(${LIGHT_ANGLE_VAR})))`;
  const offsetY = `calc(${toRem(geo.offsetY)} * cos(var(${LIGHT_ANGLE_VAR})))`;
  return `${offsetX} ${offsetY} ${toRem(geo.blur)} ${color}`;
}

/** Compose the full four-ply `box-shadow` value for one elevation level. */
export function composeElevation(level: ElevationLevelShape, angleDeg: number): string {
  return SHADOW_SLOTS.map((slot) => composePly(slot, level.slots[slot], angleDeg)).join(',\n    ');
}
