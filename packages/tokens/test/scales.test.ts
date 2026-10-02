import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config/default-config.js';
import { buildTokens } from '../src/domain/build.js';
import { buildOpacity } from '../src/domain/opacity.js';
import { buildSpacing } from '../src/domain/spacing.js';
import { buildZIndex } from '../src/domain/zindex.js';

const tokens = buildTokens(defaultConfig);

describe('spacing scale — linear rem multiplier', () => {
  it('every step equals baseRem * its multiplier (perfect linearity)', () => {
    const { baseRem, steps } = defaultConfig.spacing;
    const { tokens: built } = buildSpacing(defaultConfig.spacing);
    const byName = new Map(built.map((t) => [t.name, t.cssValue]));
    for (const [name, mult] of Object.entries(steps)) {
      const expectedRem = baseRem * mult;
      expect(byName.get(name)).toBe(`${trim(expectedRem)}rem`);
    }
  });

  it('integer steps form a strictly increasing arithmetic-by-multiplier ladder', () => {
    // The numeric spine 1..12 must be exactly 4px apart on a 16px root.
    const px = (name: string) => tokens.spacing.find((t) => t.name === name)?.numeric as number;
    for (let n = 2; n <= 12; n++) {
      if (defaultConfig.spacing.steps[String(n)] === undefined) continue;
      expect(px(String(n)) - px(String(n - 1))).toBeCloseTo(4, 6);
    }
  });

  it('aliases resolve to var() references, never duplicated values (three-language split)', () => {
    for (const a of tokens.spacingAliases) {
      expect(a.cssValue).toMatch(/^var\(--lab-space-/);
    }
  });
});

describe('radii scale — Figma ladder translated to rem + pill', () => {
  it('preserves the final Figma Radius/* primitive values', () => {
    const byName = Object.fromEntries(
      tokens.radii
        .filter((token) => token.dtcgType === 'dimension')
        .map((token) => [token.name, token.numeric]),
    );
    expect(byName).toMatchObject({
      '0': 0,
      xxs: 2,
      xs: 4,
      s: 6,
      m: 8,
      l: 12,
      xl: 16,
      '2xl': 20,
      '3xl': 24,
      '4xl': 28,
      '5xl': 32,
      full: 9999,
    });
  });

  it('is non-decreasing across named steps', () => {
    // Монотонность — закон ДЛИН лестницы: full (семантический пилюль) и
    // unitless-ручки формы (corner-k, dtcgType number) — не ступени длины.
    const steps = tokens.radii.filter((t) => t.name !== 'full' && t.dtcgType !== 'number');
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]?.numeric).toBeGreaterThanOrEqual(steps[i - 1]?.numeric as number);
    }
  });

  it('full is the 9999px pill constant, not a computed value', () => {
    const full = tokens.radii.find((t) => t.name === 'full');
    expect(full?.cssValue).toBe('9999px');
    expect(full?.numeric).toBe(9999);
  });
});

describe('z-index scale — semantic gapped levels', () => {
  it('has exactly the 15 levels and they are strictly monotonic', () => {
    expect(tokens.zIndex).toHaveLength(15);
    for (let i = 1; i < tokens.zIndex.length; i++) {
      expect(tokens.zIndex[i]?.numeric).toBeGreaterThan(tokens.zIndex[i - 1]?.numeric as number);
    }
  });

  it('every adjacent pair is exactly `gap` apart (room to insert)', () => {
    const { gap } = defaultConfig.zIndex;
    for (let i = 1; i < tokens.zIndex.length; i++) {
      const delta =
        (tokens.zIndex[i]?.numeric as number) - (tokens.zIndex[i - 1]?.numeric as number);
      expect(delta).toBe(gap);
    }
  });

  it('all values are unique (no z-index collisions, unlike the raw Figma snapshot)', () => {
    const values = tokens.zIndex.map((t) => t.numeric);
    expect(new Set(values).size).toBe(values.length);
  });

  it('every level carries a documented purpose', () => {
    for (const t of tokens.zIndex) {
      expect(t.description, `${t.name} must document its purpose`).toBeTruthy();
    }
  });

  it('rejects duplicate level names', () => {
    expect(() => buildZIndex({ levels: ['a', 'a'], startAt: 0, gap: 100 })).toThrow(/duplicate/);
  });
});

describe('zero token — present and correct in every dimension scale', () => {
  it('spacing defines space-0 = 0rem', () => {
    const zero = tokens.spacing.find((t) => t.name === '0');
    expect(zero?.cssValue).toBe('0rem');
    expect(zero?.numeric).toBe(0);
  });

  it('radii defines radius-0 = 0rem', () => {
    const zero = tokens.radii.find((t) => t.name === '0');
    expect(zero?.cssValue).toBe('0rem');
    expect(zero?.numeric).toBe(0);
  });

  it('z-index lowest level (primary) = 0', () => {
    expect(tokens.zIndex[0]?.numeric).toBe(0);
  });

  it('the zero token never renders as -0rem', () => {
    for (const t of [...tokens.spacing, ...tokens.radii]) {
      expect(t.cssValue).not.toContain('-0rem');
    }
  });

  it('spacing build throws if the zero step is missing (data-gap guard)', () => {
    expect(() => buildSpacing({ baseRem: 0.25, steps: { '1': 1 }, aliases: {} })).toThrow(
      /zero token/,
    );
  });
});

describe('opacity scale — unitless доли состояний (задача 13)', () => {
  it('emits the audited state fractions and both explicit edges', () => {
    const byName = new Map(tokens.opacity.map((t) => [t.name, t.cssValue]));
    expect(byName.get('0')).toBe('0'); // явный нулевой токен
    expect(byName.get('45')).toBe('0.45'); // disabled (25 мест до миграции)
    expect(byName.get('50')).toBe('0.5'); // muted / placeholder (17 мест)
    expect(byName.get('100')).toBe('1'); // явный верхний край
  });

  it('aliases resolve to var() references, never duplicated values', () => {
    for (const a of tokens.opacityAliases) {
      expect(a.cssValue).toMatch(/^var\(--lab-opacity-/);
    }
    const roles = tokens.opacityAliases.map((a) => a.name);
    expect(roles).toContain('disabled');
    expect(roles).toContain('muted');
  });

  it('a numeric step name must equal its value ×100 (name-value drift guard)', () => {
    expect(() => buildOpacity({ steps: { '0': 0, '45': 0.5 }, aliases: {} })).toThrow(
      /percent name/,
    );
  });

  it('rejects fractions outside [0, 1] and a missing zero token', () => {
    expect(() => buildOpacity({ steps: { '0': 0, half: 1.5 }, aliases: {} })).toThrow(/\[0, 1\]/);
    expect(() => buildOpacity({ steps: { '50': 0.5 }, aliases: {} })).toThrow(/zero token/);
  });

  it('rejects an alias pointing at a missing step', () => {
    expect(() => buildOpacity({ steps: { '0': 0 }, aliases: { ghost: '45' } })).toThrow(/ghost/);
  });
});

function trim(value: number): string {
  return String(Math.round(value * 1e4) / 1e4 + 0);
}
