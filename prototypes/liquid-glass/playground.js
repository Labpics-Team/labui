import { attach } from './liquid-glass.js';

const pane = document.getElementById('pane');
const panel = document.getElementById('panel');
const bg = document.getElementById('bg');
const stage = document.getElementById('stage');

// Attach the refraction engine to the draggable pane and to the panel itself.
const glass = attach(pane);
attach(panel, { depth: 14 });
// Expose the pane instance for tooling / the render harness (demo-only).
window.__paneGlass = glass;

document.getElementById('engine').textContent = glass.refracts
  ? 'engine: Chromium · refraction ON'
  : 'engine: blur fallback (non-Chromium)';

/* ── Controls ──────────────────────────────────────────────────────────────
 * Each knob just writes a CSS custom property on the pane, then nudges the
 * engine to re-read it. refraction/depth/dispersion rebuild the SVG; the rest
 * are pure CSS. One uniform path → trivially configurable. */
const GLASS = [
  { v: '--lg-radius', name: 'Blur (frost)', min: 0, max: 40, step: 0.5, def: 9, unit: 'px' },
  { v: '--lg-refraction', name: 'Refraction', min: 0, max: 1.5, step: 0.01, def: 1 },
  { v: '--lg-depth', name: 'Depth', min: 6, max: 48, step: 1, def: 20, unit: 'px' },
  { v: '--lg-dispersion', name: 'Dispersion', min: 0, max: 1, step: 0.01, def: 0.06 },
  {
    v: '--lg-light-angle',
    name: 'Light angle',
    min: -180,
    max: 180,
    step: 1,
    def: -45,
    unit: 'deg',
  },
  { v: '--lg-light', name: 'Light intensity', min: 0, max: 1, step: 0.01, def: 0.45 },
  { v: '--lg-splay', name: 'Splay', min: 0, max: 1, step: 0.01, def: 0.5 },
];
const SURFACE = [
  { v: '--lg-corner', name: 'Corner radius', min: 0, max: 90, step: 1, def: 28, unit: 'px' },
  { v: '--lg-tint-opacity', name: 'Tint opacity', min: 0, max: 1, step: 0.01, def: 0.1 },
  { v: '--lg-saturate', name: 'Saturation', min: 1, max: 2.6, step: 0.05, def: 1.25 },
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
    '--lg-radius': 0,
    '--lg-refraction': 1,
    '--lg-depth': 14,
    '--lg-dispersion': 0.1,
    '--lg-light-angle': -45,
    '--lg-light': 0.4,
    '--lg-splay': 0.4,
    '--lg-tint-opacity': 0.07,
    '--lg-saturate': 1.2,
  },
  Base: {
    '--lg-radius': 0,
    '--lg-refraction': 1,
    '--lg-depth': 16,
    '--lg-dispersion': 0.12,
    '--lg-light-angle': -45,
    '--lg-light': 0.45,
    '--lg-splay': 0.5,
    '--lg-tint-opacity': 0.1,
    '--lg-saturate': 1.25,
  },
  Muted: {
    '--lg-radius': 3,
    '--lg-refraction': 0.9,
    '--lg-depth': 20,
    '--lg-dispersion': 0.1,
    '--lg-light-angle': 0,
    '--lg-light': 0.4,
    '--lg-splay': 0.6,
    '--lg-tint-opacity': 0.16,
    '--lg-saturate': 1.3,
  },
  Elevated: {
    '--lg-radius': 0,
    '--lg-refraction': 1.2,
    '--lg-depth': 24,
    '--lg-dispersion': 0.16,
    '--lg-light-angle': 0,
    '--lg-light': 0.6,
    '--lg-splay': 0.7,
    '--lg-tint-opacity': 0.08,
    '--lg-saturate': 1.3,
  },
  Frosted: {
    '--lg-radius': 10,
    '--lg-refraction': 0.7,
    '--lg-depth': 16,
    '--lg-dispersion': 0.08,
    '--lg-light-angle': -45,
    '--lg-light': 0.35,
    '--lg-splay': 0.5,
    '--lg-tint-opacity': 0.22,
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
