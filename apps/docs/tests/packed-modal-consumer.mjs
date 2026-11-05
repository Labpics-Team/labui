import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const docs = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(docs, '../..');
const temporary = await mkdtemp(join(tmpdir(), 'labui-packed-modal-'));
const consumer = join(temporary, 'consumer');
const evidence = process.env.LABUI_PACKED_MODAL_EVIDENCE
  ? resolve(process.env.LABUI_PACKED_MODAL_EVIDENCE)
  : join(temporary, 'evidence');
const pnpm = process.env.npm_execpath;
assert(pnpm, 'Запустите test:packed-modal через pnpm run.');
const packages = [
  ['core', '@labpics/ui-core'],
  ['react', '@labpics/ui-react'],
  ['vue', '@labpics/ui-vue'],
  ['solid', '@labpics/ui-solid'],
  ['materials', '@labpics/ui-materials'],
  ['tokens', '@labpics/ui-tokens'],
  ['shadow', '@labpics/ui-shadow'],
  ['colors', '@labui/colors'],
];
const specifications = [
  'modal-composition.spec.ts',
  'modal-layer-composition.spec.ts',
  'modal-public-composition.spec.ts',
  'modal-sibling-ownership.spec.ts',
  'modal-early-dismiss.spec.ts',
  'sheet-motion-errors.spec.ts',
  'sheet-disconnect-errors.spec.ts',
  'sheet-error-focus.spec.ts',
  'packed-react-sheet-focus.mjs',
  'dialog.spec.ts',
  'alert-dialog.spec.ts',
];
const fixtureNames = [
  '_fixtures/modal-composition',
  '_fixtures/modal-layer-composition',
  '_fixtures/modal-public-composition',
  '_fixtures/modal-live',
  '_fixtures/sheet',
  'dialog',
  'alert-dialog',
  'select',
  'menu',
  'combobox',
  'popover',
];
const formats = ['mixed', 'esm', 'cjs'];

async function run(command, args, options) {
  const child = spawn(command, args, { ...options, windowsHide: true, stdio: 'inherit' });
  const code = await new Promise((accept, reject) => {
    child.once('error', reject);
    child.once('exit', accept);
  });
  assert.equal(code, 0, `Процесс завершился с кодом ${code}.`);
}

async function verifyTypeContract(consumerRequire) {
  const source = `
import * as dialog from '@labpics/ui-core/behaviors/dialog';
import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import { Dialog, type DialogProps } from '@labpics/ui-react/dialog';
import { AlertDialog, type AlertDialogProps } from '@labpics/ui-react/alert-dialog';
type DialogSchema = SchemaOf<dialog.Service>;
const module: MachineModule<DialogSchema, dialog.Api> = dialog;
const behavior: dialog.Props = {
  id: 'consumer-dialog',
  triggerEl: () => document.createElement('button'),
};
// @ts-expect-error DOM binding принимает ссылку на элемент.
const invalidBehavior: dialog.Props = { id: 'consumer-dialog', triggerEl: 'trigger' };
const props: DialogProps = { heading: 'Параметры', content: 'Действие' };
const alert: AlertDialogProps = { heading: 'Подтверждение', content: 'Действие' };
// @ts-expect-error Публичный React API сохраняет прежние props.
const invalidReact: DialogProps = { triggerEl: () => document.createElement('button') };
void [module, behavior, invalidBehavior, Dialog, AlertDialog, props, alert, invalidReact];
`;
  const tsc = consumerRequire.resolve('typescript/lib/tsc.js');
  for (const extension of ['mts', 'cts']) {
    const file = join(consumer, `modal-types.${extension}`);
    await writeFile(file, source);
    await cp(file, join(evidence, `modal-types.${extension}`));
    const result = spawnSync(
      process.execPath,
      [
        tsc,
        '--noEmit',
        '--strict',
        '--target',
        'es2022',
        '--lib',
        'es2022,dom,dom.iterable',
        '--esModuleInterop',
        '--skipLibCheck',
        '--module',
        'nodenext',
        '--moduleResolution',
        'nodenext',
        file,
      ],
      { cwd: consumer, encoding: 'utf8', timeout: 20_000, windowsHide: true },
    );
    await writeFile(
      join(evidence, `modal-types-${extension}.json`),
      JSON.stringify(
        {
          extension,
          status: result.status,
          error: result.error?.message,
          stdout: result.stdout,
          stderr: result.stderr,
        },
        null,
        2,
      ),
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, `${extension}: ${result.stdout}\n${result.stderr}`);
  }
}

async function verifyRuntimeIdentity(consumerRequire) {
  const results = [];
  for (const name of ['dialog', 'popover', 'menu', 'select', 'combobox', 'tooltip']) {
    const importFile = join(consumer, 'node_modules/@labpics/ui-core/dist/behaviors', `${name}.js`);
    const requireFile = consumerRequire.resolve(`@labpics/ui-core/behaviors/${name}`);
    const imported = await import(pathToFileURL(importFile).href);
    const required = consumerRequire(`@labpics/ui-core/behaviors/${name}`);
    const names = Object.keys(required);
    results.push({
      name,
      importFile,
      requireFile,
      sameMachine: imported.machine === required.machine,
      sameConnect: imported.connect === required.connect,
      sameExports:
        Object.keys(imported).length === names.length &&
        names.every((key) => imported[key] === required[key]),
    });
  }
  await writeFile(join(evidence, 'runtime-identities.json'), JSON.stringify(results, null, 2));
  assert(
    results.every(
      ({ sameMachine, sameConnect, sameExports }) => sameMachine && sameConnect && sameExports,
    ),
  );
}

async function verifyReactImport() {
  for (const format of ['esm', 'cjs']) {
    const source =
      format === 'esm'
        ? "import { Dialog } from '@labpics/ui-react/dialog'; globalThis.component = Dialog;"
        : "const { Dialog } = require('@labpics/ui-react/dialog'); globalThis.component = Dialog;";
    const result = await build({
      absWorkingDir: consumer,
      stdin: { contents: source, resolveDir: consumer, loader: 'js' },
      bundle: true,
      platform: 'browser',
      format: 'iife',
      target: 'es2022',
      minify: true,
      write: false,
      metafile: true,
    });
    await writeFile(
      join(evidence, `react-import-${format}-metafile.json`),
      JSON.stringify(result.metafile),
    );
    const emitted = Object.values(result.metafile.outputs).flatMap((output) =>
      Object.entries(output.inputs)
        .filter(([, contribution]) => contribution.bytesInOutput > 0)
        .map(([file]) => resolve(consumer, file).replaceAll('\\', '/')),
    );
    assert(
      !emitted.some((file) =>
        /\/node_modules\/(?:lit(?:-html|-element)?|@lit(?:-labs)?)\//.test(file),
      ),
    );
    assert(!emitted.some((file) => /\/ui-core\/dist\/components\//.test(file)));
    const code = result.outputFiles[0].contents;
    await writeFile(
      join(evidence, `react-import-${format}-size.json`),
      JSON.stringify({ bytes: code.length, gzipBytes: gzipSync(code).length }),
    );
  }
}

async function verifyReactSSR(consumerRequire) {
  const { createElement, version } = consumerRequire('react');
  const { renderToString } = consumerRequire('react-dom/server');
  const results = [];
  for (const format of ['esm', 'cjs']) {
    for (const [name, exported] of [
      ['dialog', 'Dialog'],
      ['alert-dialog', 'AlertDialog'],
    ]) {
      const entry =
        format === 'esm'
          ? join(consumer, 'node_modules/@labpics/ui-react/dist', `${name}.js`)
          : consumerRequire.resolve(`@labpics/ui-react/${name}`);
      const result = { format, component: exported, entry, warnings: [] };
      const previousError = console.error;
      console.error = (...args) => result.warnings.push(args.map(String).join(' '));
      try {
        const module =
          format === 'esm'
            ? await import(pathToFileURL(entry).href)
            : consumerRequire(`@labpics/ui-react/${name}`);
        result.markup = renderToString(
          createElement(
            module[exported],
            {
              heading: 'SSR: параметры',
              content: 'SSR: клиентское содержимое',
            },
            `SSR: открыть ${exported}`,
          ),
        );
      } catch (error) {
        result.error = String(error);
      } finally {
        console.error = previousError;
      }
      results.push(result);
    }
  }
  await writeFile(
    join(evidence, 'react-ssr.json'),
    JSON.stringify({ node: process.version, react: version, results }, null, 2),
  );
  for (const result of results) {
    assert.equal(result.error, undefined, `${result.format}/${result.component}: ${result.error}`);
    assert.deepEqual(result.warnings, [], `${result.format}/${result.component}: SSR warnings`);
    assert(result.markup.includes(`SSR: открыть ${result.component}`));
    assert(result.markup.includes('data-part="trigger"'));
    assert(!result.markup.includes('lab-dialog-portal-plane'));
    assert(!result.markup.includes('SSR: клиентское содержимое'));
  }
}

async function verifyCoreSSR() {
  const source = `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const esm = await import('@labpics/ui-core/ssr');
require('@labpics/ui-core/sheet');
const first = esm.renderToString(esm.html\`<lab-sheet heading="SSR: настройки">SSR: открыть Sheet<input slot="content" value="SSR: содержимое" /></lab-sheet>\`);
const cjs = require('@labpics/ui-core/ssr');
await import('@labpics/ui-core/sheet');
const second = cjs.renderToString(cjs.html\`<lab-sheet heading="SSR: настройки">SSR: открыть Sheet<input slot="content" value="SSR: содержимое" /></lab-sheet>\`);
for (const markup of [first, second]) {
  assert(markup.includes('shadowrootmode="open"'));
  assert(markup.includes('SSR: открыть Sheet') && markup.includes('SSR: содержимое'));
  assert(markup.includes('class="portal-plane" popover="manual"'));
  assert(!markup.includes('class="positioner"'));
}
console.log(JSON.stringify({ node: process.version, results: [
  { ssr: 'esm', sheet: 'cjs', markup: first },
  { ssr: 'cjs', sheet: 'esm', markup: second },
] }));
`;
  const file = join(consumer, 'core-ssr-mixed.mjs');
  await writeFile(file, source);
  await cp(file, join(evidence, 'core-ssr-mixed.mjs'));
  const result = spawnSync(process.execPath, [file], {
    cwd: consumer,
    encoding: 'utf8',
    timeout: 20_000,
    windowsHide: true,
  });
  await writeFile(
    join(evidence, 'core-ssr-mixed.json'),
    JSON.stringify(
      {
        status: result.status,
        error: result.error?.message,
        stdout: result.stdout,
        stderr: result.stderr,
      },
      null,
      2,
    ),
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, `Core SSR: ${result.stdout}\n${result.stderr}`);
  assert.equal(result.stderr, '');
}

async function bundleFixture(name, format, consumerRequire) {
  const htmlFile = join(docs, 'src', `${name}.html`);
  let html = await readFile(htmlFile, 'utf8');
  const script = html.match(/<script type="module" src="([^"]+)"><\/script>/)?.[1];
  assert(script, `В ${name} нет входа fixture.`);
  const sourceFile = resolve(dirname(htmlFile), script);
  const result = await build({
    absWorkingDir: consumer,
    stdin: {
      contents: await readFile(sourceFile, 'utf8'),
      resolveDir: dirname(sourceFile),
      sourcefile: sourceFile,
      loader: sourceFile.endsWith('.tsx') ? 'tsx' : 'ts',
    },
    tsconfig: join(consumer, 'tsconfig.json'),
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    minify: true,
    write: false,
    metafile: true,
    outdir: join(temporary, 'unused'),
    plugins: [
      {
        name: 'independent-consumer-packages',
        setup(builder) {
          builder.onResolve({ filter: /^[^./]|^@/ }, async (args) => {
            if (args.pluginData?.independent) return;
            // Package-private imports разрешает исходный пакет, включая Motion #frame.
            if (args.path.startsWith('#')) return;
            if (format === 'cjs' && /^@labpics\/ui-(?:core|react)(?:\/|$)/.test(args.path)) {
              return { path: consumerRequire.resolve(args.path) };
            }
            // Mixed consumer берёт WC из require entry, а React child из import entry.
            if (format === 'mixed' && args.path === '@labpics/ui-core/sheet') {
              return { path: consumerRequire.resolve(args.path) };
            }
            return builder.resolve(args.path, {
              resolveDir: consumer,
              kind: args.kind,
              pluginData: { independent: true },
            });
          });
        },
      },
    ],
  });
  // Граф сохраняется и при отказе границы, чтобы finding указывал на реальные inputs.
  await writeFile(
    join(evidence, `${format}-${name.replaceAll('/', '-')}-metafile.json`),
    JSON.stringify(result.metafile),
  );
  const emitted = Object.values(result.metafile.outputs).flatMap((output) =>
    Object.entries(output.inputs)
      .filter(([, contribution]) => contribution.bytesInOutput > 0)
      .map(([path]) => resolve(consumer, path).replaceAll('\\', '/')),
  );
  const installedRoot = consumer.replaceAll('\\', '/');
  assert(
    !emitted.some(
      (path) => path.includes('/node_modules/') && !path.startsWith(`${installedRoot}/`),
    ),
  );
  assert(
    !emitted.some((path) => /\/packages\/(?:core|react|materials|tokens|shadow)\/src\//.test(path)),
  );
  const externalOverlay = emitted.filter((path) =>
    /\/node_modules\/@zag-js\/(?:dialog|popover|menu|select|combobox|tooltip|dismissable|focus-trap|aria-hidden)\//.test(
      path,
    ),
  );
  assert.equal(
    externalOverlay.length,
    0,
    `Внешний overlay runtime ${format}:${name}: ${externalOverlay.join(', ')}`,
  );
  if (format === 'mixed') {
    const inputs = Object.keys(result.metafile.inputs).map((path) =>
      resolve(consumer, path).replaceAll('\\', '/'),
    );
    assert(inputs.some((path) => path.endsWith('/ui-core/dist/components/sheet/index.cjs')));
    assert(inputs.some((path) => path.endsWith('/ui-react/dist/dialog.js')));
    assert(inputs.some((path) => path.endsWith('/ui-core/dist/behaviors/dialog.js')));
  }
  const scriptName = `${name.replaceAll('/', '-')}.js`;
  const directory = join(temporary, 'public', format);
  await mkdir(dirname(join(directory, `${name}.html`)), { recursive: true });
  html = html.replace(
    /<script type="module" src="[^"]+"><\/script>/,
    `<script src="/${scriptName}"></script>`,
  );
  await writeFile(join(directory, `${name}.html`), html);
  const output = result.outputFiles.find((file) => file.path.endsWith('.js'));
  assert(output, 'Не создан browser bundle.');
  await writeFile(join(directory, scriptName), output.contents);
  await writeFile(join(evidence, `${format}-${scriptName}`), output.contents);
  await writeFile(
    join(evidence, `${format}-${name.replaceAll('/', '-')}-size.json`),
    JSON.stringify({ bytes: output.contents.length, gzipBytes: gzipSync(output.contents).length }),
  );
}

let server;
try {
  await mkdir(consumer, { recursive: true });
  await mkdir(evidence, { recursive: true });
  const dependencies = {
    '@lit-labs/ssr': '4.1.0',
    lit: '3.3.3',
    react: '18.3.1',
    'react-dom': '18.3.1',
    vue: '3.5.42',
    'solid-js': '1.9.4',
  };
  const artifacts = [];
  for (const [folder, name] of packages) {
    const destination = join(temporary, 'packs', folder);
    await mkdir(destination, { recursive: true });
    execFileSync(process.execPath, [pnpm, 'pack', '--pack-destination', destination], {
      cwd: join(repository, 'packages', folder),
      windowsHide: true,
      timeout: 30_000,
      stdio: 'pipe',
    });
    const archives = (await readdir(destination)).filter((file) => file.endsWith('.tgz'));
    assert.equal(archives.length, 1);
    const archive = join(destination, archives[0]);
    dependencies[name] = `file:${archive.replaceAll('\\', '/')}`;
    const saved = join(evidence, archives[0]);
    await cp(archive, saved);
    artifacts.push({
      name,
      archive: saved,
      sha256: createHash('sha256')
        .update(await readFile(archive))
        .digest('hex'),
    });
  }
  await writeFile(join(evidence, 'packages.json'), JSON.stringify(artifacts, null, 2));
  const manifest = {
    name: 'labui-independent-modal-consumer',
    private: true,
    type: 'module',
    dependencies,
    devDependencies: {
      typescript: '5.7.3',
      '@types/react': '18.3.18',
      '@types/react-dom': '18.3.5',
    },
  };
  await writeFile(join(consumer, 'package.json'), JSON.stringify(manifest, null, 2));
  await writeFile(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { jsx: 'react-jsx', target: 'ES2022' } }),
  );
  if (process.platform === 'win32') {
    // Только фиксированная команда; tarball paths передаются через JSON manifest.
    await run(
      'npm.cmd install --ignore-scripts --no-audit --no-fund --global=false --package-lock=true',
      [],
      {
        cwd: consumer,
        shell: true,
      },
    );
  } else {
    await run(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--global=false',
        '--package-lock=true',
      ],
      { cwd: consumer },
    );
  }
  const consumerRequire = createRequire(join(consumer, 'package.json'));
  const notices = await readFile(
    join(consumer, 'node_modules/@labpics/ui-core/dist/THIRD-PARTY-NOTICES.txt'),
    'utf8',
  );
  assert(notices.includes('@zag-js/dom-query@1.41.2') && notices.includes('@floating-ui/dom@'));
  assert(notices.includes('@zag-js/aria-hidden@1.41.2'));
  const queryRoot = dirname(consumerRequire.resolve('@zag-js/dom-query'));
  const tabbable = await readFile(join(queryRoot, 'tabbable.js'), 'utf8');
  const containment = await readFile(join(queryRoot, 'node.js'), 'utf8');
  assert(tabbable.includes('collectElementsWithShadowDOM'));
  const containsBody = containment.match(/function contains\(parent, child\) \{[\s\S]*?\n\}/)?.[0];
  assert(containsBody && !containsBody.includes('assignedSlot'));
  const hidingRoot = dirname(consumerRequire.resolve('@zag-js/aria-hidden'));
  const hiding = await readFile(join(hidingRoot, 'walk-tree-outside.mjs'), 'utf8');
  assert(hiding.includes('counterMap') && !hiding.includes('createLockStack'));
  const dialogRoot = dirname(consumerRequire.resolve('@zag-js/dialog'));
  const dialogTypes = await Promise.all(
    ['dialog.types.d.mts', 'dialog.types.d.ts'].map((name) =>
      readFile(join(dialogRoot, name), 'utf8'),
    ),
  );
  assert(dialogTypes.every((source) => !source.includes('triggerEl?:')));
  for (const name of [
    '@labpics/ui-core',
    '@labpics/ui-react',
    '@zag-js/dom-query',
    '@zag-js/aria-hidden',
    '@zag-js/dialog',
    'typescript',
    '@types/react',
    '@types/react-dom',
  ]) {
    const installed = join(consumer, 'node_modules', name);
    assert(!(await lstat(installed)).isSymbolicLink());
    assert((await realpath(installed)).startsWith(await realpath(consumer)));
  }
  await cp(join(consumer, 'package.json'), join(evidence, 'consumer-package.json'));
  await cp(join(consumer, 'package-lock.json'), join(evidence, 'consumer-package-lock.json'));
  await writeFile(
    join(evidence, 'registry-dependencies.json'),
    JSON.stringify(
      {
        unpatched: true,
        containsSha256: createHash('sha256').update(containment).digest('hex'),
        tabbableSha256: createHash('sha256').update(tabbable).digest('hex'),
        dialogTypesSha256: dialogTypes.map((source) =>
          createHash('sha256').update(source).digest('hex'),
        ),
      },
      null,
      2,
    ),
  );
  await verifyTypeContract(consumerRequire);
  await verifyRuntimeIdentity(consumerRequire);
  await verifyReactImport();
  await verifyReactSSR(consumerRequire);
  await verifyCoreSSR();
  const css = await build({
    stdin: {
      contents: await readFile(join(docs, 'src/button-demo.css'), 'utf8'),
      loader: 'css',
      resolveDir: consumer,
    },
    bundle: true,
    write: false,
    outdir: join(temporary, 'unused-css'),
  });
  assert.equal(css.outputFiles.length, 1);
  for (const format of formats) {
    const fixtures = format === 'mixed' ? ['_fixtures/modal-public-composition'] : fixtureNames;
    for (const name of fixtures) await bundleFixture(name, format, consumerRequire);
    await writeFile(
      join(temporary, 'public', format, 'button-demo.css'),
      css.outputFiles[0].contents,
    );
    await writeFile(
      join(temporary, 'public', format, '_fixtures/packed-react-sheet-focus.html'),
      '<!doctype html><html data-theme="light" data-material="solid"><body><button id="background">Background</button><fieldset id="area"><div id="app"></div></fieldset></body></html>',
    );
  }
  let activeFormat = 'esm';
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const file = resolve(temporary, 'public', activeFormat, `.${pathname}`);
      assert(file.startsWith(resolve(temporary, 'public', activeFormat)));
      const data = await readFile(file);
      response.setHeader(
        'Content-Type',
        file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html',
      );
      response.end(data);
    } catch {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  const port = server.address().port;
  for (const format of formats) {
    activeFormat = format;
    const config = join(temporary, `playwright-${format}.config.cjs`);
    await writeFile(
      config,
      `module.exports = ${JSON.stringify({
        testDir: join(docs, 'tests'),
        testMatch: (format === 'mixed'
          ? ['modal-public-composition.spec.ts', 'packed-react-sheet-focus.mjs']
          : specifications
        ).map((name) => `**/${name}`),
        fullyParallel: false,
        workers: 1,
        retries: 0,
        metadata: { packedReactSheetFocus: { consumer, format, evidence } },
        outputDir: join(evidence, `${format}-results`),
        reporter: [['list'], ['json', { outputFile: join(evidence, `${format}-results.json`) }]],
        use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1280, height: 720 } },
        projects: [
          { name: 'chromium', use: { browserName: 'chromium' } },
          { name: 'webkit', use: { browserName: 'webkit' } },
        ],
      })};${format === 'mixed' ? '\nmodule.exports.grep = /Controlled закрытие Sheet в shadow root|React Sheet final focus/;' : ''}`,
    );
    const cli = createRequire(join(docs, 'package.json')).resolve('@playwright/test/cli');
    await run(process.execPath, [cli, 'test', '--config', config], { cwd: docs });
  }
  console.info(
    'packed-modal-consumer: NodeNext types, React/Core SSR, ESM/CJS/mixed и Chromium/WebKit PASS; registry dependencies не исправлены потребителем.',
  );
} finally {
  if (server) await new Promise((accept) => server.close(accept));
  const absoluteTemporary = resolve(temporary);
  assert(
    absoluteTemporary.startsWith(resolve(tmpdir())) &&
      absoluteTemporary.includes('labui-packed-modal-'),
  );
  await rm(absoluteTemporary, { recursive: true, force: true });
}
