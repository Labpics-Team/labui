import { describe, expect, it } from 'vitest';

import { createLabuiEngine } from '../engine.mjs';
import config from '../labui.config.json' with { type: 'json' };
import { prepareEngineConfig } from '../prepare-config.mjs';
import { THEMES, readyTheme } from './labui-program-shared.mjs';

const LEVELS = ['primary', 'secondary', 'tertiary', 'quaternary'];

describe('единые авторские источники static/inverted', () => {
  it('одна ссылка static-стороны питает все уровни и компонентную заливку', () => {
    const model = prepareEngineConfig(config);
    for (const theme of THEMES) {
      for (const side of THEMES) {
        const expectedSource = config.authored.static.sources[side];
        for (const level of LEVELS) {
          expect(model.themes[theme].paints.get(`label-static-${side}-${level}`)).toEqual({
            source: expectedSource,
            opacity: config.authored.labelAlpha[level],
          });
        }
        expect(model.themes[theme].paints.get(`badge-fill-static-${side}`).source).toBe(
          expectedSource,
        );
      }
    }
  });

  it('смена static-ссылки переносит всё семейство, сохраняя независимый overlay', () => {
    const changed = structuredClone(config);
    changed.authored.static.sources.dark = 'white';
    const model = prepareEngineConfig(changed);
    for (const theme of THEMES) {
      for (const level of LEVELS) {
        expect(model.themes[theme].paints.get(`label-static-dark-${level}`).source).toBe('white');
      }
      expect(model.themes[theme].paints.get('badge-fill-static-dark').source).toBe('white');
      expect(model.themes[theme].paints.get('bg-overlay-base').source).toBe(
        config.authored.overlay.sources[theme],
      );
    }
  });

  it('inverted использует выбранный источник и общую alpha уровней', () => {
    const model = prepareEngineConfig(config);
    for (const theme of THEMES) {
      for (const level of LEVELS) {
        expect(model.themes[theme].paints.get(`label-inverted-${level}`)).toEqual({
          source:
            level === 'primary'
              ? config.themes[theme].invertedPrimary
              : config.themes[theme].invertedMuted,
          opacity: config.authored.labelAlpha[level],
        });
      }
    }
  });

  it('обе static-заливки доходят до конечных красок и различаются', async () => {
    const engine = await createLabuiEngine();
    for (const theme of THEMES) {
      const { paints } = readyTheme(engine, theme);
      expect(paints.get('--lab-badge-fill-static-dark')).toBeDefined();
      expect(paints.get('--lab-badge-fill-static-light')).toBeDefined();
      expect(paints.get('--lab-badge-fill-static-dark')).not.toEqual(
        paints.get('--lab-badge-fill-static-light'),
      );
    }
  });
});
