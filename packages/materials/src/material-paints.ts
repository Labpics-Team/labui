import { type Rgba, compositeOver } from './luminance';
import type { MaterialBlendMode } from './profile';

// Gecko's WebRender backdrop path corrupts component tables above 256 entries.
// Keep one bounded table format for every renderer and SSR compilation.
const TRANSFER_SAMPLES = 256;

export interface MaterialPaints {
  readonly normal: Rgba;
  readonly blend: Rgba;
  readonly blendMode: MaterialBlendMode;
}

export interface CompiledMaterialPaint {
  /** Opaque backdrop -> this normal paint -> complete authored appearance. */
  readonly fill: Rgba;
  /** Sampled transfer applied before fill; affine recipes need no SVG at all.
   * Custom discontinuities need not be accurate between its 256 samples. */
  readonly tables: readonly [string, string, string];
  readonly affine: boolean;
  /** Maximum channel error (8-bit sRGB units) when the transfer is unavailable. */
  readonly fallbackError: number;
}

/** Factor the transfer into a normal fallback paint and an optional residual.
 * Neutral authored paints share endpoint slope across channels. Coloured custom
 * recipes that cannot use one normal alpha keep the unfactored transfer.
 * Residual tables use the same sampled approximation as materialPaintTables;
 * fallbackError bounds the normal-only chord, not table interpolation error.
 */
export function compileMaterialPaint(paints: MaterialPaints): CompiledMaterialPaint {
  const black = materialPaintOver(paints, { r: 0, g: 0, b: 0, a: 1 });
  const white = materialPaintOver(paints, { r: 255, g: 255, b: 255, a: 1 });
  const keys = ['r', 'g', 'b'] as const;
  const slopes = keys.map((key) => (white[key] - black[key]) / 255);
  const common = slopes.every((value) => Math.abs(value - (slopes[0] ?? 0)) < 1e-10);
  const slope = common ? (slopes[0] ?? 1) : 1;
  const alpha = 1 - slope;
  const fill =
    common && alpha > 1e-10 && keys.every((key) => black[key] <= alpha * 255 + 1e-10)
      ? { r: black.r / alpha, g: black.g / alpha, b: black.b / alpha, a: alpha }
      : { r: 0, g: 0, b: 0, a: 0 };
  const gain = 1 - fill.a;
  const offsets = keys.map((key) => fill[key] * fill.a);
  let maximumError = 0;
  // All current blend functions are piecewise linear. Endpoint + breakpoint
  // evaluation proves the maximum chord error without a sampling tolerance.
  // Color-dodge with source=1 has a jump immediately after black.
  const probes = new Set([0, Number.EPSILON, 1 - Number.EPSILON, 1]);
  for (const key of keys) {
    const normal = paints.normal[key] / 255;
    const threshold = paints.blendMode === 'overlay' ? 0.5 : 1 - paints.blend[key] / 255;
    const point = (threshold - paints.normal.a * normal) / (1 - paints.normal.a);
    if (point > 0 && point < 1) probes.add(point);
  }
  for (const point of probes) {
    const exact = materialPaintOver(paints, {
      r: point * 255,
      g: point * 255,
      b: point * 255,
      a: 1,
    });
    for (const [index, key] of keys.entries())
      maximumError = Math.max(
        maximumError,
        Math.abs(exact[key] - ((offsets[index] ?? 0) + gain * point * 255)),
      );
  }
  const affine = maximumError < 1e-8;
  const rows: number[][] = [[], [], []];
  for (let i = 0; i < TRANSFER_SAMPLES; i++) {
    const value = (i / (TRANSFER_SAMPLES - 1)) * 255;
    const out = materialPaintOver(paints, { r: value, g: value, b: value, a: 1 });
    for (const [index, key] of keys.entries())
      rows[index]?.push(
        gain > 1e-10
          ? Math.min(1, Math.max(0, (out[key] - (offsets[index] ?? 0)) / (255 * gain)))
          : i / (TRANSFER_SAMPLES - 1),
      );
  }
  return {
    fill,
    tables: rows.map((row) => row.map((value) => Number(value.toFixed(8))).join(' ')) as [
      string,
      string,
      string,
    ],
    affine,
    fallbackError: maximumError,
  };
}

/** W3C Compositing & Blending, separable blend functions, encoded sRGB.
 * https://www.w3.org/TR/compositing-1/#blendingcolor-dodge
 * https://www.w3.org/TR/compositing-1/#blendingoverlay
 */
export function blendChannel(backdrop: number, source: number, mode: MaterialBlendMode): number {
  if (mode === 'color-dodge') {
    if (backdrop <= 0) return 0;
    return source >= 1 ? 1 : Math.min(1, backdrop / (1 - source));
  }
  return backdrop <= 0.5 ? 2 * backdrop * source : 1 - 2 * (1 - backdrop) * (1 - source);
}

/** Normal 01, then blend 02. The result is an opaque filtered backdrop;
 * neither paint is a substitute for the independent Solid role.
 */
export function materialPaintOver(paints: MaterialPaints, backdrop: Rgba): Rgba {
  const normal = compositeOver(paints.normal, backdrop);
  const channel = (key: 'r' | 'g' | 'b'): number => {
    const b = normal[key] / 255;
    const mixed = blendChannel(b, paints.blend[key] / 255, paints.blendMode);
    return 255 * (b + paints.blend.a * (mixed - b));
  };
  return { r: channel('r'), g: channel('g'), b: channel('b'), a: 1 };
}

/** Piecewise linear RGB transfer, compiled only on a theme/role change.
 * All channels remain independent: coloured inputs need no neutral assumption.
 * The SVG renderer interpolates these 256 samples; this is an approximation
 * around a blend breakpoint, not a claim of byte identity with Figma. The
 * <0.15 RGB interpolation bound is tested only for the ten authored recipes.
 * A fully opaque white dodge over transparent Normal jumps just after black:
 * input 0.5/255 maps to 1 exactly, but to 0.5 in this sampled representation.
 * materialPaintOver remains the exact scalar composition for arbitrary inputs.
 */
export function materialPaintTables(
  paints: MaterialPaints,
  screen?: Rgba,
): readonly [string, string, string] {
  const rows: number[][] = [[], [], []];
  for (let i = 0; i < TRANSFER_SAMPLES; i++) {
    const value = (i / (TRANSFER_SAMPLES - 1)) * 255;
    const input = screen
      ? {
          r: value + ((255 - value) * screen.r * screen.a) / 255,
          g: value + ((255 - value) * screen.g * screen.a) / 255,
          b: value + ((255 - value) * screen.b * screen.a) / 255,
          a: 1,
        }
      : { r: value, g: value, b: value, a: 1 };
    const out = materialPaintOver(paints, input);
    rows[0]?.push(out.r / 255);
    rows[1]?.push(out.g / 255);
    rows[2]?.push(out.b / 255);
  }
  return rows.map((row) => row.map((v) => Number(v.toFixed(8))).join(' ')) as [
    string,
    string,
    string,
  ];
}

/** A uniform midpoint is a bounded rendering approximation, not spatial grain.
 * Each channel's worst source deviation is noise[channel] * maxAlpha/2. The
 * blend function's global slope bounds its amplification through both paints.
 * This includes every backdrop and noise sample, without sampling either axis.
 */
export function screenNoiseApproximation(
  paints: MaterialPaints,
  noise: Rgba,
): { screen: Rgba; maxError: number } {
  const screen = { ...noise, a: noise.a / 2 };
  let maxError = 0;
  for (const key of ['r', 'g', 'b'] as const) {
    if (paints.normal.a === 1 || noise[key] === 0 || noise.a === 0) continue;
    const source = paints.blend[key] / 255;
    const blendSlope =
      paints.blendMode === 'overlay'
        ? 2 * Math.max(source, 1 - source)
        : source < 1
          ? 1 / (1 - source)
          : Number.POSITIVE_INFINITY;
    const slope =
      (1 - paints.normal.a) *
      (paints.blend.a === 0 ? 1 : 1 - paints.blend.a + paints.blend.a * blendSlope);
    maxError = Math.max(maxError, ((noise[key] * noise.a) / 2) * slope);
  }
  return { screen, maxError };
}
