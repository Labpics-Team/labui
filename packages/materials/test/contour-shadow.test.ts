import { describe, expect, it } from 'vitest';
import { materialContour } from '../src/engine/contour';
import { type Shadow, shadowMarkup } from '../src/engine/contour-shadow';

const shadow = (overrides: Partial<Shadow> = {}): Shadow => ({
  x: 0,
  y: 0,
  blur: 0,
  spread: 0,
  color: 'red',
  inset: false,
  ...overrides,
});
const images = (markup: string): string[] =>
  [...markup.matchAll(/href="data:image\/svg\+xml,([^"]+)"/g)].map((match) =>
    decodeURIComponent(match[1] ?? ''),
  );

describe('CSS contour shadows', () => {
  it('outsets a circular corner by distance rather than a square raster kernel', () => {
    const markup = shadowMarkup(
      [shadow({ spread: 10 })],
      materialContour(200, 160, 40, 0),
      [0, 0, 0, 0],
    );
    expect(markup).not.toContain('feMorphology');
    expect(markup).toContain('x="-10" y="-10" width="220" height="180"');
    expect(images(markup)[0]).toContain('a 50 50');
    expect(markup).toContain('in="offset-0" in2="SourceAlpha" operator="out"');
  });

  it('preserves sharp corners and the CSS small-radius correction on each axis', () => {
    const border = materialContour(200, 160, [10, 5, 0, 0, 40, 40, 40, 40], 0);
    const markup = shadowMarkup([shadow({ spread: 20 })], border, [0, 0, 0, 0]);
    const svg = images(markup)[0];
    // W3C's 10px radius / 20px spread example yields 27.5px. The y radius
    // independently yields 5 + 20 * (1 + (.25 - 1)^3) = 16.5625px.
    expect(svg).toContain('a 16.5625 27.5 90');
    expect(svg).toContain('M 240 0 L');
    expect(svg).toContain('a 60 60');
  });

  it('uses the padding box for the inset hole and final clip with unequal borders', () => {
    const markup = shadowMarkup(
      [shadow({ spread: 5, inset: true })],
      materialContour(200, 160, 40, 0),
      [4, 8, 12, 16],
    );
    expect(markup).toContain('x="16" y="4" width="176" height="144"');
    expect(markup).toContain('x="21" y="9" width="166" height="134"');
    expect(images(markup)[0]).toContain('a 32 36');
    expect(images(markup)[1]).toContain('a 27 31');
    expect(markup).toContain('in="padding-alpha" in2="offset-0" operator="out"');
    expect(markup).not.toContain('operator="arithmetic"');
  });

  it('handles signed spreads, collapsed holes, and first-shadow-on-top order', () => {
    const border = materialContour(100, 80, 10, 0.6);
    const markup = shadowMarkup(
      [shadow({ spread: -20, inset: true }), shadow({ spread: 50, inset: true })],
      border,
      [0, 0, 0, 0],
    );
    expect(markup).toContain('x="-20" y="-20" width="140" height="120"');
    expect(markup).toContain('<feFlood flood-opacity="0" result="spread-1"/>');
    expect(markup).toContain('<feMergeNode in="shadow-1"/><feMergeNode in="shadow-0"/>');
    const outer = shadowMarkup([shadow({ spread: -50 })], border, [0, 0, 0, 0]);
    expect(outer).toContain('<feFlood flood-opacity="0" result="spread-0"/>');
    expect(outer).not.toContain('feImage');
  });

  it('normalizes overlapping asymmetric radii after a hole contracts', () => {
    const markup = shadowMarkup(
      [shadow({ x: 20, y: 10, spread: 20, inset: true })],
      materialContour(100, 140, [0, 0, 100, 100, 0, 0, 0, 0], 0),
      [0, 0, 0, 0],
    );
    expect(markup).toContain('width="60" height="100"');
    // The 80px corner no longer fits the 60px hole: scale BOTH axes by .75.
    expect(images(markup)[0]).toContain('a 60 60');
    expect(images(markup)[0]).not.toContain('a 80 80');
  });
});
