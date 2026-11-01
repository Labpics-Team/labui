// Общий слой двух CI-гейтов стейт-оверлеев (#109): рецепт D, математика,
// экстракция паттерна из компонентных источников обоих близнецов.
//
// Математика (scopeBody/scopeVars/parseColor/resolveValue/overGamma) поднята
// 1:1 из accent-substrate-legality.test.mjs — инструкция владельца #109:
// переиспользовать её, а не заводить вторую копию правды.
//
// ФОРМА оверлея (решение владельца, финальное, не переоткрывать):
//   состояние = color-mix(in oklab, <роль покоя>, <тинт> var(--lab-state-*)),
//   hover 8% / pressed 14%; disabled = opacity; focus = ring (вне гейтов).
// РЕЦЕПТ D — тинт по классу поверхности:
//   класс A — несущие лейбл НЕПРОЗРАЧНЫЕ заливки (fill-accent / fill-danger /
//     fill-neutral и бейджевые badge-fill-*): тинт = ЧЁРНЫЙ в ОБЕИХ темах;
//   класс B — всё остальное (тинт-поверхности, чистый текст, бордеры):
//     тинт = чернила темы var(--lab-label-primary), тема-адаптивно.
// FALLBACK (требование владельца: hover не мёртв без color-mix):
//   @supports not (color: color-mix(in oklab, red, blue)) →
//   filter: brightness(k), k = (1−p)^3 — ΔL-эквивалент микса к чёрному:
//   brightness масштабирует линейный sRGB на k, oklab-L — на k^(1/3); у чёрного
//   L=0, микс даёт L·(1−p) ⇒ k^(1/3) = 1−p. Для класса A совпадение точное при
//   ЛЮБОЙ базе; для класса B — ближайшая одноконстантная аппроксимация
//   (задокументировано в docs/vocabulary.md, раздел стейт-оверлеев).

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  M_LMS_SRGB,
  M_OKLAB_LMS,
  degam,
  gam,
  hexToLin,
  linOf,
  mulv,
  oklabOf,
} from '../oklab-math.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const CONTRACT_PATH = join(here, '..', 'contract.css');
export const TOKENS_CSS_PATH = join(here, '..', '..', 'tokens', 'src', 'generated', 'tokens.css');
export const REACT_BUTTON_CSS_PATH = join(here, '..', '..', 'react', 'src', 'button.css');
export const LIT_BUTTON_TS_PATH = join(
  here,
  '..',
  '..',
  'core',
  'src',
  'components',
  'button',
  'lab-button.ts',
);

export const AA_TEXT = 4.5;
// Фон резолва темы (якоря нейтрали паспорта) — под ним композитятся тинты.
export const THEME_BG = { light: '#FFFFFF', dark: '#101012' };
export const THEME_SCOPE = {
  light: /^:root,\s*\r?\n\[data-theme="light"\]\s*\{/m,
  dark: /^\[data-theme="dark"\]\s*\{/m,
};

// ── математика из accent-substrate-legality.test.mjs (1:1) ──────────────────

/** Вырезать тело scope-блока по началу строки (тот же приём, что в генераторе). */
export function scopeBody(css, scopePattern) {
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
export function scopeVars(css, scopePattern) {
  const clean = scopeBody(css, scopePattern).replace(/\/\*[\s\S]*?\*\//g, '');
  const vars = new Map();
  for (const m of clean.matchAll(/(--lab-[a-z0-9-]+)\s*:\s*([^;]+);/g)) vars.set(m[1], m[2].trim());
  return vars;
}

/** Значение цвета → { lin:[r,g,b] линейный sRGB 0..1, alpha }. */
export function parseColor(value) {
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
export function resolveValue(name, vars, seen = new Set()) {
  const raw = vars.get(name);
  if (raw === undefined) throw new Error(`переменная не найдена: ${name}`);
  const m = raw.match(/^var\((--lab-[a-z0-9-]+)\)$/);
  if (!m) return raw;
  if (seen.has(name)) throw new Error(`цикл var(): ${name}`);
  seen.add(name);
  return resolveValue(m[1], vars, seen);
}

/** fg (с альфой) поверх непрозрачного bg — композит в ГАММЕ sRGB, как браузер. */
export function overGamma(fg, bgLin) {
  const bgG = bgLin.map(gam);
  const fgG = fg.lin.map(gam);
  return fgG.map((c, i) => c * fg.alpha + bgG[i] * (1 - fg.alpha)).map(degam);
}

// ── дополнение #109: микс, hex-энкод, рецепт, экстракция ────────────────────

/** Линейный sRGB → hex (вход движку: muddiness()/recheckContrast() едят hex). */
export function linToHex(lin) {
  return `#${lin
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, gam(c))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/**
 * color-mix(in oklab, base, tint p) с ПРЕМУЛЬТИПЛИЦИРОВАННОЙ альфой — ровно как
 * CSS Color 4 §12.2: координаты интерполируются домноженными на альфу, альфа —
 * линейно. Для непрозрачных вырождается в линейную интерполяцию oklab-координат.
 */
export function mixOklabPremul(base, tint, p) {
  const lb = oklabOf(base.lin);
  const lt = oklabOf(tint.lin);
  const alpha = base.alpha * (1 - p) + tint.alpha * p;
  const lab = lb.map((c, i) => (c * base.alpha * (1 - p) + lt[i] * tint.alpha * p) / alpha);
  return { lin: linOf(lab).map((x) => Math.min(1, Math.max(0, x))), alpha };
}

/** Класс A рецепта D: несущие лейбл непрозрачные заливки (пары «fill × label-on»). */
export const CLASS_A_FILLS = new Set([
  '--lab-fill-accent',
  '--lab-fill-neutral',
  '--lab-fill-danger',
  '--lab-badge-fill-brand',
  '--lab-badge-fill-danger',
  '--lab-badge-fill-warning',
  '--lab-badge-fill-success',
  '--lab-badge-fill-info',
  '--lab-badge-fill-static-dark',
  '--lab-badge-fill-static-light',
]);

/** Чернила темы — тинт класса B. */
export const INK_ROLE = '--lab-label-primary';

/** Рецепт D: тинт по имени роли. */
export const tintFor = (role) => (CLASS_A_FILLS.has(role) ? 'black' : 'ink');

const BLACK = { lin: [0, 0, 0], alpha: 1 };

/**
 * Δmud одной роли при миксе к тинту рецепта D на фракции p (композиты — в гамме).
 * ЕДИНСТВЕННАЯ копия правды Δmud: гейт грязи (state-overlay-muddiness.test.mjs)
 * и замер экономии (state-overlay-economy.mjs) зовут её, а не повторяют шаги —
 * правка порядка композита/обработки альфы меняет обе стороны синхронно.
 */
export function overlayDelta(colors, vars, themeBgLin, name, p) {
  const base = parseColor(resolveValue(name, vars));
  const tint = tintFor(name) === 'black' ? BLACK : parseColor(resolveValue(INK_ROLE, vars));
  const baseSolid = base.alpha === 1 ? base.lin : overGamma(base, themeBgLin);
  const mixed = mixOklabPremul(base, tint, p);
  const mixedSolid = mixed.alpha === 1 ? mixed.lin : overGamma(mixed, themeBgLin);
  return colors.muddiness(linToHex(mixedSolid)) - colors.muddiness(linToHex(baseSolid));
}

/** Фракции состояний из СГЕНЕРИРОВАННОГО tokens.css — единственный источник ручек. */
export function readStateFractions(tokensCss) {
  const out = {};
  for (const m of tokensCss.matchAll(/--lab-state-(hover|pressed)\s*:\s*([\d.]+)%\s*;/g)) {
    out[m[1]] = Number(m[2]) / 100;
  }
  if (out.hover === undefined || out.pressed === undefined) {
    throw new Error(
      'фракции состояний не объявлены в tokens.css (--lab-state-hover / --lab-state-pressed)',
    );
  }
  return out;
}

/**
 * Роли покоя интерактивных комбо кнопки — ПИНН спецификации оверлея:
 * каждая цветовая декларация покоя получает hover/pressed-оверлей той же роли.
 * (Дрейф-гард в гейте сверяет эту таблицу с фактическими базовыми правилами.)
 */
export const REST_ROLES = {
  'accent/fill': { 'background-color': '--lab-fill-accent' },
  'accent/tinted': { 'background-color': '--lab-fill-accent-tinted' },
  'accent/border': { color: '--lab-label-accent', 'border-color': '--lab-border-accent' },
  'accent/ghost': { color: '--lab-label-accent' },
  'neutral/fill': { 'background-color': '--lab-fill-neutral' },
  'neutral/tinted': { 'background-color': '--lab-fill-primary' },
  'neutral/border': { color: '--lab-label-primary', 'border-color': '--lab-border-base' },
  'neutral/ghost': { color: '--lab-label-primary' },
  'danger/fill': { 'background-color': '--lab-fill-danger' },
  'danger/tinted': { 'background-color': '--lab-fill-danger-tinted' },
  'danger/border': { color: '--lab-label-danger', 'border-color': '--lab-border-danger' },
  'danger/ghost': { color: '--lab-label-danger' },
};

/** Ожидаемый набор оверлеев из REST_ROLES × {hover, pressed} + рецепт D. */
export function expectedOverlays() {
  const keys = new Map();
  for (const [combo, props] of Object.entries(REST_ROLES)) {
    // Accent fill сохраняет base и меняет авторские gradient/inset/glow.
    // Реальную композицию проверяет apps/docs/tests/button-effects.spec.ts.
    if (combo === 'accent/fill') continue;
    for (const [prop, role] of Object.entries(props)) {
      for (const state of ['hover', 'pressed']) {
        keys.set(`${combo}/${state}/${prop}`, { role, tint: tintFor(role) });
      }
    }
  }
  return keys;
}

/** Нормализация Lit-источника: ${litVar('X')} / ${litVar('X','F')} → var(X[, F]). */
export function normalizeLitCss(ts) {
  return ts
    .replace(/\$\{litVar\('(--lab-[a-z0-9-]+)'\s*,\s*'([^']+)'\)\}/g, 'var($1, $2)')
    .replace(/\$\{litVar\('(--lab-[a-z0-9-]+)'\)\}/g, 'var($1)')
    .replace(/\$\{[^}]*\}/g, '/*expr*/');
}

const COMBO_RE = {
  react: /\[data-type="([a-z]+)"\]\[data-kind="([a-z]+)"\]/,
  lit: /\[type='([a-z]+)'\]\[kind='([a-z]+)'\]/,
};

const NOT_HEAD = '@supports not (color: color-mix(in oklab, red, blue))';
const POS_HEAD = '@supports (color: color-mix(in oklab, red, blue))';

/** Тела @supports-блоков (positive / negated) с балансировкой скобок. */
export function supportsBlocks(css, negated) {
  const head = negated ? NOT_HEAD : POS_HEAD;
  const bodies = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf(head, from);
    if (at === -1) break;
    const open = css.indexOf('{', at + head.length);
    let depth = 1;
    let i = open + 1;
    while (depth > 0 && i < css.length) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    bodies.push(css.slice(open + 1, i - 1));
    from = i;
  }
  return bodies;
}

// Альтернатива тинта собирается из INK_ROLE (регекс-безопасно: имя роли —
// только [a-z-]), а не дублируется литералом: смена роли чернил — одно место.
const OVERLAY_DECL_RE = new RegExp(
  String.raw`(background-color|border-color|color)\s*:\s*color-mix\(in oklab,\s*var\((--lab-[a-z0-9-]+)\),\s*(black|var\(${INK_ROLE}\))\s+var\(--lab-state-(hover|pressed),\s*([\d.]+)%\)\)`,
  'g',
);

/**
 * Каноникализация форматирования: гейт судит СЕМАНТИКУ CSS, а не решения
 * форматтера — biome переносит длинные color-mix() на несколько строк, для
 * регексов выше это эквивалентно однострочной записи.
 */
function flattenWhitespace(css) {
  return css.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
}

/**
 * Экстракция оверлеев из позитивных @supports-блоков компонентного источника.
 * → Map 'type/kind/state/prop' → { role, tint: 'black'|'ink', step, fallbackPct }.
 */
export function extractOverlays(cssText, flavor) {
  const out = new Map();
  for (const body of supportsBlocks(flattenWhitespace(cssText), false)) {
    for (const rule of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const combo = COMBO_RE[flavor].exec(rule[1]);
      if (!combo) continue;
      const state = /:active\b/.test(rule[1])
        ? 'pressed'
        : /:hover\b/.test(rule[1])
          ? 'hover'
          : undefined;
      if (!state) continue;
      for (const d of rule[2].matchAll(OVERLAY_DECL_RE)) {
        out.set(`${combo[1]}/${combo[2]}/${state}/${d[1]}`, {
          role: d[2],
          tint: d[3] === 'black' ? 'black' : 'ink',
          step: d[4],
          fallbackPct: Number(d[5]),
        });
      }
    }
  }
  return out;
}

/** Роли покоя из базовых (без псевдоклассов) правил — дрейф-гард REST_ROLES. */
export function extractRestRoles(cssText, flavor) {
  const out = new Map();
  for (const rule of flattenWhitespace(cssText).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/:hover|:active|:focus|:disabled/.test(rule[1])) continue;
    const combo = COMBO_RE[flavor].exec(rule[1]);
    if (!combo) continue;
    for (const d of rule[2].matchAll(
      /(?:^|;|\s)(background-color|border-color|color)\s*:\s*var\((--lab-[a-z0-9-]+)\)/g,
    )) {
      out.set(`${combo[1]}/${combo[2]}/${d[1]}`, d[2]);
    }
  }
  return out;
}

/** brightness-коэффициенты hover/pressed из НЕГАТИВНОГО @supports-блока. */
export function extractFallbackBrightness(cssText) {
  const out = {};
  for (const body of supportsBlocks(cssText, true)) {
    for (const rule of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const state = /:active\b/.test(rule[1])
        ? 'pressed'
        : /:hover\b/.test(rule[1])
          ? 'hover'
          : undefined;
      if (!state) continue;
      const m = /filter\s*:\s*brightness\(([\d.]+)\)/.exec(rule[2]);
      if (m) out[state] = Number(m[1]);
    }
  }
  return out;
}

/**
 * Источник без негативных @supports-блоков (для «brightness только в fallback»).
 * Комментарии срезаются: гейт судит ДЕКЛАРАЦИИ, а не прозу — упоминание
 * brightness в пояснительном комментарии нарушением не является.
 */
export function withoutFallbackBlocks(cssText) {
  let css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  for (;;) {
    const at = css.indexOf(NOT_HEAD);
    if (at === -1) return css;
    const open = css.indexOf('{', at + NOT_HEAD.length);
    let depth = 1;
    let i = open + 1;
    while (depth > 0 && i < css.length) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    css = css.slice(0, at) + css.slice(i);
  }
}

// ── таблица пар для оракула контраста ───────────────────────────────────────

const FAMILIES = ['brand', 'danger', 'warning', 'success', 'info', 'static-dark', 'static-light'];

/** Непрозрачные «заливка × лейбл-на-заливке» — оверлей на заливке, класс A. */
export const PAIRS_FILL = [
  ['--lab-fill-accent', '--lab-label-on-accent'],
  ['--lab-fill-danger', '--lab-label-on-danger'],
  ['--lab-fill-neutral', '--lab-label-on-neutral'],
  ...FAMILIES.map((f) => [`--lab-badge-fill-${f}`, `--lab-badge-label-on-${f}`]),
];

/** Тинт-поверхность × её текст (список accent-substrate-legality) — оверлей на заливке, класс B. */
export const PAIRS_TINTED = [
  ['--lab-fill-accent-tinted', '--lab-label-accent'],
  ['--lab-fill-brand-primary', '--lab-label-brand-primary'],
  ['--lab-fill-danger-primary', '--lab-label-danger-primary'],
  ['--lab-fill-warning-primary', '--lab-label-warning-primary'],
  ['--lab-fill-success-primary', '--lab-label-success-primary'],
  ['--lab-fill-info-primary', '--lab-label-info-primary'],
  ['--lab-fill-primary', '--lab-label-primary'],
];

/** Текст на фоне страницы (ghost/border) — оверлей на ТЕКСТЕ, класс B. */
export const PAIRS_ON_BG = [
  ['--lab-bg-primary', '--lab-label-accent'],
  ['--lab-bg-primary', '--lab-label-danger'],
  ['--lab-bg-primary', '--lab-label-primary'],
];
