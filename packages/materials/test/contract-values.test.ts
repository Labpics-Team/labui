import { describe, expect, it } from 'vitest';
import { MATERIAL_TIERS, fillKey } from '../src/material-guarantee';
import { readContractMaterials } from './contract-values';

const declarations = (tint: string, base: string) =>
  MATERIAL_TIERS.flatMap((tier) => [
    `--lab-bg-material-${tier}-01: ${tint};`,
    `--lab-bg-material-${tier}-02: ${base};`,
  ]).join('\n');

const switched = `
:root { --_lab-normal: initial; --_lab-more: ; }
:root, [data-theme], [data-contrast] {
  ${declarations(
    'var(--_lab-normal, var(--_lab-light, rgb(10 20 30 / 0.2)) var(--_lab-dark, rgb(90 80 70 / 0.8))) var(--_lab-more, var(--_lab-light, rgb(40 50 60 / 0.4)) var(--_lab-dark, rgb(60 50 40 / 0.6)))',
    'var(--lab-material-base)',
  )}
  --lab-material-base: var(--_lab-light, rgb(200 210 220)) var(--_lab-dark, rgb(20 30 40));
  --lab-label-static-light-primary: rgb(255 255 255);
  --lab-label-static-dark-primary: rgb(0 0 0);
}`;

describe('material reader поверх generated CSS contract', () => {
  it('читает весь набор материалов из действующего контракта', () => {
    const { fills, labelCandidatesByTheme } = readContractMaterials();
    expect(fills.size).toBe(MATERIAL_TIERS.length * 2);
    for (const theme of ['light', 'dark'] as const) {
      expect(labelCandidatesByTheme.get(theme)).toHaveLength(2);
      for (const tier of MATERIAL_TIERS) {
        expect(fills.get(fillKey(theme, tier))?.base.a).toBe(1);
      }
    }
  });

  it.each([
    ['normal', 'light', { r: 10, g: 20, b: 30, a: 0.2 }],
    ['normal', 'dark', { r: 90, g: 80, b: 70, a: 0.8 }],
    ['more', 'light', { r: 40, g: 50, b: 60, a: 0.4 }],
    ['more', 'dark', { r: 60, g: 50, b: 40, a: 0.6 }],
  ] as const)('выбирает %s/%s и разрешает alias', (contrast, theme, tint) => {
    const { fills } = readContractMaterials(switched, contrast);
    for (const tier of MATERIAL_TIERS) {
      expect(fills.get(fillKey(theme, tier))).toEqual({
        tint,
        base: theme === 'light' ? { r: 200, g: 210, b: 220, a: 1 } : { r: 20, g: 30, b: 40, a: 1 },
      });
    }
  });

  it('отсутствующая роль или непригодное значение не превращаются в успешное чтение', () => {
    const missing = switched.replace(/--lab-bg-material-base-01:[^;]+;/, '');
    expect(() => readContractMaterials(missing)).toThrow(
      'declaration --lab-bg-material-base-01 not found',
    );
    const invalid = switched.replace('rgb(10 20 30 / 0.2)', 'invalid-colour');
    expect(() => readContractMaterials(invalid)).toThrow('could not be parsed');
    const missingAlias = switched.replace(/--lab-material-base:[^;]+;/, '');
    expect(() => readContractMaterials(missingAlias)).toThrow('переменная не найдена');
  });
});
