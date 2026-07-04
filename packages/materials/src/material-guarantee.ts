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

export interface EvaluateOptions {
  readonly floor?: number;
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

  const solid = compositeOver(fill.tint, fill.base);
  const solidLuminance = relativeLuminance(solid);
  const label = commitLabel(solidLuminance, labelCandidates);
  const labelLuminance = relativeLuminance(label.colour);

  // Bound the band in the browser's real paint space: the tint composited
  // per-channel in gamma-encoded sRGB over pure black (min) and pure white (max).
  // Monotonicity of luminance and of the composite makes these the TRUE extrema
  // over every backdrop — coloured ones too — so effLow ≤ effHigh by construction.
  const effLow = relativeLuminance(compositeOver(fill.tint, BLACK_BACKDROP));
  const effHigh = relativeLuminance(compositeOver(fill.tint, WHITE_BACKDROP));

  const contrastLow = contrastRatio(labelLuminance, effLow);
  const contrastHigh = contrastRatio(labelLuminance, effHigh);

  // The guarantee is the worst contrast across the WHOLE band, not just its ends.
  // If the label's own luminance lies strictly inside the band, some backdrop
  // drives the composite to exactly the label's luminance → 1:1 contrast, illegal,
  // even though both endpoints may pass. Outside the band the worst is the nearer
  // endpoint (whichever composite luminance sits closest to the label).
  const worstContrast =
    labelLuminance > effLow && labelLuminance < effHigh
      ? contrastRatio(labelLuminance, labelLuminance) // = 1: a backdrop matches the label exactly
      : Math.min(contrastLow, contrastHigh);

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
