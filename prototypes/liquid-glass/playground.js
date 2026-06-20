import { attach } from './liquid-glass.js';

const pane = document.getElementById('pane');
const panel = document.getElementById('panel');
const bg = document.getElementById('bg');
const stage = document.getElementById('stage');

/* ── Perf instrumentation — DEV ONLY (strip the whole block for production) ────
 * Collects the engine's own timing (map build vs cheap re-stamp) + a live FPS
 * counter, renders a small HUD, and exposes window.__lgPerf for the render
 * harness to dump to disk. The runtime cost is zero when no onPerf is passed. */
const perf = {
  fps: 0,
  lastMapMs: 0,
  maxMapMs: 0,
  lastReason: '-',
  mapW: 0,
  mapH: 0,
  rebuilds: 0,
  restamps: 0,
  dragging: false,
};
window.__lgPerf = perf;
const onPerf = (m) => {
  if (m.reason === 'rebuild') {
    perf.rebuilds++;
    perf.lastMapMs = m.mapMs;
    perf.maxMapMs = Math.max(perf.maxMapMs, m.mapMs);
    perf.mapW = m.mapW;
    perf.mapH = m.mapH;
  } else {
    perf.restamps++;
  }
  perf.lastReason = m.reason;
};

// Attach the refraction engine to the draggable pane and to the panel itself.
const glass = attach(pane, { onPerf });
attach(panel, { depth: 14 });
// Expose the pane instance for tooling / the render harness (demo-only).
window.__paneGlass = glass;

const hud = document.createElement('div');
hud.className = 'lg-perf';
hud.innerHTML =
  '<b>PERF</b> <span class="lg-perf-note">dev-only — strip for prod</span><pre id="lg-perf-body"></pre>';
document.body.appendChild(hud);
const hudBody = document.getElementById('lg-perf-body');
let frames = 0;
let fpsT0 = performance.now();
function perfTick(now) {
  frames++;
  const dt = now - fpsT0;
  if (dt >= 500) {
    perf.fps = Math.round((frames * 1000) / dt);
    frames = 0;
    fpsT0 = now;
    hudBody.textContent =
      `fps        ${perf.fps}${perf.dragging ? '  (dragging)' : ''}\n` +
      `map build  ${perf.lastMapMs.toFixed(2)}ms (max ${perf.maxMapMs.toFixed(2)})\n` +
      `map size   ${perf.mapW}x${perf.mapH} device-px\n` +
      `rebuilds   ${perf.rebuilds}\n` +
      `re-stamps  ${perf.restamps}  (drag must NOT rebuild)`;
  }
  requestAnimationFrame(perfTick);
}
requestAnimationFrame(perfTick);

document.getElementById('engine').textContent = glass.refracts
  ? 'engine: Chromium · refraction ON'
  : 'engine: blur fallback (non-Chromium)';

/* ── Controls ──────────────────────────────────────────────────────────────
 * Each knob just writes a CSS custom property on the pane, then nudges the
 * engine to re-read it. refraction/depth/dispersion rebuild the SVG; the rest
 * are pure CSS. One uniform path → trivially configurable. */
const GLASS = [
  { v: '--lg-radius', name: 'Blur (frost)', min: 0, max: 40, step: 0.5, def: 4, unit: 'px' },
  { v: '--lg-refraction', name: 'Refraction', min: 0, max: 2, step: 0.01, def: 1 },
  { v: '--lg-depth', name: 'Depth', min: 6, max: 120, step: 1, def: 40, unit: 'px' },
  { v: '--lg-dispersion', name: 'Dispersion', min: 0, max: 1, step: 0.01, def: 0.4 },
];
const SURFACE = [
  { v: '--lg-corner', name: 'Corner radius', min: 0, max: 90, step: 1, def: 28, unit: 'px' },
  { v: '--lg-tint-opacity', name: 'Tint opacity', min: 0, max: 1, step: 0.01, def: 0.03 },
  { v: '--lg-saturate', name: 'Saturation', min: 1, max: 2.6, step: 0.05, def: 1.3 },
];

const inputs = new Map();

function fmt(spec, value) {
  if (spec.unit === 'px' || spec.unit === 'deg') return `${Math.round(value)}${spec.unit}`;
  return Number(value).toFixed(2);
}

function setKnob(spec, value, fromPreset) {
  pane.style.setProperty(spec.v, spec.unit ? `${value}${spec.unit}` : `${value}`);
  const row = inputs.get(spec.v);
  if (row) {
    row.out.textContent = fmt(spec, value);
    if (fromPreset) row.input.value = value;
  }
  glass.update({});
  if (!fromPreset) clearPresetSelection();
  writeCss();
}

function buildControls(list, mountId) {
  const mount = document.getElementById(mountId);
  for (const spec of list) {
    const row = document.createElement('div');
    row.className = 'ctrl';
    const name = document.createElement('span');
    name.className = 'ctrl__name';
    name.textContent = spec.name;
    const out = document.createElement('span');
    out.className = 'ctrl__val';
    out.textContent = fmt(spec, spec.def);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = spec.min;
    input.max = spec.max;
    input.step = spec.step;
    input.value = spec.def;
    input.setAttribute('aria-label', spec.name);
    input.addEventListener('input', () => setKnob(spec, Number(input.value), false));
    row.append(name, out, input);
    mount.appendChild(row);
    inputs.set(spec.v, { input, out, spec });
  }
}
buildControls(GLASS, 'glass-controls');
buildControls(SURFACE, 'surface-controls');

/* ── Presets (Figma tiers, web-tuned) ─────────────────────────────────────── */
const PRESETS = {
  Clear: {
    '--lg-radius': 2,
    '--lg-refraction': 1,
    '--lg-depth': 36,
    '--lg-dispersion': 0.35,
    '--lg-tint-opacity': 0.02,
    '--lg-saturate': 1.25,
  },
  Base: {
    '--lg-radius': 4,
    '--lg-refraction': 1,
    '--lg-depth': 40,
    '--lg-dispersion': 0.4,
    '--lg-tint-opacity': 0.03,
    '--lg-saturate': 1.3,
  },
  Muted: {
    '--lg-radius': 8,
    '--lg-refraction': 0.85,
    '--lg-depth': 44,
    '--lg-dispersion': 0.3,
    '--lg-tint-opacity': 0.08,
    '--lg-saturate': 1.35,
  },
  Elevated: {
    '--lg-radius': 3,
    '--lg-refraction': 1.4,
    '--lg-depth': 52,
    '--lg-dispersion': 0.6,
    '--lg-tint-opacity': 0.03,
    '--lg-saturate': 1.4,
  },
  Frosted: {
    '--lg-radius': 16,
    '--lg-refraction': 0.6,
    '--lg-depth': 36,
    '--lg-dispersion': 0.2,
    '--lg-tint-opacity': 0.16,
    '--lg-saturate': 1.45,
  },
};
const ALL = [...GLASS, ...SURFACE];
const presetMount = document.getElementById('presets');

function clearPresetSelection() {
  for (const c of presetMount.children) c.classList.remove('is-on');
}

function applyPreset(nameKey, chip) {
  const p = PRESETS[nameKey];
  for (const spec of ALL) {
    if (p[spec.v] !== undefined) setKnob(spec, p[spec.v], true);
  }
  glass.update({});
  writeCss();
  clearPresetSelection();
  chip.classList.add('is-on');
}

for (const key of Object.keys(PRESETS)) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = key;
  chip.addEventListener('click', () => applyPreset(key, chip));
  presetMount.appendChild(chip);
}

/* ── Theme ─────────────────────────────────────────────────────────────────── */
for (const btn of document.querySelectorAll('[data-theme-btn]')) {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.themeBtn;
    document.documentElement.setAttribute('data-theme', mode);
    for (const b of document.querySelectorAll('[data-theme-btn]'))
      b.classList.toggle('is-on', b === btn);
    glass.update({});
  });
}

/* ── Backdrop swatches + upload ──────────────────────────────────────────────
 * A stark monochrome grid is included because straight black/white lines make
 * the refraction (and dispersion fringing) unmistakable. */
const GRID = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
   <rect width="1600" height="1000" fill="#0b0e16"/>
   <g stroke="#e8ecff" stroke-width="2">
     ${Array.from({ length: 33 }, (_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="1000"/>`).join('')}
     ${Array.from({ length: 21 }, (_, i) => `<line x1="0" y1="${i * 50}" x2="1600" y2="${i * 50}"/>`).join('')}
   </g>
   <g fill="none" stroke="#ff3b30" stroke-width="6"><circle cx="800" cy="500" r="260"/></g>
   <g fill="none" stroke="#34c759" stroke-width="6"><circle cx="800" cy="500" r="180"/></g>
   <g fill="none" stroke="#0a84ff" stroke-width="6"><circle cx="800" cy="500" r="100"/></g>
  </svg>`,
)}`;
const BGS = [
  {
    name: 'Spectrum',
    src: './assets/backdrop.svg',
    sw: 'linear-gradient(135deg,#ff2d95,#1f6dff,#ffd23f)',
  },
  { name: 'Grid', src: GRID, sw: 'repeating-linear-gradient(0deg,#0b0e16 0 4px,#e8ecff 4px 5px)' },
];
const bgsMount = document.getElementById('bgs');
for (const [i, b] of BGS.entries()) {
  const s = document.createElement('button');
  s.type = 'button';
  s.className = `swatch${i === 0 ? ' is-on' : ''}`;
  s.style.background = b.sw;
  s.title = b.name;
  s.addEventListener('click', () => {
    bg.src = b.src;
    for (const el of bgsMount.children) el.classList.toggle('is-on', el === s);
  });
  bgsMount.appendChild(s);
}
document.getElementById('bgfile').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) {
    bg.src = URL.createObjectURL(file);
    for (const el of bgsMount.children) el.classList.remove('is-on');
  }
});

/* ── CSS export (proves it's just a configurable class) ──────────────────────── */
function writeCss() {
  const lines = ALL.map((spec) => {
    const raw =
      pane.style.getPropertyValue(spec.v) ||
      (spec.unit ? `${spec.def}${spec.unit}` : `${spec.def}`);
    return `  ${spec.v}: ${raw.trim()};`;
  });
  document.getElementById('css-out').textContent = `.lab-liquid-glass {\n${lines.join('\n')}\n}`;
}
writeCss();

/* ── Drag (1:1 pointer tracking via transform — compositor-friendly) ─────────── */
let x = 0;
let y = 0;
let px = 0;
let py = 0;
let dragging = false;

function clampInto() {
  const s = stage.getBoundingClientRect();
  const r = pane.getBoundingClientRect();
  // keep the pane fully on stage and clear of the control panel on the right
  const panelLeft = panel.getBoundingClientRect().left - s.left;
  const maxX = Math.max(0, Math.min(s.width - r.width, panelLeft - r.width - 12));
  const maxY = Math.max(0, s.height - r.height);
  x = Math.min(Math.max(x, 0), maxX);
  y = Math.min(Math.max(y, 0), maxY);
}

function place() {
  // Position via left/top, NOT transform: a CSS transform on the glass element
  // moves its painted result but NOT the SVG displacement map's user space, so a
  // transformed pane shows the lens offset from the frost (a hard seam). left/top
  // keeps the element's box (and its filter) coincident with where it paints.
  pane.style.transform = 'none';
  pane.style.left = `${x}px`;
  pane.style.top = `${y}px`;
}

// Initial position: left third, vertically centred.
function initPosition() {
  const s = stage.getBoundingClientRect();
  const r = pane.getBoundingClientRect();
  x = s.width * 0.26;
  y = (s.height - r.height) * 0.5;
  clampInto();
  place();
}
initPosition();

pane.addEventListener('pointerdown', (e) => {
  dragging = true;
  perf.dragging = true;
  px = e.clientX;
  py = e.clientY;
  pane.classList.add('is-drag');
  pane.setPointerCapture(e.pointerId);
});
pane.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  x += e.clientX - px;
  y += e.clientY - py;
  px = e.clientX;
  py = e.clientY;
  clampInto();
  place();
});
function endDrag(e) {
  if (!dragging) return;
  dragging = false;
  perf.dragging = false;
  pane.classList.remove('is-drag');
  if (e.pointerId !== undefined && pane.hasPointerCapture(e.pointerId)) {
    pane.releasePointerCapture(e.pointerId);
  }
}
pane.addEventListener('pointerup', endDrag);
pane.addEventListener('pointercancel', endDrag);
window.addEventListener('resize', () => {
  clampInto();
  place();
});
