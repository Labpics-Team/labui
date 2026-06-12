/**
 * The four semantic shadow layers of the LabUI stack, named by the owner's
 * Figma FX/Shadow stack. A layered soft shadow is the sum of Gaussians of
 * growing width — the physically-correct approximation of a soft shadow (Tobias
 * Ahlin / Josh Comeau). Each layer is one `box-shadow` ply; an elevation level
 * stacks all four.
 *
 *   - Minor    — near, sharp contact ply (small distance/blur, highest alpha);
 *   - Ambient  — soft surrounding ply;
 *   - Penumbra — mid diffuse ply;
 *   - Major    — far, wide diffuse ply (largest distance/blur, lowest alpha).
 */
export const SHADOW_LAYERS = ['minor', 'ambient', 'penumbra', 'major'] as const;

export type ShadowLayerName = (typeof SHADOW_LAYERS)[number];

/**
 * The shape of one shadow ply, expressed as unitless multipliers against an
 * elevation's base distance. Keeping these as multipliers (not absolute px) is
 * what lets a single light-angle token and a single elevation depth drive the
 * whole stack — change the angle once, every ply re-derives.
 *
 * `distance` is the geometric throw of the ply along the light direction; the
 * generator splits it into x/y offsets using the global angle. `blur` and
 * `spread` are multipliers of the same base. `alpha` is NOT stored here: it is
 * read at runtime from the `--lab-shadow-alpha-*` contract so JND-calibrated
 * alphas from lab-colors can replace the Figma provisional values without
 * touching this geometry.
 */
export interface ShadowLayerShape {
  readonly name: ShadowLayerName;
  readonly distance: number;
  readonly blur: number;
  readonly spread: number;
}

/**
 * Layer geometry — the exponential growth of distance/blur across the four plies
 * (Josh Comeau: layers with exponentially growing offset/blur read as one soft
 * shadow). Minor hugs the element; Major is the far diffuse ply. These are the
 * GEOMETRY multipliers only — alpha lives in the runtime contract.
 *
 * Doubling progression (1 / 2 / 4 / 8) mirrors the reference stack in
 * foundations-research §B and the owner's Minor→Major progression.
 */
export const LAYER_SHAPES: readonly ShadowLayerShape[] = [
  { name: 'minor', distance: 0.5, blur: 1, spread: 0 },
  { name: 'ambient', distance: 1, blur: 2, spread: 0 },
  { name: 'penumbra', distance: 2, blur: 4, spread: 0 },
  { name: 'major', distance: 4, blur: 8, spread: 0 },
];
