import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createLabuiEngine } from '../engine.mjs';
import { generateContract } from '../generate-contract.mjs';
import { prepareEngineConfig } from '../prepare-config.mjs';
import { THEMES, readyTheme, rgba, scopes } from './labui-program-shared.mjs';
import { resolveValue } from './state-overlays-shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(await readFile(join(here, '..', 'labui.config.json'), 'utf8'));
const referencePath = join(here, '..', 'figma-reference.css');
const reference = await readFile(referencePath, 'utf8');
const selected =
  /^--lab-(label-static-(light|dark)-(primary|secondary|tertiary|quaternary)|bg-overlay-(base|ghost|soft|strong))$/;
const select = (maps) =>
  maps.map((map) => new Map([...map].filter(([name]) => selected.test(name))));

describe('авторские источники Program', () => {
  it('36 фиксированных RGBA сохраняют независимый reference, включая системную dark', async () => {
    const actual = select(scopes(await generateContract()));
    const expected = select(scopes(reference));
    const values = (maps) =>
      maps.map((map) => new Map([...map].map(([name, value]) => [name, rgba(value)])));
    expect(actual.map((roles) => roles.size)).toEqual([12, 12, 12]);
    expect(values(actual)).toEqual(values(expected));
    expect(await readFile(referencePath, 'utf8')).toBe(reference);
  });

  it.each(THEMES)('источник brand-%s меняет всё семейство и алиасы', async (theme) => {
    const changed = structuredClone(config);
    changed.authored.sources[`brand-${theme}`] = '#6D4AFF';
    const before = readyTheme(await createLabuiEngine({ config }), theme);
    const after = readyTheme(await createLabuiEngine({ config: changed }), theme);
    for (const name of [
      'label-brand-primary',
      'fill-brand-primary',
      'border-brand-base',
      'badge-fill-brand',
      'fx-glow-brand',
    ]) {
      expect(after.paints.get(`--lab-${name}`).rgb, name).toEqual([109, 74, 255]);
      expect(after.paints.get(`--lab-${name}`).rgb, name).not.toEqual(
        before.paints.get(`--lab-${name}`).rgb,
      );
    }
    expect(resolveValue('--lab-fill-accent', after.vars)).toBe(
      resolveValue('--lab-badge-fill-brand', after.vars),
    );
    for (const name of [
      'label-danger-primary',
      'fill-success-primary',
      'border-warning-base',
      'label-static-light-primary',
    ]) {
      expect(after.paints.get(`--lab-${name}`), name).toEqual(before.paints.get(`--lab-${name}`));
    }
    const other = theme === 'light' ? 'dark' : 'light';
    expect(readyTheme(await createLabuiEngine({ config: changed }), other).vars).toEqual(
      readyTheme(await createLabuiEngine({ config }), other).vars,
    );
  });

  it.each([
    ['labelAlpha', 'secondary', 0.5, /^--lab-label(?:-[a-z-]+)?-secondary$/],
    ['overlay', 'base', 0.6, /^--lab-bg-overlay-base$/],
  ])(
    'общая alpha %s.%s меняет все и только связанные RGBA',
    async (family, level, alpha, names) => {
      const changed = structuredClone(config);
      if (family === 'labelAlpha') changed.authored.labelAlpha[level] = alpha;
      else changed.authored[family].alpha[level] = alpha;
      const before = scopes(await generateContract());
      const after = scopes(await generateContract({ config: changed }));
      for (const [index, map] of before.entries()) {
        for (const [name, value] of map) {
          if (names.test(name))
            expect(rgba(after[index].get(name)), name).toEqual({ ...rgba(value), opacity: alpha });
          else expect(after[index].get(name), name).toBe(value);
        }
        expect([...after[index].keys()]).toEqual([...map.keys()]);
      }
    },
  );

  it.each(['static', 'overlay'])(
    'ссылка %s меняет назначение фиксированного источника',
    async (family) => {
      const changed = structuredClone(config);
      changed.authored[family].sources = { light: 'shade', dark: 'white' };
      const after = await createLabuiEngine({ config: changed });
      for (const theme of THEMES) {
        const { paints } = readyTheme(after, theme);
        if (family === 'static') {
          expect(paints.get('--lab-label-static-light-primary').rgb).toEqual([16, 16, 18]);
          expect(paints.get('--lab-label-static-dark-primary').rgb).toEqual([255, 255, 255]);
        } else
          expect(paints.get('--lab-bg-overlay-base').rgb).toEqual(
            theme === 'light' ? [16, 16, 18] : [255, 255, 255],
          );
      }
    },
  );

  it('смена баз темы не перекрашивает фиксированные источники', async () => {
    const changed = structuredClone(config);
    Object.assign(changed.authored.sources, { 'test-light': '#F1F5FB', 'test-dark': '#17171C' });
    changed.themes.light.background = 'test-light';
    changed.themes.dark.background = 'test-dark';
    const before = scopes(await generateContract());
    const after = scopes(await generateContract({ config: changed }));
    expect(rgba(after[0].get('--lab-bg-tone-1')).rgb).toEqual([241, 245, 251]);
    expect(rgba(after[1].get('--lab-bg-tone-1')).rgb).toEqual([23, 23, 28]);
    expect(select(after)).toEqual(select(before));
  });

  it('подготовка детерминирована и не меняет авторский объект', () => {
    const original = structuredClone(config);
    expect(prepareEngineConfig(config)).toEqual(prepareEngineConfig(structuredClone(config)));
    expect(config).toEqual(original);
  });

  it.each([
    [['authored'], undefined],
    [['authored', 'sources'], null],
    [['authored', 'sources', 'white'], undefined],
    [['authored', 'sources', 'noise'], undefined],
    [['authored', 'sources', 'shade'], '#12345Z'],
    [['authored', 'sources', 'white'], '#fff'],
    [['authored', 'sources', 'shade'], 16],
    [['authored', 'static', 'sources', 'light'], 'missing'],
    [['authored', 'overlay', 'sources', 'dark'], '__proto__'],
    [['authored', 'overlay', 'sources', 'light'], undefined],
    [['authored', 'labelAlpha', 'primary'], -0.1],
    [['authored', 'labelAlpha', 'secondary'], 1.1],
    [['authored', 'labelAlpha', 'tertiary'], '0.5'],
    [['authored', 'overlay', 'alpha', 'base'], null],
    [['authored', 'overlay', 'alpha', 'ghost'], Number.NaN],
    [['authored', 'overlay', 'alpha', 'soft'], Number.POSITIVE_INFINITY],
    [['authored', 'overlay', 'alpha', 'strong'], undefined],
  ])('неверный авторский вход %j = %j отклоняется до разрешения', async (path, value) => {
    const changed = structuredClone(config);
    let parent = changed;
    for (const key of path.slice(0, -1)) parent = parent[key];
    parent[path.at(-1)] = value;
    expect(() => prepareEngineConfig(changed)).toThrow();
    await expect(generateContract({ config: changed })).rejects.toThrow();
  });
});
