import { describe, expect, it } from 'vitest';
import config from '../labui.config.json' with { type: 'json' };
import { themeProfile } from '../profile.mjs';
import source from './fixtures/figma-badge-primitives-20261118.json' with { type: 'json' };
import semantic from './fixtures/figma-badge-semantic-20261118.json' with { type: 'json' };

describe('authored Badge paints', () => {
  it('preserves all four live semantic modes, including compound color/opacity aliases', () => {
    const variables = new Map(semantic.variables.map((variable) => [variable.id, variable]));
    const resolve = (id, mode) => {
      const variable = variables.get(id);
      const collection = semantic.collections.find(
        (collection) => collection.id === variable.collection,
      );
      const modeId =
        collection.modes.find((value) => value.name === mode)?.modeId ?? collection.modes[0].modeId;
      const value = variable.valuesByMode[modeId];
      if (value?.type === 'VARIABLE_ALIAS') return resolve(value.id, mode);
      if (value?.color)
        return { ...resolve(value.color.id, mode), a: resolve(value.opacity.id, mode) / 100 };
      return value;
    };
    const roles = {
      'badge-fill-neutral': 'Backgrounds/Neutral/Inverted',
      'badge-label-on-neutral': 'Labels/Neutral/Inverted/Primary',
      'badge-tint-neutral': 'Neutral/Derivable/6/6@12',
      'badge-label-neutral': 'Labels/Neutral/Primary',
      'badge-label-gray': 'Labels/Neutral/Secondary',
      'badge-base-disabled-label': 'Labels/Neutral/Quaternary',
      'badge-base-disabled-fill': 'Fills/Neutral/Quaternary',
    };
    for (const theme of ['light', 'dark'])
      for (const contrast of ['normal', 'more']) {
        const mode = `${theme === 'light' ? 'Light' : 'Dark'}-mode${contrast === 'more' ? '/IC' : ''}`;
        const profile = themeProfile(theme, contrast);
        for (const [role, name] of Object.entries(roles)) {
          const value = resolve(
            semantic.variables.find((variable) => variable.name === name).id,
            mode,
          );
          const actual = profile.resolve(role);
          expect(actual.slice(0, 3), `${mode}/${role}`).toEqual(
            [value.r, value.g, value.b].map((channel) => Math.round(channel * 255)),
          );
          expect(actual[3], `${mode}/${role}`).toBeCloseTo(value.a, 7);
        }
      }
  });
  it('uses the captured Figma primitives for every theme and contrast mode', () => {
    for (const variable of source.variables) {
      const name = variable.name.split('/').pop().toLowerCase();
      for (const [mode, theme, contrast] of [
        ['7644:0', 'light', 'normal'],
        ['7644:2', 'dark', 'normal'],
        ['7644:3', 'light', 'more'],
        ['7644:4', 'dark', 'more'],
      ]) {
        const c = variable.valuesByMode[mode];
        const actual =
          contrast === 'more' ? config.anchors[name].increased[theme] : config.anchors[name][theme];
        expect(actual).toEqual([c.r, c.g, c.b].map((value) => Math.round(value * 255)));
      }
    }
  });
  it('retains the visible Screen/Normal distinction and the yellow dark-label branch', () => {
    const p = themeProfile('light');
    expect(p.resolve('badge-label-on-orange')).toEqual([255, 255, 255, 1]);
    expect(p.resolve('badge-icon-on-orange')).toEqual([253, 238, 224, 1]);
    expect(p.resolve('badge-label-on-yellow')).toEqual([31, 25, 0, 1]);
    expect(p.resolve('badge-icon-on-yellow')).toEqual([31, 25, 0, 1]);
  });
  it('keeps static tinted surfaces neutral and gray fill different from neutral fill', () => {
    for (const theme of ['light', 'dark']) {
      const p = themeProfile(theme);
      expect(p.resolve('badge-tint-static-dark')).toEqual(p.resolve('badge-base-tint'));
      expect(p.resolve('badge-tint-static-light')).toEqual(p.resolve('badge-base-tint'));
      expect(p.resolve('badge-fill-gray')).not.toEqual(p.resolve('badge-fill-neutral'));
    }
  });
});
