// Гейт легальности закона пары: КАЖДАЯ несущая лейбл поверхность contract.css
// (заливка × её лейбл) обязана давать WCAG-контраст композита ≥ 4.5 в ОБЕИХ
// темах — по построению, не по совпадению. До закона пары label-on-accent был
// статическим белым на сыром бренде = 4.017:1 < 4.5 (нелегально, ловил axe в
// PR #58). Теперь заливки выводятся pair-fill, лейблы — nested resolve; этот
// тест — их WCAG-пол, неторгуемый.
//
// Контраст меряется на СГЕНЕРИРОВАННОМ артефакте (contract.css) с разрешением
// var()-цепочек — то, что реально доедет до кнопки/бейджа в браузере.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { M_LMS_SRGB, M_OKLAB_LMS, degam, hexToLin, mulv, wcagY } from '../oklab-math.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const contractPath = join(here, '..', 'contract.css');

// Пары «заливка × лейбл-на-заливке». Семантический паспорт (несущие лейбл
// поверхности) + бейджи (тот же закон пары) — полный класс.
const PAIRS = [
  ['--lab-fill-accent', '--lab-label-on-accent'],
  ['--lab-fill-danger', '--lab-label-on-danger'],
  ['--lab-fill-neutral', '--lab-label-on-neutral'],
  ['--lab-badge-fill-brand', '--lab-badge-label-on-brand'],
  ['--lab-badge-fill-danger', '--lab-badge-label-on-danger'],
  ['--lab-badge-fill-warning', '--lab-badge-label-on-warning'],
  ['--lab-badge-fill-success', '--lab-badge-label-on-success'],
  ['--lab-badge-fill-info', '--lab-badge-label-on-info'],
  ['--lab-badge-fill-static-dark', '--lab-badge-label-on-static-dark'],
  ['--lab-badge-fill-static-light', '--lab-badge-label-on-static-light'],
];

// Пол WCAG 2.1 AA для обычного текста. Крупнотекстовых ролей тут нет. Движок
// двигает заливку «к полу», поэтому проход бывает пограничным by design (напр.
// light fill-danger ≈ 4.50004, слак ~4e-5) — честный, т.к. и тест, и генератор
// делят одну копию oklab-math в одном V8 (детерминизм IEEE754); ассерт на сыром
// ratio, не на округлении. Инвариант «единая копия WCAG-математики» несущий.
const AA_TEXT = 4.5;

// Фон резолва темы (якоря нейтрали паспорта) — под ним композитятся полупрозрачные.
const THEME_BG = { light: hexToLin('#FFFFFF'), dark: hexToLin('#101012') };

/** Вырезать тело scope-блока по началу строки (тот же приём, что в генераторе). */
function scopeBody(css, scopePattern) {
  const m = scopePattern.exec(css);
  if (!m) throw new Error(`scope не найден: ${scopePattern}`);
  const open = css.indexOf('{', m.index);
  let depth = 1;
  let i = open + 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(open + 1, i - 1);
}

/** Карта имя → значение scope-а (комментарии срезаются; последняя декларация выигрывает — каскад). */
function scopeVars(css, scopePattern) {
  const clean = scopeBody(css, scopePattern).replace(/\/\*[\s\S]*?\*\//g, '');
  const vars = new Map();
  for (const m of clean.matchAll(/(--lab-[a-z0-9-]+)\s*:\s*([^;]+);/g)) vars.set(m[1], m[2].trim());
  return vars;
}

/** Значение цвета → { lin:[r,g,b] линейный sRGB 0..1, alpha }. */
function parseColor(value) {
  const v = value.trim();
  if (v.startsWith('#')) return { lin: hexToLin(v), alpha: 1 };
  if (v.startsWith('rgb(')) {
    const [body, a] = v.slice(4, -1).split('/');
    const [r, g, b] = body.trim().split(/\s+/).map(Number);
    return { lin: [r, g, b].map((c) => degam(c / 255)), alpha: a === undefined ? 1 : Number(a) };
  }
  if (v.startsWith('oklch(')) {
    const [lch, a] = v.slice(6, -1).split('/');
    const [lRaw, cRaw, hRaw] = lch.trim().split(/\s+/);
    const L = Number.parseFloat(lRaw) / 100;
    const C = Number.parseFloat(cRaw);
    const H = (Number.parseFloat(hRaw) * Math.PI) / 180;
    const lin = mulv(
      M_LMS_SRGB,
      mulv(M_OKLAB_LMS, [L, C * Math.cos(H), C * Math.sin(H)]).map((x) => x ** 3),
    ).map((x) => Math.min(1, Math.max(0, x)));
    return { lin, alpha: a === undefined ? 1 : Number.parseFloat(a) };
  }
  throw new Error(`неизвестный формат цвета: ${value}`);
}

/** Разрешить var()-цепочку к литеральному цвету. */
function resolveValue(name, vars, seen = new Set()) {
  const raw = vars.get(name);
  if (raw === undefined) throw new Error(`переменная не найдена: ${name}`);
  const m = raw.match(/^var\((--lab-[a-z0-9-]+)\)$/);
  if (!m) return raw;
  if (seen.has(name)) throw new Error(`цикл var(): ${name}`);
  seen.add(name);
  return resolveValue(m[1], vars, seen);
}

/**
 * fg (с альфой) поверх непрозрачного bg — линейная композиция. Все текущие пары
 * непрозрачны (alpha=1), поэтому этот путь сейчас не задействован. Если появится
 * полупрозрачная пара — учесть, что браузер композитит альфу в ГАММА-sRGB, а не
 * в линейном свете: тогда смешивать в гамме (encode→blend→decode) под браузер.
 */
const over = (fg, bgLin) => fg.lin.map((c, i) => c * fg.alpha + bgLin[i] * (1 - fg.alpha));

/** WCAG 2.1 контраст двух непрозрачных линейных цветов. */
function wcagContrast(fgLin, bgLin) {
  const [hi, lo] = [wcagY(fgLin), wcagY(bgLin)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

describe('закон пары: WCAG-пол несущих лейбл поверхностей', () => {
  for (const theme of ['light', 'dark']) {
    const pattern =
      theme === 'light'
        ? /^:root,\s*\r?\n\[data-theme="light"\]\s*\{/m
        : /^\[data-theme="dark"\]\s*\{/m;

    for (const [fillName, labelName] of PAIRS) {
      it(`${theme}: ${labelName} на ${fillName} ≥ ${AA_TEXT}`, async () => {
        const css = (await readFile(contractPath, 'utf8')).replace(/\r\n/g, '\n');
        const vars = scopeVars(css, pattern);
        const fill = parseColor(resolveValue(fillName, vars));
        const label = parseColor(resolveValue(labelName, vars));
        const fillLin = fill.alpha === 1 ? fill.lin : over(fill, THEME_BG[theme]);
        const labelLin = label.alpha === 1 ? label.lin : over(label, fillLin);
        const ratio = wcagContrast(labelLin, fillLin);
        expect(ratio, `${labelName} на ${fillName} = ${ratio.toFixed(3)}:1`).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
      });
    }
  }
});
