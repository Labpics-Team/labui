/*
 * @labpics/ui-materials/engine — the veil runtime (lab-veil, progressive blur).
 *
 * Landed from `prototypes/progressive-blur/progressive-blur.js`.
 * PACKAGE-BOUNDARY CHANGES vs the prototype — everything else is a faithful
 * port (same cumulative strip model, same trailing-edge rAF discipline, same
 * loud-failure rules):
 *
 *   · Tokens renamed at the boundary: `--pb-*` → `--lab-veil-*`. New at the
 *     boundary is `--lab-veil-strength` (px at the strong end, default 24px):
 *     the canonical profile is `0 var(--lab-veil-strength), 1 0px ease-out` —
 *     strength at the edge, decaying away from it. `--lab-veil-stops`
 *     overrides the whole profile; `--lab-veil-levels` / `--lab-veil-feather`
 *     map 1:1 onto the prototype's knobs.
 *   · The marker is the `data-veil` ATTRIBUTE (declarative, beside
 *     `data-material`), not a class. `data-veil="top|bottom|left|right"` pins
 *     the axis to an edge (blur decays FROM that edge);
 *     `data-veil="axis"` reads the full axis from `--lab-veil-from` /
 *     `--lab-veil-to`. Ordinary use is ONE attribute + ONE variable.
 *   · Config is 100% declarative (attribute + custom properties): the
 *     prototype's attach(opts)/update(params) programmatic override channel
 *     did not land — stops are therefore always strings and the config
 *     signature needs no by-value array serialisation.
 *   · The strip class is `lab-veil__strip`; the host carries no class at all —
 *     `[data-veil]` is the CSS hook (base styling + honest fallbacks live in
 *     material.css, the package stylesheet).
 *   · NOT exported from the package index: the only consumer is the
 *     declarative runtime in `./runtime.ts` (mountMaterialRuntime scans
 *     `[data-veil]` with the same observer mechanics as `data-material`).
 *
 * ── The mechanism (unchanged) ───────────────────────────────────────────────
 * The web has no variable-radius backdrop blur, and the naive "one blur +
 * opacity mask" fake cross-fades BLURRED against SHARP across the whole
 * surface — sharp content ghosts through mid-fade. The honest construction is
 * a CUMULATIVE STACK OF STRIPS: the blur profile B(t) (Figma-like stops +
 * per-segment easing, see veil-math.ts) is discretised onto a geometric ladder
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
 */

import { type LengthProbe, createLengthProbe } from './length';
import { trailingRaf } from './mount';
import { type Point, type Stop, bandBBox, bandify, parseStops } from './veil-math';

/** The strip class material.css binds its base styling and honest fallbacks
 *  to — the veil analogue of LENSED_CLASS (asserted by the CSS contract test). */
export const VEIL_STRIP_CLASS = 'lab-veil__strip';

export interface VeilHandle {
  restore(): void;
  /** Re-read the declarative config and rebuild if it changed (sig-guarded). */
  refresh(): void;
  setEnabled(b: boolean): void;
  destroy(): void;
}

interface VeilState {
  el: HTMLElement;
  measurements: HTMLElement;
  strength: LengthProbe;
  feather: LengthProbe;
  strips: HTMLElement[];
  sig: string | null;
  enabled: boolean;
}

const registry = new WeakMap<HTMLElement, VeilHandle>(); // host → handle (no DOM expando)

const DEFAULTS = {
  from: '50% 0%',
  to: '50% 100%',
  levels: 6,
  feather: 'auto',
} as const;

/** Edge presets: the axis starts AT the named edge, so the canonical profile
 *  (strength at t=0, decaying to 0) puts the blur against that edge. */
const PRESETS: Readonly<Record<string, { from: string; to: string }>> = {
  top: { from: '50% 0%', to: '50% 100%' },
  bottom: { from: '50% 100%', to: '50% 0%' },
  left: { from: '0% 50%', to: '100% 50%' },
  right: { from: '100% 50%', to: '0% 50%' },
};

/** Plain backdrop blur support — the effect's only hard requirement. Probed
 *  once per page (the answer cannot change mid-session). */
let blurProbe: boolean | null = null;
export function supportsBackdropBlur(): boolean {
  if (blurProbe === null) {
    blurProbe =
      typeof CSS !== 'undefined' &&
      !!CSS.supports &&
      (CSS.supports('backdrop-filter', 'blur(1px)') ||
        CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));
  }
  return blurProbe;
}

function parsePoint(str: string, w: number, h: number): Point | null {
  const m = /^\s*(-?[\d.]+)(%|px)?\s+(-?[\d.]+)(%|px)?\s*$/.exec(String(str));
  if (!m) return null;
  const x = Number.parseFloat(m[1] ?? '');
  const y = Number.parseFloat(m[3] ?? '');
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: m[2] === 'px' ? x : (x / 100) * w,
    y: m[4] === 'px' ? y : (y / 100) * h,
  };
}

interface VeilConfig {
  w: number;
  h: number;
  from: string;
  to: string;
  stops: string;
  levels: number;
  feather: string;
  reduced: boolean;
}

/** Read the declarative config: `data-veil` picks the axis (edge preset or the
 *  `--lab-veil-from/to` tokens), `--lab-veil-*` carries everything else. The
 *  tokens are NOT declared in material.css — a `[data-veil]` declaration would
 *  shadow values inherited from an ancestor, so the defaults live here. */
function readConfig(state: VeilState): VeilConfig {
  const { el } = state;
  const cs = getComputedStyle(el);
  const raw = (prop: string, fb: string): string => {
    const v = cs.getPropertyValue(prop).trim();
    return v || fb;
  };
  const rect = el.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  const preset = PRESETS[(el.getAttribute('data-veil') ?? '').trim()];
  const stops = raw('--lab-veil-stops', '');
  const feather = raw('--lab-veil-feather', DEFAULTS.feather);
  return {
    w,
    h,
    from: preset ? preset.from : raw('--lab-veil-from', DEFAULTS.from),
    to: preset ? preset.to : raw('--lab-veil-to', DEFAULTS.to),
    // The canonical profile: strength at the strong end (t=0), easing out to
    // sharp — `--lab-veil-stops` overrides it wholesale (Figma-like stops).
    stops: stops || `0 ${state.strength.read()}px, 1 0px ease-out`,
    levels:
      Number.parseInt(raw('--lab-veil-levels', String(DEFAULTS.levels)), 10) || DEFAULTS.levels,
    feather: feather === 'auto' ? feather : String(state.feather.read()),
    reduced:
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-transparency: reduce)').matches,
  };
}

const px = (v: number): string => `${v.toFixed(2)}px`;

/**
 * Build the strip stack. Pure function of the config → identical configs
 * produce identical DOM; a config signature short-circuits no-op rebuilds.
 */
function render(state: VeilState): void {
  const { el } = state;
  let c: VeilConfig;
  try {
    c = readConfig(state);
  } catch (error) {
    for (const strip of state.strips) strip.remove();
    state.strips = [];
    state.sig = null;
    console.error(error);
    return;
  }

  const sig = `${c.w.toFixed(1)}x${c.h.toFixed(1)}|${c.from}|${c.to}|${c.stops}|${c.levels}|${c.feather}|${c.reduced}|${state.enabled}`;
  if (sig === state.sig) return;
  state.sig = sig;

  for (const s of state.strips) s.remove();
  state.strips = [];
  if (c.reduced || !state.enabled || !supportsBackdropBlur()) return;

  let stops: Stop[];
  try {
    stops = parseStops(c.stops);
  } catch (err) {
    // A broken stops token must not throw the page apart mid-theme-switch —
    // render nothing, shout once.
    console.error(err);
    return;
  }
  const A = parsePoint(c.from, c.w, c.h);
  const B = parsePoint(c.to, c.w, c.h);
  if (!A || !B) {
    // Same loud-failure discipline as parseStops: a broken axis token renders
    // nothing, but never silently.
    console.error(`lab-veil: unparseable axis point "${!A ? c.from : c.to}"`);
    return;
  }
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

  const tOf = (pt: Point): number => ((pt.x - A.x) * dx + (pt.y - A.y) * dy) / (axisLen * axisLen);

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
  const runLevel = (blur: number): number => ladder.indexOf(blur); // -1 for the sharp (0) runs

  for (let k = 0; k < ladder.length; k++) {
    const lk = ladder[k] ?? 0;
    const lPrev = k === 0 ? 0 : (ladder[k - 1] ?? 0);
    const rInc = k === 0 ? lk : Math.sqrt(lk * lk - lPrev * lPrev);
    // Superlevel intervals: merge consecutive runs whose level ≥ k. Handles
    // non-monotone profiles (a level owns several disjoint intervals).
    const intervals: { t0: number; t1: number }[] = [];
    for (const r of runs) {
      if (runLevel(r.blur) >= k) {
        const last = intervals[intervals.length - 1];
        if (last && Math.abs(last.t1 - r.t0) < 1e-9) last.t1 = r.t1;
        else intervals.push({ t0: r.t0, t1: r.t1 });
      }
    }
    // The profile CLAMPS flat beyond the outer stops (blurAt), and the axis
    // A→B may be INSET in the element — the element regions before t=0 /
    // after t=1 belong to the clamped-flat profile. An interval touching an
    // axis end therefore extends to the ELEMENT edge (no seam there), padded
    // far enough along the axis to reach any corner of the box.
    const clampPad = (Math.hypot(c.w, c.h) + featherPx) / axisLen;
    for (const iv of intervals) {
      // Feather half-width per edge: fade only where the profile actually
      // CROSSES the level (an interval ending at the axis end has no seam).
      const width = iv.t1 - iv.t0;
      const hf = Math.min(f, width) / 2;
      const fadeIn = iv.t0 > 1e-6;
      const fadeOut = iv.t1 < 1 - 1e-6;
      const inS = fadeIn ? iv.t0 - hf : iv.t0 - clampPad;
      const inE = fadeIn ? iv.t0 + hf : iv.t0;
      const outS = fadeOut ? iv.t1 - hf : iv.t1;
      const outE = fadeOut ? iv.t1 + hf : iv.t1 + clampPad;
      // Bleed past the visible zone by the blur radius, so backdrop-filter's
      // edge clamping never lands inside the visible mask.
      const bleed = (rInc + 2) / axisLen;
      const box = bandBBox(c.w, c.h, A, B, inS - bleed, outE + bleed);
      if (!box) continue;

      const strip = document.createElement('div');
      strip.className = VEIL_STRIP_CLASS;
      strip.style.left = px(box.x);
      strip.style.top = px(box.y);
      strip.style.width = px(box.w);
      strip.style.height = px(box.h);
      const blur = `blur(${rInc.toFixed(2)}px)`;
      strip.style.setProperty('backdrop-filter', blur);
      strip.style.setProperty('-webkit-backdrop-filter', blur);

      if (fadeIn || fadeOut) {
        // Gradient-line px positions: the CSS gradient line spans the strip
        // box's extent along the axis; convert t-boundaries to px from its start.
        const gl = Math.abs(box.w * ux) + Math.abs(box.h * uy);
        const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
        const tStart = tOf(center) - gl / 2 / axisLen;
        const at = (t: number): number => (t - tStart) * axisLen;
        // Mask fill is `currentColor` — the package's allowed no-literal-colour
        // keyword for masks (see material.css): only its ALPHA is read here,
        // hue is irrelevant to mask-image.
        const seg: string[] = [];
        if (fadeIn) seg.push(`transparent ${px(at(inS))}`, `currentColor ${px(at(inE))}`);
        else seg.push(`currentColor ${px(at(inS))}`);
        if (fadeOut) seg.push(`currentColor ${px(at(outS))}`, `transparent ${px(at(outE))}`);
        else seg.push(`currentColor ${px(at(outE))}`);
        const mask = `linear-gradient(${cssAngle}deg, ${seg.join(', ')})`;
        strip.style.setProperty('mask-image', mask);
        strip.style.setProperty('-webkit-mask-image', mask);
      }
      el.appendChild(strip);
      state.strips.push(strip);
    }
  }
}

/**
 * Attach the veil to a `[data-veil]` element. Reads the declarative config
 * (attribute + `--lab-veil-*` tokens) and keeps itself in sync with the
 * element's size (ResizeObserver + window resize, trailing-edge rAF) and the
 * reduced-transparency media query.
 */
export function attach(el: HTMLElement): VeilHandle {
  registry.get(el)?.destroy();
  let disposed = false;
  // The one integration invariant: a host that forms a backdrop root makes
  // the strips blur the ELEMENT instead of the page behind it — the effect
  // silently dies. Shout once instead of degrading quietly.
  const hostCs = getComputedStyle(el);
  if (
    Number.parseFloat(hostCs.opacity) < 1 ||
    hostCs.filter !== 'none' ||
    hostCs.maskImage !== 'none' ||
    hostCs.mixBlendMode !== 'normal'
  ) {
    console.warn(
      'lab-veil: the host element forms a backdrop root (filter/opacity/mask/blend) — strips will not see the page behind it',
      el,
    );
  }
  // CSS-измерения не увеличивают scrollable overflow самой поверхности.
  const measurements = el.ownerDocument.createElement('span');
  measurements.className = 'lab-veil__lengths';
  measurements.setAttribute('aria-hidden', 'true');
  measurements.style.cssText =
    'all:initial;display:block;position:absolute;width:0;height:0;overflow:hidden;font:inherit;visibility:hidden;pointer-events:none';
  el.appendChild(measurements);
  const state: VeilState = {
    el,
    measurements,
    strength: createLengthProbe(el, measurements, '--lab-veil-strength'),
    feather: createLengthProbe(el, measurements, '--lab-veil-feather'),
    strips: [],
    sig: null,
    enabled: true,
  };

  const update = (): void => {
    if (!disposed) render(state);
  };
  // Trailing-edge rAF — общий примитив (./mount): шторм ресайза → один render.
  const raf = trailingRaf(update);
  const schedule = (): void => {
    if (!disposed) raf.schedule();
  };
  const ro = new ResizeObserver(schedule);
  ro.observe(el);
  ro.observe(state.strength.element);
  ro.observe(state.feather.element);
  window.addEventListener('resize', schedule);
  const mq =
    typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-transparency: reduce)') : null;
  mq?.addEventListener('change', update);

  const handle: VeilHandle = {
    restore(): void {
      if (disposed) return;
      if (measurements.parentNode !== el) el.appendChild(measurements);
      state.strength.restore();
      state.feather.restore();
      for (const strip of state.strips) if (strip.parentNode !== el) el.appendChild(strip);
    },
    refresh: update,
    setEnabled: (b: boolean): void => {
      state.enabled = b !== false;
      update();
    },
    destroy: (): void => {
      if (disposed) return;
      disposed = true;
      ro.disconnect();
      raf.cancel();
      window.removeEventListener('resize', schedule);
      mq?.removeEventListener('change', update);
      for (const s of state.strips) s.remove();
      state.strips = [];
      state.strength.destroy();
      state.feather.destroy();
      measurements.remove();
      if (registry.get(el) === handle) registry.delete(el);
    },
  };

  registry.set(el, handle);
  update();
  return handle;
}
