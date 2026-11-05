import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { litModules, packPackage, ssrModules } from './packed-consumer.js';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = process.env.LABUI_PACKED_REACT_SHEET_EVIDENCE;
let temporary: string;
let consumer: string;

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'labui-packed-react-sheet-'));
  consumer = join(temporary, 'consumer');
  await mkdir(consumer);
  const dependencies: Record<string, string> = { react: '18.3.1', 'react-dom': '18.3.1' };
  const artifacts = [];
  for (const [folder, name] of [
    ['core', '@labpics/ui-core'],
    ['react', '@labpics/ui-react'],
    ['materials', '@labpics/ui-materials'],
    ['tokens', '@labpics/ui-tokens'],
    ['shadow', '@labpics/ui-shadow'],
    ['colors', '@labui/colors'],
  ]) {
    if (!folder || !name) throw new Error('Не задан пакет installed consumer.');
    const archive = await packPackage(
      join(repository, 'packages', folder),
      join(temporary, 'packs', folder),
    );
    dependencies[name] = `file:${archive.replaceAll('\\', '/')}`;
    const sha256 = createHash('sha256')
      .update(await readFile(archive))
      .digest('hex');
    artifacts.push({ name, archive, sha256 });
    if (evidence) {
      await mkdir(evidence, { recursive: true });
      await cp(archive, join(evidence, `${folder}.tgz`));
    }
  }
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'labui-packed-react-sheet-consumer',
      private: true,
      type: 'module',
      dependencies,
      devDependencies: {
        typescript: '5.7.3',
        '@types/react': '18.3.18',
        '@types/react-dom': '18.3.5',
      },
    }),
  );
  const install = ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--global=false'];
  execFileSync(
    process.platform === 'win32' ? 'cmd.exe' : 'npm',
    process.platform === 'win32' ? ['/d', '/s', '/c', `npm.cmd ${install.join(' ')}`] : install,
    { cwd: consumer, encoding: 'utf8', windowsHide: true, timeout: 60_000 },
  );
  for (const name of [
    '@labpics/ui-core',
    '@labpics/ui-react',
    '@zag-js/dialog',
    '@zag-js/dom-query',
    '@zag-js/aria-hidden',
    'typescript',
  ]) {
    expect((await lstat(join(consumer, 'node_modules', name))).isSymbolicLink()).toBe(false);
  }
  if (evidence) {
    await writeFile(
      join(evidence, 'consumer.json'),
      JSON.stringify({ consumer, node: process.version, artifacts }, null, 2),
    );
    await cp(join(consumer, 'package.json'), join(evidence, 'package.json'));
    await cp(join(consumer, 'package-lock.json'), join(evidence, 'package-lock.json'));
  }
}, 120_000);

afterAll(async () => {
  if (!temporary || evidence) return;
  const withinTemporary = relative(resolve(tmpdir()), resolve(temporary));
  if (
    withinTemporary.startsWith('..') ||
    !withinTemporary.startsWith('labui-packed-react-sheet-')
  ) {
    throw new Error('Installed consumer находится вне каталога этого запуска.');
  }
  await rm(temporary, { recursive: true, force: true });
});

describe('installed native React Sheet', () => {
  it.each(['esm', 'cjs'])(
    '%s: public Sheet SSR renders its React trigger without Lit',
    async (format) => {
      const imports =
        format === 'esm'
          ? "const { Sheet } = await import('./node_modules/@labpics/ui-react/dist/sheet.js'); const { Sheet: RootSheet } = await import('./node_modules/@labpics/ui-react/dist/index.js');"
          : "const { Sheet } = require('@labpics/ui-react/sheet'); const { Sheet: RootSheet } = require('@labpics/ui-react');";
      const source = `
const assert = ${format === 'esm' ? "(await import('node:assert/strict')).default" : "require('node:assert/strict')"};
const registered = [];
globalThis.customElements = { get() {}, define(name) { registered.push(name); } };
const { createElement } = ${format === 'esm' ? "await import('react')" : "require('react')"};
const { renderToString } = ${format === 'esm' ? "await import('react-dom/server')" : "require('react-dom/server')"};
const warnings = [];
console.error = (...args) => warnings.push(args.join(' '));
${imports}
for (const component of [Sheet, RootSheet]) for (const state of [{}, {defaultOpen: true}, {open: true}]) {
  const html = renderToString(createElement(component, {
    ...state, heading: createElement('em', null, 'Heading'),
    content: createElement('button', {onClick() {}}, 'Client body'),
  }, createElement('strong', null, 'React trigger')));
  assert(html.includes('<strong>React trigger</strong>'));
  assert(!html.includes('Client body') && !html.includes('lab-sheet-positioner'));
}
assert.throws(() => renderToString(createElement(Sheet, {position: '50%'})), TypeError);
assert.deepEqual(warnings, []);
assert.deepEqual(registered, []);
assert(!globalThis.litHtmlVersions && !globalThis.litElementVersions);
process.stdout.write(JSON.stringify({warnings, registered, node: process.version, loaded: ${format === 'cjs' ? 'Object.keys(require.cache)' : '[]'}}));
`;
      const result = JSON.parse(
        execFileSync(
          process.execPath,
          [`--input-type=${format === 'esm' ? 'module' : 'commonjs'}`, '-e', source],
          {
            cwd: consumer,
            encoding: 'utf8',
            windowsHide: true,
            timeout: 20_000,
          },
        ),
      );
      expect(litModules(result.loaded)).toEqual([]);
      expect(ssrModules(result.loaded)).toEqual([]);
      if (evidence)
        await writeFile(join(evidence, `ssr-${format}.json`), JSON.stringify(result, null, 2));
    },
  );

  it.each(['mts', 'cts'])(
    '%s: TypeScript5.7.3 checks finite positions and closed implementation props',
    async (extension) => {
      const source = `
import { Sheet, type SheetProps, type LabSheetPosition } from '@labpics/ui-react/sheet';
import { parseSheetPosition, sheetGeometry, type SheetGeometry } from '@labpics/ui-core/shared';
import { mountSheetMotion, type SheetMotion, type SheetMotionOptions } from '@labpics/ui-core/motion';
import { createElement } from 'react';
const position: LabSheetPosition = 'two-thirds';
const props: SheetProps = {
  position, defaultPosition: 'half', open: true, defaultOpen: false, modal: true, closable: false,
  heading: createElement('em', null, 'Heading'), description: 'Description',
  content: createElement('button', { onClick: () => {} }, 'React action'), 'aria-label': 'Panel',
  onOpenChange: (value: boolean) => {},
  onPositionChange: (value: LabSheetPosition) => {},
  onMotionError: (error: unknown) => {},
};
createElement(Sheet, props, 'Open');
const geometry: SheetGeometry = sheetGeometry(812, 32, {full: 776, 'two-thirds': 540, 'one-third': 270, flex: 40});
parseSheetPosition(position);
const mount: (frame: HTMLElement, handle: HTMLElement, observed: readonly Element[], options: SheetMotionOptions) => SheetMotion = mountSheetMotion;
// @ts-expect-error A percentage is not a LabUI position.
const invalid: SheetProps = {position: '50%'};
// @ts-expect-error Internal geometry is owned by Core.
const geometryOverride: SheetProps = {readGeometry: () => geometry};
// @ts-expect-error Internal machine DOM refs are not caller props.
const triggerOverride: SheetProps = {triggerEl: () => document.body};
// @ts-expect-error Sheet has the dialog role; AlertDialog owns alertdialog.
const roleOverride: SheetProps = {role: 'alertdialog'};
void [invalid, geometryOverride, triggerOverride, roleOverride, mount];
`;
      const file = join(consumer, `sheet-contract.${extension}`);
      await writeFile(file, source);
      const requireConsumer = createRequire(join(consumer, 'package.json'));
      let output: string;
      try {
        output = execFileSync(
          process.execPath,
          [
            requireConsumer.resolve('typescript/lib/tsc.js'),
            '--noEmit',
            '--strict',
            '--module',
            'NodeNext',
            '--moduleResolution',
            'NodeNext',
            '--target',
            'ES2022',
            '--lib',
            'ES2022,DOM',
            file,
          ],
          { cwd: consumer, encoding: 'utf8', windowsHide: true, timeout: 30_000 },
        );
      } catch (error) {
        const diagnostics =
          error instanceof Error && 'stdout' in error ? String(error.stdout) : String(error);
        throw new Error(diagnostics, { cause: error });
      }
      expect(output).toBe('');
      if (evidence) await cp(file, join(evidence, `sheet-contract.${extension}`));
    },
  );

  it.each(['esm', 'cjs'])(
    '%s: per-component browser bundle uses installed Core owners without Lit or registration',
    async (format) => {
      const source =
        format === 'esm'
          ? "import { Sheet } from '@labpics/ui-react/sheet'; globalThis.Sheet = Sheet;"
          : "globalThis.Sheet = require('@labpics/ui-react/sheet').Sheet;";
      const result = await build({
        stdin: { contents: source, resolveDir: consumer },
        platform: 'browser',
        bundle: true,
        format: 'iife',
        write: false,
        metafile: true,
      });
      const emitted = Object.values(result.metafile.outputs).flatMap((output) =>
        Object.entries(output.inputs)
          .filter(([, item]) => item.bytesInOutput > 0)
          .map(([name]) => name),
      );
      expect(litModules(emitted)).toEqual([]);
      expect(ssrModules(emitted)).toEqual([]);
      expect(
        emitted.some((name) => name.replaceAll('\\', '/').includes('/packages/react/src/')),
      ).toBe(false);
      expect(
        emitted.some((name) => name.replaceAll('\\', '/').includes('/ui-core/dist/components/')),
      ).toBe(false);
      expect(
        emitted.some((name) =>
          name.replaceAll('\\', '/').includes('/ui-core/dist/behaviors/dialog'),
        ),
      ).toBe(true);
      const code = result.outputFiles[0]?.text;
      expect(code).toBeDefined();
      expect(code).not.toMatch(/customElements\.define\(/);
      if (evidence) {
        await writeFile(join(evidence, `browser-${format}.js`), code ?? '');
        await writeFile(
          join(evidence, `browser-${format}-metafile.json`),
          JSON.stringify(result.metafile, null, 2),
        );
      }
    },
  );
});
