import { type MaterialContour, materialContour } from './contour';
import type { CornerRadii } from './rounded-shape';

export interface Shadow {
  readonly x: number;
  readonly y: number;
  readonly blur: number;
  readonly spread: number;
  readonly color: string;
  readonly inset: boolean;
}

/** Physical CSS border widths: top, right, bottom, left. */
export type BorderWidths = readonly [number, number, number, number];

interface ShadowShape {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radii: CornerRadii;
}

const attr = (s: string): string =>
  s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

/** Shared filter and primitive bounds include blur support after translation. */
export function shadowPadding(list: readonly Shadow[]): number {
  return Math.max(
    1,
    ...list.map(
      (shadow) =>
        Math.max(Math.abs(shadow.x), Math.abs(shadow.y)) +
        shadow.blur * 2 +
        Math.abs(shadow.spread),
    ),
  );
}

/** CSS preserves sharp corners continuously as a positive outset grows.
 * The polynomial form avoids cancellation when radius / outset is tiny.
 * https://www.w3.org/TR/css-backgrounds-3/#shadow-shape
 */
function spreadRadius(radius: number, outset: number): number {
  if (outset <= 0 || radius >= outset) return Math.max(0, radius + outset);
  const ratio = radius / outset;
  return radius * (4 - 3 * ratio + ratio * ratio);
}

function outsetShape(shape: ShadowShape, outset: number): ShadowShape {
  return {
    x: shape.x - outset,
    y: shape.y - outset,
    width: Math.max(0, shape.width + 2 * outset),
    height: Math.max(0, shape.height + 2 * outset),
    radii: shape.radii.map((radius) => spreadRadius(radius, outset)) as unknown as CornerRadii,
  };
}

/** An SVG image gives the filter an exact shared path. Unlike morphology,
 * expansion is independent of raster resolution and has no square kernel.
 * Black is the default SVG fill; only this image's alpha is consumed.
 */
function shapeAlpha(shape: ShadowShape, smoothing: number, result: string): string {
  if (!shape.width || !shape.height) return `<feFlood flood-opacity="0" result="${result}"/>`;
  const contour = materialContour(shape.width, shape.height, shape.radii, smoothing);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}"><path d="${contour.path}"/></svg>`;
  const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return `<feImage href="${href}" x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="${result}"/>`;
}

/** Parallel CSS shadow layers, first layer on top. SourceAlpha is the original
 * border contour; outer shadows knock out that border box, whereas inner
 * shadows use the padding box both for their hole and for the final clip.
 * Rebuild only when shadows, contour geometry, or border widths change.
 */
export function shadowMarkup(
  list: readonly Shadow[],
  border: MaterialContour,
  borders: BorderWidths,
): string {
  const [top, right, bottom, left] = borders;
  const pad = shadowPadding(list);
  // feImage has the silhouette's tight primitive subregion. Blur and offset
  // must be allowed to paint outside it, up to the enclosing filter region.
  const region = `x="${-pad}" y="${-pad}" width="${border.width + 2 * pad}" height="${border.height + 2 * pad}"`;
  const cornerBorders = [left, top, right, top, right, bottom, left, bottom];
  const outer: ShadowShape = {
    x: 0,
    y: 0,
    width: border.width,
    height: border.height,
    radii: border.radii,
  };
  const padding: ShadowShape = {
    x: left,
    y: top,
    width: Math.max(0, border.width - left - right),
    height: Math.max(0, border.height - top - bottom),
    radii: border.radii.map((radius, i) =>
      Math.max(0, radius - (cornerBorders[i] ?? 0)),
    ) as unknown as CornerRadii,
  };
  const distinctPadding = borders.some((width) => width !== 0);
  const paddingAlpha = distinctPadding ? 'padding-alpha' : 'SourceAlpha';
  const prefix =
    distinctPadding && list.some((shadow) => shadow.inset)
      ? shapeAlpha(padding, border.smoothing, paddingAlpha)
      : '';
  const primitives = list
    .map((shadow, i) => {
      const clip = shadow.inset ? paddingAlpha : 'SourceAlpha';
      const alpha = shadow.spread ? `spread-${i}` : clip;
      const spread = shadow.spread
        ? shapeAlpha(
            outsetShape(
              shadow.inset ? padding : outer,
              shadow.inset ? -shadow.spread : shadow.spread,
            ),
            border.smoothing,
            alpha,
          )
        : '';
      // For inner shadows, padding * (1 - blurred hole) also preserves the
      // fractional coverage at the clip edge; subtracting alpha does not.
      const knockout = shadow.inset
        ? `in="${clip}" in2="offset-${i}"`
        : `in="offset-${i}" in2="${clip}"`;
      return `${spread}<feGaussianBlur in="${alpha}" stdDeviation="${shadow.blur / 2}" ${region}/><feOffset dx="${shadow.x}" dy="${shadow.y}" result="offset-${i}" ${region}/><feComposite ${knockout} operator="out" result="alpha-${i}"/><feFlood flood-color="${attr(shadow.color)}"/><feComposite in2="alpha-${i}" operator="in" result="shadow-${i}"/>`;
    })
    .join('');
  return `${prefix}${primitives}<feMerge>${list.map((_, i) => `<feMergeNode in="shadow-${list.length - i - 1}"/>`).join('')}</feMerge>`;
}
