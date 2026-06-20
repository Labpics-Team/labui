/*
 * lab-liquid-glass runtime — the refraction engine.
 *
 * `backdrop-filter` can blur and saturate a backdrop, but it cannot bend it.
 * The bend — the single thing that separates Liquid Glass from frosted glass —
 * comes from an SVG <feDisplacementMap> driven by a displacement MAP image:
 * a picture whose Red channel encodes horizontal pixel shift and Green channel
 * vertical shift (0.5 grey = no shift). We paint that map as a rounded
 * rectangle with a neutral interior and a gradient rim, so the backdrop is
 * displaced only near the edges — a lens. The filter is referenced from CSS as
 * `backdrop-filter: url(#id)`, which is why it must live in the DOM and track
 * the element's real size. This module builds, sizes, and live-tunes it.
 *
 * Zero dependencies, browser-native ES module. Pairs with liquid-glass.css.
 */

const SVGNS = 'http://www.w3.org/2000/svg';
let uid = 0;
let defs = null;

const DEFAULTS = {
  refraction: 1, // 0..1  — Figma: refraction. Edge bend strength.
  depth: 11, // px    — Figma: depth. Width of the refractive rim band.
  dispersion: 0.45, // 0..1  — Figma: dispersion. Chromatic fringe at the rim.
  scale: 110, // master displacement scale (px) at refraction=1 — tuned on the grid
  //            backdrop so the rim reads as a real lens without tearing.
};

/** Detect whether this engine actually REFRACTS the backdrop via url() filters.
 *  Critical subtlety (verified): Firefox and Safari PARSE
 *  `backdrop-filter: url(#f)` — so `CSS.supports(...)` returns true — but they
 *  do NOT render an SVG filter on a backdrop. Only Chromium does. So the gate
 *  must be an actual-engine test, not @supports alone. Everyone else keeps the
 *  honest blur+saturate fallback (still a clean glass, just no lens). */
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
  // UA fallback: Chromium engines, excluding Gecko/WebKit-only builds.
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

/** Build the displacement-map image (data-URI).
 *  R ramps 0→255 left→right (x-shift), G ramps 0→255 top→bottom (y-shift).
 *  A blurred neutral (#808080) rounded rect covers the interior so only a band
 *  of width ≈ depth around the rim carries any shift. */
function displacementMap(w, h, corner, depth) {
  // Clamp the rim band so a neutral interior always survives — otherwise a thin
  // element (depth ≥ min(w,h)/2) would refract edge-to-edge with no clear centre
  // and read as broken rather than as a lens.
  const d = Math.max(1, Math.min(Math.round(depth), Math.floor(Math.min(w, h) / 2) - 1 || 1));
  const iw = Math.max(0, w - 2 * d);
  const ih = Math.max(0, h - 2 * d);
  const ir = Math.max(0, corner - d);
  const svg = `<svg xmlns="${SVGNS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="x" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient><linearGradient id="y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#0f0"/></linearGradient></defs><rect width="${w}" height="${h}" fill="#000"/><rect width="${w}" height="${h}" fill="url(#x)" style="mix-blend-mode:screen"/><rect width="${w}" height="${h}" fill="url(#y)" style="mix-blend-mode:screen"/><rect x="${d}" y="${d}" width="${iw}" height="${ih}" rx="${ir}" ry="${ir}" fill="#808080" style="filter:blur(${d}px)"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Compose the <filter> body. One displacement pass when dispersion≈0; three
 *  channel-split passes (R/G/B at fanned-out scales) when it is on, which is
 *  what paints the rainbow rim. */
function filterMarkup(href, w, h, scale, dispersion) {
  // Escape the data-URI at the attribute boundary rather than trusting the
  // producer's encoding — keeps the markup well-formed even if displacementMap's
  // encoder ever changes (defence in depth; the URI is otherwise machine-built).
  const safe = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const img =
    `<feImage href="${safe}" xlink:href="${safe}" x="0" y="0" ` +
    `width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>`;
  const disp = (s, input, result) =>
    `<feDisplacementMap in="${input}" in2="map" scale="${s.toFixed(2)}" ` +
    `xChannelSelector="R" yChannelSelector="G" result="${result}"/>`;

  if (dispersion < 0.01) {
    return `${img}${disp(scale, 'SourceGraphic', 'out')}`;
  }

  const spread = scale * dispersion * 0.5;
  // Keep only one channel from each displaced pass, then screen them back.
  const keepR = '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0';
  const keepG = '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0';
  const keepB = '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0';
  return `${
    img + disp(scale + spread, 'SourceGraphic', 'dR')
  }<feColorMatrix in="dR" type="matrix" values="${keepR}" result="cR"/>${disp(scale, 'SourceGraphic', 'dG')}<feColorMatrix in="dG" type="matrix" values="${keepG}" result="cG"/>${disp(scale - spread, 'SourceGraphic', 'dB')}<feColorMatrix in="dB" type="matrix" values="${keepB}" result="cB"/><feBlend in="cR" in2="cG" mode="screen" result="cRG"/><feBlend in="cRG" in2="cB" mode="screen" result="out"/>`;
}

function cssNumber(cs, prop, fallback) {
  const raw = cs.getPropertyValue(prop).trim();
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function render(state) {
  const { el, id, filter } = state;
  const rect = el.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));

  // Pull live values from CSS vars unless overridden by an explicit update().
  const cs = getComputedStyle(el);
  const corner = Math.round(Number.parseFloat(cs.borderTopLeftRadius) || 28);
  const refraction = state.params.refraction ?? cssNumber(cs, '--lg-refraction', 1);
  const depth = Math.round(state.params.depth ?? cssNumber(cs, '--lg-depth', DEFAULTS.depth));
  const dispersion =
    state.params.dispersion ?? cssNumber(cs, '--lg-dispersion', DEFAULTS.dispersion);
  const blur = cssNumber(cs, '--lg-radius', 14);
  const saturate = cssNumber(cs, '--lg-saturate', 1.7);
  const brightness = cssNumber(cs, '--lg-brightness', 1.05);

  const reduced =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-transparency: reduce)').matches;

  // Always (re)apply the backdrop tail — blur/saturate/brightness are cheap and
  // never need the SVG. In the non-refracting / reduced path that is the whole
  // material; the CSS class already declares the same tail, so clearing inline
  // lets the stylesheet win.
  const tail = `blur(${blur}px) saturate(${saturate}) brightness(${brightness})`;

  if (reduced || !state.enabled || !state.refracts) {
    el.style.backdropFilter = state.refracts && !reduced && state.enabled ? tail : '';
    el.style.webkitBackdropFilter = el.style.backdropFilter;
    // Invalidate the caches so a later re-enable (e.g. the user turns
    // prefers-reduced-transparency back OFF) rebuilds the filter from scratch
    // instead of trusting a stale key.
    state.geoKey = null;
    state.fKey = null;
    return;
  }

  // Rebuild the displacement MAP only when geometry changes (the expensive part:
  // a fresh data-URI). Refraction → feDisplacementMap `scale`, and dispersion →
  // pass count, only re-stamp the (cheap) filter markup. This is what keeps
  // dragging the sliders at 60fps. (Research: only `scale` is cheap to animate.)
  const geoKey = `${w}x${h}x${corner}x${depth}`;
  if (geoKey !== state.geoKey) {
    state.href = displacementMap(w, h, corner, depth);
    state.geoKey = geoKey;
    filter.setAttribute('x', '-20%');
    filter.setAttribute('y', '-20%');
    filter.setAttribute('width', '140%');
    filter.setAttribute('height', '140%');
  }

  const scale = DEFAULTS.scale * refraction;
  // geoKey already encodes w/h/corner/depth; the filter additionally varies with
  // refraction (scale) and dispersion (pass count) only.
  const fKey = `${state.geoKey}|${scale.toFixed(2)}|${dispersion.toFixed(2)}`;
  if (fKey !== state.fKey) {
    filter.innerHTML = filterMarkup(state.href, w, h, scale, dispersion);
    state.fKey = fKey;
  }

  const value = `url(#${id}) ${tail}`;
  el.style.backdropFilter = value;
  el.style.webkitBackdropFilter = value;
}

/**
 * Attach Liquid Glass refraction to an element.
 * @param {HTMLElement} el
 * @param {Partial<typeof DEFAULTS>} [opts] explicit param overrides (else CSS vars win)
 * @returns {{ update(p:object):void, destroy():void, params:object, refracts:boolean }}
 */
export function attach(el, opts = {}) {
  // Re-attaching the same element tears down the previous instance first, so its
  // observers and <filter> never leak (the class is reusable / may re-mount).
  el.__labLiquidGlass?.destroy();
  ensureDefs();
  const id = `lab-lg-${++uid}`;
  const filter = document.createElementNS(SVGNS, 'filter');
  filter.id = id;
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  ensureDefs().appendChild(filter);

  const state = {
    el,
    id,
    filter,
    enabled: true,
    refracts: supportsRefraction(),
    params: { ...opts },
  };

  const update = () => render(state);
  const ro = new ResizeObserver(update);
  ro.observe(el);
  const onResize = () => update();
  window.addEventListener('resize', onResize);
  // React to the user toggling prefers-reduced-transparency at runtime, in BOTH
  // directions — so the contract holds live, not just at first paint.
  const mq =
    typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-transparency: reduce)') : null;
  mq?.addEventListener('change', update);

  state.update = (p) => {
    Object.assign(state.params, p);
    update();
  };
  state.destroy = () => {
    ro.disconnect();
    window.removeEventListener('resize', onResize);
    mq?.removeEventListener('change', update);
    filter.remove();
    el.style.backdropFilter = '';
    el.style.webkitBackdropFilter = '';
    if (el.__labLiquidGlass === state) el.__labLiquidGlass = undefined;
  };

  el.classList.add('lab-liquid-glass');
  update();
  el.__labLiquidGlass = state;
  return state;
}

export default { attach, supportsRefraction };
