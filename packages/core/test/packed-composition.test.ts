import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
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
const repository = resolve(core, '../..');
let temporary: string;
let consumer: string;
let sourceProbe: Awaited<ReturnType<typeof bundleConsumer>> | Error;

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'labui-packed-composition-'));
  const fixture = join(temporary, 'producer');
  const fixtureCore = join(fixture, 'packages/core');
  const source = process.env.LABUI_PRODUCER_ROOT ?? repository;
  await mkdir(fixtureCore, { recursive: true });
  // Полная штатная конфигурация, включая discovery, два формата и DTS.
  // Меняем только две зависимости между настоящими компонентами в своей копии.
  for (const path of [
    'package.json',
    'pnpm-workspace.yaml',
    'tsup.config.base.ts',
    'tsconfig.base.json',
  ]) {
    await cp(join(source, path), join(fixture, path));
  }
  for (const path of [
    'src',
    'scripts',
    'types',
    'package.json',
    'tsup.config.ts',
    'tsconfig.json',
  ]) {
    await cp(join(source, 'packages/core', path), join(fixtureCore, path), { recursive: true });
  }
  await mkdir(join(fixture, 'packages/shadow'), { recursive: true });
  await cp(
    join(source, 'packages/shadow/package.json'),
    join(fixture, 'packages/shadow/package.json'),
  );
  await symlink(join(repository, 'node_modules'), join(fixture, 'node_modules'), 'junction');
  await symlink(join(core, 'node_modules'), join(fixtureCore, 'node_modules'), 'junction');
  for (const [parent, child] of [
    ['avatar', 'badge'],
    ['badge', 'kbd'],
  ]) {
    const file = join(fixtureCore, `src/components/${parent}/lab-${parent}.ts`);
    await writeFile(file, `import '@labpics/ui-core/${child}';\n${await readFile(file, 'utf8')}`);
  }

  // dist ещё не существует: успех не может прийти из прежней сборки /shared.
  try {
    sourceProbe = await bundleConsumer(
      fixtureCore,
      `
import { filterComboboxItems, tagsInputTranslations } from '@labpics/ui-core/shared';
globalThis.result = {
  filtered: filterComboboxItems([{value:'a',label:'Alpha'}], 'alp').map(item => item.value),
  label: tagsInputTranslations.deleteTagTriggerLabel('tag'),
};`,
      join(fixture, 'tsconfig.base.json'),
    );
  } catch (error) {
    sourceProbe = error instanceof Error ? error : new Error(String(error));
  }

  const pnpm = process.env.npm_execpath;
  if (!pnpm) throw new Error('Запустите тест через pnpm, как в CI.');
  execFileSync(process.execPath, [pnpm, 'run', 'build'], {
    cwd: fixtureCore,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  });
  const packed = await packedConsumer(
    temporary,
    {
      '@labpics/ui-core': { directory: fixtureCore },
      '@labpics/ui-shadow': {
        directory: resolve(core, '../shadow'),
        archive: process.env.LABUI_SHADOW_TARBALL,
      },
    },
    process.env.LABUI_COMPOSITION_EVIDENCE,
  );
  consumer = packed.directory;
}, 150_000);

afterAll(async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

describe('настоящие компоненты: публичное вложение Avatar → Badge → Kbd', () => {
  it('shared разрешается из исходников до первой сборки', async () => {
    if (sourceProbe instanceof Error) throw sourceProbe;
    expect(litModules(sourceProbe.emitted)).toEqual([]);
    await executeBrowser(sourceProbe.code, (window, registered) => {
      expect(Reflect.get(window, 'result')).toEqual({ filtered: ['a'], label: 'Delete tag' });
      expect(registered).toEqual([]);
    });
  });

  for (const format of ['esm', 'cjs']) {
    for (const [name, expected] of [
      ['avatar', ['lab-avatar', 'lab-badge', 'lab-kbd']],
      ['badge', ['lab-badge', 'lab-kbd']],
      ['kbd', ['lab-kbd']],
      ['button', ['lab-button']],
    ] as const) {
      it(`${format}: bare ${name} сохраняет только нужные регистрации`, async () => {
        const source =
          format === 'esm'
            ? `import '@labpics/ui-core/${name}';`
            : `require('@labpics/ui-core/${name}');`;
        const { code } = await bundleConsumer(consumer, source);
        await executeBrowser(code, (_window, registered) => {
          expect(registered.sort()).toEqual(expected);
        });
      });
    }

    for (const order of [
      ['avatar', 'badge', 'kbd'],
      ['kbd', 'badge', 'avatar'],
    ]) {
      it(`${format}: порядок ${order.join(' → ')} сохраняет конструкторы`, async () => {
        const source = `${order
          .map((name) =>
            format === 'esm'
              ? `import * as ${name} from '@labpics/ui-core/${name}';`
              : `const ${name} = require('@labpics/ui-core/${name}');`,
          )
          .join('\n')}
${format === 'esm' ? "import * as again from '@labpics/ui-core/avatar';" : "const again = require('@labpics/ui-core/avatar');"}
globalThis.result = {
  avatar: avatar.LabAvatar === customElements.get('lab-avatar'),
  badge: badge.LabBadge === customElements.get('lab-badge'),
  kbd: kbd.LabKbd === customElements.get('lab-kbd'),
  repeated: again.LabAvatar === avatar.LabAvatar,
};`;
        const expected = { avatar: true, badge: true, kbd: true, repeated: true };
        const { code } = await bundleConsumer(consumer, source);
        await executeBrowser(code, (window, registered) => {
          expect(Reflect.get(window, 'result')).toEqual(expected);
          expect(registered.sort()).toEqual(['lab-avatar', 'lab-badge', 'lab-kbd']);
          for (const tag of ['lab-avatar', 'lab-badge', 'lab-kbd']) {
            const elementClass = window.customElements.get(tag);
            expect(elementClass).toBeDefined();
            if (elementClass)
              expect(window.document.createElement(tag)).toBeInstanceOf(elementClass);
          }
        });
        if (format === 'cjs') {
          const direct = executeRequire(consumer, source);
          expect(direct.result).toEqual(expected);
          expect(direct.registered.sort()).toEqual(['lab-avatar', 'lab-badge', 'lab-kbd']);
          expect(ssrModules(direct.loaded)).toEqual([]);
        }
      });
    }
  }
});
