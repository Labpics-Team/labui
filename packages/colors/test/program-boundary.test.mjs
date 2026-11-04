import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { createLabuiEngine } from '../engine.mjs';
import { generateContract } from '../generate-contract.mjs';
import config from '../labui.config.json' with { type: 'json' };
import dictionary from '../roles.json' with { type: 'json' };
import { RETIRED_FX_ROLES } from './authored-reference.mjs';
import { THEMES, readyTheme, rgba, scopes } from './labui-program-shared.mjs';
import { resolveValue } from './state-overlays-shared.mjs';

const declared = Object.values(dictionary.groups).flat().sort();
const topology = {
  light: [1, 2, 1, 2, 1, 2],
  dark: [1, 2, 3, 1, 2, 3],
};
const backgrounds = [
  'primary',
  'secondary',
  'tertiary',
  'grouped-primary',
  'grouped-secondary',
  'grouped-tertiary',
];

describe('граница полного Program-контракта', () => {
  it('полный словарь и все реальные значения доходят до light/dark/system CSS', async () => {
    const engine = await createLabuiEngine();
    const output = scopes(await generateContract());
    expect(declared).toHaveLength(164);
    expect(new Set(declared).size).toBe(declared.length);
    for (const [index, theme] of THEMES.entries()) {
      const result = readyTheme(engine, theme);
      expect([...result.vars.keys()].sort()).toEqual(declared);
      for (const name of RETIRED_FX_ROLES) expect(result.vars.has(name), name).toBe(false);
      expect([...output[index].keys()].sort()).toEqual(declared);
      expect(output[index]).toEqual(result.vars);
      // Каждая краска сверяется с конечным RGB/opacity владельца.
      for (const [name, paint] of result.paints) {
        expect(rgba(resolveValue(name, output[index])), name).toEqual(paint);
      }
    }
    expect(output[2]).toEqual(output[1]);
  });

  it('повторная генерация и порядок тем не меняют результат', async () => {
    const engine = await createLabuiEngine();
    const dark = readyTheme(engine, 'dark');
    const light = readyTheme(engine, 'light');
    expect(readyTheme(engine, 'light').vars).toEqual(light.vars);
    expect(readyTheme(engine, 'dark').vars).toEqual(dark.vars);
    expect(await generateContract()).toBe(await generateContract());
  });

  it('primary сохраняет авторский белый label-on-accent в обеих темах', async () => {
    const engine = await createLabuiEngine();
    const white = rgba(config.authored.sources.white);
    for (const theme of THEMES) {
      const { paints } = readyTheme(engine, theme);
      expect(paints.get('--lab-label-on-accent')).toEqual(white);
      expect(paints.get('--lab-badge-label-on-brand')).toEqual(white);
    }
  });

  it.each(THEMES)(
    '%s: обычная и grouped-последовательности следуют разным связям',
    async (theme) => {
      const { vars } = readyTheme(await createLabuiEngine(), theme);
      for (const [index, role] of backgrounds.entries()) {
        expect(vars.get(`--lab-bg-${role}`), role).toBe(
          `var(--lab-bg-tone-${topology[theme][index]})`,
        );
      }
    },
  );

  it('нейтральный источник не переключает grouped-топологию', async () => {
    const changed = structuredClone(config);
    changed.authored.sources.mid = '#60588C';
    const engine = await createLabuiEngine({ config: changed });
    for (const theme of THEMES) {
      const { vars } = readyTheme(engine, theme);
      for (const [index, role] of backgrounds.entries()) {
        expect(vars.get(`--lab-bg-${role}`), `${theme}/${role}`).toBe(
          `var(--lab-bg-tone-${topology[theme][index]})`,
        );
      }
    }
  });

  it('нерешённое требование запрещает весь output и запись CSS', async () => {
    const unresolved = structuredClone(config);
    unresolved.policy.contrast = 'unresolved';
    const before = await readFile(new URL('../contract.css', import.meta.url));
    const engine = await createLabuiEngine({ config: unresolved });
    for (const theme of THEMES) {
      const result = engine.resolve(theme);
      expect(result.state).toBe('blocked');
      expect(result.reason).toMatch(/contrast/);
      expect(result.vars).toBeNull();
      expect(result.paints).toBeNull();
    }
    await expect(generateContract({ config: unresolved })).rejects.toThrow();
    expect(await readFile(new URL('../contract.css', import.meta.url))).toEqual(before);
  });

  it.each([
    [
      'контекст',
      (c) => {
        c.observation.adaptingLuminance = Number.NaN;
      },
    ],
    [
      'alpha',
      (c) => {
        c.themes.dark.tone.alpha[1] = 1.01;
      },
    ],
    [
      'источник',
      (c) => {
        c.themes.dark.background = 'missing';
      },
    ],
    [
      'цикл',
      (c) => {
        c.aliases.push(
          { alias: 'cycle-a', target: 'cycle-b' },
          { alias: 'cycle-b', target: 'cycle-a' },
        );
      },
    ],
  ])('ошибка %s не подменяется предыдущим полным результатом', async (_name, mutate) => {
    const changed = structuredClone(config);
    mutate(changed);
    await expect(createLabuiEngine({ config: changed })).rejects.toThrow();
    await expect(generateContract({ config: changed })).rejects.toThrow();
  });
});
