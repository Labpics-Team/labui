import { evaluateWcag22 } from '@labpics/colors';
import { describe, expect, it } from 'vitest';

import { createLabuiEngine } from '../engine.mjs';
import config from '../labui.config.json' with { type: 'json' };
import { pairPixels, rgbHex } from './core-observation.mjs';

const themes = ['light', 'dark'];
const get = (result, role) => result.paints.get(`--lab-${role}`);
const ready = (engine, theme, contrast = 'more') => {
  const result = engine.resolve(theme, contrast);
  expect(result.state, `${theme}/${contrast}: ${result.reason}`).toBe('ready');
  return result;
};

describe('IC: назначение общей акцентной заливки', () => {
  it('сохраняет допустимую опору; отделяет тёмную заливку от акцентной подписи', async () => {
    const engine = await createLabuiEngine();
    const light = ready(engine, 'light');
    const dark = ready(engine, 'dark');
    expect(get(light, 'fill-accent').rgb).toEqual([0, 64, 221]);
    expect(get(light, 'label-accent').rgb).toEqual([0, 64, 221]);
    expect(get(dark, 'label-accent').rgb).toEqual([64, 156, 255]);
    expect(get(dark, 'fill-accent').rgb).not.toEqual(get(dark, 'label-accent').rgb);
    expect(get(dark, 'bg-primary').rgb).toEqual([0, 0, 0]);
  });

  it.each(themes)(
    '%s: white и secondary проходят на готовой заливке, необходимые cues — на трёх тонах',
    async (theme) => {
      const result = ready(await createLabuiEngine(), theme);
      expect(get(result, 'label-on-accent')).toEqual({ rgb: [255, 255, 255], opacity: 1 });
      expect(get(result, 'label-static-light-secondary')).toEqual({
        rgb: [255, 255, 255],
        opacity: 1,
      });
      for (const level of [1, 2, 3]) {
        const background = get(result, `bg-tone-${level}`);
        const assertPair = (foreground, surface, criterion) => {
          const observed = pairPixels(surface, foreground, background.rgb);
          expect(
            evaluateWcag22(rgbHex(observed.foreground), rgbHex(observed.background), criterion)
              .decision,
          ).toBe('pass');
        };
        for (const role of ['label-on-accent', 'label-static-light-secondary'])
          assertPair(get(result, role), get(result, 'fill-accent'), 'sc-1.4.3-text-default');
        assertPair(get(result, 'label-accent'), background, 'sc-1.4.3-text-default');
        for (const role of ['border-focus', 'border-base'])
          assertPair(get(result, role), background, 'sc-1.4.11-ui-component-or-state');
      }
    },
  );

  it.each(themes)(
    '%s: ordinary остаётся прежним после независимого разрешения IC',
    async (theme) => {
      const engine = await createLabuiEngine();
      const before = ready(engine, theme, 'normal');
      ready(engine, theme);
      expect(engine.resolve(theme).paints).toEqual(before.paints);
      expect(engine.resolve(theme, 'normal').vars).toEqual(before.vars);
      expect(before.paints.size).toBe(164);
      expect(get(before, 'fill-accent')).toEqual(get(before, 'label-accent'));
    },
  );

  it('невыполнимое ограничение IC не возвращает прежние цвета или частичный набор', async () => {
    const changed = structuredClone(config);
    changed.contrast.more.assignment.maxDelta = 0;
    const engine = await createLabuiEngine({ config: changed });
    ready(engine, 'dark', 'normal');
    const result = engine.resolve('dark', 'more');
    expect(result.state).toBe('unsatisfied');
    expect(result.vars).toBeNull();
    expect(result.paints).toBeNull();
    expect(() => engine.resolve('light', 'unknown')).toThrow();
  });

  it('отложенное разрешение IC сохраняет входы, принятые при создании engine', async () => {
    const changed = structuredClone(config);
    const engine = await createLabuiEngine({ config: changed });
    changed.contrast.more.sources['brand-light'] = '#FFFFFF';
    const result = ready(engine, 'light');
    expect(get(result, 'label-accent').rgb).toEqual([0, 64, 221]);
    expect(result.diagnostics.fingerprint).toBe(engine.fingerprint);
  });
});
