import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import components from '../src/components.js';
import { defaultConfig } from '../src/config/default-config.js';
import { resolveConfig } from '../src/config/merge.js';
import { authoredTextStyles, buildTextStyleTokens } from '../src/domain/text-styles.js';
import { generate } from '../src/generate/index.js';
import { resolveTextStyles } from '../src/resolve-text-styles.mjs';

const source = JSON.parse(
  readFileSync(
    new URL('../../../docs/evidence/typography-20261119/source-text.json', import.meta.url),
    'utf8',
  ),
);

describe('authored text roles', () => {
  it('preserves each complete source style, including distinct Regular and Medium tracking', () => {
    for (const [role, actual] of Object.entries(authoredTextStyles)) {
      const expected = source.text.find((text: { id: string }) => text.id === actual.sourceNode);
      expect(expected, role).toBeDefined();
      expect(actual.fontFamily).toBe(expected.style.fontFamily);
      expect(actual.fontSize).toBe(expected.style.fontSize);
      expect(actual.fontWeight).toBe(expected.style.fontWeight);
      expect(actual.lineHeight).toBe(expected.style.lineHeightPx);
      expect(actual.letterSpacing).toBeCloseTo(expected.style.letterSpacing, 6);
    }
    expect(authoredTextStyles.body.letterSpacing).not.toBe(
      authoredTextStyles['body-emphasized'].letterSpacing,
    );
  });

  it('projects CSS and DTCG without a per-letter error budget', () => {
    const tokens = buildTextStyleTokens();
    const dtcg = JSON.parse(generate(defaultConfig).dtcg);
    for (const [role, style] of Object.entries(authoredTextStyles)) {
      const tracking = tokens.find((t) => t.kind === 'letter-spacing' && t.name === role);
      if (!tracking) throw new Error(`Missing role tracking ${role}`);
      // A thousand intervals amplifies unit/rounding defects that a 0.35px
      // interval tolerance previously concealed. Actual shaping is tested in browsers/Compose.
      expect(
        Math.abs(Number.parseFloat(tracking.cssValue) * 16 - style.letterSpacing) * 1000,
      ).toBeLessThan(0.001);
      expect(dtcg.typography[role].$value).toEqual({
        fontFamily: style.fontFamily,
        fontSize: { value: style.fontSize, unit: 'px' },
        fontWeight: style.fontWeight,
        letterSpacing: { value: style.letterSpacing, unit: 'px' },
        lineHeight: style.lineHeight / style.fontSize,
      });
    }
  });

  it('shares exact component tuples while preserving their numeric public shape', () => {
    expect(components.card.text.description).toEqual({
      fontSize: 16,
      lineHeight: 24,
      fontWeight: 400,
      letterSpacing: -0.25,
    });
    expect(components.card.text.title).toEqual({
      fontSize: 20,
      lineHeight: 20,
      fontWeight: 500,
      letterSpacing: -0.33,
    });
    expect(components.sheet.typography.description).toEqual(components.card.text.description);
    expect(components.selection.choicebox.fontWeight).toBe(500);
    expect(components.selection.choicebox.letterSpacing).toBe(0);
    expect(JSON.stringify(components)).not.toContain('$textStyle');
    expect(() => resolveTextStyles({ $textStyle: 'unknown' })).toThrow(
      'Unknown authored text style',
    );
    expect(() => resolveTextStyles({ $textStyle: 'body', letterSpacing: 0 })).toThrow(
      'must not override letterSpacing',
    );
  });

  it('keeps authored roles independent of custom fluid-scale ratios and base', () => {
    const custom = resolveConfig({ typography: { basePx: 18, ratioMax: 1.4 } });
    expect(JSON.parse(generate(custom).dtcg).typography).toEqual(
      JSON.parse(generate(defaultConfig).dtcg).typography,
    );
  });
});
