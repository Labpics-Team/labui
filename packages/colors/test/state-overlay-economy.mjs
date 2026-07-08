// Воспроизводимый замер #109: экономия токенов + эмпирика гейта грязи.
// Запуск: pnpm --filter @labpics/colors measure:overlays  (node test/state-overlay-economy.mjs)
//
// Считает ИЗ ЖИВОГО контракта, ничего не хардкодит:
//   1. ЭКОНОМИЯ: сколько токенов НЕ родилось благодаря color-mix-оверлеям —
//      материализация состояний потребовала бы <роли> × <состояния> новых
//      кастом-свойств (значения по темам жили бы в scope-блоках тех же имён).
//   2. sup Δmud/p — эмпирический запас относительного инварианта гейта грязи
//      (цитируется в шапке state-overlay-muddiness.test.mjs).
//   3. Отклонение fallback k=(1−p)^3 от микса по oklab-L: класс A — точно
//      (тинт чёрный, L=0), класс B — |Δ| = p·L(чернила) — верхняя граница
//      «ближайшей одноконстантной аппроксимации» из docs/vocabulary.md.
//
// Выход ≠ 0, если относительный инвариант нарушен — замер сам себе гейт.

import { readFile } from 'node:fs/promises';

import { createLabuiEngine } from '../engine.mjs';
import {
  CONTRACT_PATH,
  INK_ROLE,
  THEME_BG,
  THEME_SCOPE,
  TOKENS_CSS_PATH,
  overlayDelta,
  parseColor,
  readStateFractions,
  resolveValue,
  scopeVars,
} from './state-overlays-shared.mjs';

import { oklabOf } from '../oklab-math.mjs';

const [{ colors }, contractRaw, tokensRaw] = await Promise.all([
  createLabuiEngine(),
  readFile(CONTRACT_PATH, 'utf8'),
  readFile(TOKENS_CSS_PATH, 'utf8'),
]);
const contract = contractRaw.replace(/\r\n/g, '\n');
const fractions = readStateFractions(tokensRaw.replace(/\r\n/g, '\n'));
const vars = {
  light: scopeVars(contract, THEME_SCOPE.light),
  dark: scopeVars(contract, THEME_SCOPE.dark),
};

// ── 1. экономия ──────────────────────────────────────────────────────────────
const colorRoles = { light: new Set(), dark: new Set() };
for (const theme of ['light', 'dark']) {
  for (const name of vars[theme].keys()) {
    try {
      parseColor(resolveValue(name, vars[theme]));
      colorRoles[theme].add(name);
    } catch {
      /* не цвет — вне замера */
    }
  }
}
const union = new Set([...colorRoles.light, ...colorRoles.dark]);
const states = Object.keys(fractions);
const saved = union.size * states.length;

// ── 2. sup Δmud/p ────────────────────────────────────────────────────────────
let sup = 0;
let supAt = '';
let swept = 0;
const violations = [];
for (const theme of ['light', 'dark']) {
  const themeBgLin = parseColor(THEME_BG[theme]).lin;
  for (const state of states) {
    const p = fractions[state];
    for (const name of colorRoles[theme]) {
      // Δmud — общий overlayDelta из state-overlays-shared.mjs (та же копия
      // правды, что в гейте грязи): эмпирика замера и предикат гейта не расходятся.
      const delta = overlayDelta(colors, vars[theme], themeBgLin, name, p);
      swept++;
      const ratio = delta / p;
      if (ratio > sup) {
        sup = ratio;
        supAt = `${theme}/${state}/${name}`;
      }
      if (delta > p + 1e-9) violations.push(`${theme}/${state}/${name}: Δ=${delta.toFixed(4)}`);
    }
  }
}

// ── 3. отклонение fallback по oklab-L ────────────────────────────────────────
// Микс: L → L(1−p) + L_тинт·p. brightness((1−p)^3): L → L(1−p). Разница = p·L_тинт.
const worstInkL = Math.max(
  ...['light', 'dark'].map((t) => oklabOf(parseColor(resolveValue(INK_ROLE, vars[t])).lin)[0]),
);
const fbDev = states.map((s) => `${s}: |ΔL| ≤ ${(fractions[s] * worstInkL).toFixed(4)}`);

console.info('=== #109 стейт-оверлеи: замер ===');
console.info(
  `роли-цвета: light ${colorRoles.light.size}, dark ${colorRoles.dark.size}, союз ${union.size}`,
);
console.info(
  `состояния: ${states.map((s) => `${s} ${+(fractions[s] * 100).toFixed(4)}%`).join(', ')}`,
);
console.info(`ТОКЕНОВ НЕ РОДИЛОСЬ: ${union.size} ролей × ${states.length} состояний = ${saved}`);
console.info(`свип гейта грязи: ${swept} комбинаций, sup Δmud/p = ${sup.toFixed(4)} (${supAt})`);
console.info(
  `fallback класс A: точный (тинт чёрный, L=0); класс B: ${fbDev.join('; ')} (L чернил ≤ ${worstInkL.toFixed(4)})`,
);
if (violations.length > 0) {
  console.error(`НАРУШЕНИЯ ИНВАРИАНТА (${violations.length}):\n${violations.join('\n')}`);
  process.exit(1);
}
console.info('инвариант Δmud ≤ p: выполнен на всём свипе');
