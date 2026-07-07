/*
 * @labpics/ui-materials — the material MODE axis for LabUI surfaces.
 *
 * Ships two things:
 *   1. `./material.css` — the CSS/DOM mechanics of the `data-material`
 *      solid|glass|blur scope, built strictly ON TOP of the `--lab-*` contract
 *      (it consumes `--lab-bg-material-*` emissions, never invents colour).
 *   2. This module — the pure α-boundary guarantee math, exported so consumers
 *      and tests can prove a glass tier keeps its label legal across the
 *      unknown backdrop, or honestly flag it unguaranteed.
 *
 * The package owns MECHANICS (backdrop stack, degradations, the guarantee).
 * It owns NO colour: tint and label values come from @labpics/colors.
 *
 * Since ADR-0003 it also ships the refraction engine (`./engine/`) behind ONE
 * declarative entry: `mountMaterialRuntime()`. The engine itself (attach,
 * filters, caches) is package-internal — never part of this surface.
 */

export {
  type Rgba,
  type Rgb8,
  parseRgb,
  relativeLuminance,
  contrastRatio,
  compositeOver,
  compositeOverByte,
} from './luminance';

export { mountMaterialRuntime } from './engine/runtime';

export {
  type LadderCase,
  type LadderDecision,
  type GuaranteedDecision,
  type ScrimDecision,
  type ScrimFloor,
  type LadderOptions,
  type ImageRegionOptions,
  resolveOnSolid,
  resolveOnMaterial,
  resolveOnImageRegion,
  resolveOnBoundary,
  resolveOnTainted,
  computeScrimFloor,
  corridorFromPixels,
} from './legibility-ladder';

export {
  type MaterialMode,
  LIVE_BLUR_MODES,
  MATERIAL_FILL_FAMILY,
  isLiveBlur,
  canNest,
} from './background-policy';

export {
  type MaterialTier,
  type ThemeName,
  type TierFill,
  type LabelCandidate,
  type TierVerdict,
  type GuaranteeReport,
  type EvaluateOptions,
  type BackdropCorridor,
  MATERIAL_TIERS,
  WCAG_AA_NORMAL,
  WCAG_AA_LARGE,
  FULL_BACKDROP,
  evaluateTier,
  guaranteeReport,
  cornerCorridor,
  unionCorridor,
  fillKey,
  verdictKey,
} from './material-guarantee';
