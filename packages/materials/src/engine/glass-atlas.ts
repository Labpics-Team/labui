import { lensBand, lensReach } from './glass-optics';
import type { RoundedShape } from './rounded-shape';

export interface GlassAtlasPlan {
  padding: number;
  side: number;
  /** A bounded field along the changing short axis; the long middle is invariant. */
  strip?: { axis: 'x' | 'y'; cross: number; scale: number };
}

export interface GlassAtlas extends GlassAtlasPlan {
  tiles: readonly string[];
}

const cornerExtent = (corner: RoundedShape): number =>
  typeof corner === 'number'
    ? corner
    : 'radii' in corner
      ? Math.max(...corner.corners.flatMap((c) => [c.x, c.y]))
      : Math.max(...corner);

/** Largest source side needed before the optical profile and corners fit.
 * Full fields within this bound are as small as the retained tile source. */
export function glassFieldSide(corner: RoundedShape, depth: number, dpr: number): number {
  return (Math.ceil(2 * Math.max(cornerExtent(corner), lensReach(depth)) * dpr) + 1) / dpr;
}

/** An unchanged rim can move with the box without stretching its optics.
 * Small shapes keep the bounded field: their thickness and overlapping corner
 * regions really do depend on the current size.
 */
export function glassAtlasPlan(
  w: number,
  h: number,
  corner: RoundedShape,
  depth: number,
  dpr: number,
): GlassAtlasPlan | null {
  const radius = cornerExtent(corner);
  const band = lensBand(depth, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const padding = Math.ceil(Math.max(radius, band) * dpr) / dpr;
  const minimum = Math.max(2 * padding + 1, 2 * lensReach(depth));
  if (Number.isInteger(dpr) && Math.min(w, h) >= minimum)
    return { padding, side: Math.ceil(minimum) + 1 };
  // Small shapes cannot use the invariant four-sided rim: their optical
  // half-size still changes. Compress only the unchanged middle of the LONG
  // axis. Keep its exact rounded bitmap phase, including fractional DPR.
  const axis = w >= h ? 'x' : 'y';
  const long = Math.max(w, h);
  const cross = Math.min(w, h);
  const scale = Math.max(1, Math.round(long * dpr)) / long;
  const stripPadding = Math.ceil(Math.max(radius, lensBand(depth, w, h)) * scale) / scale;
  const side =
    (Math.ceil(Math.max(2 * stripPadding, Math.min(cross, 2 * lensReach(depth))) * scale) + 1) /
    scale;
  return side < long ? { padding: stripPadding, side, strip: { axis, cross, scale } } : null;
}

/** Lossless corner/rim PNGs. Native feImage primitives retain device-pixel detail;
 * external SVG images lose it, and local SVG references fail on the backdrop
 * path even when an ordinary filter paints them correctly.
 */
export function buildGlassAtlas(
  source: HTMLCanvasElement,
  plan: GlassAtlasPlan,
  dpr: number,
): GlassAtlas {
  const { padding: p, side } = plan;
  const tile = source.ownerDocument.createElement('canvas');
  const ctx = tile.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('liquid-glass: 2d canvas context unavailable');
  if (plan.strip) {
    const { axis, scale } = plan.strip;
    const padding = Math.round(p * scale);
    const long = axis === 'x' ? source.width : source.height;
    const crop = (start: number, length: number): string => {
      tile.width = axis === 'x' ? length : source.width;
      tile.height = axis === 'y' ? length : source.height;
      ctx.drawImage(
        source,
        axis === 'x' ? start : 0,
        axis === 'y' ? start : 0,
        tile.width,
        tile.height,
        0,
        0,
        tile.width,
        tile.height,
      );
      return tile.toDataURL('image/png');
    };
    const tiles = [crop(0, padding), crop(Math.floor(long / 2), 1), crop(long - padding, padding)];
    tile.width = tile.height = 0;
    return { ...plan, tiles };
  }
  const crop = (x: number, y: number, w: number, h: number): string => {
    tile.width = Math.round(w * dpr);
    tile.height = Math.round(h * dpr);
    ctx.drawImage(source, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, tile.width, tile.height);
    return tile.toDataURL('image/png');
  };
  const mid = Math.floor((side * dpr) / 2) / dpr;
  const pixel = 1 / dpr;
  const tiles = [
    crop(0, mid, p, pixel),
    crop(side - p, mid, p, pixel),
    crop(mid, 0, pixel, p),
    crop(mid, side - p, pixel, p),
    crop(0, 0, p, p),
    crop(side - p, 0, p, p),
    crop(0, side - p, p, p),
    crop(side - p, side - p, p, p),
  ];
  tile.width = tile.height = 0;
  return { ...plan, tiles };
}

export function glassAtlasMarkup(atlas: GlassAtlas, w: number, h: number): string {
  const p = atlas.padding;
  const bounds = atlas.strip
    ? atlas.strip.axis === 'x'
      ? [
          [0, 0, p, h],
          [p, 0, w - 2 * p, h],
          [w - p, 0, p, h],
        ]
      : [
          [0, 0, w, p],
          [0, p, w, h - 2 * p],
          [0, h - p, w, p],
        ]
    : [
        [0, 0, p, h],
        [w - p, 0, p, h],
        [0, 0, w, p],
        [0, h - p, w, p],
        [0, 0, p, p],
        [w - p, 0, p, p],
        [0, h - p, p, p],
        [w - p, h - p, p, p],
      ];
  const images = atlas.tiles
    .map((href, i) => {
      const [x, y, width, height] = bounds[i] ?? [];
      return `<feImage href="${href}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" result="tile${i}"/>`;
    })
    .join('');
  const merge = atlas.tiles.map((_, i) => `<feMergeNode in="tile${i}"/>`).join('');
  const zero = NEUTRAL_VECTOR_BYTE;
  return `<feFlood flood-color="rgb(${zero} ${zero} ${zero})" result="neutral"/>${images}<feMerge result="map"><feMergeNode in="neutral"/>${merge}</feMerge>`;
}

/** Only dependent coordinates change. The bitmaps and SVG nodes survive. */
export function resizeGlassAtlas(
  nodes: readonly Element[],
  atlas: GlassAtlas,
  w: number,
  h: number,
): void {
  const p = atlas.padding;
  const set = (i: number, name: string, value: number) => {
    const node = nodes[i];
    const next = String(value);
    if (node?.getAttribute(name) !== next) node?.setAttribute(name, next);
  };
  if (atlas.strip) {
    if (atlas.strip.axis === 'x') {
      set(1, 'width', w - 2 * p);
      set(2, 'x', w - p);
    } else {
      set(1, 'height', h - 2 * p);
      set(2, 'y', h - p);
    }
    return;
  }
  set(0, 'height', h);
  set(1, 'x', w - p);
  set(1, 'height', h);
  set(2, 'width', w);
  set(3, 'y', h - p);
  set(3, 'width', w);
  set(5, 'x', w - p);
  set(6, 'y', h - p);
  set(7, 'x', w - p);
  set(7, 'y', h - p);
}
import { NEUTRAL_VECTOR_BYTE } from './glass-field-format';
