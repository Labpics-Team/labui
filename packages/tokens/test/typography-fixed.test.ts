import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config/default-config.js';
import { resolveConfig } from '../src/config/merge.js';
import { buildTypography } from '../src/domain/typography.js';
import { generate } from '../src/generate/index.js';

describe('фиксированные роли подписей Switch', () => {
  it('сохраняет rem-кегль и точный em-трекинг в CSS, TS и DTCG', () => {
    const { css, ts, dtcg } = generate(defaultConfig);
    const doc = JSON.parse(dtcg);
    for (const [name, fontRem, lineHeight, trackingEm] of [
      ['switch-label', 1, 1.5, -0.015625],
      ['switch-label-l', 1.25, 1, -0.0165],
    ] as const) {
      expect(css).toContain(`--lab-font-size-${name}: ${fontRem}rem;`);
      expect(css).toContain(`--lab-line-height-${name}: ${lineHeight};`);
      expect(css).toContain(`--lab-letter-spacing-${name}: ${trackingEm}em;`);
      expect(ts).toContain(`'${name}': 'var(--lab-font-size-${name})'`);
      expect(doc['font-size'][name].$value).toEqual({ value: fontRem * 16, unit: 'px' });
      expect(doc['line-height'][name].$value).toBe(lineHeight);
      expect(doc['letter-spacing'][name].$value).toBe(trackingEm);
    }
  });

  it('добавление роли не меняет существующую плавную шкалу', () => {
    const before = buildTypography({ ...defaultConfig.typography, fixedRoles: undefined });
    const after = buildTypography(defaultConfig.typography);
    for (const key of ['fontSizes', 'lineHeights', 'letterSpacings'] as const) {
      const names = new Set(before[key].map((token) => token.name));
      expect(after[key].filter((token) => names.has(token.name))).toEqual(before[key]);
    }
  });

  it('переопределение одной роли сохраняет соседнюю и не зависит от fluid ratio', () => {
    const config = resolveConfig({
      typography: {
        ratioMax: 1.5,
        fixedRoles: {
          'switch-label-l': { fontSizeRem: 1.5, lineHeight: 1, letterSpacingEm: -0.0165 },
        },
      },
    });
    const { fontSizes } = buildTypography(config.typography);
    expect(fontSizes.find((token) => token.name === 'switch-label-l')?.cssValue).toBe('1.5rem');
    expect(fontSizes.find((token) => token.name === 'switch-label')?.cssValue).toBe('1rem');
  });

  it('не позволяет затереть плавную ступень одноимённой ролью', () => {
    expect(() =>
      buildTypography({
        ...defaultConfig.typography,
        fixedRoles: { md: { fontSizeRem: 1, lineHeight: 1, letterSpacingEm: 0 } },
      }),
    ).toThrow(/collides/);
  });

  it.each([
    { fontSizeRem: 0, lineHeight: 1, letterSpacingEm: 0 },
    { fontSizeRem: Number.NaN, lineHeight: 1, letterSpacingEm: 0 },
    { fontSizeRem: 1, lineHeight: -1, letterSpacingEm: 0 },
    { fontSizeRem: 1, lineHeight: 1, letterSpacingEm: Number.POSITIVE_INFINITY },
  ])('отвергает невалидную геометрию роли: %o', (role) => {
    expect(() =>
      buildTypography({
        ...defaultConfig.typography,
        fixedRoles: { invalid: role },
      }),
    ).toThrow(/finite positive size/);
  });
});
