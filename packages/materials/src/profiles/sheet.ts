/** Sheet's authored body is a paint stack, not the generic Base luminosity recipe.
 * The order is shared by browser and native projections. Roles remain in Colors,
 * dimensions/opacity in Tokens; no palette values belong to this profile. */
export const SHEET_BODY = [
  { kind: 'tint', role: '--lab-bg-material-elevated-01' },
  {
    kind: 'blend',
    role: '--lab-bg-material-elevated-02',
    mode: { light: 'color-dodge', dark: 'overlay' },
  },
  { kind: 'blur', radius: '--lab-size-sheet-body-blur' },
] as const;

export const SHEET_SOLID = '--lab-bg-grouped-secondary';

/** Figma's authored radius maps to Gaussian sigma. Supported by the direct
 * Light Half raster and the independent Button radius36 / exported sigma18.
 * Dark's resampled showcase is supporting evidence, not exact qualification. */
export const AUTHORED_RADIUS_TO_SIGMA = 0.5;
export const authoredBlurSigma = (radius: number): number => radius * AUTHORED_RADIUS_TO_SIGMA;

/** Source facts only: the compositor meaning of size/density is unresolved.
 * Do not turn this into generic acrylic grain or claim a qualified noise pass. */
export const SHEET_NOISE_SOURCE = {
  role: '--lab-fx-noise',
  bodyOpacity: '--lab-opacity-sheet-body-noise',
  ghostOpacity: '--lab-opacity-sheet-ghost-noise',
  size: 0.2,
  density: 1,
  type: 'monotone',
} as const;
