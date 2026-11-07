import { describe, expect, it } from 'vitest';
import config from '../labui.config.json' with { type: 'json' };
import { prepareEngineConfig } from '../prepare-config.mjs';

describe('общая топология материалов тем', () => {
  it.each(['normal', 'more'])('%s: отвергает материал только одной темы', (contrast) => {
    for (const theme of ['light', 'dark']) {
      const changed = structuredClone(config);
      changed.authored.materials[theme].extra = Object.values(changed.authored.materials[theme])[0];
      expect(() => prepareEngineConfig(changed, contrast)).toThrow('одинаковый набор материалов');
    }
  });

  it('принимает общие новые материалы независимо от порядка объявления', () => {
    const changed = structuredClone(config);
    for (const theme of ['light', 'dark']) {
      changed.authored.materials[theme].extra = Object.values(changed.authored.materials[theme])[0];
    }
    changed.authored.materials.dark = Object.fromEntries(
      Object.entries(changed.authored.materials.dark).reverse(),
    );
    const model = prepareEngineConfig(changed);
    for (const theme of ['light', 'dark']) {
      expect(model.themes[theme].paints.has('bg-material-extra-01')).toBe(true);
      expect(model.themes[theme].paints.has('bg-material-extra-02')).toBe(true);
    }
  });
});
