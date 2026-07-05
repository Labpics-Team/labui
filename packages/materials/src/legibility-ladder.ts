/*
 * Task #58 — the legibility LADDER for text on complex backgrounds (ADR-0004
 * Решение 2/3, generalised to arbitrary backdrops).
 *
 * Every case a label can land in resolves to exactly ONE of two states:
 *   - `guaranteed`     — the corridor worst-case contrast clears the WCAG floor,
 *                        proven, not sampled; or
 *   - `scrim-required` — it cannot, so the SYSTEM inserts an opaque scrim floor
 *                        under the label (it does not leave the text to luck).
 *
 * There is no third "put the text down and hope" path: `guaranteed` is only ever
 * returned when {@link worstContrastOverBand} over the reachable corridor clears
 * the floor. The five rungs:
 *
 *   (a) solid   — {@link resolveOnSolid}: the surface is one opaque colour, the
 *                 corridor collapses to a point, contrast is a direct solve.
 *   (b) material— {@link resolveOnMaterial}: a translucent tint over an UNKNOWN
 *                 live backdrop → the full [black, white] corridor (the α-boundary
 *                 guarantee, unchanged).
 *   (c) image   — {@link resolveOnImageRegion}: readable pixels under the label →
 *                 their per-channel corridor → the same solver → a forced scrim
 *                 floor if the target is unreachable.
 *   (d) tainted — {@link resolveOnTainted}: cross-origin / tainted pixels cannot
 *                 be read, so the backdrop is UNKNOWN → scrim is mandatory by
 *                 contract. The resolver STRUCTURALLY cannot return `guaranteed`
 *                 here — its return type is {@link ScrimDecision} (compiler-
 *                 enforced), pinned by a test on top.
 *   (e) boundary— {@link resolveOnBoundary}: a label straddling two regions must
 *                 hold over the UNION of their corridors.
 *
 * Pure domain (Clean Architecture): parsed colours / pixel bytes in, verdicts out.
 * The browser wiring — `ctx.getImageData(rect)` in a try/catch, a `SecurityError`
 * meaning tainted → {@link resolveOnTainted} — is a thin adapter the consumer owns;
 * this module never imports the DOM, so it stays exhaustively unit-testable.
 */

import { type Rgba, compositeOver, contrastRatio, relativeLuminance } from './luminance';
import {
  type BackdropCorridor,
  FULL_BACKDROP,
  WCAG_AA_NORMAL,
  bandOverCorridor,
  cornerCorridor,
  unionCorridor,
  worstContrastOverBand,
} from './material-guarantee';

/** Which rung of the ladder produced a decision. */
export type LadderCase = 'solid' | 'material' | 'image' | 'tainted' | 'boundary';

/** The opaque scrim floor the system inserts under a label it cannot otherwise guarantee. */
export interface ScrimFloor {
  /** The opaque scrim colour (a guaranteed surface — the polarity extreme by default). */
  readonly colour: Rgba;
  /** The MINIMAL scrim alpha over the residual corridor that restores the floor, in (0, 1]. */
  readonly alpha: number;
}

export interface GuaranteedDecision {
  readonly outcome: 'guaranteed';
  readonly case: LadderCase;
  /** The proven reachable composite-luminance band under the label. */
  readonly effLow: number;
  readonly effHigh: number;
  readonly worstContrast: number;
  readonly floor: number;
}

export interface ScrimDecision {
  readonly outcome: 'scrim-required';
  readonly case: LadderCase;
  readonly reason: string;
  readonly floor: number;
  /**
   * The scrim floor to paint under the label. `null` ONLY if even a fully-opaque
   * scrim of the chosen colour cannot clear the floor (the caller must pick a
   * different guaranteed surface colour); it is never null for the default
   * polarity scrim, which by construction reaches AA at α=1.
   */
  readonly scrim: ScrimFloor | null;
}

export type LadderDecision = GuaranteedDecision | ScrimDecision;

/** A fully-transparent tint: composited over any backdrop it IS that backdrop.
 * Models "the label sits directly on the surface" (no material layer). */
const TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 };

/** The default scrim colour: whichever corridor extreme (opaque black / white,
 * the single-source {@link FULL_BACKDROP} corners) contrasts MORE with the label,
 * so the scrim is a guaranteed surface reaching AA at full opacity. */
function polarityScrim(label: Rgba): Rgba {
  const l = relativeLuminance(label);
  const cDark = contrastRatio(l, relativeLuminance(FULL_BACKDROP.min));
  const cLight = contrastRatio(l, relativeLuminance(FULL_BACKDROP.max));
  return cDark >= cLight ? FULL_BACKDROP.min : FULL_BACKDROP.max;
}

/** The opaque corridor a label sees after a tint: the tint composited over each
 * corner. For a transparent tint this is the backdrop corridor unchanged. */
function residualCorridor(tint: Rgba, corridor: BackdropCorridor): BackdropCorridor {
  return {
    min: compositeOver(tint, corridor.min),
    max: compositeOver(tint, corridor.max),
  };
}

/**
 * The MINIMAL scrim alpha that restores the floor. A scrim of `scrimColour` at
 * alpha `s` painted over `corridor` yields the residual band
 * `bandOverCorridor(scrimColour@s, corridor)`; as `s → 1` the band collapses onto
 * `L(scrimColour)`. With `scrimColour` chosen far from the label (the polarity
 * extreme) the worst contrast rises monotonically in `s`, so a bisection finds the
 * least `s` clearing the floor. Returns `null` iff even `s = 1` cannot (the colour
 * itself is too close to the label — the caller must choose another surface).
 */
export function computeScrimFloor(
  label: Rgba,
  corridor: BackdropCorridor,
  scrimColour: Rgba,
  floor: number = WCAG_AA_NORMAL,
): ScrimFloor | null {
  const labelLum = relativeLuminance(label);
  const worstAt = (s: number): number => {
    const { effLow, effHigh } = bandOverCorridor({ ...scrimColour, a: s }, corridor);
    return worstContrastOverBand(labelLum, effLow, effHigh);
  };
  // An opaque scrim of this colour is the strongest floor available; if it can't
  // clear AA, no lower alpha can — report infeasible rather than lie.
  if (worstAt(1) < floor) {
    return null;
  }
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (worstAt(mid) >= floor) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return { colour: scrimColour, alpha: hi };
}

/** The forced-scrim branch: compute the floor over the residual corridor. Split
 * out of {@link decide} so contract-mandatory rungs (tainted) can call it DIRECTLY
 * and be compiler-narrowed to {@link ScrimDecision} — `guaranteed` is unreachable
 * by type, not by a runtime string convention. */
function scrimDecision(
  kase: LadderCase,
  label: Rgba,
  tint: Rgba,
  corridor: BackdropCorridor,
  floor: number,
  reason: string,
): ScrimDecision {
  const scrim = computeScrimFloor(
    label,
    residualCorridor(tint, corridor),
    polarityScrim(label),
    floor,
  );
  return { outcome: 'scrim-required', case: kase, reason, floor, scrim };
}

/** The shared core: derive the band, decide guaranteed vs scrim over one corridor. */
function decide(
  kase: LadderCase,
  label: Rgba,
  tint: Rgba,
  corridor: BackdropCorridor,
  floor: number,
): LadderDecision {
  const labelLum = relativeLuminance(label);
  const { effLow, effHigh } = bandOverCorridor(tint, corridor);
  const worst = worstContrastOverBand(labelLum, effLow, effHigh);
  if (worst >= floor) {
    return { outcome: 'guaranteed', case: kase, effLow, effHigh, worstContrast: worst, floor };
  }
  return scrimDecision(
    kase,
    label,
    tint,
    corridor,
    floor,
    `worst contrast ${worst.toFixed(2)}:1 below floor ${floor}:1 across [${effLow.toFixed(3)}, ${effHigh.toFixed(3)}]`,
  );
}

export interface LadderOptions {
  readonly floor?: number;
}

/** (a) A label on one opaque solid colour — the corridor is a point. */
export function resolveOnSolid(
  label: Rgba,
  solid: Rgba,
  options: LadderOptions = {},
): LadderDecision {
  const opaque = { ...solid, a: 1 };
  return decide('solid', label, opaque, cornerCorridor([opaque]), options.floor ?? WCAG_AA_NORMAL);
}

/** (b) A label on a material tint over an UNKNOWN live backdrop — full corridor. */
export function resolveOnMaterial(
  label: Rgba,
  tint: Rgba,
  options: LadderOptions = {},
): LadderDecision {
  return decide('material', label, tint, FULL_BACKDROP, options.floor ?? WCAG_AA_NORMAL);
}

export interface ImageRegionOptions extends LadderOptions {
  /** A material tint between the label and the image (default: none — label sits directly on the image). */
  readonly tint?: Rgba;
  /** A scrim already applied under the label (used to re-check a computed floor). */
  readonly scrim?: ScrimFloor;
}

/**
 * (c) A label on a readable image/gradient region, bounded by its per-channel
 * corridor. With no tint the label sits directly on the region; with a `scrim`
 * option the label sits on that scrim painted over the FULL stack beneath it —
 * scrim over tint over region, the same stack {@link decide} computes its forced
 * floor for — so re-checking a computed {@link ScrimFloor} verifies the paint
 * stack it was actually derived from, not a different one.
 */
export function resolveOnImageRegion(
  label: Rgba,
  region: BackdropCorridor,
  options: ImageRegionOptions = {},
): LadderDecision {
  const floor = options.floor ?? WCAG_AA_NORMAL;
  if (options.scrim) {
    const scrimTint = { ...options.scrim.colour, a: options.scrim.alpha };
    const base = options.tint === undefined ? region : residualCorridor(options.tint, region);
    return decide('image', label, scrimTint, base, floor);
  }
  return decide('image', label, options.tint ?? TRANSPARENT, region, floor);
}

/** (e) A label straddling two regions — it must hold over the UNION corridor. */
export function resolveOnBoundary(
  label: Rgba,
  regionA: BackdropCorridor,
  regionB: BackdropCorridor,
  options: ImageRegionOptions = {},
): LadderDecision {
  const floor = options.floor ?? WCAG_AA_NORMAL;
  return decide(
    'boundary',
    label,
    options.tint ?? TRANSPARENT,
    unionCorridor(regionA, regionB),
    floor,
  );
}

/**
 * (d) A cross-origin / tainted background: `getImageData` is unreadable, so the
 * backdrop is UNKNOWN = the full [black, white] corridor. The label cannot be
 * proven legal → scrim mandatory BY CONTRACT. Structurally cannot return
 * `guaranteed`: the return type is {@link ScrimDecision} and the function calls
 * the scrim branch directly — the compiler enforces the contract, the ladder test
 * pins the runtime behaviour on top.
 */
export function resolveOnTainted(label: Rgba, options: LadderOptions = {}): ScrimDecision {
  return scrimDecision(
    'tainted',
    label,
    TRANSPARENT,
    FULL_BACKDROP,
    options.floor ?? WCAG_AA_NORMAL,
    'cross-origin/tainted background: pixels unreadable — scrim mandatory by contract',
  );
}

/**
 * The per-channel corridor of a readable pixel region (straight-alpha RGBA bytes,
 * stride 4). An OPAQUE pixel contributes its own colour. A NON-opaque pixel
 * (alpha < 255) partially reveals UNKNOWN content beneath the sampled layer, so
 * its on-screen colour is `α·c + (1−α)·u` with `u` unknown in [0, 255] — the
 * corridor widens per channel to `[α·c, α·c + (1−α)·255]`, never trusting the
 * sampled byte alone. (A fully-transparent pixel therefore contributes the full
 * [0, 255] range: it reveals everything and asserts nothing.) Treating
 * semi-transparent pixels as opaque would narrow the corridor below the reachable
 * set — the one failure that over-promises — which is exactly what this widening
 * forecloses. The corridor's corners then bound every reachable on-screen colour
 * from outside (monotonicity), so the guarantee built on it stays conservative.
 * Throws only on an empty region: there is nothing to prove anything about.
 */
export function corridorFromPixels(pixels: Uint8ClampedArray): BackdropCorridor {
  if (pixels.length < 4) {
    throw new Error('corridorFromPixels: region is empty — no pixels to bound');
  }
  let minR = 255;
  let minG = 255;
  let minB = 255;
  let maxR = 0;
  let maxG = 0;
  let maxB = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const alpha = (pixels[i + 3] ?? 0) / 255;
    const reveal = (1 - alpha) * 255;
    const loR = alpha * (pixels[i] ?? 0);
    const loG = alpha * (pixels[i + 1] ?? 0);
    const loB = alpha * (pixels[i + 2] ?? 0);
    if (loR < minR) minR = loR;
    if (loG < minG) minG = loG;
    if (loB < minB) minB = loB;
    if (loR + reveal > maxR) maxR = loR + reveal;
    if (loG + reveal > maxG) maxG = loG + reveal;
    if (loB + reveal > maxB) maxB = loB + reveal;
  }
  return {
    min: { r: minR, g: minG, b: minB, a: 1 },
    max: { r: maxR, g: maxG, b: maxB, a: 1 },
  };
}
