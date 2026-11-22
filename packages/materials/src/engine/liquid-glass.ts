/** Shape-aware refraction. Frost, paints and directional light belong to the
 * shared author profile; this engine owns only the retained displacement map. */
import { materialProfile } from '../profile';
import { readBorderBox } from './border-box';
import { type MaterialContour, contourGeometry, materialContour } from './contour';
import {
  type GlassAtlas,
  type GlassAtlasPlan,
  buildGlassAtlas,
  glassAtlasMarkup,
  glassAtlasPlan,
  resizeGlassAtlas,
} from './glass-atlas';
import { NEUTRAL_VECTOR_RGBA } from './glass-field-format';
import { lensBand, lensDisplacement } from './glass-optics';
// Geometry, optical profile and displacement encoding remain DOM-free.
import { sdRoundRect } from './lg-math';
import { ensureHiddenDefs, removeFilter, supportsBackdropFilterUrl } from './mount';
import {
  type CornerRadii,
  type RoundedShape,
  normalizeCornerRadii,
  resolveCornerRadii,
  roundedShapeGeometry,
  shapeKey,
} from './rounded-shape';

export interface LiquidGlassParams {
  refraction?: number;
  depth?: number;
  dispersion?: number;
}

export interface PerfReport {
  reason: 'rebuild' | 'restamp';
  mapMs: number;
  totalMs: number;
  mapW: number;
  mapH: number;
  w: number;
  h: number;
}

export interface AttachOptions extends LiquidGlassParams {
  /** Optional perf hook — DEV only. When provided, render() reports timing.
   *  Pass nothing in production → zero overhead (no performance.now() calls). */
  onPerf?: (report: PerfReport) => void;
}

export interface LiquidGlassHandle {
  update(p: LiquidGlassParams): void;
  refresh(): void;
  setEnabled(b: boolean): void;
  destroy(): void;
  readonly refracts: boolean;
}

interface MapEntry {
  atlas?: GlassAtlas;
  href: string | null;
  ready: Promise<string> | null;
  unit: number;
  mapW: number;
  mapH: number;
  refs: number;
  evicted: boolean;
}

interface StampedShape {
  map: MapEntry;
  w: number;
  h: number;
  dispersed: boolean;
  scales: string[];
}

interface RenderParams {
  w: number;
  h: number;
  corner: RoundedShape;
  refraction: number;
  depth: number;
  dispersion: number;
  reduced: boolean;
}

interface EngineState extends LiquidGlassHandle {
  el: HTMLElement;
  id: string;
  filter: SVGFilterElement;
  enabled: boolean;
  refracts: boolean;
  params: LiquidGlassParams;
  gen: number;
  /** geometry last targeted by render() (drives the cheap-restamp) */
  geoKey: string | null;
  /** geometry we currently hold a cache ref for (drives refcount) */
  heldKey: string | null;
  map: MapEntry | null;
  pendingMap: MapEntry | null;
  /** what the <filter> currently holds (drives the attribute-only re-stamp) */
  stamped: StampedShape | null;
  /** live feDisplacementMap nodes of the current structure */
  dispNodes: Element[] | null;
  mapNodes: Element[] | null;
  /** last backdrop-filter string we wrote (skip repeats) */
  lastBackdrop: string | undefined;
  onPerf: ((report: PerfReport) => void) | null;
}

const SVGNS = 'http://www.w3.org/2000/svg';
const registry = new WeakMap<Element, EngineState>(); // host element → state (no DOM expando)
let uid = 0;

/** Скрытый defs-хост линзы — общий примитив (./mount), делится с acrylic-движком
 *  (тот же паттерн, разные className). Раньше — локальная копия `ensureDefs`. */
const ensureDefs = (el: HTMLElement): SVGDefsElement => ensureHiddenDefs('lab-lg-defs', el);

export const LENSED_CLASS = 'lab-material--lensed';
const DEFAULTS = { ...materialProfile.tiers.base.glass, corner: 0 };

/** Whether this engine REFRACTS the backdrop. The requirement is the browser's
 *  ability to render a url()-referenced SVG filter on a backdrop — the shared
 *  capability probe (./mount). Author paints have separate Gecko/WebKit adapters.
 *  The name stays glass-specific (its public semantics = "does the lens bend the
 *  backdrop"); the probe underneath is neutral. Everyone else keeps the honest
 *  blur fallback. */
export function supportsRefraction(): boolean {
  return supportsBackdropFilterUrl();
}

// Reused scratch across builds (grown on demand): the displacement vectors and
// the rasterising canvas. The map build is the only allocation-heavy step;
// reusing these keeps GC flat under a resize STORM (many builds back-to-back).
// The bytes written are identical regardless of reuse.
//
// MEMORY BOUND: without release these grow to a permanent high-water mark — one
// giant resize parks a multi-MB Float32Array + canvas forever. We keep them ONLY
// across a burst, then free them after a short idle so steady state retains no
// scratch. The next build re-allocates lazily (cost paid once, off the hot path).
let sDx: Float32Array | null = null;
let sRGBA: Uint8ClampedArray | null = null; // reused RGBA byte scratch (grown on demand) → no per-build zero-fill
let sRowEnd: Int32Array | null = null; // per-row rim width (rim-skip): shared field→encode so both loops stop at the same column
let sCanvas: HTMLCanvasElement | null = null;
let sCtx: CanvasRenderingContext2D | null = null;
let scratchIdleTimer: ReturnType<typeof setTimeout> | null = null;
const SCRATCH_IDLE_MS = 2000;

/* ── SDF distance-field cache (separable field: geometry × depth) ────────────
 * The signed distance `inside = -sdRoundRect(px,py,w,h,r)` is a pure function of
 * GEOMETRY (w,h,corner,sc) — it does NOT depend on `depth`. Only `band` (=depth)
 * and the Snell profile applied to `inside/band` do. So the SDF is
 * SEPARABLE: cache the raw distance field per geometry, and a depth change reuses
 * it with ZERO sdRoundRect recomputes — the sqrt-heavy 43% of the field loop
 * (measured: 894µs→510µs on a 360×220@dpr2 panel) is skipped, only the cheap
 * depth-dependent profile + encode re-run (ceiling criterion б).
 *
 * GROW-ONLY, NO FIRST-BUILD REGRESSION: the field loop caches EXACTLY the rim
 * columns it already walks (rim-skip stops each row at the first flat column).
 * A first build stores what it computes; a later SMALLER band reads a subset
 * (0 recompute); a LARGER band resumes from the covered edge (only the delta
 * ring calls sdRoundRect — still 0 FULL recomputes). Values are stored as
 * Float64Array — the exact IEEE-754 double sdRoundRect returned — so feeding a
 * cached value through the identical downstream arithmetic is BYTE-IDENTICAL.
 * Proven two ways: the golden corpus locks the cold + shrink-hit bytes, and
 * engine-sdf-cache hashes BOTH the grow-resume and the shrink-hit outputs against
 * a from-scratch build (delta-ring end/mirror/encode byte-verified, not just
 * counter-verified).
 *
 * KEY = `${w}x${h}x${corner}x${sc}` — every input that moves `inside` (r derives
 * from w,h,corner; px/py from sc). Dropping any component collides two distinct
 * geometries onto one field → wrong bytes (a golden red + the key-mutation test).
 *
 * MEMORY: one Float64Array(halfW·halfH) per geometry — comparable to the 8N-byte
 * sDx scratch it rides beside. Bounded by SDF_CACHE_CAP (LRU) for burst safety
 * and cleared with the scratch on idle, so steady state retains nothing. */
interface SdfEntry {
  inside: Float64Array; // quarter distance field, indexed [Y*halfW + X]
  normals?: Float64Array;
  covered: Int32Array; // per top-half row: how many columns have been computed
  halfW: number;
  halfH: number;
}
const SDF_CACHE_CAP = 4;
const sdfCache = new Map<string, SdfEntry>(); // geometry (no depth) → distance field
const asymmetricSdfCache = new Map<
  string,
  {
    distances: Float64Array;
    normals: Float32Array;
    left: Int32Array;
    right: Int32Array;
  }
>();
let sdfComputeCount = 0; // cumulative sdRoundRect calls (the counter-assert reads this)

function releaseScratch(): void {
  sDx = null;
  sRGBA = null;
  sRowEnd = null;
  if (sCanvas) {
    sCanvas.width = 0; // drop the backing store immediately, not just the ref
    sCanvas.height = 0;
  }
  sCanvas = null;
  sCtx = null;
  sdfCache.clear(); // the distance fields are scratch too — no steady-state retention
  asymmetricSdfCache.clear();
}

function armScratchRelease(): void {
  if (typeof setTimeout === 'undefined') return;
  if (scratchIdleTimer) clearTimeout(scratchIdleTimer);
  scratchIdleTimer = setTimeout(() => {
    scratchIdleTimer = null;
    releaseScratch();
  }, SCRATCH_IDLE_MS);
}

/**
 * The DOM-free hot core: compute ONE displacement map's RGBA bytes at
 * DEVICE-pixel resolution, plus the feDisplacementMap `scale` unit.
 *   R = x sample-shift, G = y sample-shift (no shift → the neutral byte 128)
 *
 * Rays follow the inward boundary normal, through a convex optical section
 * with a clear interior. Depth sets thickness and bezel; the available local
 * size limits both on small controls. Straight edges do not pull diagonally
 * toward the centre of a long panel.
 *
 * Geometry-only (no strength baked in): the displacement is encoded normalised,
 * and `unit` is the feDisplacementMap `scale` that reconstructs the true pixel
 * shift at refraction = 1. So changing refraction is a cheap scale change.
 *
 * No canvas/ImageData here — buildMap() rasterises the returned bytes for the
 * browser, while a bare Node test runner can call this directly and hash the
 * map. Exported under a `__` name (like __cacheStats) so it stays OFF the
 * package surface (ADR-0003 §3): buildMap, the golden test, the sdf-cache test,
 * and the bench read it — never a package consumer.
 */
export function __computeDisplacementField(
  w: number,
  h: number,
  shape: RoundedShape,
  depth: number,
  dpr: number,
): { data: Uint8ClampedArray; W: number; H: number; unit: number } {
  const usedShape =
    typeof shape !== 'number' && !('radii' in shape) ? normalizeCornerRadii(w, h, shape) : shape;
  const corner =
    typeof usedShape !== 'number' &&
    'radii' in usedShape &&
    (usedShape.width !== w || usedShape.height !== h)
      ? materialContour(w, h, usedShape.radii, usedShape.smoothing)
      : usedShape;
  const contour =
    typeof corner !== 'number' &&
    'radii' in corner &&
    corner.radii.every((r) => r === corner.radii[0])
      ? corner
      : null;
  if (typeof corner !== 'number' && !contour) return asymmetricField(w, h, corner, depth, dpr);
  const r = Math.max(0, Math.min(contour?.radii[0] ?? (corner as number), Math.min(w, h) / 2));
  const band = lensBand(depth, w, h);
  const halfSize = Math.min(w, h) / 2;
  const sc = Math.max(1, Math.min(dpr || 1, 2)); // device-pixel scale, capped at 2
  const W = Math.max(1, Math.round(w * sc));
  const H = Math.max(1, Math.round(h * sc));
  const N = W * H;

  if (!sDx || sDx.length < 2 * N) {
    sDx = new Float32Array(2 * N); // interleaved [dx,dy] pairs → one cache stream
  }
  const di = sDx;
  const halfH = (H + 1) >> 1; // rows we actually visit (top half incl. centre)
  const halfW = (W + 1) >> 1; // ceil — covers the centre column on odd W
  if (!sRowEnd || sRowEnd.length < halfH) sRowEnd = new Int32Array(halfH);
  const rowEnd = sRowEnd; // rim width per visited row → the encode pass reuses it
  let maxAbs = 1e-6;

  // Separable SDF field: `inside` depends only on geometry (w,h,corner,sc), not
  // on `depth`. Fetch (or lazily create) the per-geometry distance-field cache
  // so a depth change reads the sqrt-heavy `inside` back with 0 recomputes.
  const sdfKey = `${w}x${h}x${shapeKey(corner)}x${sc}`;
  let sdf = sdfCache.get(sdfKey);
  // Dims guard: the key ⇒ (halfW,halfH) deterministically today, so this never
  // fires — but if a future key edit ever let a mis-sized field answer a key, an
  // unguarded hit would misindex `inside`/`covered` and SILENTLY drop out-of-range
  // Float64Array writes → wrong bytes, no error. Treating a size mismatch as a
  // loud MISS (rebuild) makes halfW/halfH load-bearing instead of dead fields.
  if (sdf && (sdf.halfW !== halfW || sdf.halfH !== halfH)) sdf = undefined;
  if (sdf) {
    sdfCache.delete(sdfKey);
    sdfCache.set(sdfKey, sdf); // LRU touch (Map keeps insertion order)
  } else {
    sdf = {
      inside: new Float64Array(halfW * halfH),
      ...(contour ? { normals: new Float64Array(2 * halfW * halfH) } : {}),
      covered: new Int32Array(halfH),
      halfW,
      halfH,
    };
    sdfCache.set(sdfKey, sdf);
    while (sdfCache.size > SDF_CACHE_CAP) {
      const oldest = sdfCache.keys().next().value as string;
      sdfCache.delete(oldest); // evict LRU — burst bound (idle release clears all)
    }
  }
  const sInside = sdf.inside;
  const sCovered = sdf.covered;
  const normals = sdf.normals;
  const normal = contour ? new Float64Array(2) : null;

  // Distance, normal magnitude and optical section share four-way symmetry.
  // Only the normal's signs change, so one quarter supplies all four quadrants.
  // feImage stretches the rounded bitmap to the exact CSS box. Sample that
  // image's pixel centres; a fractional size/DPR gives each axis its own step.
  const stepX = w / W;
  const stepY = h / H;
  for (let Y = 0; Y < H; Y++) {
    const Ym = H - 1 - Y;
    if (Ym < Y) break; // bottom half already filled by its top twin
    const rowT = Y * W;
    const rowB = Ym * W;
    const py = (Y + 0.5) * stepY;
    const rowBase = Y * halfW; // this row's slice of the cached distance field
    const covered = sCovered[Y] as number; // columns already computed for this row
    // RIM-SKIP. A pixel is a no-op (dx=dy=0) once inside ≥ band — the
    // convex section becomes flat — and, because `inside` RISES monotonically
    // across the left half (distance to a convex-body boundary is concave, so it
    // only climbs toward the centre; verified with a zero-violation monotonicity
    // probe over the whole geometry corpus incl. the r = half circle), every
    // column past that first crossing is a no-op too. So we stop the row at that
    // column: [0,end) carry the rim, and the encode pass leaves [end,halfW) at the
    // prefilled neutral byte (128) that a zero displacement encodes to. Output is
    // byte-for-byte identical; the flat interior grows with area, so large maps
    // skip most of the work.
    let end = halfW; // no interior crossing ⇒ the whole left half is rim
    for (let X = 0; X < halfW; X++) {
      const px = (X + 0.5) * stepX;
      // Cached distance (the exact float64 sdRoundRect returned → byte-identical)
      // or a fresh compute past the covered edge. Depth-free, so a depth change
      // reads it back with 0 sqrt recomputes; a larger band computes only the
      // delta ring [covered, end].
      let inside: number;
      if (X < covered) {
        inside = sInside[rowBase + X] as number;
      } else {
        inside =
          contour && normal
            ? contourGeometry(contour, px, py, normal)
            : -sdRoundRect(px, py, w, h, r);
        if (normals && normal) {
          normals[2 * (rowBase + X)] = normal[0] ?? 0;
          normals[2 * (rowBase + X) + 1] = normal[1] ?? 0;
        }
        sInside[rowBase + X] = inside;
        sdfComputeCount++; // the counter-assert: 0 on a same-geometry depth reuse
      }
      if (inside >= band) {
        end = X; // first flat column — the rest of the row is flat too (monotone)
        break;
      }
      let dx = 0;
      let dy = 0;
      if (inside > 0) {
        const qx = r - px;
        const qy = r - py;
        const corner = qx > 0 && qy > 0;
        const nx = normals
          ? (normals[2 * (rowBase + X)] ?? 0)
          : corner
            ? qx / (r - inside)
            : qx > qy
              ? 1
              : 0;
        const ny = normals
          ? (normals[2 * (rowBase + X) + 1] ?? 0)
          : corner
            ? qy / (r - inside)
            : qx > qy
              ? 0
              : 1;
        const magnitude = lensDisplacement(inside, band, halfSize);
        dx = nx * magnitude;
        dy = ny * magnitude;
      }
      const adx = dx < 0 ? -dx : dx;
      const ady = dy < 0 ? -dy : dy;
      if (adx > maxAbs) maxAbs = adx;
      if (ady > maxAbs) maxAbs = ady;
      // Top-left (X,Y) and its three mirror twins. dx flips across the vertical
      // axis, dy flips across the horizontal axis. Writing Xm/Ym twice when they
      // equal X/Y (centre col/row on odd dims) is a harmless idempotent re-store.
      const Xm = W - 1 - X;
      let p = (rowT + X) << 1;
      di[p] = dx;
      di[p + 1] = dy;
      p = (rowT + Xm) << 1;
      di[p] = -dx;
      di[p + 1] = dy;
      p = (rowB + X) << 1;
      di[p] = dx;
      di[p + 1] = -dy;
      p = (rowB + Xm) << 1;
      di[p] = -dx;
      di[p + 1] = -dy;
    }
    // Extend coverage to the furthest column we computed (never shrink — a later
    // smaller band must still find the wider cached run). `end` computed inside[end]
    // on a miss (the break reads it), so cols [0,end] are cached ⇒ covered = end+1.
    const reach = end < halfW ? end + 1 : halfW;
    if (reach > (sCovered[Y] as number)) sCovered[Y] = reach;
    rowEnd[Y] = end; // rim width for this row — the encode pass and its bottom twin reuse it
  }

  // Encode [-maxAbs, maxAbs] → [0,1] with no clipping. feDisplacementMap shifts
  // by scale·(channel − 0.5); with scale = 2·maxAbs the shift reconstructs the
  // true pixel displacement exactly. Reused RGBA scratch instead of a fresh
  // createImageData: an exact-length subarray view is wrapped in a fresh
  // ImageData by buildMap (the constructor requires view.length === 4·W·H).
  const need = N * 4;
  if (!sRGBA || sRGBA.length < need) sRGBA = new Uint8ClampedArray(need);
  const data = sRGBA.length === need ? sRGBA : sRGBA.subarray(0, need);
  const norm = 1 / (2 * maxAbs);
  const norm255 = norm * 255;
  const u32 = new Uint32Array(data.buffer, data.byteOffset, N);
  // Prefill the WHOLE map with the neutral byte (R=G=B=128, A=255). The flat
  // interior the rim-skip left uncomputed encodes to EXACTLY this (a zero
  // displacement → 0·norm255+127.5 → Uint8Clamped 128), so the rim loop below
  // only has to overwrite R/G on the ring. (The old fill was 0xff800000 with a
  // full-map R/G rewrite; the interior R/G are now the fill — byte-identical.)
  u32.fill(NEUTRAL_VECTOR_RGBA); // little-endian RGBA: R=128 G=128 B=128 A=255
  // Encode with the SAME 4-way symmetry used to compute the field, so the
  // per-pixel Float32 read + multiply-add runs for ~N/4 pixels instead of N, and
  // for a mirror twin dx→−dx (dy→−dy) we recompute −dx·norm255+127.5 directly (no
  // derived 255−v trick, which could round differently) → bytes stay bit-identical
  // to the flat pass. Each row only walks its own rim width [0,rowEnd[Y]); the
  // interior columns keep the neutral prefill.
  for (let Y = 0; Y < H; Y++) {
    const Ym = H - 1 - Y;
    if (Ym < Y) break;
    const rowT = Y * W;
    const rowB = Ym * W;
    const end = rowEnd[Y] as number; // this row's rim width serves its bottom twin too
    for (let X = 0; X < end; X++) {
      const Xm = W - 1 - X;
      const kT = rowT + X;
      const pT = kT << 1;
      const dx = di[pT] as number;
      const dy = di[pT + 1] as number;
      const rPos = dx * norm255 + 127.5; // R for +dx
      const gPos = dy * norm255 + 127.5; // G for +dy
      const rNeg = -dx * norm255 + 127.5; // R for −dx (mirror about vertical axis)
      const gNeg = -dy * norm255 + 127.5; // G for −dy (mirror about horizontal axis)
      let i = kT << 2; // top-left (+dx,+dy)
      data[i] = rPos;
      data[i + 1] = gPos;
      i = (rowT + Xm) << 2; // top-right (−dx,+dy)
      data[i] = rNeg;
      data[i + 1] = gPos;
      i = (rowB + X) << 2; // bottom-left (+dx,−dy)
      data[i] = rPos;
      data[i + 1] = gNeg;
      i = (rowB + Xm) << 2; // bottom-right (−dx,−dy)
      data[i] = rNeg;
      data[i + 1] = gNeg;
    }
  }
  return { data, W, H, unit: 2 * maxAbs };
}

/** General CSS shape path. Ordinary circular symmetric panels retain the
 * quarter-field fast path above; asymmetric/elliptical shapes cache their full
 * distances once, so depth/refraction changes do not rerun the ellipse solver.
 */
function asymmetricField(
  w: number,
  h: number,
  radii: CornerRadii | MaterialContour,
  depth: number,
  dpr: number,
) {
  const sc = Math.max(1, Math.min(dpr || 1, 2));
  const W = Math.max(1, Math.round(w * sc));
  const H = Math.max(1, Math.round(h * sc));
  const N = W * H;
  const band = lensBand(depth, w, h);
  const halfSize = Math.min(w, h) / 2;
  const key = `${w}x${h}x${shapeKey(radii)}x${sc}`;
  let field = asymmetricSdfCache.get(key);
  if (!field) {
    field = {
      distances: new Float64Array(N),
      normals: new Float32Array(2 * N),
      left: new Int32Array(H),
      right: new Int32Array(H).fill(W),
    };
    asymmetricSdfCache.set(key, field);
    while (asymmetricSdfCache.size > SDF_CACHE_CAP) {
      const oldest = asymmetricSdfCache.keys().next().value;
      if (oldest !== undefined) asymmetricSdfCache.delete(oldest);
    }
  } else {
    asymmetricSdfCache.delete(key);
    asymmetricSdfCache.set(key, field);
  }
  if (!sDx || sDx.length < 2 * N) sDx = new Float32Array(2 * N);
  if (!sRGBA || sRGBA.length < 4 * N) sRGBA = new Uint8ClampedArray(4 * N);
  if (!sRowEnd || sRowEnd.length < 2 * H) sRowEnd = new Int32Array(2 * H);
  const data = sRGBA.length === 4 * N ? sRGBA : sRGBA.subarray(0, 4 * N);
  const normal = new Float64Array(2);
  const stepX = w / W;
  const stepY = h / H;
  let maxAbs = 1e-6;
  // A convex outline has a convex eroded interior. Once either side reaches
  // distance >= band, skip that interior interval; do not assume symmetry or
  // that its maximum is at the box centre. Coverage grows independently on
  // both sides, so a later wider lens computes only the newly exposed pixels.
  for (let y = 0; y < H; y++) {
    const row = y * W;
    let leftEnd = W;
    let rightStart = W;
    for (let side = 0; side < 2; side++) {
      let x = side ? W - 1 : 0;
      for (; side ? x >= leftEnd : x < W; x += side ? -1 : 1) {
        const i = row + x;
        let distance = field.distances[i] ?? 0;
        if (x >= (field.left[y] ?? 0) && x < (field.right[y] ?? W)) {
          const px = (x + 0.5) * stepX;
          const py = (y + 0.5) * stepY;
          distance =
            'radii' in radii
              ? contourGeometry(radii, px, py, normal)
              : roundedShapeGeometry(px, py, w, h, radii, normal);
          field.distances[i] = distance;
          field.normals[2 * i] = normal[0] ?? 0;
          field.normals[2 * i + 1] = normal[1] ?? 0;
          sdfComputeCount++;
        }
        if (distance >= band) {
          if (side) rightStart = x + 1;
          else leftEnd = x;
          break;
        }
        if (distance <= 0) continue;
        const magnitude = lensDisplacement(distance, band, halfSize);
        const dx = (field.normals[2 * i] ?? 0) * magnitude;
        const dy = (field.normals[2 * i + 1] ?? 0) * magnitude;
        sDx[2 * i] = dx;
        sDx[2 * i + 1] = dy;
        maxAbs = Math.max(maxAbs, Math.abs(dx), Math.abs(dy));
      }
      if (side) field.right[y] = Math.min(field.right[y] ?? W, Math.max(leftEnd, x));
      else field.left[y] = Math.max(field.left[y] ?? 0, Math.min(W, x + 1));
    }
    sRowEnd[2 * y] = leftEnd;
    sRowEnd[2 * y + 1] = rightStart;
  }
  const gain = 255 / (2 * maxAbs);
  new Uint32Array(data.buffer, data.byteOffset, N).fill(NEUTRAL_VECTOR_RGBA);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    const leftEnd = sRowEnd[2 * y] ?? 0;
    const rightStart = sRowEnd[2 * y + 1] ?? W;
    for (let x = 0; x < W; x++) {
      if (x === leftEnd) x = rightStart;
      if (x >= W) break;
      const i = row + x;
      if ((field.distances[i] ?? 0) <= 0) continue;
      data[4 * i] = (sDx[2 * i] ?? 0) * gain + 127.5;
      data[4 * i + 1] = (sDx[2 * i + 1] ?? 0) * gain + 127.5;
    }
  }
  return { data, W, H, unit: 2 * maxAbs };
}

/**
 * Build ONE displacement map (PNG data-URI) at DEVICE-pixel resolution and wrap
 * it for the browser: the DOM-free field core rasterised onto a reused canvas,
 * then encoded to a PNG off the main thread.
 */
function buildMap(
  w: number,
  h: number,
  corner: RoundedShape,
  depth: number,
  dpr: number,
  atlasPlan?: GlassAtlasPlan | null,
): Omit<MapEntry, 'refs' | 'evicted'> {
  const used =
    typeof corner !== 'number' && 'radii' in corner
      ? materialContour(w, h, corner.radii, corner.smoothing)
      : corner;
  const { data, W, H, unit } = __computeDisplacementField(w, h, used, depth, dpr);
  if (!sCanvas) {
    sCanvas = document.createElement('canvas');
    sCtx = sCanvas.getContext('2d');
  }
  if (!sCtx) throw new Error('liquid-glass: 2d canvas context unavailable');
  sCanvas.width = W;
  sCanvas.height = H;
  sCtx.putImageData(new ImageData(data, W, H), 0, 0);
  if (atlasPlan) {
    const atlas = buildGlassAtlas(sCanvas, atlasPlan, dpr);
    const ready = Promise.all(
      atlas.tiles.map(
        (href) =>
          new Promise<void>((resolve) => {
            const im = new Image();
            im.onload = im.onerror = () => resolve();
            im.src = href;
          }),
      ),
    ).then(() => atlas.tiles[0] ?? '');
    armScratchRelease();
    return { atlas, href: null, ready, unit, mapW: W, mapH: H };
  }
  // The PNG encode was the LAST big synchronous chunk of a build (heavier than
  // the ¼-symmetric field loop). toBlob snapshots the canvas bitmap AT CALL
  // TIME (spec: a synchronous copy) and encodes off the main thread; the href
  // arrives one tick later through `ready` — every consumer already survives
  // that (the feImage decode was async anyway, and the pending-decode re-arm
  // machinery covers the window). toDataURL remains the fallback reference
  // path; both encoders emit lossless PNG of the same bitmap, so the decoded
  // RGBA — and therefore the rendered lens — is byte-identical either way.
  const out: Omit<MapEntry, 'refs' | 'evicted'> = {
    href: null,
    ready: null,
    unit,
    mapW: W,
    mapH: H,
  };
  const canvas = sCanvas;
  if (typeof canvas.toBlob === 'function' && typeof URL !== 'undefined' && URL.createObjectURL) {
    out.ready = new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : ''), 'image/png');
    });
  } else {
    out.href = canvas.toDataURL();
  }
  // Burst is (probably) over: schedule scratch release after idle. A storm keeps
  // re-arming the timer so reuse stays flat while builds keep coming.
  armScratchRelease();
  return out;
}

/* ── Cross-instance map cache (refcounted + bounded zero-ref LRU) ────────────
 * The map is a pure function of geometry, so every instance of the same
 * geometry (e.g. the panel and a same-sized pane) wants identical bytes. A
 * refcounted module-level cache builds each geometry ONCE; later users — other
 * instances, or a size you resize back to — reuse it with zero work.
 *
 * MEMORY BOUND: a released (zero-ref) entry is NOT deleted immediately. It is
 * parked in a small LRU (cap ZOMBIE_CAP). So "resize back to a recent size"
 * still hits with zero work, yet total retained maps are bounded: live entries
 * (one per distinct on-screen geometry, inherently few) + at most ZOMBIE_CAP
 * parked ones. Beyond the cap the oldest zombie is evicted. The Map preserves
 * insertion order, so re-inserting on touch keeps true LRU order. */
const ZOMBIE_CAP = 12;
const mapCache = new Map<string, MapEntry>(); // geoKey → entry

// Move geoKey to the most-recently-used end (delete+re-set on the ordered Map).
function touchLru(geoKey: string, entry: MapEntry): void {
  mapCache.delete(geoKey);
  mapCache.set(geoKey, entry);
}

/** Free an evicted entry's blob URL. An entry evicted while its encode is
 *  still in flight is flagged; the resolver revokes on arrival. (Revoking
 *  invalidates future fetches only — an feImage that already decoded the
 *  bitmap keeps rendering, and zero-ref eviction means no live instance
 *  targets this geometry anyway.) */
function releaseHref(entry: MapEntry): void {
  entry.evicted = true;
  if (entry.href?.startsWith('blob:')) {
    URL.revokeObjectURL(entry.href);
    entry.href = null;
  }
}

// Evict oldest zero-ref (zombie) entries until at most ZOMBIE_CAP remain.
function evictZombies(): void {
  let zombies = 0;
  for (const e of mapCache.values()) if (e.refs <= 0) zombies++;
  if (zombies <= ZOMBIE_CAP) return;
  for (const [key, e] of mapCache) {
    if (e.refs <= 0) {
      mapCache.delete(key);
      releaseHref(e);
      if (--zombies <= ZOMBIE_CAP) break;
    }
  }
}

function acquireMap(
  geoKey: string,
  w: number,
  h: number,
  corner: RoundedShape,
  depth: number,
  dpr: number,
  atlasPlan?: GlassAtlasPlan | null,
): MapEntry {
  const hit = mapCache.get(geoKey);
  if (hit) {
    hit.refs++;
    if (hit.refs === 1) touchLru(geoKey, hit); // revived a zombie → mark MRU
    return hit;
  }
  const entry: MapEntry = {
    ...buildMap(w, h, corner, depth, dpr, atlasPlan),
    refs: 1,
    evicted: false,
  };
  if (entry.ready) {
    // Cache-layer resolver registers FIRST, so by the time any render-layer
    // consumer sees the href, entry.href is already settled.
    entry.ready.then((href) => {
      if (entry.evicted && href.startsWith('blob:')) {
        URL.revokeObjectURL(href);
        return;
      }
      entry.href = href;
    });
  }
  mapCache.set(geoKey, entry);
  return entry;
}

function releaseMap(geoKey: string): void {
  const entry = mapCache.get(geoKey);
  if (!entry) return;
  if (--entry.refs <= 0) {
    entry.refs = 0;
    touchLru(geoKey, entry); // becomes the newest zombie (keep recent sizes warm)
    evictZombies(); // …but never let zombies exceed the cap
  }
}

const escAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** feDisplacementMap scale formatting — ONE formatter for the markup build and
 *  the attribute-only re-stamp, so both paths emit byte-identical values. */
const fmtScale = (s: number): string => s.toFixed(2);

/** Per-channel spread of the chromatic fringe. The single source for the
 *  dispersion→scale fan: the markup build and the attribute-only re-stamp both
 *  call this, so a change here (or a mutation-gate patch) hits every path. */
function dispersionSpread(dispersion: number): number {
  const k = dispersion * 0.08; // gentle per-channel spread
  return k;
}

/**
 * Compose the <filter> body:
 *   1. feImage(map)                          → R/G displacement field
 *   2. feDisplacementMap                     → resample (bend) the backdrop
 *      · dispersion > 0 → split R/G/B at fanned scales, linearly recombine for a
 *        chromatic fringe. The map is neutral in the interior, so the fringe
 *        only appears where it displaces — the rim — with no extra mask needed.
 */
function filterMarkup(
  href: string,
  w: number,
  h: number,
  scale: number,
  dispersion: number,
  tiles?: GlassAtlas,
): string {
  const atlas = tiles
    ? glassAtlasMarkup(tiles, w, h)
    : `<feImage href="${escAttr(href)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>`;
  const dm = (s: number) =>
    `<feDisplacementMap in="SourceGraphic" in2="map" scale="${fmtScale(s)}" xChannelSelector="R" yChannelSelector="G"`;

  if (dispersion < 0.02) {
    return `${atlas}${dm(scale)}/>`;
  }
  const k = dispersionSpread(dispersion);
  // Screen only joins independent channels correctly when their alpha is 1.
  // A compositor may pass the element's opacity into this graph: Screen would
  // then amplify it to 1-(1-a)^3, changing both the paint and the rim. Average
  // the three premultiplied channels first (alpha never exceeds 1), then undo
  // the RGB division. The result is homogeneous in alpha and preserves the
  // same independent RGB samples for an opaque source.
  return `${atlas}${dm(scale * (1 + k))} result="dR"/><feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${1 / 3} 0" result="cR"/>${dm(scale)} result="dG"/><feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 ${1 / 3} 0" result="cG"/>${dm(scale * (1 - k))} result="dB"/><feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 ${1 / 3} 0" result="cB"/><feComposite in="cR" in2="cG" operator="arithmetic" k2="1" k3="1" result="cRG"/><feComposite in="cRG" in2="cB" operator="arithmetic" k2="1" k3="1"/><feColorMatrix type="matrix" values="3 0 0 0 0  0 3 0 0 0  0 0 3 0 0  0 0 0 1 0"/>`;
}

/**
 * Stamp the lens into the <filter>. A STRUCTURAL change (new map/geometry, or
 * crossing the dispersion on/off threshold) rebuilds the primitive markup; a
 * same-structure re-stamp (refraction/dispersion tuning, theme nudge, cache-hit
 * re-render) only updates the feDisplacementMap `scale` attributes in place.
 * Attribute values go through the same fmtScale as the markup build, so the
 * rendered filter is byte-identical on either path — what the attribute path
 * REMOVES is pure churn: re-parsing a markup string that embeds the multi-KB
 * data-URI map, recreating ~10 SVG nodes, and re-attaching the feImage href on
 * every slider tick.
 */
function applyLens(state: EngineState, map: MapEntry, p: RenderParams, scale: number): void {
  const { filter } = state;
  const dispersed = p.dispersion >= 0.02;
  const k = dispersed ? dispersionSpread(p.dispersion) : 0;
  const scales = dispersed
    ? [fmtScale(scale * (1 + k)), fmtScale(scale), fmtScale(scale * (1 - k))]
    : [fmtScale(scale)];
  const s = state.stamped;
  const sameMap = s && s.map === map;
  if (sameMap && (map.atlas || (s.w === p.w && s.h === p.h)) && s.dispersed === dispersed) {
    if (s.w !== p.w || s.h !== p.h) {
      // Resize is scalar writes, no field loop, image encode/decode, or
      // replacement SVG nodes. All four physical edges remain present.
      filter.setAttribute('width', String(p.w));
      filter.setAttribute('height', String(p.h));
      if (map.atlas) resizeGlassAtlas(state.mapNodes ?? [], map.atlas.padding, p.w, p.h);
      s.w = p.w;
      s.h = p.h;
    }
    const nodes = state.dispNodes ?? [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i] as Element;
      const value = scales[i] as string;
      if (node.getAttribute('scale') !== value) {
        node.setAttribute('scale', value);
      }
    }
    s.scales = scales;
    return;
  }
  // Region == element box in element-LOCAL px (filterUnits=userSpaceOnUse) →
  // travels with the element on left/top; the lens stays aligned when dragged
  // in its own local coordinates; ordinary transforms do not rebuild it.
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', String(p.w));
  filter.setAttribute('height', String(p.h));
  filter.innerHTML = filterMarkup(map.href ?? '', p.w, p.h, scale, p.dispersion, map.atlas);
  state.dispNodes = Array.from(filter.querySelectorAll('feDisplacementMap'));
  state.mapNodes = Array.from(filter.querySelectorAll('feImage'));
  state.stamped = { map, w: p.w, h: p.h, dispersed, scales };
}

function readParams(el: HTMLElement, state: EngineState): RenderParams {
  const cs = getComputedStyle(el);
  const num = (prop: string, fb: number): number => {
    const v = Number.parseFloat(cs.getPropertyValue(prop));
    return Number.isFinite(v) ? v : fb;
  };
  const p = state.params;
  // SVG userSpaceOnUse is local CSS space. A transformed boundingClientRect
  // would apply scale twice and rebuild the map during an ordinary sheet move.
  const rect = readBorderBox(el, cs);
  const radii = resolveCornerRadii(rect.width, rect.height, [
    cs.borderTopLeftRadius,
    cs.borderTopRightRadius,
    cs.borderBottomRightRadius,
    cs.borderBottomLeftRadius,
  ]);
  const smoothing = num('--lab-corner-smoothing', 0);
  return {
    w: Math.max(1, rect.width),
    h: Math.max(1, rect.height),
    corner: smoothing > 0 ? materialContour(rect.width, rect.height, radii, smoothing) : radii,
    refraction: p.refraction ?? num('--_lg-refraction', DEFAULTS.refraction),
    depth: Math.round(p.depth ?? num('--_lg-depth', DEFAULTS.depth)),
    dispersion: p.dispersion ?? num('--_lg-dispersion', DEFAULTS.dispersion),
    reduced:
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-transparency: reduce)').matches,
  };
}

/** Write the backdrop-filter pair once per DISTINCT value: a refraction-only
 *  re-stamp keeps the string identical, and skipping the redundant write keeps
 *  the style system out of the hot tuning path entirely. */
function setBackdrop(el: HTMLElement, value: string, state: EngineState | null): void {
  if (state) {
    if (state.lastBackdrop === value) return;
    state.lastBackdrop = value;
  }
  if (value) el.style.setProperty('--_material-lens-filter', value);
  else el.style.removeProperty('--_material-lens-filter');
}

/** Drop this instance's hold on its cached map (if any).
 *  We release the key we actually HOLD a ref for (heldKey), which is set the
 *  instant acquireMap succeeds — independent of whether the map has finished
 *  decoding. geoKey only tracks the geometry we last *targeted*; conflating the
 *  two double-counted refs on a same-geometry re-render before decode. */
function dropMap(state: EngineState): void {
  if (state.heldKey) releaseMap(state.heldKey);
  state.heldKey = null;
  state.geoKey = null;
  state.map = null;
  state.pendingMap = null;
  // The <filter> keeps stale primitives (harmless — nothing references them),
  // but the stamp bookkeeping must reset so a later re-enable rebuilds structure.
  state.stamped = null;
  state.dispNodes = null;
  state.mapNodes = null;
}

function render(state: EngineState): void {
  const { el, id } = state;
  const p = readParams(el, state);
  // Bump gen BEFORE the early returns: a frost/disabled render must also
  // invalidate any in-flight decode→stamp armed by a previous render, or the
  // stale stamp would land its lens backdrop OVER the frost we write below.
  const gen = ++state.gen;

  // Non-refracting / reduced / disabled → write NOTHING inline: material.css
  // owns the frost fallback stack (package-boundary change vs the prototype,
  // whose own CSS class declared the tail).
  if (p.reduced || !state.enabled || !state.refracts) {
    setBackdrop(el, '', state);
    dropMap(state);
    return;
  }
  // refraction ≈ 0 → plain frost, no displacement (opt-out of the lens). The
  // shared CSS keeps author frost and paints active.
  if (p.refraction <= 0.01) {
    setBackdrop(el, '', state);
    dropMap(state);
    return;
  }

  const rawDpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
  // buildMap rasterises at min(dpr,2): two screens with dpr 2 and 3 yield
  // byte-IDENTICAL maps. The cache key must therefore use the CLAMPED dpr, or
  // those identical maps would split into two entries (wasted build + memory).
  const dpr = Math.max(1, Math.min(rawDpr || 1, 2));
  // The map depends ONLY on geometry (size/corner/depth/dpr) — not on position,
  // strength, or dispersion. So a DRAG or a refraction/dispersion change never
  // rebuilds it (cheap re-stamp); only resize/corner/depth does.
  const atlasPlan = glassAtlasPlan(p.w, p.h, p.corner, p.depth, dpr);
  const mapW = atlasPlan?.side ?? p.w;
  const mapH = atlasPlan?.side ?? p.h;
  const geoKey = `${atlasPlan ? 'atlas:' : ''}${mapW}x${mapH}x${shapeKey(p.corner)}x${p.depth}x${dpr.toFixed(2)}`;
  const t0 = state.onPerf ? performance.now() : 0;

  const stamp = (map: MapEntry, mapMs: number): void => {
    if (state.gen !== gen) return; // a newer render superseded this one
    state.map = map;
    const scale = map.unit * p.refraction;
    applyLens(state, map, p, scale);
    // Frost FIRST, then the lens: blurring the backdrop before the displacement
    // means the lens bends already-soft content (clean refraction) instead of
    // smearing sharp high-contrast edges into streaks.
    setBackdrop(el, `url(#${id})`, state);
    if (state.onPerf) {
      state.onPerf({
        reason: mapMs > 0 ? 'rebuild' : 'restamp',
        mapMs,
        totalMs: performance.now() - t0,
        mapW: map.mapW,
        mapH: map.mapH,
        w: p.w,
        h: p.h,
      });
    }
  };

  // Arm the decode→stamp chain for a map whose href may still be encoding
  // (toBlob) — the gen-guard in stamp() drops stale arms either way.
  const armStamp = (map: MapEntry, mapMs: number): void => {
    const decode = (href: string | null): void => {
      if (!href) return; // encode failed (never seen in practice) → stay frost
      const im = new Image();
      im.onload = im.onerror = () => stamp(map, mapMs);
      im.src = href;
    };
    if (map.href) decode(map.href);
    else if (map.ready) map.ready.then(decode);
  };

  state.geoKey = geoKey;
  // Cheap re-stamp path: we already HOLD a ref for this exact geometry (gated on
  // heldKey, NOT state.map, so a repeat render mid-decode never re-acquires — the
  // refcount-leak class). If decoded, restamp. If the decode is still in flight,
  // our `gen` bump above just invalidated the prior render's pending stamp — so we
  // MUST re-arm a stamp for the CURRENT gen against the in-flight map, or the lens
  // would never land (it would stay frost-only until the next geometry change).
  if (geoKey === state.heldKey) {
    if (state.map) {
      stamp(state.map, 0); // decoded → reuse map, cheap re-stamp
    } else if (state.pendingMap) {
      armStamp(state.pendingMap, 0); // decode/encode in flight → re-arm for THIS gen
    }
    return;
  }
  // Geometry changed (or first acquire) → acquire the new map (a cache hit across
  // instances or a size you've used before returns instantly), then release the
  // PREVIOUS held key. Acquire/release are keyed on heldKey so each instance holds
  // exactly one ref per held geometry, decode state notwithstanding.
  const prevHeld = state.heldKey;
  const tMap = state.onPerf ? performance.now() : 0;

  const map = acquireMap(geoKey, mapW, mapH, p.corner, p.depth, dpr, atlasPlan);
  // A second render while the new image is decoding must re-arm THIS map,
  // never stamp the previous geometry under the newly acquired key.
  state.map = null;
  state.heldKey = geoKey; // we now hold a ref for this geometry (decode aside)
  state.pendingMap = map; // so a same-geometry re-render mid-decode can re-arm a stamp
  if (prevHeld && prevHeld !== geoKey) releaseMap(prevHeld);
  const mapMs = state.onPerf ? Math.max(performance.now() - tMap, 0.001) : 1;
  // Decode the map before referencing it (feImage decode is async either way);
  // stamping after decode avoids a one-frame flash of the un-lensed backdrop.
  // The gen-guard in stamp() drops this if a newer render superseded.
  armStamp(map, mapMs);
}

/**
 * Attach Liquid Glass to an element. Package-internal: the only caller is the
 * declarative runtime (`./runtime.ts`) — ADR-0003 §3 keeps this OFF the public
 * package surface.
 */
export function attach(el: HTMLElement, opts: AttachOptions = {}): LiquidGlassHandle {
  registry.get(el)?.destroy();
  const defs = ensureDefs(el);
  const id = `lab-lg-${++uid}`;
  const filter = el.ownerDocument.createElementNS(SVGNS, 'filter');
  filter.id = id;
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  // userSpaceOnUse with the region set to the element box (0,0,w,h) in stamp():
  // element-LOCAL coordinates that travel with the element on left/top → the lens
  // stays aligned when dragged and never samples out of bounds (shuding's rule).
  // (primitiveUnits is intentionally NOT set: no primitive here carries a
  // primitiveUnits-sensitive length, so it would be a no-op.)
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  defs.appendChild(filter);

  const { onPerf, ...params } = opts;
  const state: EngineState = {
    el,
    id,
    filter,
    enabled: true,
    refracts: supportsRefraction(),
    params,
    gen: 0,
    geoKey: null,
    heldKey: null,
    map: null,
    pendingMap: null,
    stamped: null,
    dispNodes: null,
    mapNodes: null,
    lastBackdrop: undefined,
    onPerf: typeof onPerf === 'function' ? onPerf : null,
    update: () => {},
    refresh: () => {},
    setEnabled: () => {},
    destroy: () => {},
  };

  const update = () => render(state);
  // The ResizeObserver / window-resize storm fires many sub-pixel callbacks while
  // a layout settles; a trailing-edge rAF collapses a burst into ONE build at the
  // final size. The final geometry — and thus the rendered map — is identical to
  // an un-debounced run; only redundant intermediate builds are skipped. Explicit
  // update()/refresh() stay immediate.
  let rafId = 0;
  const debouncedUpdate = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      update();
    });
  };
  const ro = new ResizeObserver(debouncedUpdate);
  ro.observe(el, { box: 'border-box' });
  window.addEventListener('resize', debouncedUpdate);
  const mq =
    typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-transparency: reduce)') : null;
  mq?.addEventListener('change', update);

  state.update = (p: LiquidGlassParams) => {
    Object.assign(state.params, p);
    update();
  };
  state.refresh = update;
  state.setEnabled = (b: boolean) => {
    state.enabled = b !== false;
    update();
  };
  state.destroy = () => {
    state.gen++; // supersede any in-flight async stamp so it can't fire post-destroy
    ro.disconnect();
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', debouncedUpdate);
    mq?.removeEventListener('change', update);
    dropMap(state); // release our hold on the shared cached map
    removeFilter(filter);
    setBackdrop(el, '', state);
    el.classList.remove(LENSED_CLASS);
    if (registry.get(el) === state) registry.delete(el);
  };

  el.classList.add(LENSED_CLASS);
  registry.set(el, state);
  update();
  return state;
}

/** Inert introspection for tests/DEV — never read on any render path, so it
 *  cannot affect the picture. Reports the bounded-cache invariants. */
export function __cacheStats(): {
  size: number;
  live: number;
  zombies: number;
  zombieCap: number;
  scratchAllocated: boolean;
} {
  let live = 0;
  let zombies = 0;
  for (const e of mapCache.values()) e.refs > 0 ? live++ : zombies++;
  return { size: mapCache.size, live, zombies, zombieCap: ZOMBIE_CAP, scratchAllocated: !!sDx };
}

/** Inert introspection for the SDF-cache counter-asserts (ceiling criterion б):
 *  `sdfComputes` is the cumulative sdRoundRect call count — a same-geometry depth
 *  reuse adds ZERO; a key-differing geometry adds a fresh rim. `sdfEntries` is the
 *  live per-geometry field count (bounded by SDF_CACHE_CAP). Never read on a render
 *  path. */
export function __fieldStats(): {
  sdfComputes: number;
  sdfEntries: number;
  sdfCacheCap: number;
  asymmetricEntries: number;
  retainedBytes: number;
} {
  let retainedBytes = 0;
  for (const field of sdfCache.values())
    retainedBytes +=
      field.inside.byteLength + field.covered.byteLength + (field.normals?.byteLength ?? 0);
  for (const field of asymmetricSdfCache.values())
    retainedBytes +=
      field.distances.byteLength +
      field.normals.byteLength +
      field.left.byteLength +
      field.right.byteLength;
  return {
    sdfComputes: sdfComputeCount,
    sdfEntries: sdfCache.size,
    sdfCacheCap: SDF_CACHE_CAP,
    asymmetricEntries: asymmetricSdfCache.size,
    retainedBytes,
  };
}
