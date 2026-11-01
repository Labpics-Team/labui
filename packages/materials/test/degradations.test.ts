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

/** Every degradation must list the acrylic mode selectors at their (0,2,0)
 * specificity (attribute + class — both count in the middle column) — a bare
 * `.lab-material` (0,1,0) cannot override the acrylic mode block, so acrylic
 * would silently keep its live blur under the degradation. */
function coversAcrylic(body: string): boolean {
  return (
    body.includes('[data-material="acrylic"] .lab-material') &&
    body.includes('[data-material="acrylic"].lab-material')
  );
}

describe('material.css deterministic degradations', () => {
  // Each downgrade path must force the solid canon, drop the acrylic grain, AND
  // cover the acrylic mode at its own specificity (a bare `.lab-material` cannot
  // override the acrylic mode block — the grain/blur would silently survive).
  const DEGRADATIONS: readonly [string, RegExp][] = [
    ['1. @supports (no backdrop-filter)', /@supports not \(\(backdrop-filter/],
    ['2. prefers-reduced-transparency', /@media \(prefers-reduced-transparency: reduce\)/],
    ['4. forced-colors: active', /@media \(forced-colors: active\)/],
  ];

  for (const [name, header] of DEGRADATIONS) {
    it(`${name} → solid, drops grain + rim, covers acrylic`, () => {
      const body = atRuleBody(header);
      expect(forcesSolid(body), 'forces the opaque solid canon').toBe(true);
      expect(dropsNoise(body), 'drops the acrylic grain (--_noise: none)').toBe(true);
      expect(dropsRim(body), 'drops the specular rim (--_rim: none)').toBe(true);
      expect(coversAcrylic(body), 'covers acrylic at its (0,2,0) specificity').toBe(true);
    });
  }

  it('2. reduced-transparency ≡ live-verified paths (Playwright cannot emulate it)', () => {
    // Playwright's emulateMedia has no `prefers-reduced-transparency`, so path 2 —
    // the accessibility path — has no live browser assert. Compensation: its body
    // must be IDENTICAL (modulo whitespace) to path 1 (@supports).
    // Контраст теперь разрешается в области; его отдельный путь проверяется ниже.
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
    const noBackdrop = normalize(atRuleBody(/@supports not \(\(backdrop-filter/));
    const reducedTransparency = normalize(
      atRuleBody(/@media \(prefers-reduced-transparency: reduce\)/),
    );
    expect(reducedTransparency, 'path 2 ≡ path 1 (@supports)').toBe(noBackdrop);
  });

  it('more области делает оба живых материала непрозрачными без grain и rim', () => {
    expect(css).not.toMatch(/@media\s*\(prefers-contrast:\s*more\)/);
    for (const mode of ['glass', 'acrylic']) {
      const body = atRuleBody(new RegExp(`\\[data-material="${mode}"\\] \\.lab-material,`));
      expect(body).toContain(
        '--_base-paint: var(--_lab-normal, transparent) var(--_lab-more, var(--_base))',
      );
      expect(body).toContain(
        '--_blur: var(--_lab-normal, var(--_blur-live)) var(--_lab-more, 0px)',
      );
      expect(body).toContain(
        '--_rim: var(--_lab-normal, var(--_rim-active)) var(--_lab-more, none)',
      );
      if (mode === 'acrylic')
        expect(body).toContain(
          '--_noise: var(--_lab-normal, var(--_acrylic-noise)) var(--_lab-more, none)',
        );
    }
  });

  it('4. forced-colors also strips the tint gradient + blur (UA maps the palette)', () => {
    const body = atRuleBody(/@media \(forced-colors: active\)/);
    expect(body).toContain('background-image: none');
    expect(body).toContain('backdrop-filter: none');
  });

  it('manual override: data-material="solid" restores the opaque canon and drops grain + rim', () => {
    expect(css).toContain('[data-material="solid"] .lab-material');
    expect(css).toContain('[data-material="solid"].lab-material');
    const body = atRuleBody(/\[data-material="solid"\] \.lab-material,/);
    expect(forcesSolid(body)).toBe(true);
    expect(dropsNoise(body)).toBe(true);
    // A solid override nested under a glass/acrylic ancestor inherits the
    // ancestor's --_rim through the cascade; solid must reset it to none.
    expect(dropsRim(body)).toBe(true);
  });

  it('glass и acrylic существуют; blur-ярус снесён без следа (ADR-0008)', () => {
    expect(css).toContain('[data-material="glass"] .lab-material');
    expect(css).toContain('[data-material="acrylic"] .lab-material');
    // Регрессионный замок сноса: ни одного blur-селектора в оси материала —
    // возврат яруса возможен только осознанной правкой этого закона.
    expect(css).not.toContain('[data-material="blur"]');
    // Live modes paint the tint over `transparent` so the backdrop reads through.
    expect(css).toContain('--_base-paint: var(--_lab-normal, transparent)');
  });

  it('acrylic mode binds the grain and reuses the ladder (no new magic value)', () => {
    const body = atRuleBody(/\[data-material="acrylic"\] \.lab-material,/);
    expect(body).toContain('--_noise: var(--_lab-normal, var(--_acrylic-noise))'); // grain on
    expect(body).toContain('--_blur: var(--_lab-normal, var(--_blur-live))');
    expect(body).toContain('--_saturate: var(--_lab-normal, var(--_saturate-on))');
    expect(body).toContain('--_base-paint: var(--_lab-normal, transparent)');
  });

  it('acrylic inherits the SAME tint as glass (does NOT re-point --_tint/--_base)', () => {
    // ADR-0004 Решение 2: until the corridor-compression C is measured, acrylic
    // keeps the tint over the same [0,1] corridor as glass → its α-boundary verdict
    // is IDENTICAL to glass. Re-pointing the tier fill here would silently fork the
    // guarantee, so the acrylic block must touch neither --_tint nor --_base.
    const body = atRuleBody(/\[data-material="acrylic"\] \.lab-material,/);
    expect(body).not.toContain('--_tint:');
    expect(body).not.toContain('--_base:');
  });

  it('the grain is OFF by default (var(--_noise, none) paints nothing for non-acrylic)', () => {
    // The one paint rule falls back to `none` when --_noise is unset, so solid/
    // glass/blur are byte-identical to the pre-grain background.
    expect(css).toContain('var(--_noise, none), linear-gradient(');
  });
});
