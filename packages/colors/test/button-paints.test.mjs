import { describe, expect, it } from 'vitest';
import { themeProfile } from '../profile.mjs';
import source from './fixtures/figma-button-neutral-20261120.json' with { type: 'json' };

describe('authored neutral Button paints', () => {
  it('preserves live Figma aliases in both themes and contrast modes', () => {
    const variables = new Map(source.variables.map((v) => [v.id, v]));
    const resolve = (id, mode) => {
      const variable = variables.get(id);
      const collection = source.collections.find((c) => c.id === variable.collection);
      const modeId =
        collection.modes.find((m) => m.name === mode)?.modeId ?? collection.modes[0].modeId;
      const value = variable.valuesByMode[modeId];
      if (value?.type === 'VARIABLE_ALIAS') return resolve(value.id, mode);
      if (value?.color)
        return { ...resolve(value.color.id, mode), a: resolve(value.opacity.id, mode) / 100 };
      return value;
    };
    const roles = {
      'button-fill-neutral': 'Backgrounds/Neutral/Inverted',
      'button-label-on-neutral': 'Labels/Neutral/Inverted/Primary',
      'button-description-on-neutral': 'Labels/Neutral/Inverted/Secondary',
      'button-tint-neutral': 'Fills/Neutral/Tertiary',
    };
    for (const theme of ['light', 'dark'])
      for (const contrast of ['normal', 'more']) {
        const mode = `${theme === 'light' ? 'Light' : 'Dark'}-mode${contrast === 'more' ? '/IC' : ''}`;
        const profile = themeProfile(theme, contrast);
        for (const [role, name] of Object.entries(roles)) {
          const value = resolve(source.variables.find((v) => v.name === name).id, mode);
          const paint = profile.resolve(role);
          expect(paint.slice(0, 3), `${mode}/${role}`).toEqual(
            [value.r, value.g, value.b].map((c) => Math.round(c * 255)),
          );
          expect(paint[3], `${mode}/${role}`).toBeCloseTo(value.a, 7);
        }
        expect(profile.resolve('fill-neutral')).not.toEqual(profile.resolve('button-fill-neutral'));
      }
  });
});
