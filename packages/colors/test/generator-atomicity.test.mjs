import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  config: null,
  reference: null,
  referenceReads: 0,
  events: [],
}));
vi.mock('node:fs/promises', async (original) => {
  const fs = await original();
  return {
    ...fs,
    readFile(path, ...args) {
      const name = String(path).replaceAll('\\', '/');
      if (name.endsWith('/colors/labui.config.json') && boundary.config !== null) {
        return Promise.resolve(JSON.stringify(boundary.config));
      }
      if (name.endsWith('/colors/figma-reference.css')) {
        boundary.referenceReads++;
        if (boundary.reference !== null) return Promise.resolve(boundary.reference);
      }
      return fs.readFile(path, ...args);
    },
    writeFile: async (path, value, options) => {
      boundary.events.push({ op: 'write', path, value, options });
    },
    rename: async (from, to) => {
      boundary.events.push({ op: 'rename', from, to });
    },
    rm: async (path, options) => {
      boundary.events.push({ op: 'rm', path, options });
    },
  };
});

const fs = await vi.importActual('node:fs/promises');
const here = dirname(fileURLToPath(import.meta.url));
const generatorPath = join(here, '..', 'generate-contract.mjs');
const contractPath = join(here, '..', 'contract.css');
const referencePath = join(here, '..', 'figma-reference.css');
const config = JSON.parse(await fs.readFile(join(here, '..', 'labui.config.json'), 'utf8'));
const reference = await fs.readFile(referencePath, 'utf8');
const originalArg = process.argv[1];

beforeEach(() => {
  vi.resetModules();
  boundary.config = null;
  boundary.reference = null;
  boundary.referenceReads = 0;
  boundary.events = [];
});
afterEach(() => {
  process.argv[1] = originalArg;
});

describe('публикация общего результата', () => {
  it('реальный CLI не создаёт даже временный CSS при нерешённом обязательстве', async () => {
    boundary.config = structuredClone(config);
    boundary.config.policy.contrast = 'unresolved';
    process.argv[1] = generatorPath;
    await expect(import('../generate-contract.mjs')).rejects.toMatchObject({
      code: 'LABUI_COLORS_NOT_READY',
    });
    expect(boundary.events).toEqual([]);
  });

  it('CLI сначала записывает полный CSS, затем заменяет целевой файл', async () => {
    process.argv[1] = generatorPath;
    await import('../generate-contract.mjs');
    expect(boundary.events.map((event) => event.op)).toEqual(['write', 'rename', 'rm']);
    const [write, rename] = boundary.events;
    expect(write.path).not.toBe(contractPath);
    expect(write.options).toEqual({ flag: 'wx' });
    expect(rename).toEqual({ op: 'rename', from: write.path, to: contractPath });
    expect(write.value).toContain('[data-theme="light"]');
    expect(write.value).toContain('[data-theme="dark"]');
    expect(write.value).toContain('@media (prefers-color-scheme: dark)');
    // Проверка полного словаря/значений принадлежит program-boundary,
    // здесь проверяется граница эффекта и порядок публикации.
  });

  it.each(['удаление', 'подмена', 'перестановка'])(
    '%s reference не влияет на генерацию',
    async (operation) => {
      const { generateContract } = await import('../generate-contract.mjs');
      const baseline = await generateContract();
      boundary.reference =
        operation === 'удаление'
          ? ''
          : operation === 'подмена'
            ? ':root { --lab-injected: rgb(9 8 7); }'
            : reference.split('\n').reverse().join('\n');
      expect(boundary.reference).not.toBe(reference);
      expect(await generateContract()).toBe(baseline);
      expect(boundary.referenceReads).toBe(0);
      expect(await fs.readFile(referencePath, 'utf8')).toBe(reference);
    },
  );
});
