// CI-гейт #2 стейт-оверлеев (#109): ГРЯЗЬ (muddiness движка @labpics/colors).
//
// Инвариант — ОТНОСИТЕЛЬНЫЙ, порог не хардкодится (инструкция владельца):
//   muddiness(overlay(role, p)) − muddiness(role) ≤ p
// для КАЖДОЙ цветовой роли контракта, обеих тем и обоих шагов (hover/pressed).
//
// Обоснование ε = p:
//   (а) якоря рецепта D сами чисты: чёрный и чернила обеих тем дают
//       muddiness ≤ 0.01 (пред-условие ниже держит это фактом, а не надеждой);
//   (б) p-микс в oklab сдвигает цвет ровно на p-долю пути к якорю; muddiness
//       ограничена [0,1] и локально ~липшицева по oklab-координатам, значит
//       прирост грязи от сдвига к ЧИСТОМУ якорю ограничен долей микса;
//       эмпирический sup Δ/p по всей таблице ролей контракта ≈ 0.91 < 1 —
//       запас есть, но не размазанный (замер: state-overlay-economy.mjs);
//   (в) порог масштабируется вместе с ручками --lab-state-*: ужесточение
//       фракций автоматически ужесточает гейт — в тесте нет ни одной константы,
//       которую пришлось бы «переносить» при смене формы.
//
// NB «с учётом confidence()»: в @labpics/colors 0.6.2 API confidence()
// ОТСУТСТВУЕТ (слой калибровки снят из движка; проверено интроспекцией живого
// wasm-объекта) — гейт работает на сырой muddiness() с относительным ε.
// Отступление от буквы инструкции владельца зафиксировано в отчёте #109.
//
// RED-first: до реализации токенов фракций основной свип краснеет (фракции
// читаются ТОЛЬКО из сгенерированного tokens.css). RED-proof внизу доказывает,
// что детектор ловит сфабрикованный грязный оверлей и различает грязь/нейтраль.
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { createLabuiEngine } from '../engine.mjs';
import {
  CONTRACT_PATH,
  INK_ROLE,
  THEME_BG,
  THEME_SCOPE,
  TOKENS_CSS_PATH,
  linToHex,
  mixOklabPremul,
  overGamma,
  parseColor,
  readStateFractions,
  resolveValue,
  scopeVars,
  tintFor,
} from './state-overlays-shared.mjs';

const BLACK = { lin: [0, 0, 0], alpha: 1 };
const EPS = 1e-9;

let ctxPromise;
function ctx() {
  ctxPromise ??= (async () => {
    const [{ colors }, contractRaw] = await Promise.all([
      createLabuiEngine(),
      readFile(CONTRACT_PATH, 'utf8'),
    ]);
    const contract = contractRaw.replace(/\r\n/g, '\n');
    return {
      colors,
      vars: {
        light: scopeVars(contract, THEME_SCOPE.light),
        dark: scopeVars(contract, THEME_SCOPE.dark),
      },
    };
  })();
  return ctxPromise;
}

/** Δmud одной роли при миксе к тинту рецепта D на фракции p (композиты — в гамме). */
function overlayDelta(colors, vars, themeBgLin, name, p) {
  const base = parseColor(resolveValue(name, vars));
  const ink = parseColor(resolveValue(INK_ROLE, vars));
  const tint = tintFor(name) === 'black' ? BLACK : ink;
  const baseSolid = base.alpha === 1 ? base.lin : overGamma(base, themeBgLin);
  const mixed = mixOklabPremul(base, tint, p);
  const mixedSolid = mixed.alpha === 1 ? mixed.lin : overGamma(mixed, themeBgLin);
  return colors.muddiness(linToHex(mixedSolid)) - colors.muddiness(linToHex(baseSolid));
}

describe('стейт-оверлеи #109: гейт грязи', () => {
  it('пред-условие инварианта: якоря рецепта чисты (mud ≤ 0.01)', async () => {
    const { colors, vars } = await ctx();
    expect(colors.muddiness('#000000')).toBeLessThanOrEqual(0.01);
    for (const theme of ['light', 'dark']) {
      const ink = parseColor(resolveValue(INK_ROLE, vars[theme]));
      const inkSolid =
        ink.alpha === 1 ? ink.lin : overGamma(ink, parseColor(THEME_BG[theme]).lin);
      expect(
        colors.muddiness(linToHex(inkSolid)),
        `чернила ${theme} нечисты`,
      ).toBeLessThanOrEqual(0.01);
    }
  });

  for (const theme of ['light', 'dark']) {
    for (const state of ['hover', 'pressed']) {
      it(`${theme}/${state}: Δmud ≤ p на каждой цветовой роли контракта`, async () => {
        const { colors, vars } = await ctx();
        const fractions = readStateFractions(
          (await readFile(TOKENS_CSS_PATH, 'utf8')).replace(/\r\n/g, '\n'),
        );
        const p = fractions[state];
        const themeBgLin = parseColor(THEME_BG[theme]).lin;
        const violations = [];
        let swept = 0;
        for (const name of vars[theme].keys()) {
          let delta;
          try {
            delta = overlayDelta(colors, vars[theme], themeBgLin, name, p);
          } catch {
            continue; // не цвет (fx-тени, составные значения) — вне гейта
          }
          swept++;
          if (delta > p + EPS) violations.push(`${name}: Δmud=${delta.toFixed(4)} > p=${p}`);
        }
        // Свип не выродился: таблица ролей контракта содержит десятки цветов.
        expect(swept).toBeGreaterThan(40);
        expect(violations, violations.join('\n')).toEqual([]);
      });
    }
  }

  it('детектор ловит сфабрикованный грязный оверлей (RED-proof)', async () => {
    const { colors } = await ctx();
    // База чиста (#FFFFFF), «оверлей» подменён болотом #6B5B2F при p=0.14:
    // Δmud ≈ 0.336 > 0.14 — тот же самый предикат обязан флагнуть.
    const p = 0.14;
    const delta = colors.muddiness('#6B5B2F') - colors.muddiness('#FFFFFF');
    expect(delta).toBeGreaterThan(p + EPS);
  });

  it('muddiness различает грязь и нейтраль (детектор не слеп)', async () => {
    const { colors } = await ctx();
    // Болото на два порядка грязнее серой нейтрали той же светлоты-порядка.
    expect(colors.muddiness('#6B5B2F')).toBeGreaterThan(100 * colors.muddiness('#808080'));
  });
});
