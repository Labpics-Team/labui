import { lensBand, lensReach } from './glass-optics';
import type { RoundedShape } from './rounded-shape';

export interface GlassAtlasPlan {
  padding: number;
  side: number;
}

export interface GlassAtlas extends GlassAtlasPlan {
  tiles: readonly string[];
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
  // With a fractional pixel scale, rounding the full bitmap changes the right
  // and bottom sampling phase as dimensions change. Keep that exact field path.
  if (!Number.isInteger(dpr)) return null;
  const radius = typeof corner === 'number' ? corner : Math.max(...corner);
  const band = lensBand(depth, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const padding = Math.ceil(Math.max(radius, band) * dpr) / dpr;
  const minimum = Math.max(2 * padding + 1, 2 * lensReach(depth));
  if (Math.min(w, h) < minimum) return null;
  return { padding, side: Math.ceil(minimum) + 1 };
}

/** Eight lossless PNGs. Native feImage primitives retain device-pixel detail;
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
  const ctx = tile.getContext('2d');
  if (!ctx) throw new Error('liquid-glass: 2d canvas context unavailable');
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
  const bounds = [
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

/** Only dependent coordinates change. The eight bitmaps and SVG nodes survive. */
export function resizeGlassAtlas(nodes: readonly Element[], p: number, w: number, h: number): void {
  const set = (i: number, name: string, value: number) => {
    const node = nodes[i];
    const next = String(value);
    if (node?.getAttribute(name) !== next) node?.setAttribute(name, next);
  };
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
