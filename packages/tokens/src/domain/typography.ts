import type { TypographyConfig } from '../config/types.js';
import { num, rem } from './format.js';
import type { FluidBounds, ResolvedToken } from './token.js';

/**
 * Build the fluid typography scale — a continuous gradient, not breakpoints.
 *
 * For each signed step `n` from `-stepsDown` to `+stepsUp`:
 *   minPx(n) = basePx * ratioMin^n     (narrow-anchor floor; damped)
 *   maxPx(n) = basePx * ratioMax^n     (wide-anchor ceiling)
 *
 * The preferred value is the line through (minViewport, minPx) and
 * (maxViewport, maxPx):
 *   slopeVw     = 100 * (maxPx - minPx) / (maxVp - minVp)            // in vw
 *   interceptPx = (minVp*maxPx - maxVp*minPx) / (minVp - maxVp)
 *   interceptRem = interceptPx / remBasePx
 *
 * emitted as: clamp(minRem, slopeVw·vw + interceptRem, maxRem)
 *
 * Because ratioMin < ratioMax, large steps get a disproportionately smaller
 * floor — headings grow slower at narrow widths while step 0 is identical at
 * both anchors. rem is kept in every position so browser zoom scales the text
 * (WCAG 1.4.4). No media queries are produced.
 */
export function buildTypography(config: TypographyConfig): {
  fontSizes: ResolvedToken[];
  lineHeights: ResolvedToken[];
} {
  assertConfig(config);

  const fontSizes: ResolvedToken[] = [];
  const lineHeights: ResolvedToken[] = [];

  for (let step = -config.stepsDown; step <= config.stepsUp; step++) {
    const name = labelFor(config, step);
    const bounds = fluidBounds(config, step);

    fontSizes.push({
      kind: 'font-size',
      name,
      cssValue: clampString(config, bounds),
      // A fluid step has no single value — leave numeric undefined; tests assert
      // monotonicity by evaluating the clamp at a width (see effectiveSizePx).
      dtcgType: 'dimension',
      fluid: bounds,
    });

    // Line-height as a unitless multiplier of the step's mid-size, banded by
    // step. Unitless so it tracks the fluid font-size automatically.
    const multiplier = lineHeightMultiplier(config, step);
    lineHeights.push({
      kind: 'line-height',
      name,
      cssValue: num(multiplier),
      numeric: multiplier,
      dtcgType: 'number',
    });
  }

  return { fontSizes, lineHeights };
}

/** Compute the clamp anchors and linear-preferred coefficients for a step. */
export function fluidBounds(config: TypographyConfig, step: number): FluidBounds {
  const minPx = config.basePx * config.ratioMin ** step;
  const maxPx = config.basePx * config.ratioMax ** step;
  const { minViewportPx: minVp, maxViewportPx: maxVp, remBasePx } = config;

  const slopeVw = (100 * (maxPx - minPx)) / (maxVp - minVp);
  const interceptPx = (minVp * maxPx - maxVp * minPx) / (minVp - maxVp);
  const interceptRem = interceptPx / remBasePx;

  return { step, minPx, maxPx, slopeVw, interceptRem };
}

/**
 * The effective rendered size in px at a given viewport width — the clamp
 * evaluated. Used by tests to prove the gradient interpolates and that the
 * scale stays strictly monotonic at any width in the working range.
 */
export function effectiveSizePx(
  config: TypographyConfig,
  step: number,
  viewportPx: number,
): number {
  const { minPx, maxPx, slopeVw, interceptRem } = fluidBounds(config, step);
  const preferredPx = (slopeVw / 100) * viewportPx + interceptRem * config.remBasePx;
  const lo = Math.min(minPx, maxPx);
  const hi = Math.max(minPx, maxPx);
  return Math.min(Math.max(preferredPx, lo), hi);
}

function clampString(config: TypographyConfig, b: FluidBounds): string {
  // CSS clamp requires LOWER <= UPPER. For steps below base, ratioMin^n >
  // ratioMax^n, so the narrow-anchor size is the LARGER one: the floor is the
  // wide anchor and the ceiling is the narrow anchor. Order by actual magnitude
  // so the gradient stays live instead of freezing at a swapped bound.
  const lowerPx = Math.min(b.minPx, b.maxPx);
  const upperPx = Math.max(b.minPx, b.maxPx);
  const lowerRem = rem(lowerPx / config.remBasePx);
  const upperRem = rem(upperPx / config.remBasePx);
  const interceptSign = b.interceptRem < 0 ? '- ' : '+ ';
  const interceptRem = rem(Math.abs(b.interceptRem));
  const preferred = `${num(b.slopeVw)}vw ${interceptSign}${interceptRem}`;
  return `clamp(${lowerRem}, ${preferred}, ${upperRem})`;
}

function lineHeightMultiplier(config: TypographyConfig, step: number): number {
  // Highest matching threshold wins; bands are evaluated from the top.
  const sorted = [...config.lineHeightBands].sort((a, b) => b.fromStep - a.fromStep);
  for (const band of sorted) {
    if (step >= band.fromStep) return band.multiplier;
  }
  // Unreachable when a band has a sufficiently low fromStep; guard anyway.
  throw new Error(`no line-height band matches step ${step}`);
}

function labelFor(config: TypographyConfig, step: number): string {
  return config.stepLabels[String(step)] ?? String(step);
}

function assertConfig(config: TypographyConfig): void {
  if (config.ratioMin <= 0 || config.ratioMax <= 0) {
    throw new Error('typography ratios must be positive');
  }
  if (config.ratioMin > config.ratioMax) {
    throw new Error(
      `typography ratioMin (${config.ratioMin}) must be <= ratioMax (${config.ratioMax}) for damping`,
    );
  }
  if (config.minViewportPx >= config.maxViewportPx) {
    throw new Error('typography minViewportPx must be < maxViewportPx');
  }
  if (config.remBasePx <= 0) {
    throw new Error('typography remBasePx must be positive');
  }
}
