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
const evidence = join(root, 'docs/evidence/calendar-20261123');
const consumer = await mkdtemp(join(tmpdir(), 'labui-calendar-'));
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
    vue: '3.5.42',
    'solid-js': '1.9.9',
    svelte: '5.19.0',
    esbuild: '0.25.12',
    typescript: '5.7.3',
    lit: '3.3.3',
    '@lit-labs/ssr': '4.1.0',
    '@lit-labs/ssr-client': '1.1.8',
  };
  const overrides = {};
  for (const folder of [
    'fonts',
    'tokens',
    'colors',
    'shadow',
    'materials',
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
      source: 'qualification artifact; no registry publication claim',
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs/icons.tgz')))
        .digest('hex'),
    });
  }
  await writePackedConsumerProject(consumer, {
    name: 'calendar-installed',
    dependencies,
    overrides,
  });
  runPnpm(['install', '--ignore-scripts', '--prefer-offline'], consumer);
  await writeFile(
    join(consumer, 'ssr.mjs'),
    `
    import assert from 'node:assert/strict';import {createRequire} from 'node:module';import{writeFile}from'node:fs/promises';
    import{createElement}from'react';import{renderToString as renderReact}from'react-dom/server';
    import{html,renderToString}from'@labpics/ui-core/ssr';import'@labpics/ui-core/calendar';
    const props={today:'2024-05-15',defaultMonth:'2024-05-01',defaultValue:['2024-05-15'],name:'dates',unavailableDates:['2024-05-20'],events:{'2024-05-15':7},translations:{events:'Событий: {count}'}};
    const lit=renderToString(html\`<lab-calendar today="2024-05-15" default-month="2024-05-01"></lab-calendar>\`);
    assert.match(lit,/May 2024/);assert.match(lit,/shadowrootmode/);
    for(const api of [await import('@labpics/ui-react/calendar'),createRequire(import.meta.url)('@labpics/ui-react/calendar')]){const output=renderReact(createElement(api.Calendar,props));assert.match(output,/May 2024/);await writeFile('react.html',output);}
    for(const framework of ['vue','solid','svelte','astro']){
      const {renderCalendar}=await import('@labpics/ui-'+framework+'/ssr');const output=renderCalendar(props);
      assert.match(output,/May 2024/);assert.match(output,/shadowrootmode/);
      if(framework==='astro')await writeFile('astro.html',output);
    }
  `,
  );
  execFileSync(process.execPath, ['ssr.mjs'], { cwd: consumer, windowsHide: true });
  await writeFile(
    join(consumer, 'main.tsx'),
    `
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
    import '@labpics/fonts/fonts.css';import '@labui/colors/contract.css';import '@labpics/ui-tokens/tokens.css';import '@labpics/ui-core/theme.css';import '@labpics/ui-materials/material.css';import '@labpics/ui-core/calendar';
    import '@labpics/ui-core/calendar.css';
    import {Calendar,type CalendarProps} from '@labpics/ui-react/calendar';import{hydrateRoot}from'react-dom/client';
    import{Calendar as VueCalendar}from'@labpics/ui-vue/calendar';import{createApp,h}from'vue';
    import{Calendar as SolidCalendar}from'@labpics/ui-solid/calendar';import{render}from'solid-js/web';import{createComponent}from'solid-js';
    import{Calendar as SvelteCalendar}from'@labpics/ui-svelte';import{mount}from'svelte';
    const props={today:'2024-05-15',defaultMonth:'2024-05-01',defaultValue:['2024-05-15'],name:'dates',unavailableDates:['2024-05-20'],events:{'2024-05-15':7},translations:{events:'Событий: {count}'}} satisfies CalendarProps;
    hydrateRoot(document.querySelector('#react')!,<Calendar {...props}/>,{onRecoverableError(error){throw error;}});
    createApp({render:()=>h(VueCalendar,props)}).mount('#vue');
    render(()=>createComponent(SolidCalendar,props),document.querySelector('#solid')!);
    mount(SvelteCalendar,{target:document.querySelector('#svelte')!,props});
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
  await writeFile(
    join(consumer, 'build.mjs'),
    `
    import{build}from'esbuild';import{compile}from'svelte/compiler';import{readFile}from'node:fs/promises';
    await build({entryPoints:['main.tsx'],bundle:true,format:'esm',jsx:'automatic',outdir:'public',loader:{'.woff2':'file','.webp':'file'},conditions:['browser'],
      plugins:[{name:'svelte',setup(build){build.onLoad({filter:/\\.svelte$/},async({path})=>({contents:compile(await readFile(path,'utf8'),{filename:path,generate:'client'}).js.code,loader:'js'}))}}]});
  `,
  );
  execFileSync(process.execPath, ['build.mjs'], { cwd: consumer, windowsHide: true });
  const astro = await readFile(join(consumer, 'astro.html'), 'utf8');
  const react = await readFile(join(consumer, 'react.html'), 'utf8');
  await writeFile(
    join(consumer, 'public/index.html'),
    `<!doctype html><html lang="en" class="lab-scope" data-theme="light" data-material="solid"><meta charset="utf-8"><title>Installed Calendar</title><link rel="stylesheet" href="main.css"><style>body{margin:24px;font-family:var(--lab-font-family)}form{margin-block:24px}</style><form id="lit"><lab-calendar name="dates" today="2024-05-15" default-month="2024-05-01"></lab-calendar></form><form id="react">${react}</form>${['vue', 'solid', 'svelte'].map((name) => `<form id="${name}"></form>`).join('')}<form id="astro">${astro}</form><script type="module" src="main.js"></script></html>`,
  );
  const publicRoot = resolve(consumer, 'public');
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const path = resolve(publicRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
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
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      for (const renderer of ['lit', 'react', 'vue', 'solid', 'svelte', 'astro']) {
        const scope = page.locator(`#${renderer}`);
        await expect(scope.locator('.lab-calendar-day')).toHaveCount(42);
        if (renderer !== 'lit') {
          await expect(scope.locator('[data-date="2024-05-20"]')).toHaveAttribute(
            'aria-disabled',
            'true',
          );
          await expect(scope.locator('[data-date="2024-05-15"]')).toHaveAccessibleName(
            /Событий: 7/,
          );
        }
        await scope.locator('[data-date="2024-05-17"]').click();
        await expect(scope.locator('[data-date="2024-05-17"]')).toHaveAttribute('data-active', '');
        expect(await scope.evaluate((form) => new FormData(form).getAll('dates'))).toEqual([
          '2024-05-17',
        ]);
        await scope.getByRole('button', { name: 'Next month' }).click();
        await expect(scope.locator('.lab-calendar-title')).toHaveText('June 2024');
        const grid = await scope.locator('.lab-calendar-grid').evaluate((el) => ({
          display: getComputedStyle(el).display,
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
        }));
        expect(grid.display).toBe('grid');
        expect(grid.width).toBeCloseTo(grid.height, 0);
      }
      expect(errors).toEqual([]);
      results.push({
        browser: engine.name(),
        version: browser.version(),
        renderers: ['lit', 'react', 'vue', 'solid', 'svelte', 'astro'],
        selection: true,
        month: true,
        formData: true,
        squareGrid: true,
      });
    } finally {
      await browser.close();
    }
  }
  await mkdir(evidence, { recursive: true });
  await writeFile(
    join(evidence, 'packed.json'),
    `${JSON.stringify({ archives, ssr: ['lit', 'react-esm', 'react-cjs', 'vue', 'solid', 'svelte', 'astro'], declarationConsumer: true, results }, null, 2)}\n`,
  );
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.ok(resolve(consumer).startsWith(resolve(tmpdir(), 'labui-calendar-')));
  await rm(consumer, { recursive: true, force: true });
}
