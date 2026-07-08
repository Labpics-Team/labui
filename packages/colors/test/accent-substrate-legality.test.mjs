// Гейт легальности акцента на ПОДЛОЖКАХ (дополнение к pair-legality.test.mjs).
//
// pair-legality гейтит НЕПРОЗРАЧНЫЕ пары «заливка × лейбл-на-заливке» (кнопка
// fill, бейдж fill). Но акцентное семейство читается и как ТЕКСТ на других
// подложках, которые тот гейт не покрывает:
//   - тинт-поверхность: label-accent на fill-accent-tinted (кнопка kind=tinted),
//     сентимент-тинты бейджа/аватара (label-<family>-primary на
//     fill-<family>-primary) — полупрозрачный тинт над фоном темы;
//   - фон страницы: label-accent / label-danger как текст на bg-primary
//     (кнопка ghost/border, ховер аккордеона/крошек/табов, выбор combobox/select).
//
// Движок ФЛОРИТ label-<…>-primary до aa-text ОТНОСИТЕЛЬНО фона резолва темы
// (белый/тёмный), но НЕ относительно тинт-заливки — тинт сдвигает фон, и контраст
// текста на нём формально негарантирован. Этот гейт закрывает КЛАСС: акцентный/
// сентимент-текст на КАЖДОЙ реальной подложке обязан давать WCAG-AA ≥ 4.5 в обеих
// темах. Меряется на СГЕНЕРИРОВАННОМ contract.css с разрешением var()-цепочек —
// ровно то, что доедет до браузера.
//
// Композит полупрозрачного тинта над фоном — в ГАММЕ sRGB (как браузер), не в
// линейном свете (предупреждение в самом pair-legality о разнице пространств).
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { M_LMS_SRGB, M_OKLAB_LMS, degam, gam, hexToLin, mulv, wcagY } from '../oklab-math.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const contractPath = join(here, '..', '..', 'colors-stub', 'contract.css');

// Пол WCAG 2.1 AA для обычного текста (крупнотекстовых ролей тут нет).
const AA_TEXT = 4.5;

// Фон резолва темы (якоря нейтрали паспорта) — под ним композитятся тинты.
const THEME_BG = { light: '#FFFFFF', dark: '#101012' };

// Тинт-поверхность × её текст. Полупрозрачная заливка → композит над фоном темы.
const TINTED = [
  ['--lab-fill-accent-tinted', '--lab-label-accent'], // кнопка accent kind=tinted
  ['--lab-fill-brand-primary', '--lab-label-brand-primary'], // бейдж/аватар brand
  ['--lab-fill-danger-primary', '--lab-label-danger-primary'], // бейдж/аватар danger
  ['--lab-fill-warning-primary', '--lab-label-warning-primary'],
  ['--lab-fill-success-primary', '--lab-label-success-primary'],
  ['--lab-fill-info-primary', '--lab-label-info-primary'],
  ['--lab-fill-neutral-tinted', '--lab-label-primary'], // нейтральный тинт
];

// Акцентный/сентимент-текст на фоне страницы (ghost/border/ховер/выбор).
const ON_BG = [
  ['--lab-bg-primary', '--lab-label-accent'],
  ['--lab-bg-primary', '--lab-label-danger'],
];

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
 * fg (с альфой) поверх непрозрачного bg — композит в ГАММЕ sRGB, как браузер:
 * кодируем оба в гамму, смешиваем по альфе, декодируем обратно в линейный свет.
 * Линейное смешение (как в pair-legality `over`) корректно лишь при alpha=1;
 * для тинтов (alpha<1) пространство композита влияет на результат.
 */
function overGamma(fg, bgLin) {
  const bgG = bgLin.map(gam);
  const fgG = fg.lin.map(gam);
  return fgG.map((c, i) => c * fg.alpha + bgG[i] * (1 - fg.alpha)).map(degam);
}

/** WCAG 2.1 контраст двух непрозрачных линейных цветов. */
function wcagContrast(fgLin, bgLin) {
  const [hi, lo] = [wcagY(fgLin), wcagY(bgLin)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** Разрешить + композитировать пару (заливка/фон, текст) → контраст композита. */
function pairContrast(surfaceName, textName, vars, themeBgLin) {
  const surf = parseColor(resolveValue(surfaceName, vars));
  const text = parseColor(resolveValue(textName, vars));
  const surfLin = surf.alpha === 1 ? surf.lin : overGamma(surf, themeBgLin);
  const textLin = text.alpha === 1 ? text.lin : overGamma(text, surfLin);
  return wcagContrast(textLin, surfLin);
}

describe('акцент на подложках: WCAG-пол текста (тинт + фон страницы)', () => {
  for (const theme of ['light', 'dark']) {
    const pattern =
      theme === 'light'
        ? /^:root,\s*\r?\n\[data-theme="light"\]\s*\{/m
        : /^\[data-theme="dark"\]\s*\{/m;
    const themeBgLin = hexToLin(THEME_BG[theme]);

    for (const [surfaceName, textName] of [...TINTED, ...ON_BG]) {
      it(`${theme}: ${textName} на ${surfaceName} ≥ ${AA_TEXT}`, async () => {
        const css = (await readFile(contractPath, 'utf8')).replace(/\r\n/g, '\n');
        const vars = scopeVars(css, pattern);
        const ratio = pairContrast(surfaceName, textName, vars, themeBgLin);
        expect(
          ratio,
          `${textName} на ${surfaceName} = ${ratio.toFixed(3)}:1`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }

  // ── Детекция-пруф: ассерт обязан ПАДАТЬ на заведомо низкоконтрастной паре ────
  // Зелёный корпус выше значит «легально», а не «слепо»: та же чистая математика,
  // прогнанная на паре ниже пола, обязана вернуть < 4.5 (иначе гейт — театр).
  it('wcagContrast ловит пару ниже пола (RED-proof)', () => {
    // mid-серый (#777) на белом ≈ 4.48:1 < 4.5 — граничный провал, детектируется.
    const grey = parseColor('rgb(119 119 119)');
    const white = parseColor('#FFFFFF');
    const failing = wcagContrast(grey.lin, white.lin);
    expect(failing).toBeLessThan(AA_TEXT);
    // Заведомо легальная пара (чёрный на белом) проходит — детектор не слеп в обе стороны.
    const black = parseColor('#000000');
    expect(wcagContrast(black.lin, white.lin)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  // ── Гамма-композит обязателен: полупрозрачный светлый тинт, смешанный в ГАММЕ,
  // даёт иной (браузер-точный) фон, чем линейное смешение. Пиннит выбор пространства.
  it('тинт композитится в гамме (не в линейном свете)', () => {
    const tint = { lin: hexToLin('#FFFFFF'), alpha: 0.5 };
    const overBlack = overGamma(tint, hexToLin('#000000'));
    // Гамма-полупрозрачный белый над чёрным = #BBBBBB-порядок (Y≈0.5 в гамме),
    // а линейное смешение дало бы Y=0.5 в СВЕТЕ (≈#BC в гамме тоже, но через иной
    // путь) — ключ: значение выведено из гамма-энкода, а не из линейного 0.5.
    const yGamma = wcagY(overBlack);
    const yLinearNaive = 0.5; // линейный «over» вернул бы ровно 0.5 светлоты
    expect(Math.abs(yGamma - yLinearNaive)).toBeGreaterThan(0.05);
  });
});
