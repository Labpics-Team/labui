import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config/default-config.js';
import { resolveConfig } from '../src/config/merge.js';
import { buildTypography } from '../src/domain/typography.js';
import { generate } from '../src/generate/index.js';

describe('фиксированные типографические роли', () => {
  it('сохраняет rem-кегль и точный em-трекинг в CSS, TS и DTCG', () => {
    const { css, ts, dtcg } = generate(defaultConfig);
    const doc = JSON.parse(dtcg);
    for (const [name, fontRem, lineHeight, trackingEm] of [
      ['switch-label', 1, 1.5, -0.015625],
      ['switch-label-l', 1.25, 1, -0.0165],
      ['badge-label', 0.75, 1, 0],
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

  it('сохраняет авторскую высоту строки при rem-масштабе и независимом кегле', () => {
    const { css, dtcg } = generate(defaultConfig);
    const value = css.match(/--lab-line-height-card-caption:\s*([^;]+);/)?.[1];
    const multiplier = Number(value);
    const exported = JSON.parse(dtcg)['line-height']['card-caption'].$value;

    // Эталон: 14/12 при root16; смена кегля сохраняет безразмерное отношение.
    for (const [fontPx, expectedLinePx] of [
      [14, 12],
      [17.5, 15],
      [28, 24],
    ] as const) {
      expect(fontPx * multiplier).toBe(expectedLinePx);
      expect(fontPx * exported).toBe(expectedLinePx);
    }
    expect(exported).toBe(multiplier);
  });

  it('не теряет точность произвольного авторского множителя между CSS и DTCG', () => {
    const lineHeight = 1 / 7;
    const { css, dtcg } = generate(
      resolveConfig({
        typography: {
          fixedRoles: {
            fraction: { fontSizeRem: 1, lineHeight, letterSpacingEm: 0 },
          },
        },
      }),
    );
    const value = css.match(/--lab-line-height-fraction:\s*([^;]+);/)?.[1];
    const exported = JSON.parse(dtcg)['line-height'].fraction.$value;
    expect(Number(value)).toBe(lineHeight);
    expect(exported).toBe(lineHeight);
  });

  it('добавление роли не меняет существующую плавную шкалу', () => {
    const before = buildTypography({ ...defaultConfig.typography, fixedRoles: undefined });
    const after = buildTypography(defaultConfig.typography);
    for (const key of ['fontSizes', 'lineHeights', 'letterSpacings'] as const) {
      const names = new Set(before[key].map((token) => token.name));
      expect(after[key].filter((token) => names.has(token.name))).toEqual(before[key]);
    }
    const beforeDtcg = JSON.parse(
      generate({
        ...defaultConfig,
        typography: { ...defaultConfig.typography, fixedRoles: undefined },
      }).dtcg,
    );
    const afterDtcg = JSON.parse(generate(defaultConfig).dtcg);
    for (const name of Object.keys(beforeDtcg['line-height'])) {
      expect(afterDtcg['line-height'][name]).toEqual(beforeDtcg['line-height'][name]);
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
