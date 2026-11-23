import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, webkit } from '@playwright/test';
import { runPnpm, writePackedConsumerProject } from './packed-consumer-project.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const evidence = join(root, 'docs/evidence/file-upload-20261123');
const consumer = await mkdtemp(join(tmpdir(), 'labui-file-upload-'));
const archives = [];
let server;
try {
  await mkdir(join(consumer, 'packs'));
  await mkdir(join(consumer, 'public'));
  const dependencies = {
    react: '18.3.1',
    'react-dom': '18.3.1',
    '@types/react': '18.3.18',
    '@types/react-dom': '18.3.5',
    esbuild: '0.25.12',
    typescript: '5.7.3',
    lit: '3.3.3',
    '@lit-labs/ssr': '4.1.0',
  };
  const overrides = {};
  for (const folder of ['fonts', 'tokens', 'colors', 'shadow', 'materials', 'core', 'react']) {
    const location = join(root, 'packages', folder);
    const pkg = JSON.parse(await readFile(join(location, 'package.json'), 'utf8'));
    runPnpm(['pack', '--pack-destination', join(consumer, 'packs')], location);
    const archive = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
    dependencies[pkg.name] = overrides[pkg.name] = `file:./packs/${archive}`;
    archives.push({
      package: pkg.name,
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs', archive)))
        .digest('hex'),
    });
  }
  if (process.env.LAB_ICONS_TARBALL) {
    await copyFile(process.env.LAB_ICONS_TARBALL, join(consumer, 'packs/icons.tgz'));
    dependencies['@labpics/icons'] = overrides['@labpics/icons'] = 'file:./packs/icons.tgz';
    archives.push({
      package: '@labpics/icons',
      source: 'qualification artifact; does not attest registry publication',
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs/icons.tgz')))
        .digest('hex'),
    });
  }
  await writePackedConsumerProject(consumer, {
    name: 'file-upload-installed',
    dependencies,
    overrides,
  });
  runPnpm(['install', '--ignore-scripts', '--prefer-offline'], consumer);
  await writeFile(
    join(consumer, 'ssr.mjs'),
    `
    import assert from 'node:assert/strict';
    import {createRequire} from 'node:module';
    import {createElement} from 'react';
    import {renderToString as reactRender} from 'react-dom/server';
    import {html,renderToString} from '@labpics/ui-core/ssr';
    import '@labpics/ui-core/file-upload';
    const require=createRequire(import.meta.url);
    const lit=renderToString(html\`<lab-file-upload label="Attachments" view="dropzone"></lab-file-upload>\`);
    assert.match(lit,/Browse files/);assert.match(lit,/shadowrootmode/);
    for(const api of [await import('@labpics/ui-react/file-upload'), require('@labpics/ui-react/file-upload')]) {
      const output=reactRender(createElement(api.FileUpload,{label:'Attachments',view:'dropzone'}));
      assert.match(output,/Browse files/);assert.match(output,/type="file"/);
    }
  `,
  );
  execFileSync(process.execPath, ['ssr.mjs'], { cwd: consumer, windowsHide: true });
  await writeFile(
    join(consumer, 'main.tsx'),
    `
    import '@labpics/fonts/fonts.css';
    import '@labui/colors/contract.css';
    import '@labpics/ui-tokens/tokens.css';
    import '@labpics/ui-core/theme.css';
    import '@labpics/ui-materials/material.css';
    import '@labpics/ui-core/file-upload';
    import {FileUpload,type FileUploadProps} from '@labpics/ui-react/file-upload';
    import {createRoot} from 'react-dom/client';
    const props:FileUploadProps={label:'Attachments',name:'files',accept:'.txt',view:'dropzone'};
    createRoot(document.querySelector('#react')!).render(<form id="react-form"><FileUpload {...props}/></form>);
  `,
  );
  runPnpm(
    [
      'exec',
      'tsc',
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--jsx',
      'react-jsx',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      'main.tsx',
    ],
    consumer,
  );
  runPnpm(
    [
      'exec',
      'esbuild',
      'main.tsx',
      '--bundle',
      '--format=esm',
      '--jsx=automatic',
      '--loader:.woff2=file',
      '--loader:.webp=file',
      '--outdir=public',
    ],
    consumer,
  );
  await writeFile(
    join(consumer, 'public/index.html'),
    '<!doctype html><html lang="en" class="lab-scope" data-theme="light" data-material="solid"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Installed File Upload</title><link rel="stylesheet" href="main.css"><style>body{margin:24px;background:var(--lab-bg-primary);color:var(--lab-label-primary)}form{margin-block:24px}</style><form id="lit"><lab-file-upload label="Attachments" name="files" accept=".txt" view="dropzone"></lab-file-upload></form><div id="react"></div><script type="module" src="main.js"></script></html>',
  );
  const publicRoot = resolve(consumer, 'public');
  server = createServer(async (request, response) => {
    const path = resolve(
      publicRoot,
      `.${new URL(request.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(request.url, 'http://localhost').pathname}`,
    );
    if (!path.startsWith(`${publicRoot}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const data = await readFile(path);
      response.setHeader(
        'content-type',
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.woff2': 'font/woff2',
        }[extname(path)] ?? 'application/octet-stream',
      );
      response.end(data);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const results = [];
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      for (const form of ['#lit', '#react-form']) {
        const scope = page.locator(form);
        const picker = page.waitForEvent('filechooser');
        await scope.getByRole('button', { name: 'Browse files' }).click();
        await (await picker).setFiles({
          name: 'installed.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('installed'),
        });
        await expect(scope.locator('.lab-upload-name')).toHaveText('installed.txt');
        const values = () =>
          scope.evaluate((form) =>
            Array.from(new FormData(form).getAll('files'), (f) => [f.name, f.size]),
          );
        await expect.poll(values).toEqual([['installed.txt', 9]]);
        await scope
          .locator('input[type=file]')
          .setInputFiles({
            name: 'rejected.png',
            mimeType: 'image/png',
            buffer: Buffer.from('image'),
          });
        await expect(scope.getByRole('status').filter({ hasText: 'rejected.png' })).toContainText(
          'File type is not accepted',
        );
        await expect.poll(values).toEqual([['installed.txt', 9]]);
        await scope.getByRole('button', { name: 'Remove installed.txt' }).click();
        await expect(scope.getByRole('button', { name: 'Browse files' })).toBeVisible();
      }
      results.push({
        browser: engine.name(),
        version: browser.version(),
        realPicker: true,
        acceptedFormData: true,
        rejectedSelectionPreserved: true,
        removal: true,
      });
    } finally {
      await browser.close();
    }
  }
  await mkdir(evidence, { recursive: true });
  await writeFile(
    join(evidence, 'packed.json'),
    `${JSON.stringify({ archives, ssr: ['lit', 'react-esm', 'react-cjs'], declarationConsumer: true, bundle: true, results }, null, 2)}\n`,
  );
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.ok(resolve(consumer).startsWith(resolve(tmpdir(), 'labui-file-upload-')));
  await rm(consumer, { recursive: true, force: true });
}
