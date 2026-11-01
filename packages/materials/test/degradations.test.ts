import { describe, expect, it } from 'vitest';
import { readMaterialCss } from '../scripts/material-css';

/*
 * Every deterministic degradation must be PRESENT in material.css and must
 * collapse the surface to the opaque solid canon (the only mode whose label
 * contract always holds). A missing degradation is a legibility hole, so this
 * guards the class: each downgrade path exists and points at solid.
 */

const css = readMaterialCss();

/** Extract the body of the first at-rule block whose header matches `header`. */
function atRuleBody(header: RegExp): string {
  const start = css.search(header);
  expect(start, `at-rule ${header} present`).toBeGreaterThanOrEqual(0);
  // Walk braces from the first `{` after the header to its matching `}`.
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
  throw new Error(`unbalanced braces after ${header}`);
}

/** A degradation is "solid" if it drops the blur AND restores the opaque base paint. */
function forcesSolid(body: string): boolean {
  return body.includes('--_blur: 0px') && body.includes('--_base-paint: var(--_base)');
}

/** A degradation must ALSO drop the acrylic grain (`--_noise: none`) — otherwise a
 * degraded acrylic would still tile the noise over the opaque solid canon. */
function dropsNoise(body: string): boolean {
  return body.includes('--_noise: none');
}

/** A degradation must ALSO drop the specular rim (`--_rim: none`) — otherwise a
 * degraded glass/acrylic would keep its 1px light-catching edge after the
 * translucency it belongs to is gone. The rim rides transparency; when the
 * surface collapses to the opaque solid canon, the rim collapses with it. */
function dropsRim(body: string): boolean {
  return body.includes('--_rim: none');
}

/** Селекторы acrylic в деградациях имеют специфичность 0-2-0, выше рецептов
 * внутри @scope (0-1-0). Приоритет доступности не зависит от близости области. */
function coversAcrylic(body: string): boolean {
  return (
    body.includes('[data-material="acrylic"] .lab-material') &&
    body.includes('[data-material="acrylic"].lab-material')
  );
}

describe('material.css deterministic degradations', () => {
  // Каждый путь снимает прозрачность, зерно и рим. Селекторы деградаций
  // сильнее scoped-рецептов, поэтому близкая область не сохраняет эффекты.
  const DEGRADATIONS: readonly [string, RegExp][] = [
    ['1. @supports (no backdrop-filter)', /@supports not \(\(backdrop-filter/],
    ['2. prefers-reduced-transparency', /@media \(prefers-reduced-transparency: reduce\)/],
    ['3. prefers-contrast: more', /@media \(prefers-contrast: more\)/],
    ['4. forced-colors: active', /@media \(forced-colors: active\)/],
  ];

  for (const [name, header] of DEGRADATIONS) {
    it(`${name} → solid, drops grain + rim, covers acrylic`, () => {
      const body = atRuleBody(header);
      expect(forcesSolid(body), 'forces the opaque solid canon').toBe(true);
      expect(dropsNoise(body), 'drops the acrylic grain (--_noise: none)').toBe(true);
      expect(dropsRim(body), 'drops the specular rim (--_rim: none)').toBe(true);
      expect(coversAcrylic(body), 'acrylic покрыт деградацией со специфичностью 0-2-0').toBe(true);
    });
  }

  it('2. reduced-transparency сохраняет тот же набор правил, что no-backdrop и contrast', () => {
    // Chromium проверяет reduced-transparency через CDP в material-scope.spec.ts.
    // У WebKit нет такой эмуляции в Playwright: браузерный contrast-тест и
    // равенство тел подтверждают общий рецепт, но не сам media-триггер WebKit.
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
    const noBackdrop = normalize(atRuleBody(/@supports not \(\(backdrop-filter/));
    const reducedTransparency = normalize(
      atRuleBody(/@media \(prefers-reduced-transparency: reduce\)/),
    );
    const contrastMore = normalize(atRuleBody(/@media \(prefers-contrast: more\)/));
    expect(reducedTransparency, 'path 2 ≡ path 3 (live-verified)').toBe(contrastMore);
    expect(reducedTransparency, 'path 2 ≡ path 1 (@supports)').toBe(noBackdrop);
  });

  it('4. forced-colors also strips the tint gradient + blur (UA maps the palette)', () => {
    const body = atRuleBody(/@media \(forced-colors: active\)/);
    expect(body).toContain('background-image: none');
    expect(body).toContain('backdrop-filter: none');
  });

  it('manual override: data-material="solid" restores the opaque canon and drops grain + rim', () => {
    const body = atRuleBody(/@scope \(\[data-material="solid"\]\) to \(\[data-material\]\)/);
    expect(forcesSolid(body)).toBe(true);
    expect(dropsNoise(body)).toBe(true);
    // Solid сбрасывает рим внутри своей области; вложенный явный материал
    // начинает собственную область и может снова включить эффект.
    expect(dropsRim(body)).toBe(true);
  });

  it('glass и acrylic существуют; blur-ярус снесён без следа (ADR-0008)', () => {
    for (const mode of ['glass', 'acrylic']) {
      const body = atRuleBody(
        new RegExp(`@scope \\(\\[data-material="${mode}"\\]\\) to \\(\\[data-material\\]\\)`),
      );
      expect(body).toContain('--_base-paint: transparent');
    }
    // Регрессионный замок сноса: ни одного blur-селектора в оси материала —
    // возврат яруса возможен только осознанной правкой этого закона.
    expect(css).not.toContain('[data-material="blur"]');
  });

  it('acrylic mode binds the grain and reuses the ladder (no new magic value)', () => {
    const body = atRuleBody(/@scope \(\[data-material="acrylic"\]\) to \(\[data-material\]\)/);
    expect(body).toContain('--_noise: var(--_acrylic-noise)'); // grain on
    expect(body).toContain('--_blur: var(--_blur-live)'); // одна ступень 48px на все live-материалы (ADR-0009), не новый литерал
    expect(body).toContain('--_saturate: var(--_saturate-on)'); // 180% reused
    expect(body).toContain('--_base-paint: transparent'); // live backdrop reads through
  });

  it('acrylic inherits the SAME tint as glass (does NOT re-point --_tint/--_base)', () => {
    // ADR-0004 Решение 2: until the corridor-compression C is measured, acrylic
    // keeps the tint over the same [0,1] corridor as glass → its α-boundary verdict
    // is IDENTICAL to glass. Re-pointing the tier fill here would silently fork the
    // guarantee, so the acrylic block must touch neither --_tint nor --_base.
    const body = atRuleBody(/@scope \(\[data-material="acrylic"\]\) to \(\[data-material\]\)/);
    expect(body).not.toContain('--_tint:');
    expect(body).not.toContain('--_base:');
  });

  it('зерно явно выключено в базе и не наследуется из внешней acrylic-поверхности', () => {
    const base = atRuleBody(/\.lab-material\s*\{/);
    expect(base).toContain('--_noise: none');
    expect(css).toContain('var(--_noise, none), linear-gradient(');
  });
});
