import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { npmCli, packPackage } from './packed-consumer.js';

const core = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const react = resolve(core, '../react');
const execute = promisify(execFile);
interface Manifest {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies?: Record<string, string>;
}
interface Consumer {
  installer: string;
  directory: string;
}
let temporary: string;
let registry: Server | undefined;
const installed: Consumer[] = [];
const roots = ['@labpics/ui-core', '@labpics/ui-react'];

async function declarationFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? declarationFiles(path)
        : Promise.resolve(/\.d\.(?:ts|cts|mts)$/.test(entry.name) ? [path] : []);
    }),
  );
  return files.flat();
}

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'labui-packed-types-'));
  const packages = new Map<string, { directory: string; manifest: Manifest }>();
  for (const entry of await readdir(dirname(core), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(dirname(core), entry.name);
    const manifest: Manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    packages.set(manifest.name, { directory, manifest });
  }
  const artifacts = new Map<
    string,
    { manifest: Manifest; bytes: Buffer; shasum: string; integrity: string }
  >();
  const pending = [...roots];
  for (const name of pending) {
    if (artifacts.has(name)) continue;
    const source = packages.get(name);
    if (!source) throw new Error(`Не найден workspace-пакет ${name}.`);
    const archiveVariable = `LABUI_${name.split('/').at(-1)?.replace(/^ui-/, '').replaceAll('-', '_').toUpperCase()}_TARBALL`;
    const archive =
      process.env[archiveVariable] ??
      (await packPackage(source.directory, join(temporary, 'packs', name)));
    const manifest: Manifest = JSON.parse(
      execFileSync('tar', ['-xOf', archive, 'package/package.json'], {
        encoding: 'utf8',
        windowsHide: true,
      }),
    );
    expect(manifest.name).toBe(name);
    const bytes = await readFile(archive);
    artifacts.set(name, {
      manifest,
      bytes,
      shasum: createHash('sha1').update(bytes).digest('hex'),
      integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    });
    for (const [dependency, version] of Object.entries(source.manifest.dependencies ?? {})) {
      if (version.startsWith('workspace:')) pending.push(dependency);
    }
  }
  let origin: string;
  // Обычной npm/pnpm-резолюции нужны registry metadata приватных workspace-версий.
  registry = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    for (const [name, artifact] of artifacts) {
      const tarball = `/${name}/-/artifact-${artifact.manifest.version}.tgz`;
      if (pathname === tarball) {
        response.setHeader('content-type', 'application/octet-stream');
        response.end(artifact.bytes);
        return;
      }
      if (pathname === `/${name}`) {
        response.setHeader('content-type', 'application/json');
        response.end(
          JSON.stringify({
            name,
            'dist-tags': { latest: artifact.manifest.version },
            versions: {
              [artifact.manifest.version]: {
                ...artifact.manifest,
                dist: {
                  tarball: `${origin}${tarball}`,
                  shasum: artifact.shasum,
                  integrity: artifact.integrity,
                },
              },
            },
          }),
        );
        return;
      }
    }
    response.writeHead(302, { location: `https://registry.npmjs.org${request.url}` });
    response.end();
  });
  await new Promise<void>((resolve) => registry?.listen(0, '127.0.0.1', resolve));
  const address = registry.address();
  if (!address || typeof address === 'string') throw new Error('Registry не открыл TCP-порт.');
  origin = `http://127.0.0.1:${address.port}`;
  const coreManifest: Manifest = JSON.parse(await readFile(join(core, 'package.json'), 'utf8'));
  const reactManifest: Manifest = JSON.parse(await readFile(join(react, 'package.json'), 'utf8'));
  const workspace: { packageManager: string } = JSON.parse(
    await readFile(resolve(core, '../../package.json'), 'utf8'),
  );
  const pnpm = process.env.npm_execpath;
  if (!pnpm) throw new Error('Запустите тест через pnpm, как в CI.');
  for (const installer of ['npm', 'pnpm']) {
    const directory = join(temporary, installer);
    await mkdir(directory);
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({
        name: `labui-packed-types-${installer}`,
        private: true,
        type: 'module',
        packageManager: workspace.packageManager,
        dependencies: {
          ...Object.fromEntries(
            roots.map((name) => {
              const artifact = artifacts.get(name);
              if (!artifact) throw new Error(`Не собран tarball ${name}.`);
              return [name, artifact.manifest.version];
            }),
          ),
          react: reactManifest.devDependencies.react,
          'react-dom': reactManifest.devDependencies['react-dom'],
          '@zag-js/core': coreManifest.dependencies['@zag-js/core'],
          '@zag-js/collection': coreManifest.dependencies['@zag-js/collection'],
          '@lit-labs/ssr': coreManifest.devDependencies['@lit-labs/ssr'],
          '@lit-labs/ssr-client': coreManifest.devDependencies['@lit-labs/ssr-client'],
        },
        devDependencies: {
          typescript: coreManifest.devDependencies.typescript,
          '@types/react': reactManifest.devDependencies['@types/react'],
          '@types/react-dom': reactManifest.devDependencies['@types/react-dom'],
        },
      }),
    );
    await writeFile(join(directory, '.npmrc'), `hoist=false\n@labpics:registry=${origin}\n`);
    await execute(
      process.execPath,
      installer === 'npm'
        ? [await npmCli(), 'install', '--ignore-scripts', '--no-audit', '--no-fund']
        : [
            pnpm,
            'install',
            '--ignore-scripts',
            '--no-frozen-lockfile',
            // Reused localhost ports must not reuse unpublished-version metadata.
            // Immutable tarball content can still use the ordinary pnpm store.
            '--cache-dir',
            join(temporary, 'pnpm-cache'),
          ],
      { cwd: directory, encoding: 'utf8', timeout: 30_000, windowsHide: true },
    );
    installed.push({ installer, directory });
  }
}, 60_000);

afterAll(async () => {
  if (registry) await new Promise<void>((resolve) => registry?.close(() => resolve()));
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

const consumers = [
  {
    name: 'canonical-behaviors',
    source: `
import * as popover from '@labpics/ui-core/behaviors/popover';
import * as combobox from '@labpics/ui-core/behaviors/combobox';
import * as select from '@labpics/ui-core/behaviors/select';
import type { MachineModule, SchemaOf, Service } from '@labpics/ui-core/shared';
import type { Service as CanonicalService } from '@zag-js/core';
import { ListCollection } from '@zag-js/collection';
type Item = {value:string,label:string};
const collection = new ListCollection<Item>({items:[{value:'a',label:'Alpha'}]});
const selectProps: select.Props<Item> = {id:'select',collection};
const comboProps: combobox.Props<Item> = {id:'combobox',collection};
declare const service: popover.Service;
const canonical: CanonicalService<SchemaOf<popover.Service>> = service;
const shared: Service<SchemaOf<popover.Service>> = canonical;
const same: popover.Service = shared;
const module: MachineModule<SchemaOf<popover.Service>,popover.Api> = popover;
const props: popover.Props = {id:'popover',positioning:{placement:'bottom-start'}};
// @ts-expect-error Размещение ограничено публичным поведением.
const invalidPlacement: popover.Props = {id:'invalid',positioning:{placement:'center'}};
// @ts-expect-error Service требует полного контракта поведения.
const invalidService: popover.Service = {};
type PublicCollection = {[K in keyof typeof collection]:(typeof collection)[K]};
declare const copy: PublicCollection;
// @ts-expect-error Копия публичных полей не имеет canonical private identity.
const invalidCollection: typeof collection = copy;
void [selectProps,comboProps,canonical,shared,same,module,props,invalidPlacement,invalidService,invalidCollection];
`,
  },
  {
    name: 'core-root',
    source: `
import { LabElement, ZagController, litVar, type LabInputSize } from '@labpics/ui-core';
const size: LabInputSize = 'm';
void [LabElement, ZagController, litVar, size];
`,
  },
  {
    name: 'core-component',
    source: `
import { LabCombobox, filterComboboxItems, type LabComboboxItem } from '@labpics/ui-core/combobox';
const items: LabComboboxItem[] = [{value:'a',label:'Alpha'}];
filterComboboxItems(items, 'a');
void LabCombobox;
`,
  },
  {
    name: 'core-sheet',
    source: `
import { LabSheet, type LabSheetPosition, type SheetPositionChangeDetails, type SheetMotionErrorDetails } from '@labpics/ui-core/sheet';
const sheet: LabSheet = document.createElement('lab-sheet');
const position: LabSheetPosition = 'two-thirds';
sheet.open = true;
sheet.position = position;
sheet.modal = 'false';
const updated: Promise<boolean> = sheet.updateComplete;
const construct: { new(): HTMLElement } = LabSheet;
const changed: SheetPositionChangeDetails = { position };
const failed: SheetMotionErrorDetails = { error: new Error('Движение отменено') };
// @ts-expect-error Позиции ограничены публичным контрактом.
sheet.position = 'three-fourths';
// @ts-expect-error Sheet не наследует размер Dialog.
sheet.size = 'm';
void [LabSheet, changed, failed, updated, construct];
`,
  },
  {
    name: 'shared',
    source: `
import { cssVar, filterComboboxItems, type LabComboboxItem } from '@labpics/ui-core/shared';
const items: LabComboboxItem[] = [{value:'a',label:'Alpha'}];
cssVar('--lab-label-primary');
filterComboboxItems(items, 'a');
`,
  },
  {
    name: 'core-ssr',
    source: `
import { html, ifDefined, noChange, unsafeHTML, renderToString, type TemplateResult } from '@labpics/ui-core/ssr';
const template: TemplateResult = html\`<div data-label=\${ifDefined(undefined)}>\${unsafeHTML('<span>content</span>')}</div>\`;
const markup: string = renderToString(template);
void [html, ifDefined, noChange, unsafeHTML, renderToString, markup];
`,
  },
  {
    name: 'core-class-identity',
    source: `
import { LabElement } from '@labpics/ui-core';
import { LabButton } from '@labpics/ui-core/button';
const constructor: new () => LabElement = LabButton;
const instance: LabButton = new LabButton();
const base: LabElement = instance;
const registered: LabButton = document.createElement('lab-button');
class Derived extends LabButton {}
const derived: LabElement = new Derived();
type PublicButton = { [K in keyof LabButton]: LabButton[K] };
declare const copy: PublicButton;
// @ts-expect-error Копия публичных свойств не имеет private identity Core class.
const invalid: LabButton = copy;
void [constructor, instance, base, registered, derived, invalid];
`,
  },
  {
    name: 'dialog-behavior',
    source: `
import * as dialog from '@labpics/ui-core/behaviors/dialog';
import type { MachineModule, SchemaOf } from '@labpics/ui-core';
type DialogSchema = SchemaOf<dialog.Service>;
const module: MachineModule<DialogSchema, dialog.Api> = dialog;
const props: dialog.Props = { id: 'consumer-dialog', triggerEl: () => document.createElement('button') };
// @ts-expect-error Ссылка на trigger не принимает произвольное значение.
const invalid: dialog.Props = { id: 'consumer-dialog', triggerEl: 'trigger' };
void [module, props, invalid];
`,
  },
  {
    name: 'react-root',
    source: `
import { Input, type InputProps } from '@labpics/ui-react';
const props: InputProps = {label:'Name',size:'m'};
void [Input, props];
`,
  },
  {
    name: 'react-component',
    source: `
import { Input, type InputProps } from '@labpics/ui-react/input';
const props: InputProps = {label:'Name',size:'m'};
void [Input, props];
`,
  },
  {
    name: 'react-dialog',
    source: `
import { Dialog, type DialogProps } from '@labpics/ui-react/dialog';
import { AlertDialog, type AlertDialogProps } from '@labpics/ui-react/alert-dialog';
const dialog: DialogProps = { heading: 'Параметры', content: 'Действие' };
const alert: AlertDialogProps = { heading: 'Подтверждение', content: 'Действие' };
// @ts-expect-error Потребитель компонента не управляет внутренним DOM binding.
const invalid: DialogProps = { triggerEl: () => document.createElement('button') };
void [Dialog, AlertDialog, dialog, alert, invalid];
`,
  },
];

describe('публичный tarball: декларации соответствуют формату потребителя', () => {
  for (const installer of ['npm', 'pnpm']) {
    it(`${installer}: публичные DTS imports имеют dependency у владельца`, async () => {
      const consumer = installed.find((item) => item.installer === installer);
      if (!consumer) throw new Error('Потребитель не установлен.');
      const directory = join(consumer.directory, 'node_modules/@labpics/ui-core');
      const manifest: Manifest = JSON.parse(
        await readFile(join(directory, 'package.json'), 'utf8'),
      );
      const dependencies = { ...manifest.dependencies, ...manifest.peerDependencies };
      const files = await declarationFiles(join(directory, 'dist'));
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const imports = ts.preProcessFile(await readFile(file, 'utf8')).importedFiles;
        for (const { fileName } of imports) {
          if (/^[.#/]|^node:/.test(fileName)) continue;
          const name = fileName
            .split('/')
            .slice(0, fileName.startsWith('@') ? 2 : 1)
            .join('/');
          if (name === manifest.name) continue;
          expect(dependencies[name], `${file} imports undeclared ${name}`).toBeDefined();
        }
      }
    });
    for (const extension of ['mts', 'cts']) {
      it(`${installer}: ${extension} компилируется в strict NodeNext`, async () => {
        const consumer = installed.find((item) => item.installer === installer);
        if (!consumer) throw new Error('Потребитель не установлен.');
        const files = await Promise.all(
          consumers.map(async ({ name, source }) => {
            const file = join(consumer.directory, `${name}.${extension}`);
            await writeFile(file, source);
            return file;
          }),
        );
        // Один compiler program проверяет общий граф типов root и subpaths.
        const result = spawnSync(
          process.execPath,
          [
            join(consumer.directory, 'node_modules/typescript/lib/tsc.js'),
            '--noEmit',
            '--strict',
            '--target',
            'es2022',
            '--lib',
            'es2022,dom,dom.iterable',
            '--esModuleInterop',
            '--module',
            'nodenext',
            '--moduleResolution',
            'nodenext',
            ...files,
          ],
          { cwd: consumer.directory, encoding: 'utf8', timeout: 20_000, windowsHide: true },
        );
        expect(result.error, result.stderr).toBeUndefined();
        expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      }, 25_000);
    }
  }
});
