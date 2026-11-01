/*
 * @labpics/ui-materials/engine — the refraction engine (Liquid Glass).
 *
 * Landed from `prototypes/liquid-glass/liquid-glass.js` per ADR-0003
 * (glass-effects ch-02). PACKAGE-BOUNDARY CHANGES vs the prototype — everything
 * else is a faithful port (same algorithm, same caches, same byte-identical
 * filter guarantees):
 *
 *   · Tokens renamed at the boundary (ADR-0003 §2): the engine reads PRIVATE
 *     `--_lg-refraction / --_lg-depth / --_lg-dispersion` (unitless numbers).
 *     `--lg-radius`/`--lg-saturate` did NOT land as new tokens — the inline
 *     backdrop-filter references the EXISTING mechanics `var(--_blur)` /
 *     `var(--_saturate)` directly, plus `var(--_lg-brightness)` /
 *     `var(--_lg-contrast)`; mode/tier/theme re-binds apply live with no
 *     re-render. `--lg-tint*` never reached JS (colour is the `--lab-*`
 *     contract's); corner still comes from computed `border-radius`.
 *   · The host class is `lab-material--lensed` (not `lab-liquid-glass`): a
 *     package-private state class that re-binds `--_blur` to the
 *     lens-calibrated radius in material.css while the engine holds the
 *     surface.
 *   · A non-refracting / disabled / reduced-transparency surface gets NO
 *     inline style at all — material.css owns the fallback stack (the
 *     prototype's own CSS class used to declare the tail; here the package
 *     stylesheet is the single source of the frost fallback).
 *   · NOT exported from the package index (ADR-0003 §3): the only consumer is
 *     the declarative runtime in `./runtime.ts`.
 *
 * ── The algorithm (unchanged) ───────────────────────────────────────────────
 * `backdrop-filter` blurs a backdrop but cannot bend it. The bend — what makes
 * Liquid Glass a LENS rather than frosted glass — comes from an SVG
 * <feDisplacementMap> whose map encodes, per pixel, WHERE to resample the
 * backdrop: Red = horizontal sample shift, Green = vertical (0.5 = no shift).
 *
 * The map is a continuous magnification: every pixel samples its own position
 * pulled toward the centre by a smooth factor that is strongest at the rounded
 * rim and eases to zero in the flat interior. So the whole surface bends the
 * backdrop like a thick convex lens (strong at the edge, clear in the middle) —
 * NOT a thin band at the border. This is the algorithm proven by
 * github.com/shuding/liquid-glass (the position-warp lens) with the
 * edge-confined chromatic aberration of github.com/rdev/liquid-glass-react.
 *
 * The rim highlight is pure CSS — like both references, we do NOT use
 * feSpecularLighting (a single SVG point-light only lights one corner). The
 * filter is referenced from CSS as `backdrop-filter: url(#id)`, so it must live
 * in the DOM and track the element's size.
 *
 * PERFORMANCE MODEL (what is, and is NOT, optimisable without touching the look):
 *   · Per DRAG frame there is ZERO JS — the element moves on left/top and the
 *     filter region travels with it; the cost is pure GPU compositing of the
 *     (quality-locked) filter, which we deliberately never cheapen.
 *   · The map is geometry-only (size/corner/depth/dpr). It is therefore built
 *     ONCE per geometry, shared across every instance of that geometry through a
 *     refcounted module-level cache (the panel and a same-sized pane build it
 *     once), and never rebuilt on drag / theme / strength / dispersion changes.
 *     Resize storms collapse to a single trailing-edge build. Scratch buffers
 *     are reused across builds to keep GC pressure flat. The PNG encode — the
 *     heaviest chunk of a build — runs OFF the main thread (canvas.toBlob);
 *     only the ¼-symmetric field loop stays synchronous.
 *   · A same-structure re-stamp (strength/dispersion tuning) updates only the
 *     feDisplacementMap scale attributes — no markup re-parse, no feImage href
 *     re-attach, no node churn. The emitted filter is byte-identical.
 *
 * Zero dependencies, browser-native ES module. Pairs with material.css.
 */

// The DOM-free math heart (SDF, falloff, lens constant) lives in a sibling pure
// module so a bare test runner can import and assert it directly. The browser
// engine simply re-imports those exact symbols — the runtime is byte-identical;
// only the definition site moved.
import { MAX_PULL, clamp01, sdRoundRect, smoothstep } from './lg-math';
import { createHiddenDefs, supportsBackdropFilterUrl } from './mount';

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
  href: string | null;
  ready: Promise<string> | null;
  unit: number;
  mapW: number;
  mapH: number;
  refs: number;
  evicted: boolean;
}

interface StampedShape {
  href: string | null;
  w: number;
  h: number;
  dispersed: boolean;
  scales: string[];
}

interface RenderParams {
  w: number;
  h: number;
  corner: number;
  refraction: number;
  depth: number;
  dispersion: number;
  reduced: boolean;
}

interface EngineState extends LiquidGlassHandle {
  restore(): void;
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
  /** last backdrop-filter string we wrote (skip repeats) */
  lastBackdrop: string | undefined;
  onPerf: ((report: PerfReport) => void) | null;
}

const SVGNS = 'http://www.w3.org/2000/svg';
const registry = new WeakMap<Element, EngineState>(); // host element → state (no DOM expando)
let uid = 0;

/** The package-private state class: while the engine holds a surface,
 *  material.css re-binds `--_blur` to the lens-calibrated radius under it. */
export const LENSED_CLASS = 'lab-material--lensed';

/** The frost tail rides the package mechanics tokens as LIVE var() references —
 *  a mode/tier/theme re-bind changes the rendered stack with no JS re-render.
 *  Fallbacks mirror the material.css engine-knob defaults. */
const FROST_TAIL =
  'blur(var(--_blur, 4px)) saturate(var(--_saturate, 130%)) brightness(var(--_lg-brightness, 1.05)) contrast(var(--_lg-contrast, 1.2))';

/** Single source of truth for numeric defaults. CSS custom properties override
 *  these per-instance; nothing else hard-codes a fallback. */
const DEFAULTS = {
  refraction: 1, // 0..1+ — Figma: refraction. Linear lens strength.
  depth: 40, // px    — Figma: depth. Thickness of the magnified rim band.
  dispersion: 0.4, // 0..1 — Figma: dispersion. Rim chromatic fringe.
  corner: 28, // px   — fallback when border-radius can't be read.
};

/** Whether this engine REFRACTS the backdrop. The requirement is the browser's
 *  ability to render a url()-referenced SVG filter on a backdrop — the shared
 *  capability probe (./mount), the SAME one acrylic's luminosity chain needs.
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
 * and the double-smoothstep profile applied to `inside/band` do. So the SDF is
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
  covered: Int32Array; // per top-half row: how many columns have been computed
  halfW: number;
  halfH: number;
}
const SDF_CACHE_CAP = 4;
const sdfCache = new Map<string, SdfEntry>(); // geometry (no depth) → distance field
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
 * For each interior pixel the sample position is pulled toward the centre by a
 * factor ~1 at the rim, easing (double-smoothstep) to 0 over a `depth`-px band —
 * a continuous magnifying lens with a clear middle. The pull is always inward,
 * so the lens never samples outside the element.
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
  corner: number,
  depth: number,
  dpr: number,
): { data: Uint8ClampedArray; W: number; H: number; unit: number } {
  const r = Math.max(0, Math.min(corner, Math.min(w, h) / 2));
  const band = Math.max(2, Math.min(depth, Math.min(w, h) / 2)); // rim lens thickness
  const sc = Math.max(1, Math.min(dpr || 1, 2)); // device-pixel scale, capped at 2
  const W = Math.max(1, Math.round(w * sc));
  const H = Math.max(1, Math.round(h * sc));
  const cx = w / 2;
  const cy = h / 2;
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
  const sdfKey = `${w}x${h}x${corner}x${sc}`;
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

  // 4-way symmetry: the map is mirror-symmetric about both centre axes. The SDF
  // sdRoundRect is symmetric in px↔(w−px) and py↔(h−py); the pull magnitude m
  // depends only on `inside` (symmetric); dx=(cx−px)·pull flips sign across the
  // vertical axis and dy across the horizontal. So we compute ONLY the rows in
  // the top half and mirror each into its bottom twin (dx same, dy negated about
  // its row's value). Within a row we also mirror left↔right (dx negated). This
  // collapses the expensive SDF/sqrt/double-smoothstep work to ~1/4 of pixels.
  // Output bytes are bit-identical to the full double loop.
  const invSc = 1 / sc;
  const invBand = 1 / band;
  for (let Y = 0; Y < H; Y++) {
    const Ym = H - 1 - Y;
    if (Ym < Y) break; // bottom half already filled by its top twin
    const rowT = Y * W;
    const rowB = Ym * W;
    const py = (Y + 0.5) * invSc;
    const cyPy = cy - py; // dy magnitude factor for this row
    const rowBase = Y * halfW; // this row's slice of the cached distance field
    const covered = sCovered[Y] as number; // columns already computed for this row
    // RIM-SKIP. A pixel is a no-op (dx=dy=0) once inside ≥ band — the
    // double-smoothstep bottoms out — and, because `inside` RISES monotonically
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
      const px = (X + 0.5) * invSc;
      // Cached distance (the exact float64 sdRoundRect returned → byte-identical)
      // or a fresh compute past the covered edge. Depth-free, so a depth change
      // reads it back with 0 sqrt recomputes; a larger band computes only the
      // delta ring [covered, end].
      let inside: number;
      if (X < covered) {
        inside = sInside[rowBase + X] as number;
      } else {
        inside = -sdRoundRect(px, py, w, h, r); // >0 inside, 0 at the edge
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
        // 1 at the rim → 0 `band` px inward; double-smoothstep for a gentle,
        // seamless falloff (the shape that reads as thick glass, not an outline).
        const m = smoothstep(smoothstep(clamp01(1 - inside * invBand)));
        const pull = MAX_PULL * m;
        dx = (cx - px) * pull; // inward pull = magnification
        dy = cyPy * pull;
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
  u32.fill(0xff808080); // little-endian RGBA: R=128 G=128 B=128 A=255
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

/**
 * Build ONE displacement map (PNG data-URI) at DEVICE-pixel resolution and wrap
 * it for the browser: the DOM-free field core rasterised onto a reused canvas,
 * then encoded to a PNG off the main thread.
 */
function buildMap(
  w: number,
  h: number,
  corner: number,
  depth: number,
  dpr: number,
): Omit<MapEntry, 'refs' | 'evicted'> {
  const { data, W, H, unit } = __computeDisplacementField(w, h, corner, depth, dpr);
  if (!sCanvas) {
    sCanvas = document.createElement('canvas');
    sCtx = sCanvas.getContext('2d');
  }
  if (!sCtx) throw new Error('liquid-glass: 2d canvas context unavailable');
  sCanvas.width = W;
  sCanvas.height = H;
  sCtx.putImageData(new ImageData(data, W, H), 0, 0);
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
  corner: number,
  depth: number,
  dpr: number,
): MapEntry {
  const hit = mapCache.get(geoKey);
  if (hit) {
    hit.refs++;
    if (hit.refs === 1) touchLru(geoKey, hit); // revived a zombie → mark MRU
    return hit;
  }
  const entry: MapEntry = { ...buildMap(w, h, corner, depth, dpr), refs: 1, evicted: false };
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
 *      · dispersion > 0 → split R/G/B at fanned scales, screen-recombine for a
 *        chromatic fringe. The map is neutral in the interior, so the fringe
 *        only appears where it displaces — the rim — with no extra mask needed.
 */
function filterMarkup(
  href: string,
  w: number,
  h: number,
  scale: number,
  dispersion: number,
): string {
  const atlas = `<feImage href="${escAttr(href)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>`;
  const dm = (s: number) =>
    `<feDisplacementMap in="SourceGraphic" in2="map" scale="${fmtScale(s)}" xChannelSelector="R" yChannelSelector="G"`;

  if (dispersion < 0.02) {
    return `${atlas}${dm(scale)}/>`;
  }
  const k = dispersionSpread(dispersion);
  return `${atlas}${dm(scale * (1 + k))} result="dR"/><feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cR"/>${dm(scale)} result="dG"/><feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cG"/>${dm(scale * (1 - k))} result="dB"/><feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cB"/><feBlend in="cR" in2="cG" mode="screen" result="cRG"/><feBlend in="cRG" in2="cB" mode="screen"/>`;
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
  if (s && s.href === map.href && s.w === p.w && s.h === p.h && s.dispersed === dispersed) {
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
  // (shuding's anti-seam rule). Do NOT CSS-transform a glass element.
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', String(p.w));
  filter.setAttribute('height', String(p.h));
  filter.innerHTML = filterMarkup(map.href ?? '', p.w, p.h, scale, p.dispersion);
  state.dispNodes = Array.from(filter.querySelectorAll('feDisplacementMap'));
  state.stamped = { href: map.href, w: p.w, h: p.h, dispersed, scales };
}

function readParams(el: HTMLElement, state: EngineState): RenderParams {
  const cs = getComputedStyle(el);
  const num = (prop: string, fb: number): number => {
    const v = Number.parseFloat(cs.getPropertyValue(prop));
    return Number.isFinite(v) ? v : fb;
  };
  const p = state.params;
  const rect = el.getBoundingClientRect(); // one reflow read, used for both dims
  return {
    w: Math.max(1, Math.round(rect.width)),
    h: Math.max(1, Math.round(rect.height)),
    // Number.isFinite, NOT `||`: an explicit `border-radius: 0` is a real
    // author choice (sharp lens), not an invitation to the default corner.
    corner: ((r: number): number => Math.round(Number.isFinite(r) ? r : DEFAULTS.corner))(
      Number.parseFloat(cs.borderTopLeftRadius),
    ),
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
  el.style.setProperty('backdrop-filter', value);
  el.style.setProperty('-webkit-backdrop-filter', value);
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
  // tail still adds the engine's brightness/contrast over the CSS stack.
  if (p.refraction <= 0.01) {
    setBackdrop(el, FROST_TAIL, state);
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
  const geoKey = `${p.w}x${p.h}x${p.corner}x${p.depth}x${dpr.toFixed(2)}`;
  const t0 = state.onPerf ? performance.now() : 0;

  const stamp = (map: MapEntry, mapMs: number): void => {
    if (state.gen !== gen) return; // a newer render superseded this one
    state.map = map;
    const scale = map.unit * p.refraction;
    applyLens(state, map, p, scale);
    // Frost FIRST, then the lens: blurring the backdrop before the displacement
    // means the lens bends already-soft content (clean refraction) instead of
    // smearing sharp high-contrast edges into streaks.
    setBackdrop(
      el,
      `blur(var(--_blur, 4px)) url(#${id}) saturate(var(--_saturate, 130%)) brightness(var(--_lg-brightness, 1.05)) contrast(var(--_lg-contrast, 1.2))`,
      state,
    );
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

  const map = acquireMap(geoKey, p.w, p.h, p.corner, p.depth, dpr);
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
  let disposed = false;
  const wasLensed = el.classList.contains(LENSED_CLASS);
  const baseline = ['backdrop-filter', '-webkit-backdrop-filter'].map((property) => ({
    property,
    value: el.style.getPropertyValue(property),
    priority: el.style.getPropertyPriority(property),
  }));
  const { svg, defs, restore } = createHiddenDefs(el, 'lab-lg-defs');
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
    restore: () => {
      if (!disposed) restore();
    },
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
    lastBackdrop: undefined,
    onPerf: typeof onPerf === 'function' ? onPerf : null,
    update: () => {},
    refresh: () => {},
    setEnabled: () => {},
    destroy: () => {},
  };

  const update = () => {
    if (!disposed) render(state);
  };
  // The ResizeObserver / window-resize storm fires many sub-pixel callbacks while
  // a layout settles; a trailing-edge rAF collapses a burst into ONE build at the
  // final size. The final geometry — and thus the rendered map — is identical to
  // an un-debounced run; only redundant intermediate builds are skipped. Explicit
  // update()/refresh() stay immediate.
  let rafId = 0;
  const debouncedUpdate = () => {
    if (disposed || rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      update();
    });
  };
  const ro = new ResizeObserver(debouncedUpdate);
  ro.observe(el);
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
    if (disposed) return;
    disposed = true;
    state.gen++; // supersede any in-flight async stamp so it can't fire post-destroy
    ro.disconnect();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    window.removeEventListener('resize', debouncedUpdate);
    mq?.removeEventListener('change', update);
    dropMap(state); // release our hold on the shared cached map
    svg.remove();
    for (const { property, value, priority } of baseline) {
      el.style.setProperty(property, value, priority);
    }
    if (!wasLensed) el.classList.remove(LENSED_CLASS);
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
} {
  return { sdfComputes: sdfComputeCount, sdfEntries: sdfCache.size, sdfCacheCap: SDF_CACHE_CAP };
}
