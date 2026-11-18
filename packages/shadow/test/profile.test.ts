import { describe, expect, it } from 'vitest';
import { generateShadowCss } from '../src/generate-css';
import { shadowProfile } from '../src/profile';

describe('portable authored shadow profile', () => {
  it('preserves full modal stack order and references the same Colors role as CSS', () => {
    const modal = shadowProfile.levels[shadowProfile.roles.modal];
    expect(modal?.map(({ x, y, blur, spread, opacity }) => [x, y, blur, spread, opacity])).toEqual([
      [0, 16, 36, 0, 0.12],
      [0, 24, 48, 0, 0.04],
      [0, 36, 64, 0, 0.02],
      [0, 48, 96, 0, 0.01],
    ]);
    expect(generateShadowCss()).toContain(`var(--lab-${shadowProfile.colorRole},`);
    expect(JSON.parse(JSON.stringify(shadowProfile))).toEqual(shadowProfile);
  });
});
