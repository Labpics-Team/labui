import { describe, expect, it } from 'vitest';
import type { Rgba } from '../src/luminance';
import { compileMaterialTheme } from '../src/material-theme';
import { MATERIAL_TIERS, materialRoles } from '../src/profile';

const roles = (): Record<string, Rgba> =>
  Object.fromEntries(
    MATERIAL_TIERS.flatMap((tier) => {
      const names = materialRoles(tier);
      return [
        [names.normal, { r: 60, g: 120, b: 180, a: 0.4 }],
        [names.blend, { r: 200, g: 30, b: 100, a: 0.3 }],
      ];
    }),
  );

describe('SSR material theme', () => {
  it('rejects incomplete and non-finite role maps before returning any theme output', () => {
    expect(() => compileMaterialTheme('dark', {})).toThrow('bg-material');
    const input = roles();
    input[materialRoles('base').normal] = { r: Number.NaN, g: 120, b: 180, a: 0.4 };
    expect(() => compileMaterialTheme('dark', input)).toThrow('bg-material-base-01');
  });
  it('keeps independent theme snapshots stable after a caller changes its role map', () => {
    const input = roles();
    const first = compileMaterialTheme('dark', input);
    const original = first['--_lab-material-base-filter'];
    input[materialRoles('base').normal] = { r: 220, g: 120, b: 60, a: 0.4 };
    expect(compileMaterialTheme('dark', input)['--_lab-material-base-filter']).not.toBe(original);
    expect(first['--_lab-material-base-filter']).toBe(original);
    expect(Object.isFrozen(first)).toBe(true);
  });
});
