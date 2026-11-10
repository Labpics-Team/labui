import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { buildSync } from 'esbuild';

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pnpm = process.env.npm_execpath;
assert(pnpm, 'Проверку запускает pnpm test:package.');
const temporaryRoot = resolve(tmpdir());
const consumer = mkdtempSync(join(temporaryRoot, 'labui-material-css-'));
const runPnpm = (args: string[], cwd: string): string =>
  execFileSync(process.execPath, [pnpm, ...args], { cwd, encoding: 'utf8' });

try {
  runPnpm(['pack', '--pack-destination', consumer], packageRoot);
  const archives = readdirSync(consumer).filter((file) => file.endsWith('.tgz'));
  assert.equal(archives.length, 1);
  const archive = join(consumer, archives[0] ?? '');
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: { '@labpics/ui-materials': `file:${archive.replaceAll('\\', '/')}` },
    }),
  );
  runPnpm(
    ['install', '--offline', '--ignore-scripts', '--ignore-workspace', '--lockfile=false'],
    consumer,
  );

  writeFileSync(
    join(consumer, 'runtime.mjs'),
    `import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { materialCss } from '@labpics/ui-materials/css';
const require = createRequire(import.meta.url);
const cjs = require('@labpics/ui-materials/css');
const css = readFileSync(require.resolve('@labpics/ui-materials/material.css'), 'utf8');
assert.equal(typeof materialCss, 'string');
assert.equal(materialCss, css);
assert.equal(cjs.materialCss, css);
assert.deepEqual(Object.keys(cjs), ['materialCss']);
assert(css.includes('--_material-mode:'));
assert(css.includes('--lab-bg-material-'));
`,
  );
  execFileSync(process.execPath, ['runtime.mjs'], { cwd: consumer, encoding: 'utf8' });

  const typeConsumer = `import { materialCss } from '@labpics/ui-materials/css';
const css: string = materialCss;
export { css };
`;
  writeFileSync(join(consumer, 'esm.mts'), typeConsumer);
  writeFileSync(join(consumer, 'cjs.cts'), typeConsumer);
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        types: [],
        lib: ['ES2022'],
        strict: true,
        noEmit: true,
      },
      include: ['*.mts', '*.cts'],
    }),
  );
  const compiler = require.resolve('typescript/bin/tsc');
  execFileSync(process.execPath, [compiler, '-p', 'tsconfig.json'], {
    cwd: consumer,
    encoding: 'utf8',
  });
  for (const format of ['mts', 'cts']) {
    writeFileSync(
      join(consumer, `negative.${format}`),
      `${typeConsumer}\nconst invalid: number = materialCss;\n`,
    );
  }
  const negative = spawnSync(process.execPath, [compiler, '-p', 'tsconfig.json'], {
    cwd: consumer,
    encoding: 'utf8',
  });
  assert.equal(negative.status, 2, negative.error?.message);
  for (const format of ['mts', 'cts']) {
    assert.match(negative.stdout, new RegExp(`negative\\.${format}.*TS2322`));
  }

  writeFileSync(
    join(consumer, 'browser.js'),
    "export { materialCss } from '@labpics/ui-materials/css';\n",
  );
  const browser = buildSync({
    absWorkingDir: consumer,
    entryPoints: ['browser.js'],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'materialConsumer',
    write: false,
    metafile: true,
  });
  // Браузерный импорт исполняется без DOM, process, require и прочих Node globals.
  const context: { materialConsumer?: { materialCss: string } } = {};
  runInNewContext(browser.outputFiles[0]?.text ?? '', context);
  const css = readFileSync(join(packageRoot, 'dist', 'material.css'), 'utf8');
  assert.equal(context.materialConsumer?.materialCss, css);
  const inputs = Object.keys(browser.metafile.inputs);
  assert.equal(inputs.length, 2, `CSS export втянул посторонние модули: ${inputs.join(', ')}`);
  assert(inputs.some((file) => file.endsWith('/dist/css.js')));

  console.info(
    JSON.stringify({
      result: 'PASS',
      packageSha256: createHash('sha256').update(readFileSync(archive)).digest('hex'),
      cssBytes: Buffer.byteLength(css),
      checks: ['packed ESM/CJS', 'NodeNext positive/negative ESM/CJS', 'isolated browser import'],
    }),
  );
} finally {
  // Удаляем только созданный этой проверкой каталог непосредственно в tmpdir.
  assert.equal(dirname(resolve(consumer)), temporaryRoot);
  assert(consumer.startsWith(join(temporaryRoot, 'labui-material-css-')));
  rmSync(consumer, { recursive: true, force: true });
}
