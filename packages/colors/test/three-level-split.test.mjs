import { describe, expect, it } from 'vitest';

import { createLabuiEngine } from '../engine.mjs';
import config from '../labui.config.json' with { type: 'json' };
import { prepareEngineConfig } from '../prepare-config.mjs';
import { THEMES, readyTheme } from './labui-program-shared.mjs';

const COMPONENT_USECASE = /^(badge-|control-|misc-)/;
const BADGE_FAMILIES = [
  'brand',
  'danger',
  'warning',
  'success',
  'info',
  'static-dark',
  'static-light',
];

describe('границы примитивов, семантики и компонентов', () => {
  it('краски ссылаются только на примитивные источники или вычисленные фоновые тоны', () => {
    const model = prepareEngineConfig(config);
    for (const theme of THEMES) {
      for (const [name, paint] of model.themes[theme].paints) {
        expect(COMPONENT_USECASE.test(paint.source), `${theme}/${name}: ссылка на компонент`).toBe(
          false,
        );
        expect(
          Object.hasOwn(model.sources, paint.source) || /^\$tone-[23]$/.test(paint.source),
          name,
        ).toBe(true);
      }
    }
  });

  it('все семь компонентных badge-заливок разрешаются из общих источников', () => {
    const model = prepareEngineConfig(config);
    for (const theme of THEMES) {
      const names = [...model.themes[theme].paints.keys()].filter((name) =>
        name.startsWith('badge-fill-'),
      );
      expect(names.sort()).toEqual(BADGE_FAMILIES.map((family) => `badge-fill-${family}`).sort());
    }
  });

  it('единственные semantic→component алиасы остаются прежней проекцией закона пары', () => {
    const model = prepareEngineConfig(config);
    for (const theme of THEMES) {
      const references = [...model.themes[theme].aliases]
        .filter(([name, target]) => !COMPONENT_USECASE.test(name) && COMPONENT_USECASE.test(target))
        .map(([name]) => name)
        .sort();
      expect(references).toEqual(['fill-accent', 'fill-danger']);
    }
  });
});

describe('общая нулевая краска', () => {
  it('публичные fill-none и border-none получают одну нулевую краску', () => {
    const model = prepareEngineConfig(config);
    for (const theme of THEMES) {
      const fill = model.themes[theme].paints.get('fill-none');
      const border = model.themes[theme].paints.get('border-none');
      expect(fill.opacity).toBe(0);
      expect(border).toEqual(fill);
      expect(
        [...model.themes[theme].paints.keys()].some((name) => name.startsWith('border-ghost')),
      ).toBe(false);
    }
  });

  it('прозрачность общего none сохраняется в конечном CSS-контракте', async () => {
    const engine = await createLabuiEngine();
    for (const theme of THEMES) {
      const { paints } = readyTheme(engine, theme);
      expect(paints.get('--lab-fill-none').opacity).toBe(0);
      expect(paints.get('--lab-border-none')).toEqual(paints.get('--lab-fill-none'));
    }
  });
});
