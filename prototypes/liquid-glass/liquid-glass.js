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
 * Zero dependencies, browser-native ES module. Pairs with liquid-glass.css.
 */

const SVGNS = 'http://www.w3.org/2000/svg';
const registry = new WeakMap(); // host element → state (no DOM expando)
let uid = 0;
let defs = null;

/** How far a rim pixel samples toward the centre at full refraction (the lens
 *  magnification). Tuned against the Apple references; the per-instance
 *  `--lg-refraction` knob scales the result linearly. */
const MAX_PULL = 0.15;

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
 *  keeps the honest blur fallback. */
export function supportsRefraction() {
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

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (x) => x * x * (3 - 2 * x);

/** Signed distance to a rounded rectangle [0,w]×[0,h], corner r. <0 inside. */
function sdRoundRect(px, py, w, h, r) {
  const qx = Math.abs(px - w / 2) - (w / 2 - r);
  const qy = Math.abs(py - h / 2) - (h / 2 - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
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
 * The map is geometry-only (no strength baked in): the displacement is encoded
 * normalised, and `unit` is returned as the feDisplacementMap `scale` that
 * reconstructs the true pixel shift at refraction = 1. So changing refraction
 * is a cheap scale change, not a map rebuild.
 */
function buildMap(w, h, corner, depth, dpr) {
  const r = Math.max(0, Math.min(corner, Math.min(w, h) / 2));
  const band = Math.max(2, Math.min(depth, Math.min(w, h) / 2)); // rim lens thickness
  const sc = Math.max(1, Math.min(dpr || 1, 2)); // device-pixel scale, capped at 2
  const W = Math.max(1, Math.round(w * sc));
  const H = Math.max(1, Math.round(h * sc));
  const cx = w / 2;
  const cy = h / 2;

  const dxs = new Float32Array(W * H);
  const dys = new Float32Array(W * H);
  let maxAbs = 1e-6;

  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const k = Y * W + X;
      const px = (X + 0.5) / sc;
      const py = (Y + 0.5) / sc;
      const inside = -sdRoundRect(px, py, w, h, r); // >0 inside, 0 at the edge
      let dx = 0;
      let dy = 0;
      if (inside > 0) {
        // 1 at the rim → 0 `band` px inward; double-smoothstep for a gentle,
        // seamless falloff (the shape that reads as thick glass, not an outline).
        const m = smoothstep(smoothstep(clamp01(1 - inside / band)));
        const pull = MAX_PULL * m;
        dx = (cx - px) * pull; // inward pull = magnification
        dy = (cy - py) * pull;
      }
      dxs[k] = dx;
      dys[k] = dy;
      if (Math.abs(dx) > maxAbs) maxAbs = Math.abs(dx);
      if (Math.abs(dy) > maxAbs) maxAbs = Math.abs(dy);
    }
  }

  // Encode [-maxAbs, maxAbs] → [0,1] with no clipping. feDisplacementMap shifts
  // by scale·(channel − 0.5); with scale = 2·maxAbs the shift reconstructs the
  // true pixel displacement exactly.
  const img = new ImageData(W, H);
  const data = img.data;
  const norm = 1 / (2 * maxAbs);
  for (let k = 0; k < W * H; k++) {
    const i = k * 4;
    data[i] = (dxs[k] * norm + 0.5) * 255;
    data[i + 1] = (dys[k] * norm + 0.5) * 255;
    data[i + 2] = 128;
    data[i + 3] = 255;
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.getContext('2d').putImageData(img, 0, 0);
  return { href: canvas.toDataURL(), unit: 2 * maxAbs, mapW: W, mapH: H };
}

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

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
    `<feDisplacementMap in="SourceGraphic" in2="map" scale="${s.toFixed(2)}" xChannelSelector="R" yChannelSelector="G"`;

  if (dispersion < 0.02) {
    return `${atlas}${dm(scale)}/>`;
  }
  const k = dispersion * 0.08; // gentle per-channel spread
  return (
    `${atlas}` +
    `${dm(scale * (1 + k))} result="dR"/><feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cR"/>` +
    `${dm(scale)} result="dG"/><feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cG"/>` +
    `${dm(scale * (1 - k))} result="dB"/><feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cB"/>` +
    `<feBlend in="cR" in2="cG" mode="screen" result="cRG"/><feBlend in="cRG" in2="cB" mode="screen"/>`
  );
}

function readParams(el, state) {
  const cs = getComputedStyle(el);
  const num = (prop, fb) => {
    const v = Number.parseFloat(cs.getPropertyValue(prop));
    return Number.isFinite(v) ? v : fb;
  };
  const p = state.params;
  return {
    w: Math.max(1, Math.round(el.getBoundingClientRect().width)),
    h: Math.max(1, Math.round(el.getBoundingClientRect().height)),
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

function setBackdrop(el, value) {
  el.style.backdropFilter = value;
  el.style.webkitBackdropFilter = value;
}

function render(state) {
  const { el, id, filter } = state;
  const p = readParams(el, state);
  // Frost FIRST, then the lens: blurring the backdrop before the displacement
  // means the lens bends already-soft content (clean refraction) instead of
  // smearing sharp high-contrast edges into streaks.
  const tail = `blur(${p.blur}px) saturate(${p.saturate}) brightness(${p.brightness}) contrast(${p.contrast})`;

  // Non-refracting / reduced / disabled → the CSS class declares the same blur
  // tail, so clear inline and let the stylesheet own the fallback.
  if (p.reduced || !state.enabled || !state.refracts) {
    setBackdrop(el, p.reduced || !state.enabled ? '' : tail);
    state.geoKey = null;
    return;
  }
  // refraction ≈ 0 → plain frost, no displacement (opt-out of the lens).
  if (p.refraction <= 0.01) {
    setBackdrop(el, tail);
    state.geoKey = null;
    return;
  }

  const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
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
    // Region == element box in element-LOCAL px (filterUnits=userSpaceOnUse) →
    // travels with the element on left/top; the lens stays aligned when dragged
    // (shuding's anti-seam rule). Do NOT CSS-transform a glass element.
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', String(p.w));
    filter.setAttribute('height', String(p.h));
    filter.innerHTML = filterMarkup(map.href, p.w, p.h, scale, p.dispersion);
    setBackdrop(
      el,
      `blur(${p.blur}px) url(#${id}) saturate(${p.saturate}) brightness(${p.brightness}) contrast(${p.contrast})`,
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

  if (geoKey === state.geoKey && state.map) {
    stamp(state.map, 0); // geometry unchanged → reuse map, cheap re-stamp
    return;
  }
  state.geoKey = geoKey;
  const tMap = state.onPerf ? performance.now() : 0;
  const map = buildMap(p.w, p.h, p.corner, p.depth, dpr);
  const mapMs = state.onPerf ? performance.now() - tMap : 1;
  // Decode the map before referencing it (feImage decode is async even for data-URIs).
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
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
  ensureDefs().appendChild(filter);

  const state = {
    el,
    id,
    filter,
    enabled: true,
    refracts: supportsRefraction(),
    params: { ...opts },
    gen: 0,
    // Optional perf hook — DEV only. When provided, render() reports timing
    // ({reason:'rebuild'|'restamp', mapMs, totalMs, mapW, mapH}). Pass nothing in
    // production → zero overhead (no performance.now() calls, no allocation).
    onPerf: typeof opts.onPerf === 'function' ? opts.onPerf : null,
  };

  const update = () => render(state);
  const ro = new ResizeObserver(update);
  ro.observe(el);
  window.addEventListener('resize', update);
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
    ro.disconnect();
    window.removeEventListener('resize', update);
    mq?.removeEventListener('change', update);
    filter.remove();
    setBackdrop(el, '');
    if (registry.get(el) === state) registry.delete(el);
  };

  el.classList.add('lab-liquid-glass');
  registry.set(el, state);
  update();
  return state;
}

export default { attach, supportsRefraction };
