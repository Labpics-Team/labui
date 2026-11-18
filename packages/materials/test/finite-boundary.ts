/** Independent dense sampling of the actual SVG/CSS boundary, for test oracles.
 * No production distance routine, segment buffer, or search accelerator is used.
 */
type Point = readonly [number, number];
const STEPS = 4096;

export function roundedBoundary(w: number, h: number, radii: readonly number[]): Point[] {
  const points: Point[] = [];
  for (const corner of [1, 2, 3, 0]) {
    const rawX = radii[2 * corner] ?? 0;
    const rawY = radii[2 * corner + 1] ?? 0;
    const rx = rawY ? rawX : 0;
    const ry = rawX ? rawY : 0;
    const cx = corner === 1 || corner === 2 ? w - rx : rx;
    const cy = corner >= 2 ? h - ry : ry;
    for (let i = 0; i <= STEPS; i++) {
      const angle = ((corner - 2 + i / STEPS) * Math.PI) / 2;
      points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
    }
  }
  return points;
}

/** SVG endpoint-to-centre arc conversion follows SVG 2, implementation notes. */
export function svgBoundary(path: string): Point[] {
  const tokens = path.match(/[a-zA-Z]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/g) ?? [];
  let at = 0;
  let x = 0;
  let y = 0;
  const number = () => Number(tokens[at++]);
  const points: Point[] = [];
  while (at < tokens.length) {
    const command = tokens[at++];
    if (command === 'M' || command === 'L') {
      x = number();
      y = number();
      points.push([x, y]);
    } else if (command === 'c') {
      const x1 = x + number();
      const y1 = y + number();
      const x2 = x + number();
      const y2 = y + number();
      const x3 = x + number();
      const y3 = y + number();
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS;
        const s = 1 - t;
        points.push([
          s ** 3 * x + 3 * s * s * t * x1 + 3 * s * t * t * x2 + t ** 3 * x3,
          s ** 3 * y + 3 * s * s * t * y1 + 3 * s * t * t * y2 + t ** 3 * y3,
        ]);
      }
      x = x3;
      y = y3;
    } else if (command === 'a') {
      let rx = number();
      let ry = number();
      const phi = (number() * Math.PI) / 180;
      const large = number();
      const sweep = number();
      const toX = x + number();
      const toY = y + number();
      if (toX === x && toY === y) continue;
      const cos = Math.cos(phi);
      const sin = Math.sin(phi);
      const xp = (cos * (x - toX)) / 2 + (sin * (y - toY)) / 2;
      const yp = (-sin * (x - toX)) / 2 + (cos * (y - toY)) / 2;
      const scale = Math.max(1, Math.sqrt((xp * xp) / (rx * rx) + (yp * yp) / (ry * ry)));
      rx *= scale;
      ry *= scale;
      const factor =
        (large === sweep ? -1 : 1) *
        Math.sqrt(
          Math.max(
            0,
            (rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp) /
              (rx * rx * yp * yp + ry * ry * xp * xp),
          ),
        );
      const cxp = (factor * rx * yp) / ry;
      const cyp = (-factor * ry * xp) / rx;
      const cx = cos * cxp - sin * cyp + (x + toX) / 2;
      const cy = sin * cxp + cos * cyp + (y + toY) / 2;
      const start = Math.atan2((yp - cyp) / ry, (xp - cxp) / rx);
      let span = Math.atan2((-yp - cyp) / ry, (-xp - cxp) / rx) - start;
      if (sweep && span < 0) span += 2 * Math.PI;
      if (!sweep && span > 0) span -= 2 * Math.PI;
      for (let i = 1; i <= STEPS; i++) {
        const angle = start + (span * i) / STEPS;
        points.push([
          cx + rx * Math.cos(angle) * cos - ry * Math.sin(angle) * sin,
          cy + rx * Math.cos(angle) * sin + ry * Math.sin(angle) * cos,
        ]);
      }
      x = toX;
      y = toY;
    } else if (command !== 'Z') throw new Error(`Unexpected SVG command: ${command}`);
  }
  return points;
}

export function boundaryReference(points: readonly Point[], x: number, y: number) {
  let squared = Number.POSITIVE_INFINITY;
  let bx = 0;
  let by = 0;
  let inside = false;
  for (let i = 0, previous = points.length - 1; i < points.length; previous = i++) {
    const [ax, ay] = points[previous] as Point;
    const [cx, cy] = points[i] as Point;
    const dx = cx - ax;
    const dy = cy - ay;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0;
    const qx = ax + t * dx;
    const qy = ay + t * dy;
    const d = (x - qx) ** 2 + (y - qy) ** 2;
    if (d < squared) {
      squared = d;
      bx = qx;
      by = qy;
    }
    if (ay > y !== cy > y && x < ax + ((y - ay) * dx) / dy) inside = !inside;
  }
  const distance = (inside ? 1 : -1) * Math.sqrt(squared);
  return { distance, x: bx, y: by, nx: (x - bx) / distance, ny: (y - by) / distance };
}
