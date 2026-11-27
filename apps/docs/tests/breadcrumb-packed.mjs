import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, webkit } from '@playwright/test';
import { runPnpm, writePackedConsumerProject } from './packed-consumer-project.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = join(root, 'docs/evidence/breadcrumb-20261118');
const consumer = await mkdtemp(join(tmpdir(), 'labui-breadcrumb-'));
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
    runPnpm(['pack', '--pack-destination', join(consumer, 'packs')], location);
    const name = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
    dependencies[pkg.name] = `file:./packs/${name}`;
    overrides[pkg.name] = `file:./packs/${name}`;
    archives.push({
      name: pkg.name,
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs', name)))
        .digest('hex'),
    });
  }
  await writePackedConsumerProject(consumer, {
    name: 'breadcrumb-consumer',
    dependencies,
    overrides,
  });
  runPnpm(
    ['install', '--ignore-scripts', '--config.auto-install-peers=false', '--prefer-offline'],
    consumer,
  );
  const props = {
    label: 'Разделы проекта',
    expandLabel: 'Все разделы',
    items: [
      { label: 'Home', href: '#home' },
      { label: 'Team <img src=x onerror=alert(1)>' },
      { label: 'Projects', href: '#projects' },
      { label: 'Services', href: '#services' },
      { label: 'Design', href: '#must-not-navigate' },
    ],
  };
  await writeFile(join(consumer, 'props.json'), JSON.stringify(props));
  await writeFile(
    join(consumer, 'server.mjs'),
    `
    import { writeFile } from 'node:fs/promises';
    import props from './props.json' with { type: 'json' };
    import { Breadcrumb } from '@labpics/ui-react/breadcrumb';
    import { createElement } from 'react';
    import { renderToString } from 'react-dom/server';
    const parts = [];
    for (const name of ['vue', 'solid', 'svelte', 'astro']) {
      const { renderBreadcrumb } = await import('@labpics/ui-' + name + '/ssr');
      parts.push('<section data-renderer="' + name + '">' + renderBreadcrumb(props) + '</section>');
    }
    parts.push('<section data-renderer="react" id="react-root">' + renderToString(createElement(Breadcrumb, props)) + '</section>');
    await writeFile('index.html', '<!doctype html><html lang="ru" class="lab-scope" data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/client.css"><style>section{margin:24px}body{background:var(--lab-bg-primary)}</style></head><body>' + parts.join('') + '<script type="module" src="/client.js"></script></body></html>');
  `,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
    import '@labpics/fonts/fonts.css';
    import '@labui/colors/contract.css';
    import '@labpics/ui-core/tokens.css';
    import '@labpics/ui-core/breadcrumb.css';
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
    import { createElement } from 'react';
    import { hydrateRoot } from 'react-dom/client';
    import props from './props.json';
    window.hydrateTrail = async () => {
      await import('@labpics/ui-core/breadcrumb');
      await Promise.all([...document.querySelectorAll('lab-breadcrumb')].map(el => el.updateComplete));
      const { Breadcrumb } = await import('@labpics/ui-react/breadcrumb');
      hydrateRoot(document.getElementById('react-root'), createElement(Breadcrumb, props));
      window.hydrated = true;
    };
  `,
  );
  await writeFile(
    join(consumer, 'build.mjs'),
    `
    import { build } from 'esbuild';
    await build({entryPoints:['client.js'],outdir:'web',bundle:true,format:'esm',splitting:true,loader:{'.woff2':'file'},assetNames:'[name]-[hash]'});
  `,
  );
  execFileSync(process.execPath, ['server.mjs'], { cwd: consumer, stdio: 'pipe' });
  execFileSync(process.execPath, ['build.mjs'], { cwd: consumer, stdio: 'pipe' });
  await writeFile(
    join(consumer, 'web', 'index.html'),
    await readFile(join(consumer, 'index.html')),
  );
  server = createServer(async (request, response) => {
    const path = request.url === '/' ? '/index.html' : request.url;
    const file = resolve(consumer, 'web', `.${path}`);
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
      const firstPaint = await browser.newPage({ javaScriptEnabled: false });
      await firstPaint.goto(url);
      for (const renderer of renderers) {
        const host = firstPaint.locator(`[data-renderer="${renderer}"]`);
        await expect(host.getByRole('navigation', { name: props.label })).toBeVisible();
        await expect(host.getByRole('link')).toHaveCount(2);
        await expect(host.locator('[aria-current="page"]')).toHaveText('Design');
        await expect(host.locator('[aria-current="page"]')).not.toHaveAttribute('href');
        await expect(host.getByRole('button', { name: props.expandLabel })).toBeVisible();
      }
      await firstPaint.close();
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.goto(url);
      await page.waitForFunction(() => typeof window.hydrateTrail === 'function');
      await page.evaluate(() => document.fonts.ready);
      assert.equal(
        await page.evaluate(() => customElements.get('lab-breadcrumb') !== undefined),
        false,
      );
      for (const renderer of renderers) {
        const current = page.locator(`[data-renderer="${renderer}"] [aria-current="page"]`);
        await current.evaluate((element) => {
          element.__sameNode = true;
        });
        await expect(current).toHaveCSS('font-size', '14px');
        await expect(current).toHaveCSS('font-weight', '500');
      }
      await page.evaluate(() => window.hydrateTrail());
      await page.waitForFunction(() => window.hydrated);
      for (const renderer of renderers) {
        const host = page.locator(`[data-renderer="${renderer}"]`);
        const expand = host.getByRole('button', { name: props.expandLabel });
        await expect(expand).toBeVisible();
        assert.equal(
          await host.locator('[aria-current="page"]').evaluate((element) => element.__sameNode),
          true,
          `${renderer}: retained server DOM`,
        );
        await expand.focus();
        await expand.press('Enter');
        await expect(host.getByText(props.items[1].label, { exact: true })).toBeFocused();
        await expect(host.locator('img')).toHaveCount(0);
        await expect(host.getByRole('link')).toHaveCount(3);
        await host.getByRole('link', { name: 'Projects', exact: true }).click();
        await expect(page).toHaveURL(/#projects$/);
      }
      assert.deepEqual(errors, []);
      records.push({
        engine,
        browser: browser.version(),
        renderers,
        styledSSR: true,
        sameNodeAfterHydration: true,
        groupingLabelFocus: true,
        escapedLabels: true,
        realNavigation: true,
        currentNonLink: true,
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
  process.stdout.write('Packed Breadcrumb: 4 SSR adapters + React; Chromium/WebKit passed\n');
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.equal(dirname(consumer), resolve(tmpdir()));
  assert.ok(consumer.includes('labui-breadcrumb-'));
  await rm(consumer, { recursive: true, force: true });
}
