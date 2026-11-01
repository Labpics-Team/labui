import { describe, expect, it } from 'vitest';
import { readMaterialCss } from '../scripts/material-css';

/*
 * Specular rim (Стекло v2, слайс B) — 1px внутренняя градиентная обводка,
 * имитирующая свет, пойманный кромкой стекла: ярко сверху, гаснет вниз.
 *
 * Инварианты класса, которые гейтит этот файл (а не один частный ввод):
 *   1. Рим — приватная ручка `--_rim` (unset по умолчанию); моды ТОЛЬКО
 *      пере-биндят её (священное ограничение владельца: моды не трогают
 *      единое paint-правило, лишь приватные custom properties).
 *   2. Рим ВКЛЮЧЁН у glass/acrylic (стеклянные/акриловые кромки ловят свет),
 *      ВЫКЛЮЧЕН у blur (тяжёлый фрост — диффузный, без резкой кромки) и solid
 *      (непрозрачный канон — не стекло).
 *   3. Цвет рима — из контракта (`--lab-bg-static-light/-dark`), НЕ литерал:
 *      спекуляр ахроматичен (физика отражения белого света), а gard
 *      no-hardcoded-colour запрещает сырой rgb()/hex в material.css.
 *   4. Тема ребиндит рим через custom property (светлая/тёмная), ноль хардкода
 *      темы — система остаётся динамичной.
 *   5. Единое paint-правило НЕ тронуто (байт-идентичность слоёв).
 *   6. Техника ринга — `::before` с mask-composite (уважает border-radius,
 *      ноль изменения разметки), с -webkit-литералом для Safari ≤18.2.
 *
 * Деградации, снимающие рим вместе с прозрачностью, гейтит degradations.test.ts.
 */

const css = readMaterialCss();

/** Тело первого selector/at-rule блока, чей заголовок матчит `header`. */
function blockBody(header: RegExp): string {
  const start = css.search(header);
  expect(start, `блок ${header} присутствует`).toBeGreaterThanOrEqual(0);
  let i = css.indexOf('{', start);
  let depth = 0;
  const bodyStart = i + 1;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(bodyStart, i);
    }
  }
  throw new Error(`несбалансированные скобки после ${header}`);
}

describe('specular rim — приватная ручка --_rim', () => {
  it('единое paint-правило НЕ тронуто римом (байт-идентичность слоёв)', () => {
    // Священное ограничение: рим НЕ входит в paint-правило (он на ::before).
    expect(css).toContain(
      'background: var(--_noise, none), linear-gradient(var(--_tint), var(--_tint)), var(--_base-paint);',
    );
  });

  it('ринг рисуется на ::before (ноль разметки, уважает border-radius)', () => {
    const body = blockBody(/\.lab-material::before\s*\{/);
    expect(body, 'ринг питается приватной ручкой рима с фолбэком none').toContain(
      'var(--_rim, none)',
    );
    expect(body, 'ринг наследует скругление поверхности').toContain('border-radius: inherit');
    expect(body, '1px толщина ринга (padding-box кольцо)').toContain('padding: 1px');
    // mask-composite вырезает нутро → остаётся только 1px padding-кольцо.
    expect(body).toContain('mask-composite: exclude');
    // Safari ≤18.2 — литерал -webkit (как -webkit-backdrop-filter в модах).
    expect(body).toContain('-webkit-mask');
    expect(body).toContain('-webkit-mask-composite: xor');
    expect(body, 'ринг не перехватывает клики').toContain('pointer-events: none');
  });

  it('рим ВЫКЛЮЧЕН по умолчанию (base не задаёт видимый --_rim)', () => {
    const body = blockBody(/\.lab-material\s*\{/);
    // База не биндит --_rim к градиенту — дефолт off через var(--_rim, none).
    expect(body).not.toMatch(/--_rim:\s*var\(--_rim-active\)/);
  });

  it('glass ВКЛЮЧАЕТ рим (стеклянная кромка ловит свет)', () => {
    const body = blockBody(/\[data-material="glass"\] \.lab-material,/);
    expect(body).toContain('--_rim: var(--_lab-normal, var(--_rim-active)) var(--_lab-more, none)');
  });

  it('acrylic ВКЛЮЧАЕТ рим (Fluent-кромка несёт люминантный штрих)', () => {
    const body = blockBody(/\[data-material="acrylic"\] \.lab-material,/);
    expect(body).toContain('--_rim: var(--_lab-normal, var(--_rim-active)) var(--_lab-more, none)');
  });

  it('solid ВЫКЛЮЧАЕТ рим (непрозрачный канон — не стекло; перекрывает предка)', () => {
    const body = blockBody(/\[data-material="solid"\] \.lab-material,/);
    expect(body).toContain('--_rim: none');
  });

  it('тема ребиндит рим через --_rim-active (светлая дефолт, тёмная оверрайд)', () => {
    const base = blockBody(/\.lab-material\s*\{/);
    expect(base, 'дефолт активного рима = светлый').toContain('--_rim-active: var(--_rim-light)');
    // Тёмный оверрайд на (0,2,0) — атрибут + класс, как у мод-блоков.
    expect(css).toContain('[data-theme="dark"] .lab-material');
    const darkBody = blockBody(
      /\[data-theme="dark"\] \.lab-material,\s*\r?\n\s*\[data-theme="dark"\]\.lab-material\s*\{/,
    );
    expect(darkBody).toContain('--_rim-active: var(--_rim-dark)');
  });

  it('цвет рима — из контракта (achromatic bg-static), НЕ литерал rgb/hex/oklch', () => {
    const base = blockBody(/\.lab-material\s*\{/);
    // Полное значение объявления (до `;`), формат-независимо (многострочный
    // linear-gradient ловится через [^;], включающий переносы строк).
    const declValue = (name: string): string =>
      new RegExp(`--_rim-${name}:\\s*([^;]+);`).exec(base)?.[1] ?? '';
    const lightRim = declValue('light');
    const darkRim = declValue('dark');
    expect(lightRim, 'светлый рим определён').not.toBe('');
    expect(darkRim, 'тёмный рим определён').not.toBe('');
    // Источник — статик-фоновые токены контракта (белый / почти-чёрный).
    expect(lightRim).toContain('var(--lab-bg-static-light)');
    // Тёмный рим несёт едва тёмный низ (bg-static-dark).
    expect(darkRim).toContain('var(--lab-bg-static-dark)');
    // Ноль сырых цветовых литералов (спекуляр берётся из контракта color-mix).
    const rimDecls = `${lightRim}\n${darkRim}`;
    expect(rimDecls, 'нет сырого rgb()/#hex/oklch — только color-mix над токенами').not.toMatch(
      /#[0-9a-f]{3,8}\b|(?<![-\w])rgba?\(|oklch\(|hsla?\(/i,
    );
    // Именно установленный идиом теней: color-mix(in srgb, transparent, <token> α).
    expect(lightRim).toContain('color-mix(in srgb, transparent, var(--lab-bg-static-light)');
  });
});
