/** Convex superellipse section, refracted with Snell's law. Renderer mapping
 * fitted jointly to the four untouched Figma Effects panes, not tier overrides.
 * See docs/evidence/materials-20261117/glass-optics.md and kube.io's derivation.
 */
const BEZEL_RATIO = 0.72;
const THICKNESS_RATIO = 0.4;
const INDEX = 2.8;
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

/** The depth-limited profile fits unchanged once half-size reaches depth. */
export function lensReach(depth: number): number {
  return Math.max(1, depth);
}

export function lensBand(depth: number, w: number, h: number): number {
  return Math.max(0, Math.min(Math.max(1, depth) * BEZEL_RATIO, Math.min(w, h) / 2));
}

export function lensDisplacement(
  inside: number,
  band: number,
  halfSize = Number.POSITIVE_INFINITY,
): number {
  if (inside <= 0 || inside >= band) return 0;
  const at = (inside / band) * SAMPLES;
  const lo = Math.floor(at);
  const start = profile[lo] ?? 0;
  const ray = (start + ((profile[lo + 1] ?? 0) - start) * (at - lo)) * (band / BEZEL_RATIO);
  // Joint Effects/Dock comparison selects depth as the profile's maximum reach.
  // This is a renderer approximation, not a physical law or Figma API contract.
  // The shared bound stays continuous across resize and asymmetric box axes;
  // those axes are not the contour's medial axes.
  return Math.min(ray, Math.max(0, Math.min(halfSize, band / BEZEL_RATIO) - inside));
}
