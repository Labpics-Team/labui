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
//      Accent/fill uses the independently checked authored sheen/shade/glow;
//      its base paint stays unchanged (design-baseline.md, 2026-11-01).
//   3. Каждая ordinary-пара сохраняет авторский reference и его Core assessment.
//      Композиция пары (var()-резолв, премультиплицированный oklab-микс,
//      гамма-композит альфы) — переиспользованная математика
//      accent-substrate-legality; сам вердикт о контрасте выносит движок.
//
// RED-first: до реализации краснеют (а) токены фракций, (б) экстракция паттерна
// из обоих близнецов, (в) оракульная матрица (ей нужны фракции). RED-proof-
// блоки внизу доказывают, что детекторы не слепы.
import { readFile } from 'node:fs/promises';
import { evaluateWcag22 } from '@labpics/colors';
import { describe, expect, it } from 'vitest';

import { createLabuiEngine } from '../engine.mjs';
import { authoredReference } from './authored-reference.mjs';
import {
  CONTRACT_PATH,
  INK_ROLE,
  LIT_BUTTON_TS_PATH,
  PAIRS_FILL,
  PAIRS_ON_BG,
  PAIRS_TINTED,
  REACT_BUTTON_CSS_PATH,
  REST_ROLES,
  THEME_BG,
  TOKENS_CSS_PATH,
  expectedOverlays,
  extractAccentFillPaints,
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
  themeVars,
  withoutFallbackBlocks,
} from './state-overlays-shared.mjs';

const hexToLinColor = (hex) => parseColor(hex);
const BLACK = { lin: [0, 0, 0], alpha: 1 };

// Authored normal-state paints, independent of the renderer's class names.
// The real browser test remains apps/docs/tests/button-effects.spec.ts.
const ACCENT_FILL_PAINTS = {
  'default/surface/background-color': 'var(--lab-fill-accent)',
  'default/surface/color': 'var(--lab-label-on-accent)',
  'default/effects/display': 'block',
  'default/sheen/color': 'var(--_lab-button-sheen-color, var(--lab-bg-static-light))',
  'default/sheen/background-image': 'linear-gradient(180deg, currentColor, transparent)',
  'default/sheen/opacity': 'var(--_lab-button-sheen-opacity, var(--lab-opacity-button-sheen, 0.2))',
  'default/glow/background-color': 'var(--lab-bg-static-light)',
  'default/glow/filter': 'blur(var(--lab-size-button-glow-blur, 1.125rem))',
  'default/glow/opacity': '0',
  'default/shadow/box-shadow': 'var(--lab-shadow-button)',
  'hover/sheen/opacity':
    'var(--_lab-button-sheen-hover-opacity, var(--lab-opacity-button-sheen-hover, 0.32))',
  'pressed/sheen/color': 'var(--lab-bg-static-dark)',
  'pressed/sheen/opacity': 'var(--lab-opacity-button-shade-pressed, 0.12)',
  'pressed/glow/opacity':
    'var(--_lab-button-glow-pressed-opacity, calc(var(--lab-opacity-button-glow, 0.32) * var(--lab-opacity-button-glow-fill, 0.52)))',
  'pressed/shadow/box-shadow': 'var(--lab-shadow-button-pressed)',
};

/** Ленивая загрузка всего контекста гейта (движок + контракт + токены + оба близнеца). */
const reference = await authoredReference();
let ctxPromise;
function ctx() {
  ctxPromise ??= (async () => {
    const [, contractRaw, tokensRaw, reactRaw, litRaw] = await Promise.all([
      createLabuiEngine(),
      readFile(CONTRACT_PATH, 'utf8'),
      readFile(TOKENS_CSS_PATH, 'utf8'),
      readFile(REACT_BUTTON_CSS_PATH, 'utf8'),
      readFile(LIT_BUTTON_TS_PATH, 'utf8'),
    ]);
    const contract = contractRaw.replace(/\r\n/g, '\n');
    return {
      fractions: readStateFractions(tokensRaw.replace(/\r\n/g, '\n')),
      vars: {
        light: themeVars(contract, 'light'),
        dark: themeVars(contract, 'dark'),
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
          problems.push(
            `${key}: литеральный fallback ${o.fallbackPct}% ≠ токену ${fractions[state] * 100}%`,
          );
      }
      expect(problems, problems.join('\n')).toEqual([]);
      // Ничего лишнего: оверлеи только из пинна (немой дрейф в обе стороны).
      expect([...got.keys()].sort()).toEqual([...expectedOverlays().keys()].sort());
    });

    it(`${twin}: accent/fill keeps the base paint and the authored effect states`, async () => {
      const { twins } = await ctx();
      expect(extractAccentFillPaints(twins[twin], twin)).toEqual(ACCENT_FILL_PAINTS);
    });

    it(`${twin}: brightness живёт ТОЛЬКО в @supports not и ΔL-эквивалентен миксу (k = (1−p)^3)`, async () => {
      const { twins, fractions } = await ctx();
      expect(withoutFallbackBlocks(twins[twin])).not.toMatch(/brightness\(/);
      const fb = extractFallbackBrightness(twins[twin]);
      for (const state of ['hover', 'pressed']) {
        const k = (1 - fractions[state]) ** 3;
        expect(fb[state], `fallback ${state} отсутствует`).toBeDefined();
        expect(
          Math.abs(fb[state] - k),
          `${state}: brightness(${fb[state]}) ≠ (1−p)^3 = ${k.toFixed(4)}`,
        ).toBeLessThanOrEqual(5e-4);
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

// Сохраняется полная матрица пар × 8/14% × темы. Ordinary сравнивается с
// независимым reference; обязательство IC4.5 остаётся у actual render.
function overlaidPair(kind, surface, text, vars, p, theme) {
  const backdrop = hexToLinColor(THEME_BG[theme]).lin;
  const surf = parseColor(resolveValue(surface, vars));
  const label = parseColor(resolveValue(text, vars));
  const ink = parseColor(resolveValue(INK_ROLE, vars));
  let background;
  let foreground;
  if (kind === 'fill') {
    const solid = surf.alpha === 1 ? surf.lin : overGamma(surf, backdrop);
    background = mixOklabPremul({ lin: solid, alpha: 1 }, BLACK, p).lin;
    foreground = label.alpha === 1 ? label.lin : overGamma(label, background);
  } else if (kind === 'tinted') {
    const mixed = mixOklabPremul(surf, ink, p);
    background = mixed.alpha === 1 ? mixed.lin : overGamma(mixed, backdrop);
    foreground = label.alpha === 1 ? label.lin : overGamma(label, background);
  } else {
    background = surf.alpha === 1 ? surf.lin : overGamma(surf, backdrop);
    const mixed = mixOklabPremul(label, ink, p);
    foreground = mixed.alpha === 1 ? mixed.lin : overGamma(mixed, background);
  }
  return { foreground: linToHex(foreground), background: linToHex(background) };
}

describe('ordinary: стейт-оверлеи сохраняют авторскую композицию', () => {
  for (const [index, theme] of ['light', 'dark'].entries()) {
    for (const state of ['hover', 'pressed']) {
      for (const [kind, pairs] of [
        ['fill', PAIRS_FILL],
        ['tinted', PAIRS_TINTED],
        ['text', PAIRS_ON_BG],
      ]) {
        for (const [surface, text] of pairs) {
          it(`${theme}/${state}/${kind}: ${text} на ${surface}`, async () => {
            const { fractions, vars } = await ctx();
            const observed = overlaidPair(
              kind,
              surface,
              text,
              vars[theme],
              fractions[state],
              theme,
            );
            const expected = overlaidPair(
              kind,
              surface,
              text,
              reference[index],
              fractions[state],
              theme,
            );
            expect(observed).toEqual(expected);
            const assessment = (pair) =>
              evaluateWcag22(pair.foreground, pair.background, 'sc-1.4.3-text-default').decision;
            expect(assessment(observed)).toBe(assessment(expected));
          });
        }
      }
    }
  }
});
describe('стейт-оверлеи #109: RED-proof детекторов', () => {
  it('recipe-D keeps both neighbour fills while accent/fill belongs to the effect layers', () => {
    const overlays = expectedOverlays();
    for (const state of ['hover', 'pressed']) {
      expect(overlays.has(`accent/fill/${state}/background-color`)).toBe(false);
      for (const type of ['neutral', 'danger'])
        expect(overlays.get(`${type}/fill/${state}/background-color`)).toEqual({
          role: `--lab-fill-${type}`,
          tint: 'black',
        });
    }
  });

  for (const twin of ['react', 'lit']) {
    it(`${twin}: authored-paint gate rejects a missing effect and an added base recolour`, async () => {
      const { twins } = await ctx();
      const source = twins[twin];
      // Positive control uses the same detector and the unmodified real source.
      expect(extractAccentFillPaints(source, twin)).toEqual(ACCENT_FILL_PAINTS);
      const noHover = source.replace(
        /opacity:\s*var\(--_lab-button-sheen-hover-opacity,[^;]+;/,
        '',
      );
      expect(extractAccentFillPaints(noHover, twin)).not.toEqual(ACCENT_FILL_PAINTS);
      const noGlow = source.replace(
        /opacity:\s*var\(\s*--_lab-button-glow-pressed-opacity,[^;]+;/,
        '',
      );
      expect(extractAccentFillPaints(noGlow, twin)).not.toEqual(ACCENT_FILL_PAINTS);
      const selector =
        twin === 'react'
          ? '[data-lab-button][data-type="accent"][data-kind="fill"]:hover:not(:disabled)'
          : ":host([type='accent'][kind='fill']) button:hover:not(:disabled)";
      const recoloured = `${source}\n${selector} {
        background-color: color-mix(in oklab, var(--lab-fill-accent), black var(--lab-state-hover, 8%));
      }`;
      expect(extractAccentFillPaints(recoloured, twin)).not.toEqual(ACCENT_FILL_PAINTS);
      const generic = twin === 'react' ? '[data-lab-button]' : 'button';
      expect(
        extractAccentFillPaints(
          `${source}\n${generic}:hover { filter: brightness(0.7787); }`,
          twin,
        ),
      ).not.toEqual(ACCENT_FILL_PAINTS);
    });
  }

  it('оракул движка ловит пару ниже пола и не слеп в обе стороны', async () => {
    // Оракул обязан работать даже до реализации токенов — грузим движок напрямую.
    await createLabuiEngine();
    expect(evaluateWcag22('#777777', '#ffffff', 'sc-1.4.3-text-default').decision).toBe('fail');
    expect(evaluateWcag22('#000000', '#ffffff', 'sc-1.4.3-text-default').decision).toBe('pass');
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
