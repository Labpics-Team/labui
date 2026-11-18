import type { MaterialContour } from './contour';

/** CSS used corner radii, clockwise from top-left; each pair is x/y. */
export type CornerRadii = readonly [number, number, number, number, number, number, number, number];
export type RoundedShape = number | CornerRadii | MaterialContour;

function length(value: string, dimension: number): number {
  // Computed CSS resolves absolute units to px, but comparison functions can
  // retain percentages. Evaluate the expression against EACH used axis before
  // applying CSS's shared overlap scaling. No DOM probe or forced layout.
  const tokens = value.match(/(?:\d*\.)?\d+(?:e[+-]?\d+)?(?:px|%)?|[a-z]+|[^\s]/gi) ?? [];
  let index = 0;
  const sum = (): number => {
    let out = product();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const op = tokens[index++];
      const next = product();
      out = op === '+' ? out + next : out - next;
    }
    return out;
  };
  const product = (): number => {
    let out = primary();
    while (tokens[index] === '*' || tokens[index] === '/') {
      const op = tokens[index++];
      const next = primary();
      out = op === '*' ? out * next : out / next;
    }
    return out;
  };
  const primary = (): number => {
    const token = tokens[index++] ?? '';
    if (token === '+') return primary();
    if (token === '-') return -primary();
    if (token === '(') {
      const out = sum();
      if (tokens[index++] !== ')') return Number.NaN;
      return out;
    }
    if (['calc', 'min', 'max', 'clamp'].includes(token)) {
      if (tokens[index++] !== '(') return Number.NaN;
      const args = [sum()];
      while (tokens[index] === ',') {
        index++;
        args.push(sum());
      }
      if (tokens[index++] !== ')') return Number.NaN;
      if (token === 'min') return Math.min(...args);
      if (token === 'max') return Math.max(...args);
      if (token === 'clamp')
        return args.length === 3
          ? Math.max(args[0] ?? Number.NaN, Math.min(args[1] ?? Number.NaN, args[2] ?? Number.NaN))
          : Number.NaN;
      return args.length === 1 ? (args[0] ?? Number.NaN) : Number.NaN;
    }
    const n = Number.parseFloat(token);
    return token.endsWith('%') ? (n * dimension) / 100 : n;
  };
  const out = sum();
  return index === tokens.length && Number.isFinite(out) ? Math.max(0, out) : 0;
}

function axes(value: string): readonly string[] {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && /\s/.test(c ?? '')) return [value.slice(0, i), value.slice(i).trim()];
  }
  return [value];
}

/** https://www.w3.org/TR/css-backgrounds-3/#corner-overlap */
export function normalizeCornerRadii(w: number, h: number, radii: CornerRadii): CornerRadii {
  const [lx, ly, rx, ry, bx, by, ax, ay] = radii;
  const ratio = (dimension: number, sum: number) => (sum > 0 ? dimension / sum : 1);
  const f = Math.min(1, ratio(w, lx + rx), ratio(w, ax + bx), ratio(h, ly + ay), ratio(h, ry + by));
  return f === 1 ? radii : (radii.map((r) => r * f) as unknown as CornerRadii);
}

export function resolveCornerRadii(w: number, h: number, values: readonly string[]): RoundedShape {
  const radii = values.flatMap((value) => {
    const pair = axes(value.trim());
    return [length(pair[0] ?? '0px', w), length(pair[1] ?? pair[0] ?? '0px', h)];
  }) as unknown as CornerRadii;
  const normalized = normalizeCornerRadii(w, h, radii);
  const first = normalized[0];
  return normalized.every((r) => r === first) ? first : normalized;
}

/** Distance to the four FINITE straight parts, including their endpoints.
 * The caller compares the arcs against this upper bound. Vertical wins ties,
 * matching the circular field's deterministic medial-axis convention.
 */
export function straightGeometry(
  x: number,
  y: number,
  w: number,
  h: number,
  r: CornerRadii,
  normal: Float64Array,
): number {
  const tlx = r[1] ? r[0] : 0;
  const tly = r[0] ? r[1] : 0;
  const trx = r[3] ? r[2] : 0;
  const try_ = r[2] ? r[3] : 0;
  const brx = r[5] ? r[4] : 0;
  const bry = r[4] ? r[5] : 0;
  const blx = r[7] ? r[6] : 0;
  const bly = r[6] ? r[7] : 0;
  let nx = x < tlx ? x - tlx : x > w - trx ? x - w + trx : 0;
  let ny = y;
  let squared = nx * nx + ny * ny;
  let zeroX = 0;
  let zeroY = 1;
  let dx = x < blx ? x - blx : x > w - brx ? x - w + brx : 0;
  let dy = y - h;
  let next = dx * dx + dy * dy;
  if (next < squared) {
    squared = next;
    nx = dx;
    ny = dy;
    zeroY = -1;
  }
  dx = x;
  dy = y < tly ? y - tly : y > h - bly ? y - h + bly : 0;
  next = dx * dx + dy * dy;
  if (next < squared) {
    squared = next;
    nx = dx;
    ny = dy;
    zeroX = 1;
    zeroY = 0;
  }
  dx = x - w;
  dy = y < try_ ? y - try_ : y > h - bry ? y - h + bry : 0;
  next = dx * dx + dy * dy;
  if (next < squared) {
    squared = next;
    nx = dx;
    ny = dy;
    zeroX = -1;
    zeroY = 0;
  }
  const distance = Math.sqrt(squared);
  normal[0] = distance ? nx / distance : zeroX;
  normal[1] = distance ? ny / distance : zeroY;
  return distance;
}

/** Closest point on a quarter ellipse, not on a reflected full ellipse.
 * Put the major axis first. For qx > 0, the distance derivative divided by cos(t)
 * is F(s) = (b²-a²)s + a*qx*s/sqrt(1-s²) - b*qy, s=sin(t).
 * F' changes sign at most once; its increasing branch contains the only possible
 * interior minimum. The two endpoints are already covered by straightGeometry.
 * Unlike unconstrained Newton iteration, this bracket cannot find a maximum or
 * cross into the other three quadrants. No allocation in the pixel loop.
 */
function ellipseGeometry(
  x: number,
  y: number,
  rx: number,
  ry: number,
  normal: Float64Array,
  limit: number,
  sx: number,
  sy: number,
): number {
  if (!rx || !ry) return limit;
  // The convex arc lies in the triangle of its endpoints and the box corner.
  // Its diagonal supporting half-plane is a stronger bound than the AABB.
  const diagonal = ry * x + rx * y - rx * ry;
  if (diagonal > 0 && diagonal * diagonal >= limit * limit * (rx * rx + ry * ry)) return limit;
  const bx = Math.max(0, -x, x - rx);
  const by = Math.max(0, -y, y - ry);
  if (bx * bx + by * by >= limit * limit) return limit;
  const swap = ry > rx;
  const a = swap ? ry : rx;
  const b = swap ? rx : ry;
  const qx = a - (swap ? y : x);
  const qy = b - (swap ? x : y);
  if (qx <= 0) return limit;
  let u: number;
  let v: number;
  if (a === b) {
    if (qy <= 0) return limit;
    const length = Math.hypot(qx, qy);
    u = (a * qx) / length;
    v = (a * qy) / length;
  } else {
    const delta = a * a - b * b;
    const ax = a * qx;
    const by = b * qy;
    const turningCos = Math.min(1, Math.cbrt(ax / delta));
    let lo = Math.sqrt(Math.max(0, 1 - turningCos * turningCos));
    let hi = 1;
    if (-delta * lo + (ax * lo) / turningCos - by >= 0) return limit;
    let s = (lo + hi) / 2;
    for (let i = 0; i < 48; i++) {
      const cos = Math.sqrt((1 - s) * (1 + s));
      const value = -delta * s + (ax * s) / cos - by;
      if (value < 0) lo = s;
      else hi = s;
      const slope = -delta + ax / (cos * cos * cos);
      const step = value / slope;
      // Newton stays on the increasing branch; fall back to its retained
      // bracket near the turning point or when a step would cross an endpoint.
      const next = s - step;
      if ((Math.abs(step) * a) / Math.max(cos, Number.EPSILON) < 1e-10) break;
      const bounded = next > lo && next < hi ? next : (lo + hi) / 2;
      if (bounded === s) break;
      s = bounded;
    }
    u = a * Math.sqrt((1 - s) * (1 + s));
    v = b * s;
  }
  const dx = u - qx;
  const dy = v - qy;
  const distance = Math.hypot(dx, dy);
  if (distance < limit) {
    // Near the boundary, subtracting two nearly equal points destroys the
    // direction. The implicit ellipse gradient remains well conditioned.
    const nearBoundary = distance <= 1e-8 * Math.max(1, a);
    const orientation = nearBoundary && outsideCorner(x, y, rx, ry) ? -1 : 1;
    const gx = nearBoundary ? (orientation * u) / (a * a) : dx / distance;
    const gy = nearBoundary ? (orientation * v) / (b * b) : dy / distance;
    const scale = nearBoundary ? Math.hypot(gx, gy) : 1;
    normal[0] = (sx * (swap ? gy : gx)) / scale;
    normal[1] = (sy * (swap ? gx : gy)) / scale;
    return distance;
  }
  return limit;
}

/** Exact CSS arc clipping, independent of which boundary feature is nearest. */
function outsideCorner(x: number, y: number, rx: number, ry: number): boolean {
  return rx > 0 && ry > 0 && x < rx && y < ry && ((rx - x) / rx) ** 2 + ((ry - y) / ry) ** 2 > 1;
}

/** Signed inside distance and inward normal for CSS USED (overlap-scaled) radii. */
export function roundedShapeGeometry(
  x: number,
  y: number,
  w: number,
  h: number,
  r: CornerRadii,
  normal: Float64Array,
): number {
  const right = w - x;
  const bottom = h - y;
  let distance = straightGeometry(x, y, w, h, r, normal);
  distance = ellipseGeometry(x, y, r[0], r[1], normal, distance, 1, 1);
  distance = ellipseGeometry(right, y, r[2], r[3], normal, distance, -1, 1);
  distance = ellipseGeometry(right, bottom, r[4], r[5], normal, distance, -1, -1);
  distance = ellipseGeometry(x, bottom, r[6], r[7], normal, distance, 1, -1);
  const outside =
    x < 0 ||
    y < 0 ||
    right < 0 ||
    bottom < 0 ||
    outsideCorner(x, y, r[0], r[1]) ||
    outsideCorner(right, y, r[2], r[3]) ||
    outsideCorner(right, bottom, r[4], r[5]) ||
    outsideCorner(x, bottom, r[6], r[7]);
  if (outside) {
    normal[0] = -(normal[0] ?? 0);
    normal[1] = -(normal[1] ?? 0);
  }
  return outside ? -distance : distance;
}

/** Distance-only convenience; the retained field calls the combined operation once. */
const distanceNormal = new Float64Array(2);
export function roundedShapeInside(
  x: number,
  y: number,
  w: number,
  h: number,
  r: CornerRadii,
): number {
  return roundedShapeGeometry(x, y, w, h, r, distanceNormal);
}

export const shapeKey = (shape: RoundedShape): string =>
  typeof shape === 'number'
    ? String(shape)
    : 'radii' in shape
      ? `${shape.radii.join(',')}s${shape.smoothing}`
      : shape.join(',');
