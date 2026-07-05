/*
 * lab-progressive-blur — pure math: the blur profile and its discretisation.
 *
 * DOM-free heart of the effect, importable by a bare Node test runner (the
 * same split as liquid-glass' lg-math.js). The runtime consumes exactly these
 * functions; nothing here touches window/document.
 *
 * Model (Figma-gradient-like):
 *   · an AXIS from point A to point B (percent of the element box);
 *   · STOPS along it: { at: 0..1, blur: px }, any count ≥ 2;
 *   · an optional EASING per segment (CSS cubic-bezier / keyword), attached to
 *     the stop the segment ENDS at — `0 0px, 1 24px ease-in-out` eases the
 *     0→1 segment.
 *
 * The continuous profile B(t) cannot be rendered directly (backdrop-filter has
 * no variable-radius blur), so bandify() discretises it into RUNS of nearest
 * discrete blur LEVELS on a geometric ladder — each run becomes one masked
 * strip with backdrop-filter: blur(level). Geometric spacing is what makes a
 * handful of strips read as a continuous ramp: perceived blur difference is
 * roughly ratio-based, so equal ratios → equal perceptual steps.
 */

/** Below this radius (px) a blur is indistinguishable from none — profile
 *  values under it collapse into the zero level (no strip at all). */
export const MIN_VISIBLE_BLUR = 0.25;

/** Default cap on distinct blur levels (strips). 6 levels with ratio-2 spacing
 *  cover 1..32px — beyond that the steps are already sub-perceptual. */
export const DEFAULT_MAX_LEVELS = 6;

/** Dense-sampling resolution for run extraction. 512 samples put boundary
 *  quantisation at ~0.2% of the axis — far below one device pixel for any
 *  realistic element. */
export const PROFILE_SAMPLES = 512;

/* ── Easing ─────────────────────────────────────────────────────────────── */

/** CSS cubic-bezier(x1,y1,x2,y2) → easing function t→y on [0,1].
 *  Newton-Raphson with bisection fallback — the standard CSS solver shape. */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (s) => ((ax * s + bx) * s + cx) * s;
  const sampleY = (s) => ((ay * s + by) * s + cy) * s;
  const sampleDX = (s) => (3 * ax * s + 2 * bx) * s + cx;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i++) {
      const x = sampleX(s) - t;
      if (Math.abs(x) < 1e-6) return sampleY(s);
      const d = sampleDX(s);
      if (Math.abs(d) < 1e-6) break;
      s -= x / d;
    }
    let lo = 0;
    let hi = 1;
    s = t;
    while (hi - lo > 1e-6) {
      if (sampleX(s) < t) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return sampleY(s);
  };
}

const LINEAR = (t) => t;

/** CSS keyword curves (their canonical bezier parameters). */
export const EASINGS = {
  linear: LINEAR,
  ease: cubicBezier(0.25, 0.1, 0.25, 1),
  'ease-in': cubicBezier(0.42, 0, 1, 1),
  'ease-out': cubicBezier(0, 0, 0.58, 1),
  'ease-in-out': cubicBezier(0.42, 0, 0.58, 1),
};

/** Resolve an easing spec (keyword | 'cubic-bezier(a,b,c,d)' | undefined) to a
 *  function. Unknown specs fall back to linear — a typo must not blank the
 *  effect, only straighten a segment. Custom beziers are memoised: the profile
 *  sampler calls this per sample (512×/render), rebuilding the solver each
 *  time is pure waste. x1/x2 must sit in [0,1] (the CSS validity rule — the
 *  solver's x(s) is only invertible there); out-of-range specs fall back to
 *  linear exactly like CSS drops them. */
const bezierCache = new Map();
export function resolveEase(spec) {
  if (!spec) return LINEAR;
  const key = String(spec).trim();
  const kw = EASINGS[key];
  if (kw) return kw;
  const hit = bezierCache.get(key);
  if (hit) return hit;
  const m = /^cubic-bezier\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)$/.exec(key);
  let fn = LINEAR;
  if (m) {
    const [x1, y1, x2, y2] = m.slice(1).map(Number);
    if ([x1, y1, x2, y2].every(Number.isFinite) && x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1) {
      fn = cubicBezier(x1, y1, x2, y2);
    }
  }
  if (bezierCache.size > 64) bezierCache.clear(); // pathological churn guard
  bezierCache.set(key, fn);
  return fn;
}

/* ── Stops ──────────────────────────────────────────────────────────────── */

/** Parse a stops string: comma-separated `<at> <blur>px [<easing>]`, where
 *  commas INSIDE cubic-bezier(…) do not split. `at` accepts 0..1 or N%.
 *    "0 24px, 55% 4px ease-in-out, 1 0px cubic-bezier(.2,0,.8,1)"
 *  Returns stops sorted by `at`, each { at, blur, ease? }. Throws on anything
 *  unparseable — a silent half-parsed profile is worse than a loud error. */
export function parseStops(str) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of String(str)) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  const stops = parts.map((raw) => {
    const m = /^\s*(-?[\d.]+%?)\s+(-?[\d.]+)px\s*(.*)$/.exec(raw);
    if (!m) throw new Error(`progressive-blur: unparseable stop "${raw.trim()}"`);
    let at = m[1].endsWith('%') ? Number.parseFloat(m[1]) / 100 : Number.parseFloat(m[1]);
    const blur = Number.parseFloat(m[2]);
    if (!Number.isFinite(at) || !Number.isFinite(blur) || blur < 0) {
      throw new Error(`progressive-blur: invalid stop "${raw.trim()}"`);
    }
    at = Math.min(1, Math.max(0, at));
    const ease = m[3].trim() || undefined;
    return ease ? { at, blur, ease } : { at, blur };
  });
  if (stops.length < 2) throw new Error('progressive-blur: need at least 2 stops');
  stops.sort((a, b) => a.at - b.at);
  return stops;
}

/** The continuous profile: blur radius at axis position t (0..1). Piecewise
 *  between stops; each segment interpolates linearly in radius, shaped by the
 *  segment's easing. Beyond the outer stops the profile is flat (clamp). */
export function blurAt(stops, t) {
  if (t <= stops[0].at) return stops[0].blur;
  const last = stops[stops.length - 1];
  if (t >= last.at) return last.blur;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (t <= b.at) {
      if (b.at === a.at) return b.blur;
      const u = (t - a.at) / (b.at - a.at);
      return a.blur + (b.blur - a.blur) * resolveEase(b.ease)(u);
    }
  }
  return last.blur;
}

/* ── Discretisation ─────────────────────────────────────────────────────── */

/** The geometric level ladder covering [max(minProfile, MIN_VISIBLE_BLUR),
 *  maxProfile], ratio 2 — tightened only when maxLevels binds. Level 0 is
 *  appended when the profile actually reaches (near) zero. Ascending. */
export function levelLadder(minProfile, maxProfile, maxLevels = DEFAULT_MAX_LEVELS) {
  if (maxProfile < MIN_VISIBLE_BLUR) return [0];
  const hasZero = minProfile < MIN_VISIBLE_BLUR;
  const floor = hasZero ? MIN_VISIBLE_BLUR * 2 : minProfile;
  const budget = Math.max(1, maxLevels - (hasZero ? 1 : 0));
  const n = Math.min(budget, Math.max(1, Math.ceil(Math.log2(maxProfile / floor)) + 1));
  const levels = [];
  if (n === 1) {
    levels.push(maxProfile);
  } else {
    const ratio = (maxProfile / floor) ** (1 / (n - 1));
    for (let i = 0; i < n; i++) levels.push(floor * ratio ** i);
    levels[n - 1] = maxProfile; // exact top — the strongest stop renders exactly
  }
  if (hasZero) levels.unshift(0);
  return levels;
}

/** Nearest-level index in LOG space (perceptually even); values under
 *  MIN_VISIBLE_BLUR snap to the zero level when one exists. */
function nearestLevel(levels, v) {
  if (levels[0] === 0 && v < MIN_VISIBLE_BLUR) return 0;
  let best = levels[0] === 0 ? 1 : 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = levels[0] === 0 ? 1 : 0; i < levels.length; i++) {
    const d = Math.abs(Math.log(Math.max(v, MIN_VISIBLE_BLUR) / levels[i]));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Discretise the profile into runs: [{ t0, t1, blur }], ascending t, covering
 * [0,1] exactly. Adjacent runs always differ in level. Zero-blur runs are
 * INCLUDED (blur: 0) — the DOM layer skips them (no strip = sharp backdrop),
 * but their extent is what positions the neighbours' feather.
 * Handles non-monotone profiles (multi-stop up-down) naturally: a level may
 * own several disjoint runs.
 */
export function bandify(stops, { maxLevels = DEFAULT_MAX_LEVELS, samples = PROFILE_SAMPLES } = {}) {
  let minP = Number.POSITIVE_INFINITY;
  let maxP = 0;
  const vals = new Array(samples + 1);
  for (let i = 0; i <= samples; i++) {
    const v = blurAt(stops, i / samples);
    vals[i] = v;
    if (v < minP) minP = v;
    if (v > maxP) maxP = v;
  }
  const levels = levelLadder(minP, maxP, maxLevels);
  const runs = [];
  let cur = nearestLevel(levels, vals[0]);
  let start = 0;
  for (let i = 1; i <= samples; i++) {
    const li = nearestLevel(levels, vals[i]);
    if (li !== cur) {
      runs.push({ t0: start / samples, t1: i / samples, blur: levels[cur] });
      start = i;
      cur = li;
    }
  }
  runs.push({ t0: start / samples, t1: 1, blur: levels[cur] });
  // Merge degenerate slivers (< 0.5% of the axis) into the wider neighbour so
  // the DOM never builds a sub-pixel strip.
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].t1 - runs[i].t0 < 0.005 && runs.length > 1) {
      const into = i > 0 ? runs[i - 1] : runs[i + 1];
      if (i > 0) into.t1 = runs[i].t1;
      else into.t0 = runs[i].t0;
      runs.splice(i, 1);
    }
  }
  // Re-merge equal neighbours the sliver-merge may have created.
  for (let i = runs.length - 1; i > 0; i--) {
    if (runs[i].blur === runs[i - 1].blur) {
      runs[i - 1].t1 = runs[i].t1;
      runs.splice(i, 1);
    }
  }
  return { levels, runs };
}

/* ── Geometry ───────────────────────────────────────────────────────────── */

/**
 * Bounding box (within a w×h element) of the slab t0..t1 along the axis A→B
 * (points in element px). This is what lets each strip blur ONLY its band:
 * the strip element is sized to the slab's bbox, not the whole surface.
 * Returns { x, y, w, h } or null when the slab misses the box.
 */
export function bandBBox(w, h, A, B, t0, t1) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: 0, y: 0, w, h }; // degenerate axis → whole box
  const proj = (px, py) => ((px - A.x) * dx + (py - A.y) * dy) / len2;
  const corners = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const pts = [];
  for (const [px, py] of corners) {
    const t = proj(px, py);
    if (t >= t0 - 1e-9 && t <= t1 + 1e-9) pts.push([px, py]);
  }
  const edges = [
    [0, 0, w, 0],
    [w, 0, w, h],
    [w, h, 0, h],
    [0, h, 0, 0],
  ];
  for (const tb of [t0, t1]) {
    // boundary line: (p−A)·D = tb·|D|²  — intersect with each rect edge
    const c = tb * len2 + A.x * dx + A.y * dy;
    for (const [x1, y1, x2, y2] of edges) {
      const f1 = x1 * dx + y1 * dy - c;
      const f2 = x2 * dx + y2 * dy - c;
      if ((f1 <= 0 && f2 >= 0) || (f1 >= 0 && f2 <= 0)) {
        const denom = f1 - f2;
        if (Math.abs(denom) < 1e-12) continue;
        const u = f1 / denom;
        pts.push([x1 + (x2 - x1) * u, y1 + (y2 - y1) * u]);
      }
    }
  }
  if (!pts.length) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [px, py] of pts) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(w, maxX);
  maxY = Math.min(h, maxY);
  if (maxX - minX <= 0 || maxY - minY <= 0) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
