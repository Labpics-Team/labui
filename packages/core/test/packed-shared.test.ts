import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bundleConsumer,
  executeBrowser,
  executeRequire,
  litModules,
  packedConsumer,
  ssrModules,
} from './packed-consumer.js';

const core = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let temporary: string;
let consumer: string;

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'labui-packed-shared-'));
  const packed = await packedConsumer(temporary, {
    '@labpics/ui-core': { directory: core, archive: process.env.LABUI_CORE_TARBALL },
    '@labpics/ui-shadow': {
      directory: resolve(core, '../shadow'),
      archive: process.env.LABUI_SHADOW_TARBALL,
    },
    '@labpics/ui-react': {
      directory: resolve(core, '../react'),
      archive: process.env.LABUI_REACT_TARBALL,
    },
  });
  consumer = packed.directory;
}, 60_000);

afterAll(async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

describe('публичные порты общих функций', () => {
  it.each(['@labpics/ui-core', '@labpics/ui-core/shared'])(
    '%s: прямой CJS сохраняет полезный результат без регистрации и SSR',
    (entry) => {
      const result = executeRequire(
        consumer,
        `
const helpers = require(${JSON.stringify(entry)});
globalThis.result = helpers.filterComboboxItems([{value:'a',label:'Alpha'},{value:'b',label:'Beta'}], ' ALP ').map(item => item.value);
`,
      );
      expect(result.result).toEqual(['a']);
      expect(result.registered).toEqual([]);
      expect(ssrModules(result.loaded)).toEqual([]);
      // Смешанный root экспортирует LabElement: его Node Lit/DOMshim разрешены.
      if (entry.endsWith('/shared')) {
        expect(result.lit).toBe(false);
        expect(litModules(result.loaded)).toEqual([]);
      }
    },
  );

  it.each(['esm', 'cjs'])('%s: root и shared отдают те же объекты функций', async (format) => {
    const imports =
      format === 'esm'
        ? "import * as root from '@labpics/ui-core'; import * as shared from '@labpics/ui-core/shared';"
        : "const root = require('@labpics/ui-core'); const shared = require('@labpics/ui-core/shared');";
    const source = `${imports}
const names = Object.keys(shared).filter(name => name in root);
globalThis.result = { names, same: names.every(name => root[name] === shared[name]) };
`;
    if (format === 'cjs') {
      const result = executeRequire(consumer, source);
      expect(result.result).toEqual({
        names: expect.arrayContaining([
          'fieldPartIds',
          'filterComboboxItems',
          'tagsInputTranslations',
        ]),
        same: true,
      });
      expect(result.registered).toEqual([]);
      expect(ssrModules(result.loaded)).toEqual([]);
    } else {
      const { code } = await bundleConsumer(consumer, source);
      await executeBrowser(code, (window, registered) => {
        expect(Reflect.get(window, 'result')).toEqual({
          names: expect.arrayContaining([
            'fieldPartIds',
            'filterComboboxItems',
            'tagsInputTranslations',
          ]),
          same: true,
        });
        expect(registered).toEqual([]);
      });
    }
  });

  it.each(['esm', 'cjs'])(
    '%s: публичные компонентные порты сохраняют идентичность helpers',
    async (format) => {
      const entries = [
        ['shared', '@labpics/ui-core/shared'],
        ['tags', '@labpics/ui-core/tags-input'],
        ['combobox', '@labpics/ui-core/combobox'],
      ];
      const source = `${entries
        .map(([name, entry]) =>
          format === 'esm'
            ? `import * as ${name} from '${entry}';`
            : `const ${name} = require('${entry}');`,
        )
        .join('\n')}
globalThis.result = {
  translations: tags.tagsInputTranslations === shared.tagsInputTranslations,
  filter: combobox.filterComboboxItems === shared.filterComboboxItems,
};`;
      if (format === 'cjs') {
        const result = executeRequire(consumer, source);
        expect(result.result).toEqual({ translations: true, filter: true });
        expect(result.registered.sort()).toEqual(['lab-combobox', 'lab-tags-input']);
        expect(ssrModules(result.loaded)).toEqual([]);
      } else {
        const { code } = await bundleConsumer(consumer, source);
        await executeBrowser(code, (window, registered) => {
          expect(Reflect.get(window, 'result')).toEqual({ translations: true, filter: true });
          expect(registered.sort()).toEqual(['lab-combobox', 'lab-tags-input']);
        });
      }
    },
  );
});

describe('React: настоящий require-порт не загружает Lit', () => {
  for (const [entry, expectedExport] of [
    ['@labpics/ui-react', 'Input'],
    ['@labpics/ui-react/input', 'Input'],
    ['@labpics/ui-react/combobox', 'Combobox'],
    ['@labpics/ui-react/tags-input', 'TagsInput'],
  ]) {
    const source = `const component = require(${JSON.stringify(entry)});
globalThis.result = component[${JSON.stringify(expectedExport)}] != null;`;

    it(`${entry}: прямой Node CJS`, () => {
      const result = executeRequire(consumer, source);
      expect(result.result).toBe(true);
      expect(result.registered).toEqual([]);
      expect(result.lit).toBe(false);
      expect(litModules(result.loaded)).toEqual([]);
      expect(ssrModules(result.loaded)).toEqual([]);
    });

    it(`${entry}: CJS после browser bundling`, async () => {
      const { code, emitted } = await bundleConsumer(consumer, source);
      expect(litModules(emitted)).toEqual([]);
      await executeBrowser(code, (window, registered) => {
        expect(Reflect.get(window, 'result')).toBe(true);
        expect(registered).toEqual([]);
        expect(Reflect.get(window, 'litHtmlVersions')).toBeUndefined();
        expect(Reflect.get(window, 'litElementVersions')).toBeUndefined();
      });
    });
  }
});
