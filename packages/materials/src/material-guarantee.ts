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
 * Effective-background luminance of the composite (design ch6, §Контракт):
 *
 *     L_eff = α · L_tint + (1 − α) · L_bd,   L_bd ∈ [0, 1]
 *
 * → the reachable band is [α·L_tint , α·L_tint + (1−α)]. A dense tier (α→1)
 * collapses the band onto the tint and is easy to guarantee; a sheer tier (α→0)
 * spreads the band across the whole luminance axis and usually cannot hold one
 * fixed label at both ends. That is not a bug to hide — it is the finding the
 * design asks us to surface for the provisional Figma alphas.
 *
 * This module is pure: it takes parsed colours in, returns verdicts out. The
 * test feeds it the values parsed straight from the generated contract so the
 * guarantee tracks the contract with no second copy of the numbers (DRY / no
 * drift — the same discipline the colours train uses for contract.css).
 *
 * ── MODEL CAVEAT (escalated to the design / lab-colors science owner) ───────
 * The ch6 formula interpolates in LUMINANCE space. Real browser alpha
 * compositing happens per-channel in gamma-encoded sRGB, and lab-colors'
 * own alpha-derivation composites in LINEAR sRGB — three different spaces that
 * do not agree. The luminance-linear model is CONSERVATIVE for white labels on
 * dark surfaces (our safety-critical case: unguaranteed findings hold under
 * every model) but OPTIMISTIC for near-black labels at a dark backdrop. Concrete
 * case: `light/soft` is guaranteed here (~5.7:1 by this model) yet composites to
 * ~4.1:1 in real sRGB paint — below AA. So a `guaranteed` verdict means "legal
 * under the ch6 luminance-linear α-boundary model", NOT a hard physical AA
 * promise. The composite space must be reconciled with lab-colors' linear-sRGB
 * derivation BEFORE the provisional Figma alphas are frozen (README →
 * "Model caveat"). This module implements the ch6 formula faithfully by mandate;
 * it does not unilaterally pick the composite space.
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
  /** True iff the committed label clears the floor at BOTH backdrop boundaries. */
  readonly guaranteed: boolean;
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

  // L_tint is the luminance of the tint COLOUR (alpha is the mix weight, not part of the colour).
  const tintLuminance = relativeLuminance({ ...fill.tint, a: 1 });
  const alpha = fill.tint.a;
  const effLow = alpha * tintLuminance; // L_bd = 0
  const effHigh = alpha * tintLuminance + (1 - alpha); // L_bd = 1

  const contrastLow = contrastRatio(labelLuminance, effLow);
  const contrastHigh = contrastRatio(labelLuminance, effHigh);

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
    guaranteed: contrastLow >= floor && contrastHigh >= floor,
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
