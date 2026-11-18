import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, webkit } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = join(root, 'docs/evidence/pagination-20261119');
const consumer = await mkdtemp(join(tmpdir(), 'labui-pagination-'));
const corepack = join(dirname(process.execPath), 'node_modules/corepack/dist/corepack.js');
const pnpm = (args, cwd = root) =>
  execFileSync(process.execPath, [corepack, 'pnpm', ...args], { cwd, stdio: 'pipe' });
const renderers = ['vue', 'solid', 'svelte', 'astro', 'react'];
const records = [];
let server;
try {
  await mkdir(output, { recursive: true });
  await mkdir(join(consumer, 'packs'));
  const dependencies = {
    react: '18.3.1',
    'react-dom': '18.3.1',
    lit: '3.3.3',
    '@lit-labs/ssr': '4.1.0',
    '@lit-labs/ssr-client': '1.1.8',
    esbuild: '0.25.0',
  };
  const overrides = {};
  const archives = [];
  for (const folder of [
    'tokens',
    'shadow',
    'materials',
    'fonts',
    'colors',
    'core',
    'react',
    'vue',
    'solid',
    'svelte',
    'astro',
  ]) {
    const location = join(root, 'packages', folder);
    const pkg = JSON.parse(await readFile(join(location, 'package.json'), 'utf8'));
    pnpm(['pack', '--pack-destination', join(consumer, 'packs')], location);
    const name = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
    dependencies[pkg.name] = overrides[pkg.name] = `file:./packs/${name}`;
    archives.push({
      name: pkg.name,
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs', name)))
        .digest('hex'),
    });
  }
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'pagination-consumer',
      private: true,
      type: 'module',
      dependencies,
      pnpm: { overrides },
    }),
  );
  pnpm(
    ['install', '--ignore-scripts', '--config.auto-install-peers=false', '--prefer-offline'],
    consumer,
  );
  await writeFile(
    join(consumer, 'app.js'),
    `
    import { createElement, useState } from 'react';
    import { Pagination } from '@labpics/ui-react/pagination';
    export const props = {count:200,pageSize:10,page:3,label:'Study pages'};
    export function App() { const [page,setPage]=useState(3); return createElement('div',null,
      createElement(Pagination,{...props,page,onPageChange:setPage}),
      createElement('p',{className:'records'},'Records '+((page-1)*10+1)+'–'+(page*10))); }
  `,
  );
  await writeFile(
    join(consumer, 'server.mjs'),
    `
    import { writeFile } from 'node:fs/promises';
    import { createElement } from 'react'; import { renderToString } from 'react-dom/server';
    import { App, props } from './app.js'; const parts=[];
    for(const name of ['vue','solid','svelte','astro']){
      const {renderPagination}=await import('@labpics/ui-'+name+'/ssr');
      parts.push('<section data-renderer="'+name+'"><h2>'+name+'</h2>'+renderPagination(props)+'<p class="records">Records 21–30</p></section>');
    }
    parts.push('<section data-renderer="react"><h2>React</h2><div id="react-root">'+renderToString(createElement(App))+'</div></section>');
    await writeFile('index.html','<!doctype html><html lang="en" class="lab-scope" data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/client.css"><style>body{font-family:var(--lab-font-family);margin:0;background:var(--lab-bg-grouped-primary);color:var(--lab-label-primary)}section{margin:24px}h2{font-size:14px;font-weight:500}p{font-size:14px}</style></head><body>'+parts.join('')+'<script type="module" src="/client.js"></script></body></html>');
  `,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
    import '@labpics/fonts/fonts.css'; import '@labui/colors/contract.css'; import '@labpics/ui-core/tokens.css';
    import '@labpics/ui-core/pagination.css'; import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
    import {createElement} from 'react'; import {hydrateRoot} from 'react-dom/client'; import {App} from './app.js';
    window.hydratePagination=async()=>{
      await import('@labpics/ui-core/pagination');
      await Promise.all([...document.querySelectorAll('lab-pagination')].map(el=>el.updateComplete));
      hydrateRoot(document.getElementById('react-root'),createElement(App));window.hydrated=true;
    };
    window.acceptRequests=()=>document.querySelectorAll('lab-pagination').forEach(el=>el.addEventListener('page-change',e=>{
      el.page=e.detail.page;el.parentElement.querySelector('.records').textContent='Records '+((e.detail.page-1)*10+1)+'–'+(e.detail.page*10);
    }));
  `,
  );
  await writeFile(
    join(consumer, 'build.mjs'),
    `import {build} from 'esbuild';await build({entryPoints:['client.js'],outdir:'web',bundle:true,format:'esm',splitting:true,loader:{'.woff2':'file'},assetNames:'[name]-[hash]'});`,
  );
  execFileSync(process.execPath, ['server.mjs'], { cwd: consumer, stdio: 'pipe' });
  execFileSync(process.execPath, ['build.mjs'], { cwd: consumer, stdio: 'pipe' });
  await writeFile(
    join(consumer, 'web', 'index.html'),
    await readFile(join(consumer, 'index.html')),
  );
  server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(consumer, 'web', `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(join(consumer, 'web') + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const content = await readFile(file);
      response.setHeader(
        'Content-Type',
        file.endsWith('.js')
          ? 'text/javascript'
          : file.endsWith('.css')
            ? 'text/css'
            : file.endsWith('.woff2')
              ? 'font/woff2'
              : 'text/html',
      );
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const [engine, kind] of Object.entries({ chromium, webkit })) {
    const browser = await kind.launch({ headless: true });
    try {
      const first = await browser.newPage({ javaScriptEnabled: false });
      await first.goto(url);
      for (const renderer of renderers) {
        const host = first.locator(`[data-renderer='${renderer}']`);
        await expect(host.getByRole('navigation', { name: 'Study pages' })).toBeVisible();
        await expect(host.locator('[aria-current]')).toHaveText('3');
        await expect(host.getByLabel('Next page')).toBeEnabled();
      }
      await first.close();
      const page = await browser.newPage({ viewport: { width: 960, height: 900 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.goto(url);
      await page.waitForFunction(() => typeof window.hydratePagination === 'function');
      await page.evaluate(() => document.fonts.ready);
      assert.equal(
        await page.evaluate(() =>
          [...document.fonts].some(
            (font) => font.family.includes('Geist') && font.status === 'loaded',
          ),
        ),
        true,
      );
      assert.equal(
        await page.evaluate(() => customElements.get('lab-pagination') !== undefined),
        false,
      );
      for (const renderer of renderers)
        await page.locator(`[data-renderer='${renderer}'] [aria-current]`).evaluate((el) => {
          el.__sameNode = true;
        });
      await page.evaluate(() => window.hydratePagination());
      await page.waitForFunction(() => window.hydrated);
      for (const renderer of renderers) {
        const host = page.locator(`[data-renderer='${renderer}']`);
        assert.equal(
          await host.locator('[aria-current]').evaluate((el) => el.__sameNode),
          true,
          `${renderer}: retained server node`,
        );
        await expect(host.locator('[aria-current]')).toHaveCSS('height', '40px');
        await expect(host.locator('[aria-current]')).toHaveCSS('border-radius', '12px');
        if (renderer !== 'react') {
          await host.getByLabel('Next page').click();
          await expect(host.locator('[aria-current]')).toHaveText('3');
        }
      }
      await page.evaluate(() => window.acceptRequests());
      for (const renderer of renderers) {
        const host = page.locator(`[data-renderer='${renderer}']`);
        await host.getByLabel('Next page').click();
        await expect(host.locator('[aria-current]')).toHaveText('4');
        await expect(host.locator('.records')).toHaveText('Records 31–40');
      }
      assert.deepEqual(errors, []);
      await page.screenshot({
        path: join(output, `${engine}-installed-light.png`),
        fullPage: true,
      });
      await page.evaluate(() => {
        document.documentElement.dataset.theme = 'dark';
        document.documentElement.style.fontSize = '32px';
      });
      await page.screenshot({
        path: join(output, `${engine}-installed-dark-200.png`),
        fullPage: true,
      });
      records.push({
        engine,
        browser: browser.version(),
        renderers,
        styledSSR: true,
        retainedServerNodes: true,
        controlledRefusal: true,
        dataChanged: true,
        loadedGeist: true,
        errors,
      });
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    join(output, 'packed.generated.json'),
    `${JSON.stringify({ archives, records }, null, 2)}\n`,
  );
  process.stdout.write('Packed Pagination: 4 SSR adapters + React; Chromium/WebKit passed\n');
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.equal(dirname(consumer), resolve(tmpdir()));
  assert.ok(consumer.includes('labui-pagination-'));
  await rm(consumer, { recursive: true, force: true });
}
