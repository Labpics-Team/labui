/*
 * Acrylic-движок ↔ material.css / acrylic-corridor — кросс-файловые замки
 * дрейфа (паттерн engine-css-contract.test.ts). Примитивы SVG-фильтра — это
 * атрибуты (var() недоступен), поэтому числа конвейера живут литералами в
 * engine/acrylic.ts; эти пины гарантируют, что ЛЮБОЕ расхождение с токенами
 * листа или с математикой коридора краснит CI, а не тихо расщепляет рецепт.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readMaterialCss } from '../scripts/material-css';
import { ACRYLIC_LUMINOSITY_OPACITY } from '../src/acrylic-corridor';
import { ACRYLIC_BLUR_PX, ACRYLIC_ENGINE_MEDIA, ACRYLIC_SATURATE } from '../src/engine/acrylic';
import { MATERIAL_TIERS } from '../src/material-guarantee';

const here = dirname(fileURLToPath(import.meta.url));
const css = readMaterialCss();
const engineSrc = readFileSync(join(here, '../src/engine/acrylic.ts'), 'utf8');
const runtimeSrc = readFileSync(join(here, '../src/engine/runtime.ts'), 'utf8');

describe('конвейер повторяет ступени листа (один рычаг, не две копии значения)', () => {
  it('ACRYLIC_BLUR_PX === --_blur-live из material.css', () => {
    const m = css.match(/--_blur-live:\s*(\d+(?:\.\d+)?)px/);
    expect(m, 'material.css must declare --_blur-live').not.toBeNull();
    expect(Number(m?.[1])).toBe(ACRYLIC_BLUR_PX);
  });

  it('ACRYLIC_SATURATE === --_saturate-on из material.css', () => {
    const m = css.match(/--_saturate-on:\s*(\d+(?:\.\d+)?)%/);
    expect(m, 'material.css must declare --_saturate-on').not.toBeNull();
    expect(Number(m?.[1]) / 100).toBeCloseTo(ACRYLIC_SATURATE, 10);
  });

  it('flood-opacity конвейера — ровно константа вывода коридора', () => {
    expect(engineSrc).toContain(
      "flood.setAttribute('flood-opacity', String(ACRYLIC_LUMINOSITY_OPACITY))",
    );
    // Значение Λ — замок: смена ручки = осознанная правка здесь + пересчёт
    // голдена гарантированных пар (acrylic-corridor.test.ts).
    expect(ACRYLIC_LUMINOSITY_OPACITY).toBe(0.7);
  });

  it('flood-color — живой var() контрактного тинта tier (никакого своего цвета)', () => {
    expect(engineSrc).toContain('`var(--lab-bg-material-${tier}-01)`');
    // Дефолтный tier CSS-оси и дефолт tierOf() обязаны совпадать.
    expect(MATERIAL_TIERS).toContain('base');
    expect(engineSrc).toContain("return 'base'");
  });

  it('пространство счёта закреплено: color-interpolation-filters="sRGB"', () => {
    expect(engineSrc).toContain("filter.setAttribute('color-interpolation-filters', 'sRGB')");
  });

  it('смесь — luminosity, flood поверх насыщенного блюра (in=f, in2=s)', () => {
    expect(engineSrc).toContain("blend.setAttribute('mode', 'luminosity')");
    expect(engineSrc).toContain("blend.setAttribute('in', 'f')");
    expect(engineSrc).toContain("blend.setAttribute('in2', 's')");
  });
});

describe('честные деградации: движок гаснет во всех медиа-режимах листа', () => {
  it('каждый запрещающий @media листа есть в ACRYLIC_ENGINE_MEDIA', () => {
    // Класс: «новая деградация добавлена в лист, движок о ней не знает» —
    // инлайн пережил бы её. Все transparency/contrast/forced-медиа листа
    // обязаны быть перечислены движку.
    const sheetMedia = [
      '(prefers-reduced-transparency: reduce)',
      '(prefers-contrast: more)',
      '(forced-colors: active)',
    ];
    for (const query of sheetMedia) {
      expect(css, `material.css должен нести деградацию ${query}`).toContain(`@media ${query}`);
      expect(ACRYLIC_ENGINE_MEDIA, `движок должен гаснуть под ${query}`).toContain(query);
    }
  });

  it('рантайм опустошает want-набор под блокирующими медиа и слушает их change', () => {
    expect(runtimeSrc).toContain('acrylicMediaBlocked()');
    expect(runtimeSrc).toContain('ACRYLIC_ENGINE_MEDIA');
    expect(runtimeSrc).toContain("mq.addEventListener('change', debouncedSync)");
  });
});

describe('гейт и скоуп', () => {
  it('гейт делегирует supportsRefraction (одно требование — url()-фильтр на backdrop)', () => {
    expect(engineSrc).toContain('return supportsRefraction()');
  });

  it('рантайм держит acrylic только под ближайшим acrylic-скоупом (закон nearest-scope)', () => {
    expect(runtimeSrc).toContain('inModeScope(el, ACRYLIC)');
    expect(runtimeSrc).toContain("const ACRYLIC = 'acrylic'");
  });
});
