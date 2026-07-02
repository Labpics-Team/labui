/*
 * lab-liquid-glass runtime — the refraction engine.
 *
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
 * The rim highlight is pure CSS (see liquid-glass.css) — like both references,
 * we do NOT use feSpecularLighting (a single SVG point-light only lights one
 * corner). The filter is referenced from CSS as `backdrop-filter: url(#id)`, so
 * it must live in the DOM and track the element's size.
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
 *     are reused across builds to keep GC pressure flat.
 *   · A same-structure re-stamp (strength/dispersion tuning) updates only the
 *     feDisplacementMap scale attributes — no markup re-parse, no feImage href
 *     re-attach, no node churn. The emitted filter is byte-identical.
 *
 * Zero dependencies, browser-native ES module. Pairs with liquid-glass.css.
 */

// The DOM-free math heart (SDF, falloff, lens constant) lives in a sibling pure
// module so a bare Node test runner can import and assert it directly. The
// browser engine simply re-imports those exact symbols — the runtime is
// byte-identical; only the definition site moved.
import { MAX_PULL, clamp01, sdRoundRect, smoothstep } from './lg-math.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const registry = new WeakMap(); // host element → state (no DOM expando)
let uid = 0;
let defs = null;

/** Single source of truth for every default. CSS custom properties override
 *  these per-instance; nothing else hard-codes a fallback. */
const DEFAULTS = {
  radius: 4, // px    — CSS backdrop blur; small so the lens stays crisp (rdev ≈4-6px)
  saturate: 1.3, // saturation lift gives the glassy body (rdev 140%)
  brightness: 1.05,
  contrast: 1.2, // contrast (not blur) carries the "glassy" read
  refraction: 1, // 0..1+ — Figma: refraction. Linear lens strength.
  depth: 40, // px    — Figma: depth. Thickness of the magnified rim band.
  dispersion: 0.4, // 0..1 — Figma: dispersion. Rim chromatic fringe.
  corner: 28, // px   — fallback when border-radius can't be read.
};

/** Detect whether this engine REFRACTS the backdrop via url() filters. Firefox
 *  and Safari PARSE `backdrop-filter: url(#f)` (so CSS.supports is true) but do
 *  NOT render an SVG filter on a backdrop — only Chromium does. Everyone else
 *  keeps the honest blur fallback. The answer cannot change within a page, so
 *  it is probed once — not re-parsed from the UA on every attach. */
let refractionProbe = null;
export function supportsRefraction() {
  if (refractionProbe === null) refractionProbe = probeRefraction();
  return refractionProbe;
}

function probeRefraction() {
  if (typeof CSS === 'undefined' || !CSS.supports) return false;
  if (
    !CSS.supports('backdrop-filter', 'url(#x)') &&
    !CSS.supports('-webkit-backdrop-filter', 'url(#x)')
  ) {
    return false;
  }
  const uaData = typeof navigator !== 'undefined' ? navigator.userAgentData : null;
  if (uaData && Array.isArray(uaData.brands)) {
    return uaData.brands.some((b) => /Chromium/i.test(b.brand));
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /Chrome|Chromium|Edg|OPR/.test(ua) && !/Firefox|FxiOS/.test(ua);
}

function ensureDefs() {
  if (defs?.isConnected) return defs;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'lab-lg-defs');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  defs = document.createElementNS(SVGNS, 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
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
let sDx = null;
let sRGBA = null; // reused RGBA byte scratch (grown on demand) → no per-build zero-fill
let sCanvas = null;
let sCtx = null;
let scratchIdleTimer = 0;
const SCRATCH_IDLE_MS = 2000;

function releaseScratch() {
  sDx = null;
  sRGBA = null;
  if (sCanvas) {
    sCanvas.width = 0; // drop the backing store immediately, not just the ref
    sCanvas.height = 0;
  }
  sCanvas = null;
  sCtx = null;
}

function armScratchRelease() {
  if (typeof setTimeout === 'undefined') return;
  if (scratchIdleTimer) clearTimeout(scratchIdleTimer);
  scratchIdleTimer = setTimeout(() => {
    scratchIdleTimer = 0;
    releaseScratch();
  }, SCRATCH_IDLE_MS);
}

/**
 * Build ONE displacement map (PNG data-URI) at DEVICE-pixel resolution.
 *   R = x sample-shift, G = y sample-shift (0.5 = none) → for feDisplacementMap
 *
 * For each interior pixel the sample position is pulled toward the centre by a
 * factor that is ~1 at the rim and eases (double-smoothstep) to 0 over a
 * `depth`-px band — a continuous magnifying lens with a clear middle. The pull
 * is always inward, so the lens never samples outside the element.
 *
 * Geometry-only (no strength baked in): the displacement is encoded normalised,
 * and `unit` is the feDisplacementMap `scale` that reconstructs the true pixel
 * shift at refraction = 1. So changing refraction is a cheap scale change.
 */
function buildMap(w, h, corner, depth, dpr) {
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
  let maxAbs = 1e-6;

  // 4-way symmetry: the map is mirror-symmetric about both centre axes. The SDF
  // sdRoundRect is symmetric in px↔(w−px) and py↔(h−py); the pull magnitude m
  // depends only on `inside` (symmetric); dx=(cx−px)·pull flips sign across the
  // vertical axis and dy across the horizontal. So we compute ONLY the rows in
  // the top half and mirror each into its bottom twin (dx same, dy negated about
  // its row's value). Within a row we also mirror left↔right (dx negated). This
  // collapses the expensive SDF/sqrt/double-smoothstep work to ~1/4 of pixels.
  // Output bytes are bit-identical to the full double loop.
  const halfW = (W + 1) >> 1; // ceil — covers the centre column on odd W
  const invSc = 1 / sc;
  const invBand = 1 / band;
  for (let Y = 0; Y < H; Y++) {
    const Ym = H - 1 - Y;
    if (Ym < Y) break; // bottom half already filled by its top twin
    const rowT = Y * W;
    const rowB = Ym * W;
    const py = (Y + 0.5) * invSc;
    const cyPy = cy - py; // dy magnitude factor for this row
    for (let X = 0; X < halfW; X++) {
      const Xm = W - 1 - X;
      const px = (X + 0.5) * invSc;
      const inside = -sdRoundRect(px, py, w, h, r); // >0 inside, 0 at the edge
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
  }

  // Encode [-maxAbs, maxAbs] → [0,1] with no clipping. feDisplacementMap shifts
  // by scale·(channel − 0.5); with scale = 2·maxAbs the shift reconstructs the
  // true pixel displacement exactly.
  if (!sCanvas) {
    sCanvas = document.createElement('canvas');
    sCtx = sCanvas.getContext('2d');
  }
  sCanvas.width = W;
  sCanvas.height = H;
  // Reused RGBA scratch instead of ctx.createImageData(W,H): createImageData
  // ALLOCATES and ZERO-FILLS 4·N bytes every build — wasted, since the loop below
  // overwrites every byte. We keep a grown-on-demand Uint8ClampedArray and wrap an
  // exact-length subarray view in a fresh ImageData (the constructor requires
  // view.length === 4·W·H). Bytes written are bit-identical; only the redundant
  // allocation+zero-fill is removed on warm builds.
  const need = N * 4;
  if (!sRGBA || sRGBA.length < need) sRGBA = new Uint8ClampedArray(need);
  const data = sRGBA.length === need ? sRGBA : sRGBA.subarray(0, need);
  const img = new ImageData(data, W, H);
  const norm = 1 / (2 * maxAbs);
  const norm255 = norm * 255;
  // Encode with the SAME 4-way symmetry used to compute the field, so the
  // per-pixel Float32 read + multiply-add runs for ~N/4 pixels instead of N.
  // For a mirror twin dx→−dx (dy→−dy), so its R byte = −dx·norm255+127.5: we
  // recompute that float directly (no derived 255−v trick, which could round
  // differently) → bytes stay bit-identical to the flat pass. B/A are constant.
  const u32 = new Uint32Array(data.buffer, data.byteOffset, N);
  u32.fill(0xff800000); // little-endian RGBA: R=0 G=0 B=128 A=255 (R/G overwritten)
  for (let Y = 0; Y < H; Y++) {
    const Ym = H - 1 - Y;
    if (Ym < Y) break;
    const rowT = Y * W;
    const rowB = Ym * W;
    for (let X = 0; X < halfW; X++) {
      const Xm = W - 1 - X;
      const kT = rowT + X;
      const pT = kT << 1;
      const dx = di[pT];
      const dy = di[pT + 1];
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
  sCtx.putImageData(img, 0, 0);
  const out = { href: sCanvas.toDataURL(), unit: 2 * maxAbs, mapW: W, mapH: H };
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
const mapCache = new Map(); // geoKey → { href, unit, mapW, mapH, refs }

// Move geoKey to the most-recently-used end (delete+re-set on the ordered Map).
function touchLru(geoKey, entry) {
  mapCache.delete(geoKey);
  mapCache.set(geoKey, entry);
}

// Evict oldest zero-ref (zombie) entries until at most ZOMBIE_CAP remain.
function evictZombies() {
  let zombies = 0;
  for (const e of mapCache.values()) if (e.refs <= 0) zombies++;
  if (zombies <= ZOMBIE_CAP) return;
  for (const [key, e] of mapCache) {
    if (e.refs <= 0) {
      mapCache.delete(key);
      if (--zombies <= ZOMBIE_CAP) break;
    }
  }
}

function acquireMap(geoKey, w, h, corner, depth, dpr) {
  const hit = mapCache.get(geoKey);
  if (hit) {
    hit.refs++;
    if (hit.refs === 1) touchLru(geoKey, hit); // revived a zombie → mark MRU
    return hit;
  }
  const entry = { ...buildMap(w, h, corner, depth, dpr), refs: 1 };
  mapCache.set(geoKey, entry);
  return entry;
}

function releaseMap(geoKey) {
  const entry = mapCache.get(geoKey);
  if (!entry) return;
  if (--entry.refs <= 0) {
    entry.refs = 0;
    touchLru(geoKey, entry); // becomes the newest zombie (keep recent sizes warm)
    evictZombies(); // …but never let zombies exceed the cap
  }
}

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** feDisplacementMap scale formatting — ONE formatter for the markup build and
 *  the attribute-only re-stamp, so both paths emit byte-identical values. */
const fmtScale = (s) => s.toFixed(2);

/** Per-channel spread of the chromatic fringe. The single source for the
 *  dispersion→scale fan: the markup build and the attribute-only re-stamp both
 *  call this, so a change here (or a mutation-gate patch) hits every path. */
function dispersionSpread(dispersion) {
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
function filterMarkup(href, w, h, scale, dispersion) {
  const atlas = `<feImage href="${escAttr(href)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>`;
  const dm = (s) =>
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
function applyLens(state, map, p, scale) {
  const { filter } = state;
  const dispersed = p.dispersion >= 0.02;
  const k = dispersed ? dispersionSpread(p.dispersion) : 0;
  const scales = dispersed
    ? [fmtScale(scale * (1 + k)), fmtScale(scale), fmtScale(scale * (1 - k))]
    : [fmtScale(scale)];
  const s = state.stamped;
  if (s && s.href === map.href && s.w === p.w && s.h === p.h && s.dispersed === dispersed) {
    for (let i = 0; i < state.dispNodes.length; i++) {
      if (state.dispNodes[i].getAttribute('scale') !== scales[i]) {
        state.dispNodes[i].setAttribute('scale', scales[i]);
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
  filter.innerHTML = filterMarkup(map.href, p.w, p.h, scale, p.dispersion);
  state.dispNodes = Array.from(filter.querySelectorAll('feDisplacementMap'));
  state.stamped = { href: map.href, w: p.w, h: p.h, dispersed, scales };
}

function readParams(el, state) {
  const cs = getComputedStyle(el);
  const num = (prop, fb) => {
    const v = Number.parseFloat(cs.getPropertyValue(prop));
    return Number.isFinite(v) ? v : fb;
  };
  const p = state.params;
  const rect = el.getBoundingClientRect(); // one reflow read, used for both dims
  return {
    w: Math.max(1, Math.round(rect.width)),
    h: Math.max(1, Math.round(rect.height)),
    corner: Math.round(Number.parseFloat(cs.borderTopLeftRadius) || DEFAULTS.corner),
    refraction: p.refraction ?? num('--lg-refraction', DEFAULTS.refraction),
    depth: Math.round(p.depth ?? num('--lg-depth', DEFAULTS.depth)),
    dispersion: p.dispersion ?? num('--lg-dispersion', DEFAULTS.dispersion),
    blur: num('--lg-radius', DEFAULTS.radius),
    saturate: num('--lg-saturate', DEFAULTS.saturate),
    brightness: num('--lg-brightness', DEFAULTS.brightness),
    contrast: num('--lg-contrast', DEFAULTS.contrast),
    reduced:
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-transparency: reduce)').matches,
  };
}

/** Write the backdrop-filter pair once per DISTINCT value: a refraction-only
 *  re-stamp keeps the string identical, and skipping the redundant write keeps
 *  the style system out of the hot tuning path entirely. */
function setBackdrop(el, value, state) {
  if (state) {
    if (state.lastBackdrop === value) return;
    state.lastBackdrop = value;
  }
  el.style.backdropFilter = value;
  el.style.webkitBackdropFilter = value;
}

/** Drop this instance's hold on its cached map (if any).
 *  We release the key we actually HOLD a ref for (heldKey), which is set the
 *  instant acquireMap succeeds — independent of whether the map has finished
 *  decoding. geoKey only tracks the geometry we last *targeted*; conflating the
 *  two double-counted refs on a same-geometry re-render before decode. */
function dropMap(state) {
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

function render(state) {
  const { el, id } = state;
  const p = readParams(el, state);
  // Frost FIRST, then the lens: blurring the backdrop before the displacement
  // means the lens bends already-soft content (clean refraction) instead of
  // smearing sharp high-contrast edges into streaks.
  const tail = `blur(${p.blur}px) saturate(${p.saturate}) brightness(${p.brightness}) contrast(${p.contrast})`;

  // Non-refracting / reduced / disabled → the CSS class declares the same blur
  // tail, so clear inline and let the stylesheet own the fallback.
  if (p.reduced || !state.enabled || !state.refracts) {
    setBackdrop(el, p.reduced || !state.enabled ? '' : tail, state);
    dropMap(state);
    return;
  }
  // refraction ≈ 0 → plain frost, no displacement (opt-out of the lens).
  if (p.refraction <= 0.01) {
    setBackdrop(el, tail, state);
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
  const gen = ++state.gen;
  const t0 = state.onPerf ? performance.now() : 0;

  const stamp = (map, mapMs) => {
    if (state.gen !== gen) return; // a newer render superseded this one
    state.map = map;
    const scale = map.unit * p.refraction;
    applyLens(state, map, p, scale);
    setBackdrop(
      el,
      `blur(${p.blur}px) url(#${id}) saturate(${p.saturate}) brightness(${p.brightness}) contrast(${p.contrast})`,
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
      const pm = state.pendingMap; // decode in flight → re-arm a stamp for THIS gen
      const im = new Image();
      im.onload = im.onerror = () => stamp(pm, 0);
      im.src = pm.href;
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
  // Decode the map before referencing it (feImage decode is async even for a
  // data-URI); stamping after decode avoids a one-frame flash of the un-lensed
  // backdrop. The gen-guard in stamp() drops this if a newer render superseded.
  const im = new Image();
  im.onload = im.onerror = () => stamp(map, mapMs);
  im.src = map.href;
}

/**
 * Attach Liquid Glass to an element.
 * @returns {{update(p):void, refresh():void, setEnabled(b):void, destroy():void, params, refracts}}
 */
export function attach(el, opts = {}) {
  registry.get(el)?.destroy();
  ensureDefs();
  const id = `lab-lg-${++uid}`;
  const filter = document.createElementNS(SVGNS, 'filter');
  filter.id = id;
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  // userSpaceOnUse with the region set to the element box (0,0,w,h) in stamp():
  // element-LOCAL coordinates that travel with the element on left/top → the lens
  // stays aligned when dragged and never samples out of bounds (shuding's rule).
  // (primitiveUnits is intentionally NOT set: no primitive here carries a
  // primitiveUnits-sensitive length, so it would be a no-op.)
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  ensureDefs().appendChild(filter);

  const state = {
    el,
    id,
    filter,
    enabled: true,
    refracts: supportsRefraction(),
    params: { ...opts },
    gen: 0,
    geoKey: null, // geometry last targeted by render() (drives the cheap-restamp)
    heldKey: null, // geometry we currently hold a cache ref for (drives refcount)
    map: null,
    stamped: null, // what the <filter> currently holds (drives the attribute-only re-stamp)
    dispNodes: null, // live feDisplacementMap nodes of the current structure
    lastBackdrop: undefined, // last backdrop-filter string we wrote (skip repeats)
    // Optional perf hook — DEV only. When provided, render() reports timing
    // ({reason:'rebuild'|'restamp', mapMs, totalMs, mapW, mapH}). Pass nothing in
    // production → zero overhead (no performance.now() calls, no allocation).
    onPerf: typeof opts.onPerf === 'function' ? opts.onPerf : null,
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
  ro.observe(el);
  window.addEventListener('resize', debouncedUpdate);
  const mq =
    typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-transparency: reduce)') : null;
  mq?.addEventListener('change', update);

  state.update = (p) => {
    Object.assign(state.params, p);
    update();
  };
  state.refresh = update;
  state.setEnabled = (b) => {
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
    filter.remove();
    setBackdrop(el, '', state);
    if (registry.get(el) === state) registry.delete(el);
  };

  el.classList.add('lab-liquid-glass');
  registry.set(el, state);
  update();
  return state;
}

/** Inert introspection for tests/DEV — never read on any render path, so it
 *  cannot affect the picture. Reports the bounded-cache invariants. */
export function __cacheStats() {
  let live = 0;
  let zombies = 0;
  for (const e of mapCache.values()) e.refs > 0 ? live++ : zombies++;
  return { size: mapCache.size, live, zombies, zombieCap: ZOMBIE_CAP, scratchAllocated: !!sDx };
}

export default { attach, supportsRefraction };
