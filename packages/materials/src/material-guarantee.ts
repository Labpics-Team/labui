/** Contrast of the author paint stack over a supplied backdrop corridor.
 * The corridor is an input about the captured pixels, not a promise that a
 * screenshot, blur footprint or a live video has been measured. */
import { type Rgba, compositeOver, contrastRatio, relativeLuminance } from './luminance';
import { materialPaintOver } from './material-paints';
import { MATERIAL_TIERS, type MaterialTier, type ThemeName, materialBlendMode } from './profile';
export { MATERIAL_TIERS };
export type { MaterialTier, ThemeName };

/** The material axis: independent Solid, refractive Glass, frosted Acrylic. */
export type MaterialMode = 'solid' | 'glass' | 'acrylic';

/** WCAG 2.1 AA contrast floors. */
export const WCAG_AA_NORMAL = 4.5;
export const WCAG_AA_LARGE = 3.0;

/** Author tint and blend paints, plus the independent Solid fallback role.
 * `blend` may be omitted when evaluating a single normal paint. */
export interface TierFill {
  readonly tint: Rgba;
  readonly blend?: Rgba;
  readonly solid: Rgba;
}

/** A candidate label colour the surface could commit to (opaque foreground). */
export interface LabelCandidate {
  readonly name: string;
  readonly colour: Rgba;
}

/** The verdict for one tier under one theme. */
export interface TierVerdict {
  readonly tier: MaterialTier;
  readonly theme: ThemeName;
  /** Luminance of the independent opaque Solid role. */
  readonly solidLuminance: number;
  /** The label the surface commits to (highest-contrast candidate on the solid canon). */
  readonly label: string;
  /** Contrast of the committed label on the solid canon. */
  readonly solidContrast: number;
  /** L_eff at the black-backdrop boundary (L_bd = 0). */
  readonly effLow: number;
  /** L_eff at the white-backdrop boundary (L_bd = 1). */
  readonly effHigh: number;
  /** Committed-label contrast at each boundary. */
  readonly contrastLow: number;
  readonly contrastHigh: number;
  readonly floor: number;
  /** Worst committed-label contrast anywhere in the reachable band [effLow, effHigh]. */
  readonly worstContrast: number;
  /** True iff the committed label clears the floor across the WHOLE backdrop band. */
  readonly guaranteed: boolean;
}

/** The two backdrop extremes that bound the composite luminance band. */
const BLACK_BACKDROP: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const WHITE_BACKDROP: Rgba = { r: 255, g: 255, b: 255, a: 1 };

/*
 * ADR-0004 (Решение 2) — the corridor generalisation.
 *
 * The α-boundary guarantee is ONE class of math parametrised by the reachable
 * BACKDROP corridor. The material case (unknown live backdrop) is the full
 * corridor [black, white]; a KNOWN region (an image/gradient under a label) is
 * the corridor of the per-channel extremes actually reachable there.
 *
 * A `BackdropCorridor` is a per-channel axis-aligned box: `min` is the
 * per-channel-minimum backdrop colour, `max` the per-channel-maximum. Because the
 * composite `α·t + (1−α)·b` is affine and increasing in each backdrop channel and
 * WCAG luminance is increasing in each composite channel, `L(tint over ·)` attains
 * its extrema over the box exactly at `min` and `max` (the monotonicity closed by
 * `alpha-boundary.test.ts` "black/white are the TRUE luminance extrema"). Corner
 * backdrops therefore bound the reachable composite luminance from OUTSIDE the true
 * set, so the guarantee is conservative — it may demand a scrim where a tighter
 * analysis would not, but it never promises legibility it cannot prove.
 *
 * The chosen API is the smallest that stays verifiable (task freedom → less API,
 * more proof): the corridor is two backdrop COLOURS, not a luminance scalar pair.
 * Luminance scalars would lose the per-channel structure the monotonicity proof
 * needs (two backdrops of equal luminance but different chroma composite to
 * different luminance), so the honest bound is corner colours, not L-endpoints.
 */
export interface BackdropCorridor {
  /** Per-channel-minimum backdrop colour (darkest reachable corner). */
  readonly min: Rgba;
  /** Per-channel-maximum backdrop colour (brightest reachable corner). */
  readonly max: Rgba;
}

/** The material default: any live backdrop → the full [black, white] corridor. */
export const FULL_BACKDROP: BackdropCorridor = { min: BLACK_BACKDROP, max: WHITE_BACKDROP };

/**
 * The tightest axis-aligned corridor enclosing a set of backdrop colours: the
 * per-channel min/max corner. Over the whole colour cube this returns exactly
 * [black, white] (recovering the material default); over a sampled image region
 * it returns the box the region's pixels live in. Alpha is pinned to 1 (backdrops
 * are opaque — a corridor is a range of colours the surface paints over).
 */
export function cornerCorridor(backdrops: readonly Rgba[]): BackdropCorridor {
  const first = backdrops[0];
  if (first === undefined) {
    throw new Error('cornerCorridor: at least one backdrop colour is required');
  }
  let minR = first.r;
  let minG = first.g;
  let minB = first.b;
  let maxR = first.r;
  let maxG = first.g;
  let maxB = first.b;
  for (const bd of backdrops) {
    if (bd.r < minR) minR = bd.r;
    if (bd.g < minG) minG = bd.g;
    if (bd.b < minB) minB = bd.b;
    if (bd.r > maxR) maxR = bd.r;
    if (bd.g > maxG) maxG = bd.g;
    if (bd.b > maxB) maxB = bd.b;
  }
  return {
    min: { r: minR, g: minG, b: minB, a: 1 },
    max: { r: maxR, g: maxG, b: maxB, a: 1 },
  };
}

/**
 * The corridor a label crossing TWO backgrounds sees: the per-channel union of
 * both corridors (min-of-mins, max-of-maxes). A label straddling a boundary must
 * hold across the reachable colours of BOTH regions — this is exactly their box
 * hull (ADR-0004 Решение 4, "лейбл, пересекающий границу → коридор = объединение").
 */
export function unionCorridor(a: BackdropCorridor, b: BackdropCorridor): BackdropCorridor {
  return cornerCorridor([a.min, a.max, b.min, b.max]);
}

/** The one stable `theme/tier` key format — used for both fill lookup and reporting. */
export function fillKey(theme: ThemeName, tier: MaterialTier): string {
  return `${theme}/${tier}`;
}

/** A stable `theme/tier` key for reporting. */
export function verdictKey(v: Pick<TierVerdict, 'theme' | 'tier'>): string {
  return fillKey(v.theme, v.tier);
}

/**
 * Pick the label a surface commits to: the candidate with the highest contrast
 * against the surface's effective luminance. This is the polarity mechanism —
 * a dark surface commits to the light label, a light surface to the dark label
 * — expressed as "whichever candidate is most legible on the solid canon".
 */
function commitLabel(
  surfaceLuminance: number,
  candidates: readonly LabelCandidate[],
): LabelCandidate {
  let best = candidates[0];
  if (best === undefined) {
    throw new Error('commitLabel: at least one label candidate is required');
  }
  let bestContrast = contrastRatio(relativeLuminance(best.colour), surfaceLuminance);
  for (const candidate of candidates.slice(1)) {
    const contrast = contrastRatio(relativeLuminance(candidate.colour), surfaceLuminance);
    if (contrast > bestContrast) {
      best = candidate;
      bestContrast = contrast;
    }
  }
  return best;
}

/**
 * The reachable composite-luminance band of a tint over a backdrop corridor: the
 * tint composited over each corner, taken as [min, max]. The corners are the TRUE
 * extrema over the corridor box (monotonicity — see {@link BackdropCorridor}); the
 * min/max guard keeps effLow ≤ effHigh even for a mis-ordered corridor.
 *
 * Shared by {@link evaluateTier} and the legibility ladder so there is ONE band
 * math, not two copies that can drift.
 */
export function bandOverCorridor(
  tint: Rgba,
  corridor: BackdropCorridor,
): { readonly effLow: number; readonly effHigh: number } {
  // Normalise a hand-built {min, max} into a true per-channel box first: identity
  // for every valid corridor (so byte-identical for all internal callers), but two
  // arbitrary colours passed as {min, max} are not necessarily a box — without the
  // hull the band could come out NARROWER than the reachable set, the one failure
  // direction this module must never take (over-promise).
  const box = cornerCorridor([corridor.min, corridor.max]);
  const lumA = relativeLuminance(compositeOver(tint, box.min));
  const lumB = relativeLuminance(compositeOver(tint, box.max));
  return { effLow: Math.min(lumA, lumB), effHigh: Math.max(lumA, lumB) };
}

/**
 * The WORST committed-label contrast anywhere in the reachable band — the honest
 * verdict, not the endpoint-only one. If the label's own luminance lies strictly
 * INSIDE the band, some backdrop drives the composite to exactly the label's
 * luminance → 1:1 contrast (illegal) even when both ends pass. Outside the band the
 * worst is the nearer endpoint. Shared by {@link evaluateTier} and the ladder.
 */
export function worstContrastOverBand(
  labelLuminance: number,
  effLow: number,
  effHigh: number,
): number {
  if (labelLuminance > effLow && labelLuminance < effHigh) {
    return 1; // a backdrop matches the label exactly
  }
  return Math.min(contrastRatio(labelLuminance, effLow), contrastRatio(labelLuminance, effHigh));
}

export interface EvaluateOptions {
  readonly floor?: number;
  /**
   * The reachable backdrop corridor the surface paints over. Defaults to
   * {@link FULL_BACKDROP} = [black, white] — the material case (unknown live
   * backdrop). Narrow it to bound a KNOWN region (see `legibility-ladder.ts`).
   */
  readonly backdrop?: BackdropCorridor;
}

/**
 * Evaluate one tier under one theme: derive the solid canon, commit the
 * polarity label, then test that label across the α-boundary of the glass band.
 */
export function evaluateTier(
  tier: MaterialTier,
  theme: ThemeName,
  fill: TierFill,
  labelCandidates: readonly LabelCandidate[],
  options: EvaluateOptions = {},
): TierVerdict {
  const floor = options.floor ?? WCAG_AA_NORMAL;
  const backdrop = options.backdrop ?? FULL_BACKDROP;

  const solid = { ...fill.solid, a: 1 };
  const solidLuminance = relativeLuminance(solid);
  const label = commitLabel(solidLuminance, labelCandidates);
  const labelLuminance = relativeLuminance(label.colour);

  // Bound the band in the browser's real paint space over the corridor's two
  // corner backdrops (default [black, white] = every backdrop). One shared math
  // with the ladder — see bandOverCorridor / worstContrastOverBand.
  const box = cornerCorridor([backdrop.min, backdrop.max]);
  const paint = (colour: Rgba): Rgba =>
    fill.blend
      ? materialPaintOver(
          { normal: fill.tint, blend: fill.blend, blendMode: materialBlendMode(theme) },
          colour,
        )
      : compositeOver(fill.tint, colour);
  const effLow = relativeLuminance(paint(box.min));
  const effHigh = relativeLuminance(paint(box.max));

  const contrastLow = contrastRatio(labelLuminance, effLow);
  const contrastHigh = contrastRatio(labelLuminance, effHigh);
  const worstContrast = worstContrastOverBand(labelLuminance, effLow, effHigh);

  return {
    tier,
    theme,
    solidLuminance,
    label: label.name,
    solidContrast: contrastRatio(labelLuminance, solidLuminance),
    effLow,
    effHigh,
    contrastLow,
    contrastHigh,
    floor,
    worstContrast,
    guaranteed: worstContrast >= floor,
  };
}

export interface GuaranteeReport {
  readonly verdicts: readonly TierVerdict[];
  readonly guaranteed: readonly TierVerdict[];
  readonly unguaranteed: readonly TierVerdict[];
}

/** Evaluate every (theme, tier) pair and split them into guaranteed / unguaranteed. */
export function guaranteeReport(
  fills: ReadonlyMap<string, TierFill>,
  labelCandidatesByTheme: ReadonlyMap<ThemeName, readonly LabelCandidate[]>,
  options: EvaluateOptions = {},
): GuaranteeReport {
  const verdicts: TierVerdict[] = [];
  for (const theme of ['light', 'dark'] as const) {
    const candidates = labelCandidatesByTheme.get(theme);
    if (candidates === undefined) {
      throw new Error(`guaranteeReport: no label candidates for theme "${theme}"`);
    }
    for (const tier of MATERIAL_TIERS) {
      const fill = fills.get(fillKey(theme, tier));
      if (fill === undefined) {
        throw new Error(`guaranteeReport: missing fill for ${fillKey(theme, tier)}`);
      }
      verdicts.push(evaluateTier(tier, theme, fill, candidates, options));
    }
  }
  return {
    verdicts,
    guaranteed: verdicts.filter((v) => v.guaranteed),
    unguaranteed: verdicts.filter((v) => !v.guaranteed),
  };
}
