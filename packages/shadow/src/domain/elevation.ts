import type { ShadowLayerName } from './layer.js';

/**
 * Semantic elevation levels — the role a surface plays in the depth hierarchy.
 * A component consumes a ROLE (`--lab-elevation-raised`), never the raw plies.
 * Each level is the same four-layer stack scaled by a single depth multiplier:
 * higher elevation = larger distance/blur, lower per-ply alpha (Josh Comeau:
 * elevation = offset + blur + opacity moving together).
 */
export const ELEVATION_LEVELS = ['resting', 'raised', 'overlay', 'modal'] as const;

export type ElevationLevelName = (typeof ELEVATION_LEVELS)[number];

/**
 * One elevation level: how far the stack is thrown (`depth`, the rem base the
 * layer multipliers scale) and how its per-ply alpha is scaled relative to the
 * `--lab-shadow-alpha-*` contract base (`alphaScale`). Raising a surface throws
 * the shadow further and softens it — the alpha falls as the spread grows so
 * the shadow stays believable instead of turning into a hard slab.
 */
export interface ElevationLevelShape {
  readonly name: ElevationLevelName;
  readonly depth: number;
  readonly alphaScale: number;
}

/**
 * The four elevation roles. `depth` (in rem) is the base distance the per-layer
 * multipliers scale; `alphaScale` damps the contract alpha as the surface rises.
 * resting = barely off the page; modal = floating well above everything.
 */
export const ELEVATION_SHAPES: readonly ElevationLevelShape[] = [
  { name: 'resting', depth: 0.125, alphaScale: 1 },
  { name: 'raised', depth: 0.25, alphaScale: 0.85 },
  { name: 'overlay', depth: 0.5, alphaScale: 0.7 },
  { name: 'modal', depth: 1, alphaScale: 0.55 },
];

/**
 * The runtime alpha-contract custom property for a layer, e.g.
 * `--lab-shadow-alpha-minor`. This is the integration seam with lab-colors:
 * today it carries the Figma provisional alphas (the stub default); when
 * lab-colors publishes JND-calibrated alphas they are written to the SAME names
 * and the stack re-derives with zero geometry changes.
 */
export function alphaVar(layer: ShadowLayerName): string {
  return `--lab-shadow-alpha-${layer}`;
}
