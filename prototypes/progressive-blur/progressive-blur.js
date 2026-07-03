/*
 * lab-progressive-blur runtime — variable-strength backdrop blur along an axis.
 *
 * The web has no variable-radius backdrop blur, and the naive "one blur +
 * opacity mask" fake cross-fades BLURRED against SHARP across the whole
 * surface — sharp content ghosts through mid-fade. The honest construction is
 * a CUMULATIVE STACK OF STRIPS: the blur profile B(t) (Figma-like stops +
 * per-segment easing, see pb-math.js) is discretised onto a geometric ladder
 * of levels; for each level one child strip covers the SUPERLEVEL region
 * { t : B(t) ≥ L_k } with the INCREMENTAL radius √(L_k² − L_{k−1}²). A strip's
 * backdrop includes the strips painted before it, and Gaussian blurs compose
 * as √Σr² — so the interior of every band renders EXACTLY its ladder level,
 * and each feathered edge cross-fades only the small increment against the
 * composition beneath it: the gentlest possible seam, which is what reads as
 * a continuous ramp.
 *
 * PERFORMANCE MODEL:
 *   · Strips are TIGHT superlevel bboxes, not full-surface layers, and each
 *     carries only its incremental radius. Blur cost scales ~linearly with
 *     radius, and the increments telescope (√Σr² = max level), so the whole
 *     stack costs roughly Σ area_k·r_k ≈ 1.5–2× one full-surface blur at the
 *     strongest stop — not N×.
 *   · Zero per-frame JS. Geometry rebuilds only on resize / config change
 *     (trailing-edge rAF, same discipline as liquid-glass) and is just a few
 *     style writes — no canvas, no encoding.
 *   · The host element must NOT form a backdrop root (no filter / opacity /
 *     mask / blend on it), or the strips would blur the element instead of
 *     the page behind it.
 *
 * Config — CSS custom properties (tokenisable), overridable via attach(opts):
 *   --pb-from    "50% 0%"        axis start (percent of box or px)
 *   --pb-to      "50% 100%"      axis end
 *   --pb-stops   "0 16px, 1 0px" Figma-like stops: <at> <blur>px [easing]
 *   --pb-levels  6               max distinct blur strips
 *   --pb-feather auto|<px>       cross-fade width along the axis
 *
 * Zero dependencies, browser-native ES module. Pairs with progressive-blur.css.
 */

import { bandBBox, bandify, parseStops } from './pb-math.js';

const registry = new WeakMap(); // host element → state (no DOM expando)

const DEFAULTS = {
  from: '50% 0%',
  to: '50% 100%',
  stops: '0 16px, 1 0px',
  levels: 6,
  feather: 'auto',
};

/** Plain backdrop blur support — the effect's only hard requirement. Probed
 *  once per page (the answer cannot change mid-session). */
let blurProbe = null;
export function supportsBackdropBlur() {
  if (blurProbe === null) {
    blurProbe =
      typeof CSS !== 'undefined' &&
      !!CSS.supports &&
      (CSS.supports('backdrop-filter', 'blur(1px)') ||
        CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));
  }
  return blurProbe;
}

function parsePoint(str, w, h) {
  const m = /^\s*(-?[\d.]+)(%|px)?\s+(-?[\d.]+)(%|px)?\s*$/.exec(String(str));
  if (!m) return null;
  const x = Number.parseFloat(m[1]);
  const y = Number.parseFloat(m[3]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: m[2] === 'px' ? x : (x / 100) * w,
    y: m[4] === 'px' ? y : (y / 100) * h,
  };
}

function readConfig(el, state) {
  const cs = getComputedStyle(el);
  const raw = (prop, fb) => {
    const v = cs.getPropertyValue(prop).trim();
    return v || fb;
  };
  const p = state.params;
  const rect = el.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  return {
    w,
    h,
    from: p.from ?? raw('--pb-from', DEFAULTS.from),
    to: p.to ?? raw('--pb-to', DEFAULTS.to),
    stops: p.stops ?? raw('--pb-stops', DEFAULTS.stops),
    levels: Number.parseInt(p.levels ?? raw('--pb-levels', DEFAULTS.levels), 10) || DEFAULTS.levels,
    feather: p.feather ?? raw('--pb-feather', DEFAULTS.feather),
    reduced:
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-transparency: reduce)').matches,
  };
}

const px = (v) => `${v.toFixed(2)}px`;

/**
 * Build the strip stack. Pure function of the config → identical configs
 * produce identical DOM; a config signature short-circuits no-op rebuilds.
 */
function render(state) {
  const { el } = state;
  const c = readConfig(el, state);

  const sig = `${c.w.toFixed(1)}x${c.h.toFixed(1)}|${c.from}|${c.to}|${c.stops}|${c.levels}|${c.feather}|${c.reduced}|${state.enabled}`;
  if (sig === state.sig) return;
  state.sig = sig;

  for (const s of state.strips) s.remove();
  state.strips = [];
  if (c.reduced || !state.enabled || !supportsBackdropBlur()) return;

  let stops;
  try {
    stops = Array.isArray(c.stops) ? c.stops : parseStops(c.stops);
  } catch (err) {
    // A broken stops token must not throw the page apart mid-theme-switch —
    // render nothing, shout once.
    console.error(err);
    return;
  }
  const A = parsePoint(c.from, c.w, c.h);
  const B = parsePoint(c.to, c.w, c.h);
  if (!A || !B) return;
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const axisLen = Math.hypot(dx, dy);
  if (axisLen < 1) return;
  const ux = dx / axisLen;
  const uy = dy / axisLen;
  // CSS gradient angle: 0deg points up, clockwise positive; screen y is down.
  const cssAngle = ((Math.atan2(ux, -uy) * 180) / Math.PI).toFixed(3);

  const { levels, runs } = bandify(stops, { maxLevels: c.levels });
  // Feather width along the axis (px → t units), clamped so a cross-fade never
  // eats more than half of either neighbouring band.
  const featherPx =
    c.feather === 'auto'
      ? Math.min(48, Math.max(8, axisLen * 0.06))
      : Math.max(0, Number.parseFloat(c.feather) || 0);
  const f = featherPx / axisLen;

  const tOf = (pt) => ((pt.x - A.x) * dx + (pt.y - A.y) * dy) / (axisLen * axisLen);

  /* ── CUMULATIVE (onion) strip model ────────────────────────────────────────
   * A strip's backdrop includes every strip painted before it, so overlapping
   * siblings COMPOSE their blurs — fighting that (tiling disjoint strips per
   * absolute level) makes every seam order-dependent. Instead the composition
   * IS the mechanism: for each ladder level L_k, one strip covers the
   * SUPERLEVEL region { t : B(t) ≥ L_k } with the INCREMENTAL radius
   * r_k = √(L_k² − L_{k−1}²), painted in ascending order. Gaussians compose as
   * √Σr², so the interior of every band renders EXACTLY its ladder level, and
   * each feather cross-fades only the small increment against the composition
   * beneath it — the gentlest possible seam. */
  const ladder = levels[0] === 0 ? levels.slice(1) : levels;
  const runLevel = (r) => ladder.indexOf(r.blur); // -1 for the sharp (0) runs

  for (let k = 0; k < ladder.length; k++) {
    const rInc = k === 0 ? ladder[0] : Math.sqrt(ladder[k] ** 2 - ladder[k - 1] ** 2);
    // Superlevel intervals: merge consecutive runs whose level ≥ k. Handles
    // non-monotone profiles (a level owns several disjoint intervals).
    const intervals = [];
    for (const r of runs) {
      if (runLevel(r) >= k) {
        const last = intervals[intervals.length - 1];
        if (last && Math.abs(last.t1 - r.t0) < 1e-9) last.t1 = r.t1;
        else intervals.push({ t0: r.t0, t1: r.t1 });
      }
    }
    for (const iv of intervals) {
      // Feather half-width per edge: fade only where the profile actually
      // CROSSES the level (an interval ending at the axis end has no seam).
      const width = iv.t1 - iv.t0;
      const hf = Math.min(f, width) / 2;
      const fadeIn = iv.t0 > 1e-6;
      const fadeOut = iv.t1 < 1 - 1e-6;
      const inS = fadeIn ? iv.t0 - hf : iv.t0;
      const inE = fadeIn ? iv.t0 + hf : iv.t0;
      const outS = fadeOut ? iv.t1 - hf : iv.t1;
      const outE = fadeOut ? iv.t1 + hf : iv.t1;
      // Bleed past the visible zone by the blur radius, so backdrop-filter's
      // edge clamping never lands inside the visible mask.
      const bleed = (rInc + 2) / axisLen;
      const box = bandBBox(c.w, c.h, A, B, inS - bleed, outE + bleed);
      if (!box) continue;

      const strip = document.createElement('div');
      strip.className = 'lab-pb__strip';
      strip.style.left = px(box.x);
      strip.style.top = px(box.y);
      strip.style.width = px(box.w);
      strip.style.height = px(box.h);
      const blur = `blur(${rInc.toFixed(2)}px)`;
      strip.style.backdropFilter = blur;
      strip.style.webkitBackdropFilter = blur;

      if (fadeIn || fadeOut) {
        // Gradient-line px positions: the CSS gradient line spans the strip
        // box's extent along the axis; convert t-boundaries to px from its start.
        const gl = Math.abs(box.w * ux) + Math.abs(box.h * uy);
        const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
        const tStart = tOf(center) - gl / 2 / axisLen;
        const at = (t) => (t - tStart) * axisLen;
        const seg = [];
        if (fadeIn) seg.push(`transparent ${px(at(inS))}`, `#000 ${px(at(inE))}`);
        else seg.push(`#000 ${px(at(inS))}`);
        if (fadeOut) seg.push(`#000 ${px(at(outS))}`, `transparent ${px(at(outE))}`);
        else seg.push(`#000 ${px(at(outE))}`);
        const mask = `linear-gradient(${cssAngle}deg, ${seg.join(', ')})`;
        strip.style.maskImage = mask;
        strip.style.webkitMaskImage = mask;
      }
      el.appendChild(strip);
      state.strips.push(strip);
    }
  }
}

/**
 * Attach progressive blur to an element.
 * @returns {{update(p):void, refresh():void, setEnabled(b):void, destroy():void}}
 */
export function attach(el, opts = {}) {
  registry.get(el)?.destroy();
  const state = {
    el,
    params: { ...opts },
    strips: [],
    sig: null,
    enabled: true,
  };

  const update = () => render(state);
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
    ro.disconnect();
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', debouncedUpdate);
    mq?.removeEventListener('change', update);
    for (const s of state.strips) s.remove();
    state.strips = [];
    if (registry.get(el) === state) registry.delete(el);
  };

  el.classList.add('lab-progressive-blur');
  registry.set(el, state);
  update();
  return state;
}

export default { attach, supportsBackdropBlur };
