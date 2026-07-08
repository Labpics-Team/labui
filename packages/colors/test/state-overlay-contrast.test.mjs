// CI-гейт #1 стейт-оверлеев (#109): ЧЕСТНОСТЬ КОНТРАСТА.
//
// Что пиннится:
//   1. Фракции состояний — токены @labpics/ui-tokens (--lab-state-hover: 8%,
//      --lab-state-pressed: 14%) в СГЕНЕРИРОВАННОМ tokens.css — единственный
//      источник ручек; в компонентах только var() с литеральным fallback.
//   2. Оба близнеца (react/src/button.css и core lab-button.ts) реализуют
//      паттерн прототипа: статик-роль покоя в базовом правиле + color-mix-
//      оверлей в @supports (color: color-mix(in oklab, red, blue)); тинт — по
//      рецепту D; brightness-fallback живёт ТОЛЬКО в @supports not (…) и
//      ΔL-эквивалентен миксу: k = (1−p)^3 (вывод в state-overlays-shared.mjs).
//   3. Оракул контраста — recheckContrast() ДВИЖКА @labpics/colors на КАЖДОЙ
//      оверлей-паре таблицы пар × {hover, pressed} × {light, dark} ≥ 4.5.
//      Композиция пары (var()-резолв, премультиплицированный oklab-микс,
//      гамма-композит альфы) — переиспользованная математика
//      accent-substrate-legality; сам вердикт о контрасте выносит движок.
//
// RED-first: до реализации краснеют (а) токены фракций, (б) экстракция паттерна
// из обоих близнецов, (в) оракульная матрица (ей нужны фракции). RED-proof-
// блоки внизу доказывают, что детекторы не слепы.
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { createLabuiEngine } from '../engine.mjs';
import {
  AA_TEXT,
  CONTRACT_PATH,
  INK_ROLE,
  LIT_BUTTON_TS_PATH,
  PAIRS_FILL,
  PAIRS_ON_BG,
  PAIRS_TINTED,
  REACT_BUTTON_CSS_PATH,
  REST_ROLES,
  THEME_BG,
  THEME_SCOPE,
  TOKENS_CSS_PATH,
  expectedOverlays,
  extractFallbackBrightness,
  extractOverlays,
  extractRestRoles,
  linToHex,
  mixOklabPremul,
  normalizeLitCss,
  overGamma,
  parseColor,
  readStateFractions,
  resolveValue,
  scopeVars,
  withoutFallbackBlocks,
} from './state-overlays-shared.mjs';

const hexToLinColor = (hex) => parseColor(hex);
const BLACK = { lin: [0, 0, 0], alpha: 1 };

/** Ленивая загрузка всего контекста гейта (движок + контракт + токены + оба близнеца). */
let ctxPromise;
function ctx() {
  ctxPromise ??= (async () => {
    const [{ colors }, contractRaw, tokensRaw, reactRaw, litRaw] = await Promise.all([
      createLabuiEngine(),
      readFile(CONTRACT_PATH, 'utf8'),
      readFile(TOKENS_CSS_PATH, 'utf8'),
      readFile(REACT_BUTTON_CSS_PATH, 'utf8'),
      readFile(LIT_BUTTON_TS_PATH, 'utf8'),
    ]);
    const contract = contractRaw.replace(/\r\n/g, '\n');
    return {
      colors,
      fractions: readStateFractions(tokensRaw.replace(/\r\n/g, '\n')),
      vars: {
        light: scopeVars(contract, THEME_SCOPE.light),
        dark: scopeVars(contract, THEME_SCOPE.dark),
      },
      twins: {
        react: reactRaw.replace(/\r\n/g, '\n'),
        lit: normalizeLitCss(litRaw.replace(/\r\n/g, '\n')),
      },
    };
  })();
  return ctxPromise;
}

describe('стейт-оверлеи #109: токены и паттерн', () => {
  it('фракции состояний объявлены токенами: hover 8%, pressed 14%', async () => {
    const { fractions } = await ctx();
    expect(fractions.hover).toBe(0.08);
    expect(fractions.pressed).toBe(0.14);
  });

  for (const twin of ['react', 'lit']) {
    it(`${twin}: роли покоя соответствуют пинну REST_ROLES (дрейф-гард)`, async () => {
      const { twins } = await ctx();
      const rest = extractRestRoles(twins[twin], twin);
      const missing = [];
      for (const [combo, props] of Object.entries(REST_ROLES)) {
        for (const [prop, role] of Object.entries(props)) {
          const got = rest.get(`${combo}/${prop}`);
          if (got !== role) missing.push(`${combo}/${prop}: ожидалась ${role}, в базе ${got}`);
        }
      }
      expect(missing, missing.join('\n')).toEqual([]);
    });

    it(`${twin}: каждый оверлей присутствует, роль/тинт/фракция — по рецепту D`, async () => {
      const { twins, fractions } = await ctx();
      const got = extractOverlays(twins[twin], twin);
      const problems = [];
      for (const [key, want] of expectedOverlays()) {
        const o = got.get(key);
        const state = key.split('/')[2];
        if (!o) {
          problems.push(`${key}: оверлей не найден`);
          continue;
        }
        if (o.role !== want.role) problems.push(`${key}: роль ${o.role} ≠ ${want.role}`);
        if (o.tint !== want.tint) problems.push(`${key}: тинт ${o.tint} ≠ ${want.tint} (рецепт D)`);
        if (o.step !== state) problems.push(`${key}: токен шага --lab-state-${o.step} ≠ ${state}`);
        if (Math.abs(o.fallbackPct / 100 - fractions[state]) > 1e-9)
          problems.push(`${key}: литеральный fallback ${o.fallbackPct}% ≠ токену ${fractions[state] * 100}%`);
      }
      expect(problems, problems.join('\n')).toEqual([]);
      // Ничего лишнего: оверлеи только из пинна (немой дрейф в обе стороны).
      expect([...got.keys()].sort()).toEqual([...expectedOverlays().keys()].sort());
    });

    it(`${twin}: brightness живёт ТОЛЬКО в @supports not и ΔL-эквивалентен миксу (k = (1−p)^3)`, async () => {
      const { twins, fractions } = await ctx();
      expect(withoutFallbackBlocks(twins[twin])).not.toMatch(/brightness\(/);
      const fb = extractFallbackBrightness(twins[twin]);
      for (const state of ['hover', 'pressed']) {
        const k = (1 - fractions[state]) ** 3;
        expect(fb[state], `fallback ${state} отсутствует`).toBeDefined();
        expect(Math.abs(fb[state] - k), `${state}: brightness(${fb[state]}) ≠ (1−p)^3 = ${k.toFixed(4)}`).toBeLessThanOrEqual(5e-4);
      }
    });
  }

  it('паритет близнецов: react и lit ведут одинаковый набор оверлеев', async () => {
    const { twins } = await ctx();
    const r = extractOverlays(twins.react, 'react');
    const l = extractOverlays(twins.lit, 'lit');
    expect(r.size).toBeGreaterThan(0); // вакуумный паритет пустых множеств не считается
    expect(Object.fromEntries(r)).toEqual(Object.fromEntries(l));
  });
});

describe('стейт-оверлеи #109: оракул движка — WCAG-пол на каждой оверлей-паре', () => {
  for (const theme of ['light', 'dark']) {
    for (const state of ['hover', 'pressed']) {
      // Класс A: оверлей на непрозрачной заливке, тинт — чёрный, лейбл статичен.
      for (const [surface, text] of PAIRS_FILL) {
        it(`${theme}/${state}: ${text} на ${surface}+black ≥ ${AA_TEXT}`, async () => {
          const { colors, fractions, vars } = await ctx();
          const p = fractions[state];
          const themeBgLin = hexToLinColor(THEME_BG[theme]).lin;
          const v = vars[theme];
          const surf = parseColor(resolveValue(surface, v));
          const surfSolid = surf.alpha === 1 ? surf.lin : overGamma(surf, themeBgLin);
          const mixed = mixOklabPremul({ lin: surfSolid, alpha: 1 }, BLACK, p);
          const label = parseColor(resolveValue(text, v));
          const labelSolid = label.alpha === 1 ? label.lin : overGamma(label, mixed.lin);
          const wcag = colors.recheckContrast(linToHex(mixed.lin), [linToHex(labelSolid)], theme)[1];
          expect(wcag, `${wcag.toFixed(3)}:1`).toBeGreaterThanOrEqual(AA_TEXT);
        });
      }
      // Класс B: оверлей на тинт-поверхности (альфа честно премультиплицируется),
      // затем гамма-композит над фоном темы; текст статичен.
      for (const [surface, text] of PAIRS_TINTED) {
        it(`${theme}/${state}: ${text} на ${surface}+ink ≥ ${AA_TEXT}`, async () => {
          const { colors, fractions, vars } = await ctx();
          const p = fractions[state];
          const themeBgLin = hexToLinColor(THEME_BG[theme]).lin;
          const v = vars[theme];
          const ink = parseColor(resolveValue(INK_ROLE, v));
          const surf = parseColor(resolveValue(surface, v));
          const mixed = mixOklabPremul(surf, ink, p);
          const surfSolid = mixed.alpha === 1 ? mixed.lin : overGamma(mixed, themeBgLin);
          const label = parseColor(resolveValue(text, v));
          const labelSolid = label.alpha === 1 ? label.lin : overGamma(label, surfSolid);
          const wcag = colors.recheckContrast(linToHex(surfSolid), [linToHex(labelSolid)], theme)[1];
          expect(wcag, `${wcag.toFixed(3)}:1`).toBeGreaterThanOrEqual(AA_TEXT);
        });
      }
      // Класс B: оверлей на ТЕКСТЕ (ghost/border), фон статичен.
      for (const [surface, text] of PAIRS_ON_BG) {
        it(`${theme}/${state}: ${text}+ink на ${surface} ≥ ${AA_TEXT}`, async () => {
          const { colors, fractions, vars } = await ctx();
          const p = fractions[state];
          const themeBgLin = hexToLinColor(THEME_BG[theme]).lin;
          const v = vars[theme];
          const ink = parseColor(resolveValue(INK_ROLE, v));
          const surf = parseColor(resolveValue(surface, v));
          const surfSolid = surf.alpha === 1 ? surf.lin : overGamma(surf, themeBgLin);
          const label = parseColor(resolveValue(text, v));
          const mixedLabel = mixOklabPremul(label, ink, p);
          const labelSolid =
            mixedLabel.alpha === 1 ? mixedLabel.lin : overGamma(mixedLabel, surfSolid);
          const wcag = colors.recheckContrast(linToHex(surfSolid), [linToHex(labelSolid)], theme)[1];
          expect(wcag, `${wcag.toFixed(3)}:1`).toBeGreaterThanOrEqual(AA_TEXT);
        });
      }
    }
  }
});

describe('стейт-оверлеи #109: RED-proof детекторов', () => {
  it('оракул движка ловит пару ниже пола и не слеп в обе стороны', async () => {
    const { colors } = await ctx().catch(() => ({}));
    // Оракул обязан работать даже до реализации токенов — грузим движок напрямую.
    const engine = colors ?? (await createLabuiEngine()).colors;
    expect(engine.recheckContrast('#ffffff', ['#777777'], 'light')[1]).toBeLessThan(AA_TEXT);
    expect(engine.recheckContrast('#ffffff', ['#000000'], 'light')[1]).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('экстрактор не признаёт оверлей с чужим тинтом (белый ≠ рецепт D)', () => {
    const bad = `@supports (color: color-mix(in oklab, red, blue)) {
      [data-lab-button][data-type="accent"][data-kind="fill"]:hover {
        background-color: color-mix(in oklab, var(--lab-fill-accent), white var(--lab-state-hover, 8%));
      }
    }`;
    expect(extractOverlays(bad, 'react').size).toBe(0);
    const good = bad.replace('white', 'black');
    expect(extractOverlays(good, 'react').size).toBe(1);
  });

  it('экстрактор не признаёт оверлей вне @supports-гарда', () => {
    const naked = `[data-lab-button][data-type="accent"][data-kind="fill"]:hover {
      background-color: color-mix(in oklab, var(--lab-fill-accent), black var(--lab-state-hover, 8%));
    }`;
    expect(extractOverlays(naked, 'react').size).toBe(0);
  });

  it('премультиплицированный микс совпадает с непремультиплицированным только при alpha=1', () => {
    const base = { lin: [0.2, 0.4, 0.6], alpha: 1 };
    const opaque = mixOklabPremul(base, BLACK, 0.14);
    expect(opaque.alpha).toBe(1);
    const translucent = mixOklabPremul({ ...base, alpha: 0.12 }, BLACK, 0.14);
    // Альфа растёт к тинту: 0.12·0.86 + 1·0.14
    expect(Math.abs(translucent.alpha - (0.12 * 0.86 + 0.14))).toBeLessThan(1e-12);
  });
});
