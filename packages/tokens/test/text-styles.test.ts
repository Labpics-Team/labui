import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import components from '../src/components.js';
import { defaultConfig } from '../src/config/default-config.js';
import { resolveConfig } from '../src/config/merge.js';
import { authoredTextStyles, buildTextStyleTokens } from '../src/domain/text-styles.js';
import { generate, generateFromOverride } from '../src/generate/index.js';
import { resolveTextStyles } from '../src/resolve-text-styles.mjs';

const sourceText = [
  '../../../docs/evidence/typography-20261119/source-text.json',
  '../../../docs/evidence/segmented-20261119/source-text.json',
].flatMap((path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')).text);

describe('authored text roles', () => {
  it('preserves each complete source style, including distinct Regular and Medium tracking', () => {
    for (const [role, actual] of Object.entries(authoredTextStyles)) {
      const expected = sourceText.find((text: { id: string }) => text.id === actual.sourceNode);
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

  it('keeps authored roles distinct when fluid steps and weights use the same names', () => {
    const authored = JSON.parse(generate(defaultConfig).dtcg).typography;
    for (const role of Object.keys(authoredTextStyles)) {
      for (const step of ['0', '1']) {
        const artifacts = generateFromOverride({ typography: { stepLabels: { [step]: role } } });
        const dtcg = JSON.parse(artifacts.dtcg);
        expect(dtcg.typography).toEqual(authored);
        expect(dtcg['font-size'][role].$extensions['com.labpics.ui-tokens'].fluid.step).toBe(
          Number(step),
        );
        expect(artifacts.css).toContain(`--lab-font-size-${role}:`);
        expect(artifacts.css).toContain(`--lab-text-${role}-font-size:`);
        const names = [...artifacts.css.matchAll(/^\s*(--lab-[\w-]+):/gm)].map((match) => match[1]);
        expect(new Set(names).size).toBe(names.length);
        expect(artifacts.ts).toContain(`'var(--lab-text-${role}-font-size)'`);
      }
      const weighted = generateFromOverride({ typography: { weights: { [role]: 350 } } });
      expect(JSON.parse(weighted.dtcg)['font-weight'][role].$value).toBe(350);
      expect(JSON.parse(weighted.dtcg).typography).toEqual(authored);
      expect(weighted.css).toContain(`--lab-font-weight-${role}: 350;`);
    }
  });

  it('still rejects a real collision with a component metric', () => {
    expect(() =>
      generateFromOverride({ typography: { stepLabels: { '0': 'card-title' } } }),
    ).toThrow('Duplicate component token: font-size/card-title');
  });
});
