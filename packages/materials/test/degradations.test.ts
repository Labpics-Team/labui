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

describe('material.css deterministic degradations', () => {
  it('1. @supports (no backdrop-filter) → solid', () => {
    expect(forcesSolid(atRuleBody(/@supports not \(\(backdrop-filter/))).toBe(true);
  });

  it('2. prefers-reduced-transparency → solid', () => {
    expect(forcesSolid(atRuleBody(/@media \(prefers-reduced-transparency: reduce\)/))).toBe(true);
  });

  it('3. prefers-contrast: more → solid', () => {
    expect(forcesSolid(atRuleBody(/@media \(prefers-contrast: more\)/))).toBe(true);
  });

  it('4. forced-colors: active → opaque surface, translucency stripped (UA maps the palette)', () => {
    const body = atRuleBody(/@media \(forced-colors: active\)/);
    // Force the opaque solid canon and drop the tint gradient + blur so only an
    // opaque background-color remains for the UA's forced-color-adjust to map.
    expect(forcesSolid(body)).toBe(true);
    expect(body).toContain('background-image: none');
    expect(body).toContain('backdrop-filter: none');
  });

  it('manual override: data-material="solid" restores the opaque canon', () => {
    expect(css).toContain('[data-material="solid"] .lab-material');
    expect(css).toContain('[data-material="solid"].lab-material');
  });

  it('glass and blur modes both exist and drop the opaque base', () => {
    expect(css).toContain('[data-material="glass"] .lab-material');
    expect(css).toContain('[data-material="blur"] .lab-material');
    // Live modes paint the tint over `transparent` so the backdrop reads through.
    expect(css).toContain('--_base-paint: transparent');
  });
});
