import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Меняются только копии входных файлов. Генератор и WASM выполняются настоящие.
const input = vi.hoisted(() => ({ reference: null, config: null }));
vi.mock('node:fs/promises', async (original) => {
  const fs = await original();
  return {
    ...fs,
    readFile: (path, ...args) => {
      const name = String(path).replaceAll('\\', '/');
      if (name.endsWith('/colors/figma-reference.css') && input.reference !== null) {
        return Promise.resolve(input.reference);
      }
      if (name.endsWith('/colors/labui.config.json') && input.config !== null) {
        return Promise.resolve(JSON.stringify(input.config));
      }
      return fs.readFile(path, ...args);
    },
  };
});

import { PASSPORT_FINGERPRINT, createLabuiEngine } from '../engine.mjs';
import { generateContract } from '../generate-contract.mjs';
import { prepareEngineConfig } from '../prepare-config.mjs';

const fs = await vi.importActual('node:fs/promises');
const here = dirname(fileURLToPath(import.meta.url));
const referencePath = join(here, '..', 'figma-reference.css');
const reference = await fs.readFile(referencePath, 'utf8');
const config = JSON.parse(await fs.readFile(join(here, '..', 'labui.config.json'), 'utf8'));
const selected =
  /^--lab-(label-static-(light|dark)-(primary|secondary|tertiary|quaternary)|bg-overlay-(base|ghost|soft|strong))$/;

function scopes(css, filter = () => true) {
  return [
    /\[data-theme="light"\]\s*\{([^}]+)\}/,
    /^\[data-theme="dark"\]\s*\{([^}]+)\}/m,
    /:root:not\(\[data-theme="light"\]\):not\(\[data-theme="dark"\]\)\s*\{([^}]+)\}/,
  ].map((scope) => {
    const body = scope.exec(css)?.[1];
    expect(body, String(scope)).toBeDefined();
    return new Map(
      [...body.matchAll(/(--lab-[a-z0-9-]+)\s*:\s*([^;]+);/g)]
        .map((match) => [match[1], match[2].trim()])
        .filter(([name]) => filter(name)),
    );
  });
}

function expectOnlyChanges(before, after, changes) {
  const expected = scopes(before);
  expected.forEach((roles, scope) => {
    for (const [name, value] of roles) {
      roles.set(name, changes(name, value, scope));
    }
  });
  expect(scopes(after)).toEqual(expected);
}

function mutateReference(change) {
  return reference.replace(/(^[ \t]*)(--lab-[a-z0-9-]+)\s*:\s*([^;]+);/gm, (line, indent, name) =>
    selected.test(name) ? change(line, indent, name) : line,
  );
}

beforeEach(() => {
  input.reference = null;
  input.config = null;
});

afterAll(async () => {
  expect(await fs.readFile(referencePath, 'utf8')).toBe(reference);
});

describe('авторские фиксированные роли', () => {
  it.each(['удаление', 'подмена', 'перестановка'])(
    '%s выбранных строк reference не меняет контракт',
    async (operation) => {
      const baseline = await generateContract();
      if (operation === 'удаление') {
        input.reference = mutateReference(() => '');
      } else if (operation === 'подмена') {
        input.reference = mutateReference(
          (_, indent, name) => `${indent}${name}: rgb(9 8 7 / 0.123);`,
        );
      } else {
        const lines = [];
        mutateReference((line) => {
          lines.push(line);
          return line;
        });
        input.reference = mutateReference(() => lines.pop());
      }
      expect(input.reference).not.toBe(reference);
      expect(await generateContract()).toBe(baseline);
    },
  );

  it('36 RGBA совпадают с неизменным reference, включая системную dark', async () => {
    const css = await generateContract();
    const actual = scopes(css, (name) => selected.test(name));
    expect(actual.map((roles) => roles.size)).toEqual([12, 12, 12]);
    expect(actual).toEqual(scopes(reference, (name) => selected.test(name)));
    const declarations = [...css.matchAll(/(--lab-[a-z0-9-]+)\s*:/g)];
    expect(declarations.filter((match) => selected.test(match[1]))).toHaveLength(36);
    for (const roles of actual) {
      expect(roles.get('--lab-bg-overlay-ghost')).toMatch(/ \/ 0\)$/);
    }
  });

  it.each([
    ['white', '#EEF8FF', '238 248 255', 'light'],
    ['shade', '#182028', '24 32 40', 'dark'],
  ])('источник %s меняет только связанные краски', async (source, hex, rgb, side) => {
    const before = await generateContract();
    input.config = structuredClone(config);
    input.config.authored.sources[source] = hex;
    const after = await generateContract();
    expect(after).not.toBe(before);
    expectOnlyChanges(before, after, (name, value, scope) => {
      const overlayUsesSource = side === 'light' ? scope === 0 : scope !== 0;
      return name.startsWith(`--lab-label-static-${side}-`) ||
        (overlayUsesSource && name.startsWith('--lab-bg-overlay-'))
        ? value.replace(/^rgb\(\d+ \d+ \d+/, `rgb(${rgb}`)
        : value;
    });
  });

  it.each([
    ['static', 'secondary', 0.5, /^--lab-label-static-(light|dark)-secondary$/],
    ['overlay', 'base', 0.6, /^--lab-bg-overlay-base$/],
  ])(
    'общая alpha %s.%s меняет все и только связанные роли',
    async (family, level, alpha, roles) => {
      const before = await generateContract();
      input.config = structuredClone(config);
      input.config.authored[family].alpha[level] = alpha;
      const after = await generateContract();
      expect(after).not.toBe(before);
      expectOnlyChanges(before, after, (name, value) =>
        roles.test(name) ? value.replace(/ \/ [\d.]+\)$/, ` / ${alpha})`) : value,
      );
    },
  );

  it.each(['static', 'overlay'])(
    'ссылки семейства %s управляют назначением источников',
    async (family) => {
      const before = await generateContract();
      input.config = structuredClone(config);
      input.config.authored[family].sources = { light: 'shade', dark: 'white' };
      const after = await generateContract();
      expectOnlyChanges(before, after, (name, value) => {
        const affected =
          family === 'static'
            ? name.startsWith('--lab-label-static-')
            : name.startsWith('--lab-bg-overlay-');
        if (!affected) return value;
        return value.startsWith('rgb(255 255 255')
          ? value.replace('rgb(255 255 255', 'rgb(16 16 18')
          : value.replace('rgb(16 16 18', 'rgb(255 255 255');
      });
    },
  );

  it('новые базы темы не перекрашивают фиксированные источники', async () => {
    const before = await generateContract();
    input.config = structuredClone(config);
    input.config.neutral.anchors.light = '#F1F5FB';
    input.config.neutral.anchors.dark = '#17171C';
    const after = await generateContract();
    expect(scopes(after)[0].get('--lab-bg-tone-1')).toBe('#F1F5FB');
    expect(scopes(after)[1].get('--lab-bg-tone-1')).toBe('#17171C');
    expect(scopes(after, (name) => selected.test(name))).toEqual(
      scopes(before, (name) => selected.test(name)),
    );
  });

  it('authored не меняет engine DTO, fingerprint и сам входной объект', async () => {
    const { authored: _authored, ...legacy } = config;
    const original = structuredClone(config);
    expect(JSON.stringify(prepareEngineConfig(config))).toBe(
      JSON.stringify(prepareEngineConfig(legacy)),
    );
    expect(config).toEqual(original);
    expect((await createLabuiEngine()).fingerprint).toBe(PASSPORT_FINGERPRINT);
    input.config = structuredClone(config);
    input.config.authored.sources.white = '#EEF8FF';
    input.config.authored.static.alpha.primary = 0.9;
    expect((await createLabuiEngine()).fingerprint).toBe(PASSPORT_FINGERPRINT);
  });

  it.each([
    [['authored'], undefined],
    [['authored', 'sources'], null],
    [['authored', 'sources', 'white'], undefined],
    [['authored', 'sources', 'shade'], '#12345Z'],
    [['authored', 'sources', 'white'], '#fff'],
    [['authored', 'sources', 'shade'], 16],
    [['authored', 'static', 'sources', 'light'], 'missing'],
    [['authored', 'overlay', 'sources', 'dark'], '__proto__'],
    [['authored', 'overlay', 'sources', 'light'], undefined],
    [['authored', 'static', 'alpha', 'primary'], -0.1],
    [['authored', 'static', 'alpha', 'secondary'], 1.1],
    [['authored', 'static', 'alpha', 'tertiary'], '0.5'],
    [['authored', 'overlay', 'alpha', 'base'], null],
    [['authored', 'overlay', 'alpha', 'ghost'], Number.NaN],
    [['authored', 'overlay', 'alpha', 'soft'], Number.POSITIVE_INFINITY],
    [['authored', 'overlay', 'alpha', 'strong'], undefined],
  ])('неверный authored input %j = %j явно отклоняется', async (path, value) => {
    input.config = structuredClone(config);
    let parent = input.config;
    for (const key of path.slice(0, -1)) parent = parent[key];
    parent[path.at(-1)] = value;
    await expect(generateContract()).rejects.toThrow(/authored/);
  });
});
