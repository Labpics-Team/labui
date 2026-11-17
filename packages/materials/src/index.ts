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
export { materialProfile, materialRoles, materialBlendMode } from './profile';
export type { MaterialBlendMode } from './profile';
export { materialPaintOver, materialPaintTables, blendChannel } from './material-paints';
export type { MaterialPaints } from './material-paints';
export type { MaterialRoot } from './engine/mount';

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
  bandOverCorridor,
  worstContrastOverBand,
  fillKey,
  verdictKey,
} from './material-guarantee';
