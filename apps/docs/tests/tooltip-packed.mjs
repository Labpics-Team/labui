import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, webkit } from '@playwright/test';
import { runPnpm as pnpm, writePackedConsumerProject } from './packed-consumer-project.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = join(root, 'docs/evidence/tooltip');
const reactVersion = process.env.LAB_TOOLTIP_REACT_VERSION ?? '18.3.1';
const consumer = await mkdtemp(join(tmpdir(), 'labui-tooltip-'));
let server;
try {
  await mkdir(output, { recursive: true });
  await mkdir(join(consumer, 'packs'));
  const dependencies = {
    react: reactVersion,
    'react-dom': reactVersion,
    lit: '3.3.3',
    '@lit-labs/ssr': '4.1.0',
    '@lit-labs/ssr-client': '1.1.8',
    '@labpics/icons': '0.4.0',
    esbuild: '0.25.0',
    typescript: '5.7.3',
    '@types/react': '18.3.18',
  };
  const overrides = {};
  const archives = [];
  let iconsArtifact;
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
      name,
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs', name)))
        .digest('hex'),
    });
  }
  if (process.env.LAB_ICONS_TARBALL) {
    await copyFile(process.env.LAB_ICONS_TARBALL, join(consumer, 'packs/icons.tgz'));
    dependencies['@labpics/icons'] = overrides['@labpics/icons'] = 'file:./packs/icons.tgz';
    iconsArtifact = {
      name: '@labpics/icons',
      version: '0.4.0',
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs/icons.tgz')))
        .digest('hex'),
    };
  }
  await writePackedConsumerProject(consumer, {
    name: 'labui-tooltip-consumer',
    dependencies,
    overrides,
  });
  await writeFile(
    join(consumer, 'pnpm-workspace.yaml'),
    JSON.stringify({ packages: ['.'], overrides, autoInstallPeers: false }),
  );
  pnpm(['install', '--ignore-scripts', '--prefer-offline'], consumer);
  await writeFile(
    join(consumer, 'shared.mjs'),
    `
    import {createElement as h,version} from 'react';import {Tooltip} from '@labpics/ui-react/tooltip';import {Button} from '@labpics/ui-react/button';
    function controlRef(node){if(node){window.refAttached++;if(Number.parseInt(version,10)>=19)return()=>window.refDetached++}else window.refDetached++}
    export function App(){return h(Tooltip,{content:'Hello, my name is Tooltip'},h(Button,{ref:controlRef,onClick:()=>window.clicks++},'Help'))}
  `,
  );
  await writeFile(
    join(consumer, 'server.mjs'),
    `
    import {writeFile} from 'node:fs/promises';import {createElement as h} from 'react';import {renderToString} from 'react-dom/server';import {App} from './shared.mjs';
    const parts=['<section data-renderer="react">'+renderToString(h(App))+'</section>'];
    for(const name of ['vue','solid','svelte','astro']){const {renderTooltip}=await import('@labpics/ui-'+name+'/ssr');parts.push('<section data-renderer="'+name+'">'+renderTooltip({content:'Hello, my name is Tooltip'},{default:'<button>Help</button>'})+'</section>')}
    await writeFile('index.html','<!doctype html><html data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="client.css"><style>body{margin:64px;background:#f4f4f4;font-family:Geist}section{display:inline-block;padding:64px 48px}button{font:inherit}</style></head><body>'+parts.join('')+'<script type="module" src="client.js"></script></body></html>');
  `,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
    import '@labpics/fonts/fonts.css';import '@labui/colors/contract.css';import '@labpics/ui-core/tokens.css';import '@labpics/ui-core/tooltip.css';
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';import {createElement as h} from 'react';import {hydrateRoot} from 'react-dom/client';import {App} from './shared.mjs';
    window.clicks=0;window.refAttached=0;window.refDetached=0;window.hydrate=async()=>{await import('@labpics/ui-core/tooltip');const root=hydrateRoot(document.querySelector('[data-renderer="react"]'),h(App));window.unmountReact=()=>root.unmount();window.ready=true};
  `,
  );
  await writeFile(
    join(consumer, 'types.mts'),
    `import {Tooltip,type TooltipProps} from '@labpics/ui-react/tooltip';import type {LabTooltipType,LabTooltipTail} from '@labpics/ui-core/tooltip';const type:LabTooltipType='accent';const tail:LabTooltipTail='bubble';const props:TooltipProps={type,tail};void Tooltip;void props;`,
  );
  pnpm(
    [
      'exec',
      'tsc',
      '--noEmit',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2022',
      '--skipLibCheck',
      'types.mts',
    ],
    consumer,
  );
  execFileSync(process.execPath, ['server.mjs'], {
    cwd: consumer,
    stdio: 'pipe',
    windowsHide: true,
  });
  execFileSync(
    process.execPath,
    [
      '-e',
      "require('@labpics/ui-react/tooltip');require('@labpics/ui-vue/ssr').renderTooltip({content:'Help'},{default:'<button>Help</button>'})",
    ],
    { cwd: consumer, stdio: 'pipe', windowsHide: true },
  );
  pnpm(
    [
      'exec',
      'esbuild',
      'client.js',
      '--bundle',
      '--format=esm',
      '--outdir=public',
      '--loader:.woff2=file',
      '--loader:.woff=file',
      '--loader:.ttf=file',
      '--loader:.webp=file',
    ],
    consumer,
  );
  server = createServer(async (request, response) => {
    const name = decodeURIComponent(request.url.split('?')[0]);
    if (name === '/favicon.ico') return response.writeHead(204).end();
    if (name.includes('..')) return response.writeHead(403).end();
    try {
      response.setHeader(
        'Content-Type',
        name.endsWith('.js')
          ? 'text/javascript'
          : name.endsWith('.css')
            ? 'text/css'
            : name.endsWith('.woff2')
              ? 'font/woff2'
              : 'text/html',
      );
      response.end(
        await readFile(
          name === '/' ? join(consumer, 'index.html') : join(consumer, 'public', name.slice(1)),
        ),
      );
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const records = [];
  for (const [engine, launch] of [
    ['chromium', chromium],
    ['webkit', webkit],
  ]) {
    const browser = await launch.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => {
        if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
      });
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      // Server output has exactly one real control per renderer before registration.
      for (const renderer of ['react', 'vue', 'solid', 'svelte', 'astro'])
        await expect(page.locator(`[data-renderer="${renderer}"] button`)).toHaveCount(1);
      await page.evaluate(() => window.hydrate());
      await page.waitForFunction(() => window.ready);
      await page.evaluate(() => document.fonts.ready);
      for (const renderer of ['react', 'vue', 'solid', 'svelte', 'astro']) {
        const host = page.locator(`[data-renderer="${renderer}"]`);
        const trigger = host.locator('button');
        await trigger.hover();
        const surface = host.locator('.lab-tooltip-content');
        await expect(surface).toBeVisible();
        await expect(trigger).toHaveAccessibleDescription('Hello, my name is Tooltip');
        await surface.hover();
        await page.waitForTimeout(220);
        await expect(surface).toBeVisible();
        const metrics = await surface.evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            width: el.getBoundingClientRect().width,
            height: el.getBoundingClientRect().height,
            font: style.fontSize,
            lineHeight: style.lineHeight,
            tracking: style.letterSpacing,
            clip: getComputedStyle(el, '::before').clipPath,
          };
        });
        assert.equal(metrics.height, 48);
        assert.equal(metrics.font, '16px');
        assert.notEqual(metrics.clip, 'none');
        records.push({ engine, renderer, metrics });
        const box = await surface.boundingBox();
        await page.screenshot({
          path: join(output, `${engine}-${renderer}.png`),
          clip: {
            x: Math.max(0, box.x - 48),
            y: Math.max(0, box.y - 48),
            width: box.width + 96,
            height: 180,
          },
        });
        await page.keyboard.press('Escape');
        await expect(surface).toBeHidden();
        await page.mouse.move(0, 0);
        await page.keyboard.press('Tab');
        await trigger.focus();
        await expect(surface).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(surface).toBeHidden();
        await expect(trigger).toBeFocused();
      }
      await page.locator('[data-renderer="react"] button').click();
      assert.equal(await page.evaluate(() => window.clicks), 1);
      // The installed Astro SSR entry is a convenient isolated source specimen.
      // Its real control remains mounted; only its paint is hidden for comparison.
      await page.evaluate(() => {
        for (const section of document.querySelectorAll('section')) {
          const visible = section.dataset.renderer === 'astro';
          section.style.display = visible ? 'block' : 'none';
          if (visible) {
            section.style.cssText = 'position:absolute;left:140px;top:150px;padding:0';
            section.querySelector('button').style.opacity = '0';
          }
        }
        document.querySelector('lab-tooltip').placement = 'top';
      });
      const specimen = page.locator('[data-renderer="astro"]');
      for (const theme of ['light', 'dark'])
        for (const type of ['neutral', 'inverted', 'accent'])
          for (const tail of ['chevron', 'bubble']) {
            await page.evaluate(
              ({ theme, type, tail }) => {
                document.documentElement.dataset.theme = theme;
                document.body.style.background = theme === 'light' ? '#f4f4f4' : '#1e1e1e';
                const tip = document.querySelector('[data-renderer="astro"] lab-tooltip');
                tip.type = type;
                tip.tail = tail;
                tip.placement = 'top';
              },
              { theme, type, tail },
            );
            await page.mouse.move(0, 0);
            await specimen.locator('button').hover();
            const surface = specimen.locator('.lab-tooltip-content');
            await expect(surface).toBeVisible();
            await page.waitForTimeout(80);
            const box = await surface.boundingBox();
            await page.screenshot({
              path: join(output, `${engine}-${theme}-${type}-${tail}.png`),
              clip: { x: box.x - 48, y: box.y - 48, width: box.width + 96, height: 180 },
            });
            await page.keyboard.press('Escape');
          }
      await page.evaluate(() => window.unmountReact());
      const refs = await page.evaluate(() => [window.refAttached, window.refDetached]);
      assert.ok(refs[0] > 0);
      assert.equal(refs[0], refs[1], 'consumer ref must clean up on unmount');
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    join(output, reactVersion.startsWith('19.') ? 'packed-react19.json' : 'packed.json'),
    JSON.stringify(
      {
        archives,
        reactVersion,
        publicIcons: !process.env.LAB_ICONS_TARBALL,
        iconsArtifact,
        declarations: true,
        records,
      },
      null,
      2,
    ),
  );
  console.info(
    'Installed Tooltip: React + four generated adapters, SSR/hydration, actual-control accessibility and both browser engines passed.',
  );
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.equal(dirname(consumer), resolve(tmpdir()));
  assert.ok(consumer.includes('labui-tooltip-'));
  await rm(consumer, { recursive: true, force: true });
}
