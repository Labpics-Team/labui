import { type Rgba, compositeOver } from './luminance';
import type { MaterialBlendMode } from './profile';

export interface MaterialPaints {
  readonly normal: Rgba;
  readonly blend: Rgba;
  readonly blendMode: MaterialBlendMode;
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
