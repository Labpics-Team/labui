import {
  type CornerRadii,
  type RoundedShape,
  normalizeCornerRadii,
  straightGeometry,
} from './rounded-shape';

/** One authored outline serves clipping, shadows, light and refraction. Figma
 * joins a circular arc to two cubic transitions; it is not a superellipse.
 * https://www.figma.com/blog/desperately-seeking-squircles/
 */
export interface MaterialContour {
  readonly width: number;
  readonly height: number;
  readonly radii: CornerRadii;
  readonly smoothing: number;
  readonly extents: CornerRadii;
  readonly key: string;
  readonly path: string;
  readonly corners: readonly ContourCorner[];
}

interface ContourCorner {
  readonly x: number;
  readonly y: number;
  /** x, y, dx, dy, 1 / length², clockwise toward the left edge. */
  readonly segments: Float64Array;
  /** Preorder BVH nodes: minX, minY, maxX, maxY, first, end, skip. */
  readonly bounds: Float64Array;
  readonly curve: readonly number[];
}

const ERROR = 1 / 4096;
const CACHE_LIMIT = 64;
const contours = new Map<string, MaterialContour>();
const cornersCache = new Map<string, ContourCorner>();
const f = (n: number): string => String(Number(n.toFixed(6)));

function corner(rx: number, ry: number, smoothing: number): ContourCorner {
  if (!rx || !ry)
    return { x: 0, y: 0, segments: new Float64Array(), bounds: new Float64Array(), curve: [] };
  const key = `${rx}x${ry}x${smoothing}`;
  const hit = cornersCache.get(key);
  if (hit) return hit;
  const p = 1 + smoothing;
  const theta = (smoothing * Math.PI) / 4;
  const arc = Math.sin(((1 - smoothing) * Math.PI) / 4) * Math.SQRT2;
  const c = Math.tan(theta / 2) * Math.cos(theta);
  const d = c * Math.tan(theta);
  const b = (p - arc - c - d) / 3;
  const a = 2 * b;
  const q = a + b + c;
  const values: number[] = [];
  let lastX = p * rx;
  let lastY = 0;
  const line = (x: number, y: number) => {
    const dx = x - lastX;
    const dy = y - lastY;
    const squared = dx * dx + dy * dy;
    if (squared > 1e-20) values.push(lastX, lastY, dx, dy, 1 / squared);
    lastX = x;
    lastY = y;
  };
  const cubic = (points: readonly number[], level = 0): void => {
    const [x0 = 0, y0 = 0, x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0] = points;
    // A cubic lies inside its control hull. The two control-point distances
    // therefore bound the curve-to-chord error; subdivision preserves it.
    const dx = x3 - x0;
    const dy = y3 - y0;
    const length = Math.hypot(dx, dy);
    const error = length
      ? Math.max(
          Math.abs(dx * (y1 - y0) - dy * (x1 - x0)),
          Math.abs(dx * (y2 - y0) - dy * (x2 - x0)),
        ) / length
      : Math.max(Math.hypot(x1 - x0, y1 - y0), Math.hypot(x2 - x0, y2 - y0));
    if (error <= ERROR || level === 20) {
      line(x3, y3);
      return;
    }
    const x01 = (x0 + x1) / 2;
    const y01 = (y0 + y1) / 2;
    const x12 = (x1 + x2) / 2;
    const y12 = (y1 + y2) / 2;
    const x23 = (x2 + x3) / 2;
    const y23 = (y2 + y3) / 2;
    const x012 = (x01 + x12) / 2;
    const y012 = (y01 + y12) / 2;
    const x123 = (x12 + x23) / 2;
    const y123 = (y12 + y23) / 2;
    const xm = (x012 + x123) / 2;
    const ym = (y012 + y123) / 2;
    cubic([x0, y0, x01, y01, x012, y012, xm, ym], level + 1);
    cubic([xm, ym, x123, y123, x23, y23, x3, y3], level + 1);
  };
  cubic([p * rx, 0, (p - a) * rx, 0, (p - a - b) * rx, 0, (p - q) * rx, d * ry]);
  const angle = ((1 - smoothing) * Math.PI) / 2;
  const start = Math.atan2(d - 1, p - q - 1);
  const steps = Math.max(
    1,
    Math.ceil(angle / (2 * Math.acos(Math.max(-1, 1 - ERROR / Math.max(rx, ry))))),
  );
  for (let i = 1; i <= steps; i++) {
    const t = start - (angle * i) / steps;
    line((1 + Math.cos(t)) * rx, (1 + Math.sin(t)) * ry);
  }
  cubic([d * rx, (p - q) * ry, 0, (p - a - b) * ry, 0, (p - a) * ry, 0, p * ry]);
  // Canonical top-right corner, starting at (-p*rx, 0), ending at (0, p*ry).
  const curve = [
    a * rx,
    0,
    (a + b) * rx,
    0,
    q * rx,
    d * ry,
    rx,
    ry,
    0,
    0,
    1,
    arc * rx,
    arc * ry,
    d * rx,
    c * ry,
    d * rx,
    (b + c) * ry,
    d * rx,
    q * ry,
  ];
  const bounds: number[] = [];
  const branch = (start: number, end: number): void => {
    const node = bounds.length;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let j = start; j < end; j += 5) {
      const x = values[j] ?? 0;
      const y = values[j + 1] ?? 0;
      const nextX = x + (values[j + 2] ?? 0);
      const nextY = y + (values[j + 3] ?? 0);
      minX = Math.min(minX, x, nextX);
      minY = Math.min(minY, y, nextY);
      maxX = Math.max(maxX, x, nextX);
      maxY = Math.max(maxY, y, nextY);
    }
    const leaf = end - start <= 40;
    bounds.push(minX, minY, maxX, maxY, leaf ? start : -1, end, 0);
    if (!leaf) {
      const middle = start + Math.floor((end - start) / 10) * 5;
      branch(start, middle);
      branch(middle, end);
    }
    bounds[node + 6] = bounds.length;
  };
  branch(0, values.length);
  const result = {
    x: p * rx,
    y: p * ry,
    segments: Float64Array.from(values),
    bounds: Float64Array.from(bounds),
    curve,
  };
  cornersCache.set(key, result);
  if (cornersCache.size > CACHE_LIMIT)
    cornersCache.delete(cornersCache.keys().next().value as string);
  return result;
}

export function materialContour(
  w: number,
  h: number,
  shape: RoundedShape,
  smoothing: number,
): MaterialContour {
  const radii = normalizeCornerRadii(
    w,
    h,
    (typeof shape === 'number'
      ? Array(8).fill(Math.min(shape, w / 2, h / 2))
      : 'radii' in shape
        ? [...shape.radii]
        : [...shape]) as unknown as CornerRadii,
  );
  let s = Math.max(0, Math.min(1, smoothing));
  // Preserve used CSS radii; reduce only the requested transition where neighbouring
  // corners would overlap. Every consumer uses this same used value.
  for (const [extent, a, b] of [
    [w, radii[0], radii[2]],
    [h, radii[3], radii[5]],
    [w, radii[4], radii[6]],
    [h, radii[7], radii[1]],
  ]) {
    const total = (a ?? 0) + (b ?? 0);
    if (total > 0) s = Math.min(s, Math.max(0, (extent ?? 0) / total - 1));
  }
  const key = `${w}x${h}x${radii.join(',')}x${s}`;
  const hit = contours.get(key);
  if (hit) {
    contours.delete(key);
    contours.set(key, hit);
    return hit;
  }
  const corners = [0, 2, 4, 6].map((i) => corner(radii[i] ?? 0, radii[i + 1] ?? 0, s));
  // All four corners share the same numerical construction. Transforming the
  // canonical local commands also supports asymmetric/elliptical CSS radii.
  const pathParts: string[] = [];
  const transforms = [
    [1, 0, 0, 1, w, 0],
    [0, 1, -1, 0, w, h],
    [-1, 0, 0, -1, 0, h],
    [0, -1, 1, 0, 0, 0],
  ];
  const order = [1, 2, 3, 0];
  for (let j = 0; j < 4; j++) {
    const index = order[j] ?? 0;
    const c = corners[index] as ContourCorner;
    const [a = 0, b = 0, cc = 0, d = 0, e = 0, ff = 0] = transforms[j] ?? [];
    const swap = j % 2 === 1;
    const local = swap ? corner(radii[2 * index + 1] ?? 0, radii[2 * index] ?? 0, s) : c;
    const tx = (x: number, y: number) => `${f(a * x + cc * y + e)} ${f(b * x + d * y + ff)}`;
    pathParts.push(`${j ? 'L' : 'M'} ${tx(-local.x, 0)}`);
    // Emit exact cubic and arc endpoints from the canonical commands.
    const nums = local.curve;
    if (!nums.length) continue;
    const delta = (x: number, y: number) => `${f(a * x + cc * y)} ${f(b * x + d * y)}`;
    pathParts.push(
      `c ${delta(nums[0] ?? 0, nums[1] ?? 0)} ${delta(nums[2] ?? 0, nums[3] ?? 0)} ${delta(nums[4] ?? 0, nums[5] ?? 0)} a ${f(nums[6] ?? 0)} ${f(nums[7] ?? 0)} ${swap ? 90 : 0} 0 1 ${delta(nums[11] ?? 0, nums[12] ?? 0)} c ${delta(nums[13] ?? 0, nums[14] ?? 0)} ${delta(nums[15] ?? 0, nums[16] ?? 0)} ${delta(nums[17] ?? 0, nums[18] ?? 0)}`,
    );
  }
  const result: MaterialContour = {
    width: w,
    height: h,
    radii,
    smoothing: s,
    extents: corners.flatMap((c) => [c.x, c.y]) as unknown as CornerRadii,
    key,
    corners,
    path: `${pathParts.join(' ')} Z`,
  };
  contours.set(key, result);
  if (contours.size > CACHE_LIMIT) contours.delete(contours.keys().next().value as string);
  return result;
}

// A depth-first query needs at most the subdivision depth, not one slot per
// segment. Queries are synchronous; this retained numeric stack never escapes.
const traversal = new Uint32Array(64);
function boundDistance(bounds: Float64Array, node: number, x: number, y: number): number {
  const dx = Math.max(0, (bounds[node] ?? 0) - x, x - (bounds[node + 2] ?? 0));
  const dy = Math.max(0, (bounds[node + 1] ?? 0) - y, y - (bounds[node + 3] ?? 0));
  return dx * dx + dy * dy;
}

/** Signed inside distance; writes the inward normal without per-pixel allocation. */
export function contourGeometry(
  contour: MaterialContour,
  x: number,
  y: number,
  normal: Float64Array,
): number {
  const right = contour.width - x;
  const bottom = contour.height - y;
  let distance = straightGeometry(x, y, contour.width, contour.height, contour.extents, normal);
  let squared = distance * distance;
  let sign = x < 0 || y < 0 || right < 0 || bottom < 0 ? -1 : 1;
  for (let i = 0; i < 4; i++) {
    const c = contour.corners[i] as ContourCorner;
    const sx = i === 1 || i === 2 ? -1 : 1;
    const sy = i >= 2 ? -1 : 1;
    const px = sx < 0 ? right : x;
    const py = sy < 0 ? bottom : y;
    if (!c.segments.length) continue;
    const diagonal = c.y * px + c.x * py - c.x * c.y;
    if (diagonal > 0 && diagonal * diagonal >= squared * (c.x * c.x + c.y * c.y)) continue;
    const dx = Math.max(0, -px, px - c.x);
    const dy = Math.max(0, -py, py - c.y);
    if (dx * dx + dy * dy >= squared) continue;
    let minimum = squared;
    let nx = 0;
    let ny = 0;
    let cornerSign = sign;
    let pending = 0;
    let node = 0;
    for (;;) {
      if (boundDistance(c.bounds, node, px, py) < minimum) {
        const start = c.bounds[node + 4] ?? -1;
        if (start < 0) {
          const left = node + 7;
          const right = c.bounds[left + 6] ?? c.bounds.length;
          const dl = boundDistance(c.bounds, left, px, py);
          const dr = boundDistance(c.bounds, right, px, py);
          const near = dl <= dr ? left : right;
          const far = dl <= dr ? right : left;
          if (Math.max(dl, dr) < minimum) traversal[pending++] = far;
          node = near;
          continue;
        }
        const end = c.bounds[node + 5] ?? 0;
        for (let j = start; j < end; j += 5) {
          const x0 = c.segments[j] ?? 0;
          const y0 = c.segments[j + 1] ?? 0;
          const dx = c.segments[j + 2] ?? 0;
          const dy = c.segments[j + 3] ?? 0;
          const t = Math.max(
            0,
            Math.min(1, ((px - x0) * dx + (py - y0) * dy) * (c.segments[j + 4] ?? 0)),
          );
          const qx = px - x0 - t * dx;
          const qy = py - y0 - t * dy;
          const candidate = qx * qx + qy * qy;
          if (candidate < minimum) {
            minimum = candidate;
            const length = candidate ? 1 : Math.hypot(dx, dy);
            nx = candidate ? qx : dy / length;
            ny = candidate ? qy : -dx / length;
            cornerSign = qx * dy - qy * dx >= 0 ? 1 : -1;
          }
        }
      }
      if (!pending) break;
      node = traversal[--pending] ?? 0;
    }
    if (minimum < squared) {
      squared = minimum;
      distance = Math.sqrt(minimum);
      sign = cornerSign;
      normal[0] = distance ? (sx * nx) / distance : sx * nx;
      normal[1] = distance ? (sy * ny) / distance : sy * ny;
    }
  }
  if (sign < 0) {
    normal[0] = -(normal[0] ?? 0);
    normal[1] = -(normal[1] ?? 0);
  }
  return sign * distance;
}
