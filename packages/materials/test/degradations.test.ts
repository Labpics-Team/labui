import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * Every deterministic degradation must be PRESENT in material.css and must
 * collapse the surface to the opaque solid canon (the only mode whose label
 * contract always holds). A missing degradation is a legibility hole, so this
 * guards the class: each downgrade path exists and points at solid.
 */

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, '..', 'src', 'material.css');
const css = readFileSync(cssPath, 'utf8');

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
    ['3. prefers-contrast: more', /@media \(prefers-contrast: more\)/],
    ['4. forced-colors: active', /@media \(forced-colors: active\)/],
  ];

  for (const [name, header] of DEGRADATIONS) {
    it(`${name} → solid, drops grain, covers acrylic`, () => {
      const body = atRuleBody(header);
      expect(forcesSolid(body), 'forces the opaque solid canon').toBe(true);
      expect(dropsNoise(body), 'drops the acrylic grain (--_noise: none)').toBe(true);
      expect(coversAcrylic(body), 'covers acrylic at its (0,2,0) specificity').toBe(true);
    });
  }

  it('2. reduced-transparency ≡ live-verified paths (Playwright cannot emulate it)', () => {
    // Playwright's emulateMedia has no `prefers-reduced-transparency`, so path 2 —
    // the accessibility path — has no live browser assert. Compensation: its body
    // must be IDENTICAL (modulo whitespace) to path 1 (@supports) and path 3
    // (contrast: more). Path 3 IS live-verified in the e2e (emulateMedia contrast),
    // and identity transfers that verification to path 2. If the bodies ever fork,
    // this goes red and path 2 needs its own proof.
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

  it('manual override: data-material="solid" restores the opaque canon and drops grain', () => {
    expect(css).toContain('[data-material="solid"] .lab-material');
    expect(css).toContain('[data-material="solid"].lab-material');
    const body = atRuleBody(/\[data-material="solid"\] \.lab-material,/);
    expect(forcesSolid(body)).toBe(true);
    expect(dropsNoise(body)).toBe(true);
  });

  it('glass, blur and acrylic modes all exist and drop the opaque base', () => {
    expect(css).toContain('[data-material="glass"] .lab-material');
    expect(css).toContain('[data-material="blur"] .lab-material');
    expect(css).toContain('[data-material="acrylic"] .lab-material');
    // Live modes paint the tint over `transparent` so the backdrop reads through.
    expect(css).toContain('--_base-paint: transparent');
  });

  it('acrylic mode binds the grain and reuses the ladder (no new magic value)', () => {
    const body = atRuleBody(/\[data-material="acrylic"\] \.lab-material,/);
    expect(body).toContain('--_noise: var(--_acrylic-noise)'); // grain on
    expect(body).toContain('--_blur: var(--_blur-glass)'); // 48px reused, not a new literal
    expect(body).toContain('--_saturate: var(--_saturate-on)'); // 180% reused
    expect(body).toContain('--_base-paint: transparent'); // live backdrop reads through
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
