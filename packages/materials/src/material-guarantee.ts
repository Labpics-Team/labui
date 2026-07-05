/*
 * The α-boundary guarantee — the scientific core of the materials slice.
 *
 * A glass surface paints a translucent tint over an UNKNOWN live backdrop. The
 * backdrop's luminance is not knowable at author time, so the surface can only
 * promise a legible label if the label stays legal across the WHOLE range the
 * backdrop can take. We bound that range with the two extremes a backdrop can
 * reach — pure black (luminance 0) and pure white (luminance 1) — and require
 * the surface's committed label to clear its WCAG floor at BOTH.
 *
 * Effective-background luminance of the composite — bounded in the SAME space
 * the browser paints: straight-alpha compositing per-channel in gamma-encoded
 * sRGB (see {@link compositeOver}), then WCAG luminance of that composite. This
 * is byte-identical to lab-colors' own `composite_over_encoded` (proven by the
 * 12-pair Figma-neutral roundtrip in `crates/labcolors-core/src/alpha.rs`), so
 * the guarantee, the engine, and the screen all agree.
 *
 *     effLow  = L( tint  over  black )   (backdrop L_bd = 0)
 *     effHigh = L( tint  over  white )   (backdrop L_bd = 1)
 *
 * Luminance rises monotonically in every channel and the composite rises
 * monotonically in every backdrop channel, so BLACK and WHITE backdrops give the
 * TRUE minimum and maximum composite luminance — over every backdrop, coloured
 * ones included, not just greys. A dense tier (α→1) collapses the band onto the
 * tint and is easy to guarantee; a sheer tier (α→0) spreads it across the whole
 * axis and usually cannot hold one fixed label. That is the finding to surface.
 *
 * The honest verdict is the WORST contrast ANYWHERE in the reachable band
 * [effLow, effHigh] — not merely at its ends. Composite luminance sweeps that
 * interval continuously as the backdrop varies, so a committed label whose own
 * luminance lies INSIDE the band is driven to 1:1 contrast by some backdrop even
 * when both endpoints pass. `guaranteed` is therefore a REAL browser-AA promise
 * in gamma-encoded composite space, not a model artefact.
 *
 * This module is pure: it takes parsed colours in, returns verdicts out. The
 * test feeds it the values parsed straight from the generated contract so the
 * guarantee tracks the contract with no second copy of the numbers (DRY / no
 * drift — the same discipline the colours train uses for contract.css).
 */

import { type Rgba, compositeOver, contrastRatio, relativeLuminance } from './luminance';

/** The three material modes, exactly the `data-material` scope values. */
export type MaterialMode = 'solid' | 'glass' | 'blur';

/** The five material tiers, names lifted verbatim from the Figma Materials styles. */
export const MATERIAL_TIERS = ['base', 'muted', 'soft', 'subtle', 'elevated'] as const;
export type MaterialTier = (typeof MATERIAL_TIERS)[number];

export type ThemeName = 'light' | 'dark';

/** WCAG 2.1 AA contrast floors. */
export const WCAG_AA_NORMAL = 4.5;
export const WCAG_AA_LARGE = 3.0;

/**
 * A tier's two-layer fill from the contract: `tint` is the translucent `01`
 * layer (its alpha is the glass density), `base` is the opaque `02` layer that
 * backs the solid canon.
 */
export interface TierFill {
  readonly tint: Rgba;
  readonly base: Rgba;
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
  /** Luminance of the opaque solid canon (01 over 02). */
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
  const lumA = relativeLuminance(compositeOver(tint, corridor.min));
  const lumB = relativeLuminance(compositeOver(tint, corridor.max));
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

  const solid = compositeOver(fill.tint, fill.base);
  const solidLuminance = relativeLuminance(solid);
  const label = commitLabel(solidLuminance, labelCandidates);
  const labelLuminance = relativeLuminance(label.colour);

  // Bound the band in the browser's real paint space over the corridor's two
  // corner backdrops (default [black, white] = every backdrop). One shared math
  // with the ladder — see bandOverCorridor / worstContrastOverBand.
  const { effLow, effHigh } = bandOverCorridor(fill.tint, backdrop);

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
