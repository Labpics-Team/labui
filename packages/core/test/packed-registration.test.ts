import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bundleConsumer, executeBrowser, packedConsumer } from './packed-consumer.js';

// CI собирает workspace до pnpm test. Проверяем exports распакованного tarball,
// а зависимости берём из того же lockfile; исходники core не подменяют пакет.
const core = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shadow = resolve(core, '../shadow');
let temporary: string;
let consumer: string;
let names: string[];

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'labui-packed-registration-'));
  const packed = await packedConsumer(temporary, {
    '@labpics/ui-core': { directory: core, archive: process.env.LABUI_CORE_TARBALL },
    '@labpics/ui-shadow': { directory: shadow, archive: process.env.LABUI_SHADOW_TARBALL },
  });
  consumer = packed.directory;
  const packedCore = join(consumer, 'node_modules/@labpics/ui-core');
  const wildcard = packed.metadata['@labpics/ui-core']?.exports['./*'];
  if (typeof wildcard !== 'object' || wildcard === null) {
    throw new Error('Пакет не экспортирует отдельные компоненты через wildcard.');
  }
  const importTarget: unknown = Reflect.get(wildcard, 'import');
  const pattern: unknown =
    typeof importTarget === 'object' && importTarget !== null
      ? Reflect.get(importTarget, 'default')
      : importTarget;
  if (typeof pattern !== 'string') throw new Error('Отсутствует ESM wildcard компонентов.');
  const [prefix, suffix] = pattern.split('*');
  if (prefix === undefined || suffix === undefined) {
    throw new Error('Пакет не экспортирует отдельные компоненты через wildcard.');
  }
  names = (await readdir(join(packedCore, prefix), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  // Пустой или усечённый пакет не превращает цикл в ложный GREEN.
  expect(names).toEqual(
    expect.arrayContaining([
      'accordion',
      'alert-dialog',
      'avatar',
      'badge',
      'breadcrumb',
      'button',
      'card',
      'checkbox',
      'combobox',
      'dialog',
      'input',
      'kbd',
      'loader',
      'menu',
      'number-input',
      'pagination',
      'pin-input',
      'popover',
      'progress',
      'radio-group',
      'select',
      'slider',
      'sheet',
      'switch',
      'tabs',
      'tags-input',
      'textarea',
      'tooltip',
    ]),
  );
  for (const name of names) await readFile(join(packedCore, `${prefix}${name}${suffix}`));
}, 60_000);

afterAll(async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

describe('публичный tarball: независимые потребители', () => {
  it('каждый отдельный bare component import регистрирует свой элемент', async () => {
    for (const name of names) {
      const tag = `lab-${name}`;
      const { code } = await bundleConsumer(consumer, `import '@labpics/ui-core/${name}';`);
      await executeBrowser(code, (window, registered) => {
        expect.soft(registered, `bare import @labpics/ui-core/${name}`).toContain(tag);
        const elementClass = window.customElements.get(tag);
        if (elementClass) expect(window.document.createElement(tag)).toBeInstanceOf(elementClass);
      });
    }
  }, 30_000);

  it.each([
    {
      name: 'setTheme',
      source:
        "import {setTheme} from '@labpics/ui-core';setTheme(document.documentElement,'dark');globalThis.result=document.documentElement.getAttribute('data-theme');",
      expected: 'dark',
    },
    {
      name: 'filterComboboxItems',
      source:
        "import {filterComboboxItems} from '@labpics/ui-core';globalThis.result=filterComboboxItems([{value:'a',label:'Alpha'},{value:'b',label:'Beta'}],' ALP ').map(item=>item.value);",
      expected: ['a'],
    },
    {
      name: 'tagsInputTranslations',
      source:
        "import {tagsInputTranslations} from '@labpics/ui-core';globalThis.result=tagsInputTranslations.deleteTagTriggerLabel('tag');",
      expected: 'Delete tag',
    },
  ])(
    '$name работает без регистрации компонентов и загрузки Lit runtime',
    async ({ source, expected }) => {
      const { code } = await bundleConsumer(consumer, source);
      await executeBrowser(code, (window, registered) => {
        expect(Reflect.get(window, 'result')).toEqual(expected);
        expect(registered).toEqual([]);
        expect(Reflect.get(window, 'litHtmlVersions')).toBeUndefined();
        expect(Reflect.get(window, 'litElementVersions')).toBeUndefined();
      });
    },
  );
});
