import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
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
import { fileURLToPath } from 'node:url';
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
  'modal-sibling-ownership.spec.ts',
  'modal-early-dismiss.spec.ts',
  'sheet-motion-errors.spec.ts',
  'sheet-disconnect-errors.spec.ts',
  'sheet-error-focus.spec.ts',
  'dialog.spec.ts',
  'alert-dialog.spec.ts',
];
const fixtureNames = [
  '_fixtures/modal-composition',
  '_fixtures/modal-layer-composition',
  '_fixtures/modal-live',
  '_fixtures/sheet',
  'dialog',
  'alert-dialog',
  'select',
  'menu',
  'combobox',
  'popover',
];

async function run(command, args, options) {
  const child = spawn(command, args, { ...options, windowsHide: true, stdio: 'inherit' });
  const code = await new Promise((accept, reject) => {
    child.once('error', reject);
    child.once('exit', accept);
  });
  assert.equal(code, 0, `Процесс завершился с кодом ${code}.`);
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
}

let server;
try {
  await mkdir(consumer, { recursive: true });
  await mkdir(evidence, { recursive: true });
  const dependencies = {
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
  for (const name of [
    '@labpics/ui-core',
    '@labpics/ui-react',
    '@zag-js/dom-query',
    '@zag-js/aria-hidden',
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
      },
      null,
      2,
    ),
  );
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
  for (const format of ['esm', 'cjs']) {
    for (const name of fixtureNames) await bundleFixture(name, format, consumerRequire);
    await writeFile(
      join(temporary, 'public', format, 'button-demo.css'),
      css.outputFiles[0].contents,
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
  for (const format of ['esm', 'cjs']) {
    activeFormat = format;
    const config = join(temporary, `playwright-${format}.config.cjs`);
    await writeFile(
      config,
      `module.exports = ${JSON.stringify({
        testDir: join(docs, 'tests'),
        testMatch: specifications.map((name) => `**/${name}`),
        fullyParallel: false,
        workers: 1,
        retries: 0,
        outputDir: join(evidence, `${format}-results`),
        reporter: [['list'], ['json', { outputFile: join(evidence, `${format}-results.json`) }]],
        use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1280, height: 720 } },
        projects: [
          { name: 'chromium', use: { browserName: 'chromium' } },
          { name: 'webkit', use: { browserName: 'webkit' } },
        ],
      })};`,
    );
    const cli = createRequire(join(docs, 'package.json')).resolve('@playwright/test/cli');
    await run(process.execPath, [cli, 'test', '--config', config], { cwd: docs });
  }
  console.info(
    'packed-modal-consumer: ESM/CJS и Chromium/WebKit PASS; registry dependencies не исправлены потребителем.',
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
