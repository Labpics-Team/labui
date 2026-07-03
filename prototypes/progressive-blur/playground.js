import { attach, supportsBackdropBlur } from './progressive-blur.js';

const pb = document.getElementById('pb');
const content = document.getElementById('content');

/* Busy content behind the blur: text + colour cards (real-UI material). */
const PALETTE = ['#ff2d95', '#7a2cf5', '#1f6dff', '#00c2a8', '#ffd23f', '#ff5d3b'];
const LOREM =
  'Стекло читает сквозь контент: жирные заголовки, мелкий текст и цветные карточки показывают, как радиус растёт вдоль оси. '.repeat(
    2,
  );
content.innerHTML = Array.from({ length: 6 }, (_, row) => {
  const cards = Array.from({ length: 4 }, (_, i) => {
    const c = PALETTE[(row * 4 + i) % PALETTE.length];
    return `<span class="card" style="background:${c}22;border:1px solid ${c}66;color:${c}">card ${row * 4 + i + 1}</span>`;
  }).join('');
  return `<h3>Раздел ${row + 1}</h3><p>${LOREM}</p><div>${cards}</div>`;
}).join('');

document.getElementById('engine').textContent = supportsBackdropBlur()
  ? 'engine: backdrop-filter ON'
  : 'engine: no backdrop-filter (effect off, честный no-op)';

const glass = attach(pb);
window.__pbGlass = glass; // for tooling / manual poking

/* ── Controls: everything writes CSS custom properties (the token surface),
 * then nudges the runtime to re-read them. ─────────────────────────────── */
const stopsEl = document.getElementById('stops');
const featherEl = document.getElementById('feather');
const featherOut = document.getElementById('feather-out');
const levelsEl = document.getElementById('levels');
const levelsOut = document.getElementById('levels-out');
const presetMount = document.getElementById('presets');

const PRESETS = {
  Header: { from: '50% 0%', to: '50% 100%', stops: '0 24px, 1 0px' },
  'Header · ease': { from: '50% 0%', to: '50% 100%', stops: '0 24px, 1 0px ease-in-out' },
  Dock: { from: '50% 100%', to: '50% 0%', stops: '0 18px, 45% 0px, 1 0px' },
  'Center band': { from: '50% 0%', to: '50% 100%', stops: '0 0px, 50% 20px, 1 0px' },
  Diagonal: { from: '0% 0%', to: '100% 100%', stops: '0 20px, 1 0px cubic-bezier(.2,0,.8,1)' },
};

function writeCss() {
  const lines = ['--pb-from', '--pb-to', '--pb-stops', '--pb-levels', '--pb-feather']
    .map((k) => {
      const v = pb.style.getPropertyValue(k).trim();
      return v ? `  ${k}: ${v};` : null;
    })
    .filter(Boolean);
  document.getElementById('css-out').textContent =
    `.lab-progressive-blur {\n${lines.join('\n')}\n}`;
}

let raf = 0;
function apply() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    glass.refresh();
    writeCss();
  });
}

function setProps(props) {
  for (const [k, v] of Object.entries(props)) pb.style.setProperty(k, v);
  apply();
}

for (const [name, p] of Object.entries(PRESETS)) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = name;
  chip.addEventListener('click', () => {
    stopsEl.value = p.stops;
    setProps({ '--pb-from': p.from, '--pb-to': p.to, '--pb-stops': p.stops });
    for (const c of presetMount.children) c.classList.toggle('is-on', c === chip);
  });
  presetMount.appendChild(chip);
}

stopsEl.value = PRESETS.Header.stops;
stopsEl.addEventListener('input', () => {
  setProps({ '--pb-stops': stopsEl.value });
  for (const c of presetMount.children) c.classList.remove('is-on');
});

featherEl.addEventListener('input', () => {
  const v = Number(featherEl.value);
  featherOut.textContent = v === 0 ? '0' : `${v}px`;
  setProps({ '--pb-feather': `${v}px` });
});
levelsEl.addEventListener('input', () => {
  levelsOut.textContent = levelsEl.value;
  setProps({ '--pb-levels': levelsEl.value });
});

presetMount.firstChild.classList.add('is-on');
setProps({
  '--pb-from': PRESETS.Header.from,
  '--pb-to': PRESETS.Header.to,
  '--pb-stops': PRESETS.Header.stops,
});
