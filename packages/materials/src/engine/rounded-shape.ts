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
export function resolveCornerRadii(w: number, h: number, values: readonly string[]): RoundedShape {
  const radii = values.flatMap((value) => {
    const pair = axes(value.trim());
    return [length(pair[0] ?? '0px', w), length(pair[1] ?? pair[0] ?? '0px', h)];
  }) as unknown as CornerRadii;
  const [lx, ly, rx, ry, bx, by, ax, ay] = radii;
  const ratio = (dimension: number, sum: number) => (sum > 0 ? dimension / sum : 1);
  const f = Math.min(1, ratio(w, lx + rx), ratio(w, ax + bx), ratio(h, ly + ay), ratio(h, ry + by));
  const normalized = radii.map((r) => r * f) as unknown as CornerRadii;
  const first = normalized[0];
  return normalized.every((r) => r === first) ? first : normalized;
}

/** Distance inside a quarter-ellipse joined tangentially to two straight rays.
 * Outside values only mark clipping; the lens never samples those pixels.
 */
function cornerDistance(
  x: number,
  y: number,
  rx: number,
  ry: number,
  normal?: Float64Array,
  limit = Number.POSITIVE_INFINITY,
  sx = 1,
  sy = 1,
): number {
  if (rx === 0 || ry === 0 || x >= rx || y >= ry) {
    const distance = Math.min(x, y);
    if (normal && distance < limit) {
      normal[0] = x < y ? sx : 0;
      normal[1] = x < y ? 0 : sy;
    }
    return distance;
  }
  const qx = rx - x;
  const qy = ry - y;
  if (rx === ry) {
    const d = Math.hypot(qx, qy);
    if (normal && rx - d < limit) {
      normal[0] = (sx * qx) / d;
      normal[1] = (sy * qy) / d;
    }
    return rx - d;
  }
  if ((qx / rx) ** 2 + (qy / ry) ** 2 >= 1) {
    if (normal && 0 < limit) {
      normal[0] = 0;
      normal[1] = 0;
    }
    return 0;
  }
  // Nearest point on the ellipse is (a² qx/(t+a²), b² qy/(t+b²)).
  // Both coordinates are positive here. Its unique root lies between
  // max(a*qx-a²,b*qy-b²) and zero, without the singularities at -a²/-b².
  const a2 = rx * rx;
  const b2 = ry * ry;
  let lo = Math.max(rx * qx - a2, ry * qy - b2);
  let hi = 0;
  for (let i = 0; i < 32; i++) {
    const t = (lo + hi) / 2;
    const u = (rx * qx) / (t + a2);
    const v = (ry * qy) / (t + b2);
    if (u * u + v * v > 1) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2;
  const nx = (a2 * qx) / (t + a2) - qx;
  const ny = (b2 * qy) / (t + b2) - qy;
  const distance = Math.hypot(nx, ny);
  if (normal && distance < limit) {
    normal[0] = (sx * nx) / distance;
    normal[1] = (sy * ny) / distance;
  }
  return distance;
}

/** Return distance and write the inward unit normal at the closest boundary.
 * Caller retains one two-number scratch; the ellipse solver allocates nothing.
 */
export function writeStraightNormal(
  x: number,
  y: number,
  w: number,
  h: number,
  distance: number,
  normal: Float64Array,
): boolean {
  // On a medial tie, both field paths choose the vertical normal. The optical
  // result must not change when an imperceptible corner edit selects another path.
  if (distance === y || distance === h - y) {
    normal[0] = 0;
    normal[1] = distance === y ? 1 : -1;
    return true;
  }
  if (distance === x || distance === w - x) {
    normal[0] = distance === x ? 1 : -1;
    normal[1] = 0;
    return true;
  }
  return false;
}

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
  let distance = Math.min(x, y, right, bottom);
  writeStraightNormal(x, y, w, h, distance, normal);
  // Most pixels meet a straight edge. Enter the ellipse solver only in an
  // actual corner region; unusually large CSS corners may overlap, so examine
  // every applicable corner instead of assuming a quadrant partition.
  if (x < r[0] && y < r[1])
    distance = Math.min(distance, cornerDistance(x, y, r[0], r[1], normal, distance));
  if (right < r[2] && y < r[3])
    distance = Math.min(distance, cornerDistance(right, y, r[2], r[3], normal, distance, -1, 1));
  if (right < r[4] && bottom < r[5])
    distance = Math.min(
      distance,
      cornerDistance(right, bottom, r[4], r[5], normal, distance, -1, -1),
    );
  if (x < r[6] && bottom < r[7])
    distance = Math.min(distance, cornerDistance(x, bottom, r[6], r[7], normal, distance, 1, -1));
  return distance;
}

/** A CSS rounded box is the intersection of its four rounded corner regions.
 * For an interior point, distance to the boundary is their minimum distance.
 */
export function roundedShapeInside(
  x: number,
  y: number,
  w: number,
  h: number,
  r: CornerRadii,
): number {
  const right = w - x;
  const bottom = h - y;
  let distance = Math.min(x, y, right, bottom);
  if (x < r[0] && y < r[1]) distance = Math.min(distance, cornerDistance(x, y, r[0], r[1]));
  if (right < r[2] && y < r[3]) distance = Math.min(distance, cornerDistance(right, y, r[2], r[3]));
  if (right < r[4] && bottom < r[5])
    distance = Math.min(distance, cornerDistance(right, bottom, r[4], r[5]));
  if (x < r[6] && bottom < r[7])
    distance = Math.min(distance, cornerDistance(x, bottom, r[6], r[7]));
  return distance;
}

export const shapeKey = (shape: RoundedShape): string =>
  typeof shape === 'number'
    ? String(shape)
    : 'radii' in shape
      ? `${shape.radii.join(',')}s${shape.smoothing}`
      : shape.join(',');
