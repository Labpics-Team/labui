/*
 * lab-liquid-glass runtime — the refraction engine.
 *
 * `backdrop-filter` can blur a backdrop but cannot bend it. The bend — the thing
 * that separates Liquid Glass from frosted glass — comes from an SVG
 * <feDisplacementMap> whose map is a DISPLACEMENT FIELD: a picture whose Red
 * channel encodes horizontal pixel shift, Green vertical (128 = no shift). We
 * derive that field from the rounded-rect's signed-distance function: across a
 * WIDE bevel the surface curves, its normal tilts, and the backdrop is bent
 * along that normal — a real thick-glass lens, strongest at the rim, fading to a
 * clear interior. A second map carries the SPECULAR rim-light (normal · light),
 * blended over the refracted backdrop in the same filter, so the highlight sits
 * ON the lens instead of being a CSS sticker. The filter is referenced from CSS
 * as `backdrop-filter: url(#id)`, so it must live in the DOM and track size.
 *
 * Zero dependencies, browser-native ES module. Pairs with liquid-glass.css.
 * Design driven by the physics in kube.io/blog/liquid-glass-css-svg and the
 * CSS/SVG mechanics in ekino-france's "Liquid Glass in CSS (and SVG)".
 */

const SVGNS = 'http://www.w3.org/2000/svg';
const registry = new WeakMap(); // host element → state (no DOM expando)
let uid = 0;
let defs = null;

/** Single source of truth for every default. CSS custom properties override
 *  these per-instance; nothing else hard-codes a fallback. */
const DEFAULTS = {
  radius: 0.5, // px   — backdrop blur. Near zero: the lens, not frost, is the look.
  saturate: 1.2, // ×  — gentle colour lift, not the heavy frost wash.
  brightness: 1.04,
  refraction: 1, // 0..1 — Figma: refraction. Scales the bend.
  depth: 60, // px    — Figma: depth. Width of the refractive bevel (a big fraction
  //                    of the pane → the warp spans the surface, not a hairline).
  dispersion: 0.55, // 0..1 — Figma: dispersion. Chromatic fringe at the rim.
  light: 0.7, // 0..1 — Figma: lightIntensity. Strength of the specular rim-light.
  lightAngle: -45, // deg — Figma: lightAngle.
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

/** Signed distance to a rounded rectangle [0,w]×[0,h], corner r. <0 inside. */
function sdRoundRect(px, py, w, h, r) {
  const qx = Math.abs(px - w / 2) - (w / 2 - r);
  const qy = Math.abs(py - h / 2) - (h / 2 - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

const smoothstep = (x) => x * x * (3 - 2 * x);

/**
 * Build the two maps (displacement + specular) as PNG data-URIs.
 * The bevel spans `depth` px inward; across it the surface curves from rim
 * (full slope) to interior (flat), so the bend is non-zero across the WHOLE
 * band — not a dead hairline. Displacement runs along the outward normal.
 * Specular is the rim-light: bright where the normal faces the light angle.
 */
function buildMaps(w, h, corner, depth, lightAngleDeg) {
  const r = Math.max(0, Math.min(corner, Math.min(w, h) / 2));
  const bevel = Math.max(4, Math.min(depth, Math.floor(Math.min(w, h) / 2) - 1));
  const a = (lightAngleDeg * Math.PI) / 180;
  const lx = Math.cos(a);
  const ly = Math.sin(a);

  const disp = document.createElement('canvas');
  disp.width = w;
  disp.height = h;
  const dctx = disp.getContext('2d');
  const dimg = dctx.createImageData(w, h);
  const dd = dimg.data;

  const spec = document.createElement('canvas');
  spec.width = w;
  spec.height = h;
  const sctx = spec.getContext('2d');
  const simg = sctx.createImageData(w, h);
  const sd = simg.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;
      const d = sdRoundRect(px, py, w, h, r);
      const inside = -d; // px from the edge, inward
      let vx = 0;
      let vy = 0;
      let rim = 0;
      if (d < 0 && inside < bevel) {
        // Outward surface normal = gradient of the SDF (finite differences).
        const gx = sdRoundRect(px + 1, py, w, h, r) - sdRoundRect(px - 1, py, w, h, r);
        const gy = sdRoundRect(px, py + 1, w, h, r) - sdRoundRect(px, py - 1, w, h, r);
        const gl = Math.hypot(gx, gy) || 1;
        const nx = gx / gl;
        const ny = gy / gl;
        // Slope energy across the whole bevel: 1 at the rim → 0 at the interior.
        const e = 1 - inside / bevel;
        const mag = smoothstep(e);
        vx = nx * mag;
        vy = ny * mag;
        // Specular: outward normal facing the light → hot rim. The opposite rim
        // catches a fainter counter-light (real glass lights on two edges).
        const ndotl = nx * lx + ny * ly;
        rim = mag * (Math.max(0, ndotl) ** 3 + 0.35 * Math.max(0, -ndotl) ** 3);
      }
      dd[i] = 128 + 127 * vx;
      dd[i + 1] = 128 + 127 * vy;
      dd[i + 2] = 128;
      dd[i + 3] = 255;
      const s = Math.min(255, rim * 255);
      sd[i] = 255;
      sd[i + 1] = 255;
      sd[i + 2] = 255;
      sd[i + 3] = s;
    }
  }
  dctx.putImageData(dimg, 0, 0);
  sctx.putImageData(simg, 0, 0);
  return { disp: disp.toDataURL(), spec: spec.toDataURL(), bevel };
}

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Compose the <filter> body: refract the backdrop (1 pass, or 3 channel-split
 *  passes for chromatic dispersion), then screen the specular rim-light over it. */
function filterMarkup(dispHref, specHref, w, h, scale, dispersion, light) {
  const dimg = `<feImage href="${escAttr(dispHref)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="dmap"/>`;
  const dm = (s, input, result) =>
    `<feDisplacementMap in="${input}" in2="dmap" scale="${s.toFixed(2)}" ` +
    `xChannelSelector="R" yChannelSelector="G" result="${result}"/>`;

  let refr;
  if (dispersion < 0.02) {
    refr = `${dimg}${dm(scale, 'SourceGraphic', 'refr')}`;
  } else {
    const spread = scale * dispersion * 0.4;
    const keep = (rgba) => rgba;
    refr = `${
      dimg + dm(scale + spread, 'SourceGraphic', 'dR')
    }<feColorMatrix in="dR" type="matrix" values="${keep('1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0')}" result="cR"/>${dm(scale, 'SourceGraphic', 'dG')}<feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cG"/>${dm(scale - spread, 'SourceGraphic', 'dB')}<feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cB"/><feBlend in="cR" in2="cG" mode="screen" result="cRG"/><feBlend in="cRG" in2="cB" mode="screen" result="refr"/>`;
  }

  if (light <= 0.01) return refr;
  // Specular rim-light screened over the refracted backdrop — highlight on the lens.
  const simg = `<feImage href="${escAttr(specHref)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="smap"/>`;
  const dim = `<feComponentTransfer in="smap" result="slit"><feFuncA type="linear" slope="${light.toFixed(2)}"/></feComponentTransfer>`;
  return `${refr}${simg}${dim}<feBlend in="refr" in2="slit" mode="screen"/>`;
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
    light: p.light ?? num('--lg-light', DEFAULTS.light),
    lightAngle: num('--lg-light-angle', DEFAULTS.lightAngle),
    blur: num('--lg-radius', DEFAULTS.radius),
    saturate: num('--lg-saturate', DEFAULTS.saturate),
    brightness: num('--lg-brightness', DEFAULTS.brightness),
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
  const tail = `blur(${p.blur}px) saturate(${p.saturate}) brightness(${p.brightness})`;

  // Non-refracting / reduced / disabled → the CSS class already declares the
  // same blur tail, so clear inline and let the stylesheet own the fallback.
  if (p.reduced || !state.enabled || !state.refracts) {
    setBackdrop(el, p.reduced || !state.enabled ? '' : tail);
    state.geoKey = null;
    state.fKey = null;
    return;
  }

  const geoKey = `${p.w}x${p.h}x${p.corner}x${p.depth}x${Math.round(p.lightAngle)}`;
  const gen = ++state.gen;

  const stamp = (maps) => {
    if (state.gen !== gen) return; // a newer render superseded this one
    state.maps = maps;
    // Bend ≈ 0.7 of the bevel width — derived from geometry, not a magic scale.
    const scale = maps.bevel * 1.4 * p.refraction;
    filter.setAttribute('x', '-25%');
    filter.setAttribute('y', '-25%');
    filter.setAttribute('width', '150%');
    filter.setAttribute('height', '150%');
    filter.innerHTML = filterMarkup(maps.disp, maps.spec, p.w, p.h, scale, p.dispersion, p.light);
    setBackdrop(el, `url(#${id}) ${tail}`);
  };

  if (geoKey === state.geoKey && state.maps) {
    stamp(state.maps); // geometry unchanged → reuse maps, re-stamp (cheap params)
    return;
  }
  state.geoKey = geoKey;
  const maps = buildMaps(p.w, p.h, p.corner, p.depth, p.lightAngle);
  // Decode both maps before referencing them so the very first composite already
  // has the displacement (feImage decode is async even for data-URIs).
  Promise.all(
    [maps.disp, maps.spec].map(
      (src) =>
        new Promise((res) => {
          const im = new Image();
          im.onload = im.onerror = () => res();
          im.src = src;
        }),
    ),
  ).then(() => stamp(maps));
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
  filter.setAttribute('filterUnits', 'objectBoundingBox');
  ensureDefs().appendChild(filter);

  const state = {
    el,
    id,
    filter,
    enabled: true,
    refracts: supportsRefraction(),
    params: { ...opts },
    gen: 0,
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
