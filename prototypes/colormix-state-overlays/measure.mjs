// Прототип #109 — замер color-mix() стейт-оверлеев против размножения токенов.
//
// НЕ для мержа. Считает: (1) экономию токенов, (2) честность контраста —
// WCAG затемнённых/осветлённых оверлеев ключевых ролей в обеих темах, обе
// пространства смешивания (srgb vs oklab). Провенанс значений — эмитированный
// contract.css (движок), математика — labui/oklab-math (та же, что у границы).
//
// Запуск: node prototypes/colormix-state-overlays/measure.mjs
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { degam, gam, hexToLin, linOf, oklabOf, wcagY } from '../../packages/colors/oklab-math.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const contractPath = join(here, '..', '..', 'packages', 'colors-stub', 'contract.css');
const rolesPath = join(here, '..', '..', 'packages', 'colors-stub', 'roles.json');

const AA_TEXT = 4.5; // WCAG 2.1 AA обычный текст (legalFloor несущих лейбл пар)

// ── Разбор scope-а contract.css: имя → сырое значение (комментарии срезаны) ──
function scopeVars(css, selectorRe) {
  const m = selectorRe.exec(css);
  if (!m) throw new Error(`scope не найден: ${selectorRe}`);
  const open = css.indexOf('{', m.index);
  let depth = 1;
  let i = open + 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') depth--;
    i++;
  }
  const body = css.slice(open + 1, i - 1).replace(/\/\*[\s\S]*?\*\//g, '');
  const vars = new Map();
  for (const d of body.matchAll(/(--lab-[a-z0-9-]+)\s*:\s*([^;]+);/g)) vars.set(d[1], d[2].trim());
  return vars;
}

function resolveVar(name, vars, seen = new Set()) {
  const raw = vars.get(name);
  if (raw === undefined) throw new Error(`нет роли ${name}`);
  const m = raw.match(/^var\((--lab-[a-z0-9-]+)\)$/);
  if (!m) return raw;
  if (seen.has(name)) throw new Error(`цикл var() ${name}`);
  seen.add(name);
  return resolveVar(m[1], vars, seen);
}

// Цвет → { g:[r,g,b] гамма-sRGB 0..1, a:альфа }. Гамма — пространство CSS «srgb».
function parseColor(v) {
  v = v.trim();
  if (v.startsWith('#')) return { g: hexToLin(v).map(gam), a: 1 };
  if (v.startsWith('rgb(')) {
    const [body, alpha] = v.slice(4, -1).split('/');
    const [r, g, b] = body.trim().split(/\s+/).map(Number);
    return { g: [r, g, b].map((c) => c / 255), a: alpha === undefined ? 1 : Number(alpha) };
  }
  if (v.startsWith('oklch(')) {
    const [lch, alpha] = v.slice(6, -1).split('/');
    const [L, C, H] = lch.trim().split(/\s+/).map(Number.parseFloat);
    const hr = (H * Math.PI) / 180;
    const lin = linOf([L / 100, C * Math.cos(hr), C * Math.sin(hr)]).map((x) =>
      Math.min(1, Math.max(0, x)),
    );
    return { g: lin.map(gam), a: alpha === undefined ? 1 : Number.parseFloat(alpha) };
  }
  throw new Error(`неизвестный цвет: ${v}`);
}

// color-mix(in srgb, base (1-p), tint p) — интерполяция гамма-каналов (и альфы).
const mixSrgb = (base, tint, p) => ({
  g: base.g.map((c, i) => c * (1 - p) + tint.g[i] * p),
  a: base.a * (1 - p) + tint.a * p,
});
// color-mix(in oklab, …) — интерполяция в перцептивном oklab, назад в гамму.
function mixOklab(base, tint, p) {
  const lb = oklabOf(base.g.map(degam));
  const lt = oklabOf(tint.g.map(degam));
  const lm = lb.map((c, i) => c * (1 - p) + lt[i] * p);
  const lin = linOf(lm).map((x) => Math.min(1, Math.max(0, x)));
  return { g: lin.map(gam), a: base.a * (1 - p) + tint.a * p };
}

// Композит полупрозрачного gamma-fg над непрозрачным gamma-bg (как CSS-альфа).
const over = (fg, bg) => fg.g.map((c, i) => c * fg.a + bg.g[i] * (1 - fg.a));

// WCAG 2.1 контраст двух непрозрачных gamma-цветов.
function contrast(gA, gB) {
  const y1 = wcagY(gA.map(degam));
  const y2 = wcagY(gB.map(degam));
  const [hi, lo] = y1 > y2 ? [y1, y2] : [y2, y1];
  return (hi + 0.05) / (lo + 0.05);
}

const css = (await readFile(contractPath, 'utf8')).replace(/\r\n/g, '\n');
const roles = JSON.parse(await readFile(rolesPath, 'utf8'));

const THEMES = {
  light: { re: /^:root,\s*\n\[data-theme="light"\]\s*\{/m, bg: '#FFFFFF' },
  dark: { re: /^\[data-theme="dark"\]\s*\{/m, bg: '#101012' },
};

// Оверлей-тинт состояния = «чернила темы» (label-primary): тёмные в light,
// светлые в dark → ОДИН рецепт затемняет light и осветляет dark (тема-адаптивно).
const STEPS = { hover: 0.08, pressed: 0.14 };

// Несущие лейбл пары (заливка × лейбл-на-ней) — оверлей на ЗАЛИВКУ, лейбл тот же.
const FILL_PAIRS = [
  ['--lab-fill-accent', '--lab-label-on-accent'],
  ['--lab-fill-danger', '--lab-label-on-danger'],
  ['--lab-fill-primary', '--lab-label-primary'], // нейтральная tinted-кнопка
  ['--lab-fill-danger-tinted', '--lab-label-danger'],
];
// Текст на фоне (ghost/border-кнопка, ховер таба) — оверлей на ЛЕЙБЛ.
const TEXT_ON_BG = [
  ['--lab-label-accent', '--lab-bg-primary'],
  ['--lab-label-danger', '--lab-bg-primary'],
  ['--lab-label-secondary', '--lab-bg-primary'],
];

console.log('# Замер color-mix() стейт-оверлеев (#109)\n');

// ── (1) Экономия токенов ──────────────────────────────────────────────────
const groups = roles.groups;
const interactiveFills = groups.Fills.length; // все Fill-поверхности потенциально интерактивны
const interactiveComp = groups.Component.filter((n) => /fill|border|label/.test(n)).length;
const interactiveLabels = groups.Labels.filter((n) => /accent|danger|brand|success|warning|info/.test(n)).length;
const M = interactiveFills + interactiveComp + interactiveLabels;
const states = ['hover', 'pressed', 'selected']; // disabled=opacity(exempt), focus=ring
const N = states.length;
console.log('## 1. Экономия токенов');
console.log(`Интерактивных ролей (Fills ${interactiveFills} + Component-fill/border/label ${interactiveComp} + сентимент-Labels ${interactiveLabels}) = ${M}`);
console.log(`Состояний с цветовым сдвигом (${states.join('/')}) = ${N} (disabled=opacity exempt, focus=ring)`);
console.log(`Токенов при размножении: ${M} × ${N} = **${M * N}**. При оверлеях: **0** новых токенов ролей + 1 оверлей-тинт (label-primary, уже есть).`);
console.log(`ЭКОНОМИЯ: ${M * N} токенов НЕ появится.\n`);

// ── (2) Честность контраста ──────────────────────────────────────────────
console.log('## 2. Честность контраста (WCAG AA ≥ 4.5, оверлей = mix с label-primary)');
let anyFail = false;
for (const [themeName, { re, bg }] of Object.entries(THEMES)) {
  const vars = scopeVars(css, re);
  const bgc = parseColor(bg);
  const ink = parseColor(resolveVar('--lab-label-primary', vars));
  console.log(`\n### ${themeName} (оверлей-тинт = label-primary)`);
  for (const space of ['oklab', 'srgb']) {
    const mix = space === 'oklab' ? mixOklab : mixSrgb;
    console.log(`  [${space}]`);
    for (const [fillName, labelName] of FILL_PAIRS) {
      const fill = parseColor(resolveVar(fillName, vars));
      const label = parseColor(resolveVar(labelName, vars));
      const labelSolid = label.a === 1 ? label.g : over(label, { g: over(fill, bgc), a: 1 });
      const row = [`  ${fillName} × ${labelName}:`];
      for (const [st, p] of Object.entries({ rest: 0, ...STEPS })) {
        const of = p === 0 ? fill : mix(fill, ink, p);
        const fillSolid = { g: over(of, bgc), a: 1 };
        const labSolid = label.a === 1 ? label.g : over(label, fillSolid);
        const c = contrast(labSolid, fillSolid.g);
        const bad = c < AA_TEXT;
        if (bad && st !== 'rest') anyFail = true;
        row.push(`${st}=${c.toFixed(2)}${bad ? '✗' : ''}`);
      }
      console.log(row.join(' '));
    }
    for (const [labelName, bgName] of TEXT_ON_BG) {
      const label = parseColor(resolveVar(labelName, vars));
      const surf = parseColor(resolveVar(bgName, vars));
      const surfSolid = { g: over(surf, bgc), a: 1 };
      const row = [`  ${labelName} на ${bgName}:`];
      for (const [st, p] of Object.entries({ rest: 0, ...STEPS })) {
        const ol = p === 0 ? label : mix(label, ink, p);
        const labSolid = over(ol, surfSolid);
        const c = contrast(labSolid, surfSolid.g);
        const bad = c < AA_TEXT;
        if (bad && st !== 'rest') anyFail = true;
        row.push(`${st}=${c.toFixed(2)}${bad ? '✗' : ''}`);
      }
      console.log(row.join(' '));
    }
  }
}
console.log(`\nЛюбой активный (hover/pressed) оверлей уронил контраст ниже ${AA_TEXT}: ${anyFail ? 'ДА ✗' : 'НЕТ ✓'}`);

// ── (2b) Безопасный рецепт для несущих лейбл заливок: ВСЕГДА к чёрному ─────
// Гипотеза: пара сидит на полу 4.5, ЛЮБОЕ осветление её роняет. Затемнение
// (mix к чёрному) двигает заливку ОТ светлого label-on-* → контраст РАСТЁТ в
// обеих темах. Проверяем, что тёмная тема больше не краснеет.
console.log('\n## 2b. Безопасный рецепт несущих лейбл заливок: mix к ЧЁРНОМУ (обе темы)');
const BLACK = { g: [0, 0, 0], a: 1 };
let safeFail = false;
for (const [themeName, { re, bg }] of Object.entries(THEMES)) {
  const vars = scopeVars(css, re);
  const bgc = parseColor(bg);
  console.log(`\n### ${themeName} [oklab, к чёрному]`);
  for (const [fillName, labelName] of FILL_PAIRS.slice(0, 2)) {
    const fill = parseColor(resolveVar(fillName, vars));
    const label = parseColor(resolveVar(labelName, vars));
    const row = [`  ${fillName} × ${labelName}:`];
    for (const [st, p] of Object.entries({ rest: 0, ...STEPS })) {
      const of = p === 0 ? fill : mixOklab(fill, BLACK, p);
      const fillSolid = { g: over(of, bgc), a: 1 };
      const labSolid = label.a === 1 ? label.g : over(label, fillSolid);
      const c = contrast(labSolid, fillSolid.g);
      const bad = c < AA_TEXT;
      if (bad && st !== 'rest') safeFail = true;
      row.push(`${st}=${c.toFixed(2)}${bad ? '✗' : ''}`);
    }
    console.log(row.join(' '));
  }
}
console.log(`\nРецепт «к чёрному» уронил активный контраст ниже ${AA_TEXT}: ${safeFail ? 'ДА ✗' : 'НЕТ ✓'}`);

// ── (3) oklab vs srgb: пример сдвига оттенка на затемнении danger ──────────
console.log('\n## 3. Пространство смешивания: oklab vs srgb (пример)');
for (const [themeName, { re }] of Object.entries(THEMES)) {
  const vars = scopeVars(css, re);
  const ink = parseColor(resolveVar('--lab-label-primary', vars));
  for (const roleName of ['--lab-fill-accent', '--lab-fill-danger']) {
    const base = parseColor(resolveVar(roleName, vars));
    const okl = mixOklab(base, ink, 0.14);
    const srg = mixSrgb(base, ink, 0.14);
    const hueOf = (g) => {
      const [, a, b] = oklabOf(g.map(degam));
      return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    };
    const chromaOf = (g) => {
      const [, a, b] = oklabOf(g.map(degam));
      return Math.hypot(a, b);
    };
    const dh = Math.abs(hueOf(okl.g) - hueOf(srg.g));
    console.log(
      `  ${themeName} ${roleName} pressed(14%): Δhue(oklab↔srgb)=${dh.toFixed(1)}° | chroma oklab=${chromaOf(okl.g).toFixed(3)} srgb=${chromaOf(srg.g).toFixed(3)} (base=${chromaOf(base.g).toFixed(3)})`,
    );
  }
}

// ── (4) Само-проверка (RED-first гейт честности) ──────────────────────────
// Наивный рецепт ОБЯЗАН краснеть (иначе гейт слеп): доказывает, что проверка
// контраста реально кусается на осветлении пар-fill в тёмной теме. Безопасный
// рецепт ОБЯЗАН быть чистым — иначе рекомендация неверна.
console.log('\n## 4. Само-проверка гейта');
const redProof = anyFail === true; // наивный рецепт поймали
const greenSafe = safeFail === false; // безопасный чист
console.log(`RED-proof (наивный рецепт ловится честностью): ${redProof ? 'ДА ✓' : 'НЕТ ✗ — гейт слеп'}`);
console.log(`Безопасный рецепт «к чёрному» чист: ${greenSafe ? 'ДА ✓' : 'НЕТ ✗'}`);
if (!redProof || !greenSafe) {
  console.error('\nИНВАРИАНТ НАРУШЕН: проверка честности не воспроизводится.');
  process.exit(1);
}
console.log('\nВЫВОД: форма (color-mix оверлеи) экономит 240 токенов; наивный тема-адаптивный');
console.log('рецепт НЕ безопасен на несущих лейбл заливках в dark (WCAG 1.4.3 распространяется');
console.log('на hover/focus); безопасный путь — рецепт по классу поверхности + recheck на CI.');
