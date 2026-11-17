import { type Rgba, compositeOver } from './luminance';
import type { MaterialBlendMode } from './profile';

export interface MaterialPaints {
  readonly normal: Rgba;
  readonly blend: Rgba;
  readonly blendMode: MaterialBlendMode;
}

export interface CompiledMaterialPaint {
  /** Opaque backdrop -> this normal paint -> complete authored appearance. */
  readonly fill: Rgba;
  /** Transfer applied before fill; affine recipes need no SVG at all. */
  readonly tables: readonly [string, string, string];
  readonly affine: boolean;
  /** Maximum channel error (8-bit sRGB units) when the transfer is unavailable. */
  readonly fallbackError: number;
}

/** Factor the transfer into a normal fallback paint and an optional residual.
 * Neutral authored paints share endpoint slope across channels. Coloured custom
 * recipes that cannot use one normal alpha keep the unfactored transfer.
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
  const probes = new Set([0, 1]);
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
  for (let i = 0; i <= 256; i++) {
    const value = (i / 256) * 255;
    const out = materialPaintOver(paints, { r: value, g: value, b: value, a: 1 });
    for (const [index, key] of keys.entries())
      rows[index]?.push(
        gain > 1e-10
          ? Math.min(1, Math.max(0, (out[key] - (offsets[index] ?? 0)) / (255 * gain)))
          : i / 256,
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
 * The SVG renderer interpolates these 257 samples; this is an approximation
 * around a blend breakpoint, not a claim of byte identity with Figma.
 */
export function materialPaintTables(paints: MaterialPaints): readonly [string, string, string] {
  const rows: number[][] = [[], [], []];
  for (let i = 0; i <= 256; i++) {
    const value = (i / 256) * 255;
    const out = materialPaintOver(paints, { r: value, g: value, b: value, a: 1 });
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
