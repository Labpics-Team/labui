import type { ElevationLevelShape } from './elevation.js';
import { alphaVar } from './elevation.js';
import type { ShadowLayerShape } from './layer.js';

/**
 * The shadow colour custom property. Per the owner's decision, the shadow is
 * NOT pure black — pure black "dirties"/washes out colour (Josh Comeau,
 * confirmed by research). The colour is the surface tint, read from the
 * `--lab-*` core contract. `--lab-shadow-color` carries that tint; its default
 * is the theme's dark anchor (NOT a hardcoded #000), set by the theme block.
 */
export const SHADOW_COLOR_VAR = '--lab-shadow-color';

/**
 * The per-surface shadow tint, resolved from the `--lab-*` core contract. When a
 * surface sets this (its own hue), its shadow takes that hue; when absent, the
 * shadow falls back to the theme anchor `--lab-shadow-color`. Read INSIDE each
 * ply (not frozen at :root) so it resolves at the consuming element — a surface
 * deeper in the tree tints only its own shadow.
 */
export const SURFACE_TINT_VAR = '--lab-surface-shadow-tint';

/**
 * The single global light-angle token. One light source for the whole system:
 * one angle, measured from vertical (0deg = light straight overhead → shadow
 * straight down, no horizontal offset). Every elevation level derives its
 * per-layer x/y offsets from THIS token — there is never a per-level angle.
 */
export const LIGHT_ANGLE_VAR = '--lab-light-angle';

/**
 * Compose one `box-shadow` ply as a CSS value string, deriving x/y offset from
 * the global light-angle token. The layer's geometric throw is
 * `depth * layer.distance` (rem); it is projected onto the page via the angle:
 *
 *   offset-x = throw * sin(angle)
 *   offset-y = throw * cos(angle)
 *
 * so a single `--lab-light-angle` rotates every ply of every level in lockstep.
 * The alpha is taken from the runtime `--lab-shadow-alpha-*` contract, scaled by
 * the elevation's `alphaScale`, and applied to the surface-tint shadow colour
 * via `color-mix` in srgb (transparent ← tint at the contract alpha).
 *
 * CSS `sin()`/`cos()` take an angle; `--lab-light-angle` is an `<angle>` (deg).
 */
export function composeLayer(level: ElevationLevelShape, layer: ShadowLayerShape): string {
  const throwRem = round(level.depth * layer.distance);
  const blurRem = round(level.depth * layer.blur);
  const spreadRem = round(level.depth * layer.spread);

  // Geometric projection of the throw onto x/y using the one global angle.
  const offsetX = `calc(${throwRem}rem * sin(var(${LIGHT_ANGLE_VAR})))`;
  const offsetY = `calc(${throwRem}rem * cos(var(${LIGHT_ANGLE_VAR})))`;

  // Effective alpha = contract alpha (stub: Figma; later: JND) × level damping.
  const alpha = `calc(var(${alphaVar(layer.name)}) * ${level.alphaScale})`;

  // Colour resolves at the consuming element: a per-surface tint if set, else
  // the theme anchor. Never raw black. Mixed with transparent at the alpha.
  const tint = `var(${SURFACE_TINT_VAR}, var(${SHADOW_COLOR_VAR}))`;
  const color = `color-mix(in srgb, transparent, ${tint} calc(${alpha} * 100%))`;

  const spread = spreadRem === 0 ? '' : ` ${spreadRem}rem`;
  return `${offsetX} ${offsetY} ${blurRem}rem${spread} ${color}`;
}

/** Compose the full four-ply `box-shadow` value for one elevation level. */
export function composeElevation(
  level: ElevationLevelShape,
  layers: readonly ShadowLayerShape[],
): string {
  return layers.map((layer) => composeLayer(level, layer)).join(',\n    ');
}

/**
 * Deterministic rounding to keep generated CSS stable across runs. Inputs are
 * always finite products of the static layer/elevation config; a non-finite
 * value means the config was corrupted, so fail loud rather than emit `NaNrem`.
 */
function round(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`shadow geometry produced a non-finite value: ${value}`);
  }
  return Math.round(value * 10000) / 10000;
}
