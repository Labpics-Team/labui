/** Convex superellipse section, refracted with Snell's law. Renderer mapping
 * fitted jointly to the four untouched Figma Effects panes, not tier overrides.
 * See docs/evidence/materials-20261117/glass-optics.md and kube.io's derivation.
 */
const BEZEL_RATIO = 0.72;
const THICKNESS_RATIO = 0.6;
const INDEX = 2.2;
const POWER = 2.7;
const SAMPLES = 1024;

/** The profile is dimensionless: one small immutable table serves every depth.
 * expensive powers/square roots never execute in the per-pixel field loop.
 */
const profile = Float64Array.from({ length: SAMPLES + 1 }, (_, i) => {
  if (i === 0) return Math.sqrt(INDEX * INDEX - 1) * THICKNESS_RATIO;
  if (i === SAMPLES) return 0;
  const t = i / SAMPLES;
  const height = (1 - (1 - t) ** POWER) ** (1 / POWER);
  const slope = ((1 - t) / height) ** (POWER - 1);
  const cosI = 1 / Math.sqrt(1 + slope * slope);
  const sinI = slope * cosI;
  const cosT = Math.sqrt(1 - (sinI / INDEX) ** 2);
  const rayX = sinI * (cosT - cosI / INDEX);
  const rayZ = cosI * cosT + (sinI * sinI) / INDEX;
  return (rayX / rayZ) * (THICKNESS_RATIO + height * BEZEL_RATIO);
});

export function lensBand(depth: number, w: number, h: number): number {
  return Math.max(0, Math.min(Math.max(1, depth) * BEZEL_RATIO, Math.min(w, h) / 2));
}

export function lensDisplacement(inside: number, band: number): number {
  if (inside <= 0 || inside >= band) return 0;
  const at = (inside / band) * SAMPLES;
  const lo = Math.floor(at);
  const start = profile[lo] ?? 0;
  return (start + ((profile[lo + 1] ?? 0) - start) * (at - lo)) * (band / BEZEL_RATIO);
}

/** Keep each ray on its side of the shape's medial axes when a small control
 * constrains the available glass thickness. This does not affect the author
 * 256px panes; it prevents a deep recipe from crossing a narrow control.
 */
export function confineRay(
  magnitude: number,
  x: number,
  y: number,
  nx: number,
  ny: number,
): number {
  return Math.min(
    magnitude,
    nx === 0 ? Number.POSITIVE_INFINITY : Math.abs(x / nx),
    ny === 0 ? Number.POSITIVE_INFINITY : Math.abs(y / ny),
  );
}
