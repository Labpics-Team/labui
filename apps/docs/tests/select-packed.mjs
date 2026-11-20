import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, webkit } from '@playwright/test';
import { runPnpm, writePackedConsumerProject } from './packed-consumer-project.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = join(root, 'docs/evidence/select-20261119');
const consumer = await mkdtemp(join(tmpdir(), 'labui-select-'));
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
    typescript: '5.7.3',
    '@types/react': '18.3.18',
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
    dependencies[pkg.name] = overrides[pkg.name] = `file:./packs/${name}`;
    archives.push({
      name: pkg.name,
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs', name)))
        .digest('hex'),
    });
  }
  if (process.env.LAB_ICONS_TARBALL) {
    await copyFile(process.env.LAB_ICONS_TARBALL, join(consumer, 'packs/icons.tgz'));
    dependencies['@labpics/icons'] = overrides['@labpics/icons'] = 'file:./packs/icons.tgz';
    archives.push({
      name: '@labpics/icons',
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs/icons.tgz')))
        .digest('hex'),
    });
  }
  await writePackedConsumerProject(consumer, { name: 'select-consumer', dependencies, overrides });
  runPnpm(
    ['install', '--ignore-scripts', '--config.auto-install-peers=false', '--prefer-offline'],
    consumer,
  );
  const { leading } = JSON.parse(await readFile(join(output, 'source.json'), 'utf8'));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="currentColor" transform="translate(${leading.x} ${leading.y})" d="${leading.data}"/></svg>`;
  await writeFile(
    join(consumer, 'shared.mjs'),
    `
    import {createElement as h} from 'react';
    import {Select} from '@labpics/ui-react/select';
    export const items=[{value:'',label:'Empty key'},{value:'a',label:'Chip label'},{value:'b',label:'Chip 2'},{value:'c',label:'Chip 3'}];
    export const tree=()=>h('form',{'data-react-form':''},h(Select,{items,label:'Label',name:'team',multiple:true,defaultValue:['a','b','c']}));
  `,
  );
  await writeFile(
    join(consumer, 'server.mjs'),
    `
    import {writeFile} from 'node:fs/promises';
    import {renderToString} from 'react-dom/server';
    import {items,tree} from './shared.mjs';
    const parts=[];
    for(const name of ['vue','solid','svelte','astro']) {
      const {renderSelect}=await import('@labpics/ui-'+name+'/ssr');
      parts.push('<form data-renderer="'+name+'">'+renderSelect({items,label:'Label',name:'team',multiple:true,defaultValue:['a','b','c']})+'</form>');
      parts.push('<form data-controlled="'+name+'">'+renderSelect({items,label:'Hidden caption',name:'team',multiple:true,showLabel:false,value:['','a']})+'</form>');
      parts.push('<form data-empty="'+name+'">'+renderSelect({items,label:'Empty',name:'team',multiple:true,value:[],defaultValue:['b']})+'</form>');
    }
    const {renderSelect}=await import('@labpics/ui-vue/ssr');
    for(const size of ['s','m','l'])parts.push('<section data-dropdown="'+size+'">'+renderSelect({items:[{value:'x',label:'Label'}],label:'Dropdown',size,defaultValue:['x']},{leading:${JSON.stringify(svg)}})+'</section>');
    parts.push('<section data-gallery style="display:grid;gap:28px;width:320px;padding:10px">'+
      '<div data-long>'+renderSelect({items:[{value:'long',label:'An unusually long selected option that still needs its removal action'}],label:'Long selection',multiple:true,defaultValue:['long']})+'</div>'+
      '<div data-disabled>'+renderSelect({items,label:'Disabled',multiple:true,disabled:true,defaultValue:['a','b']})+'</div>'+
      '<div data-hover>'+renderSelect({items,label:'Hover',multiple:true,defaultValue:['a','c']})+'</div>'+
      '<div data-open>'+renderSelect({items,label:'Open',multiple:true,defaultValue:['b']})+'</div></section>');
    parts.push('<section data-renderer="react" id="react-root">'+renderToString(tree())+'</section>');
    await writeFile('index.html','<!doctype html><html data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/client.css"><style>html{background:var(--lab-bg-primary);color:var(--lab-label-primary)}body{margin:24px;display:grid;gap:24px;font-family:Geist}form,section{margin:0;max-width:768px}form{padding-top:8px}section[data-dropdown]{width:max-content}</style></head><body>'+parts.join('')+'<script type="module" src="/client.js"></script></body></html>');
  `,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
    import '@labpics/fonts/fonts.css'; import '@labui/colors/contract.css';
    import '@labpics/ui-core/tokens.css'; import '@labpics/ui-core/select.css';
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
    import {hydrateRoot} from 'react-dom/client';
    window.hydrateSelect=async()=>{
      await import('@labpics/ui-core/select');
      await Promise.all([...document.querySelectorAll('lab-select')].map(el=>el.updateComplete));
      const {tree}=await import('./shared.mjs');hydrateRoot(document.getElementById('react-root'),tree());window.hydrated=true;
    };
  `,
  );
  await writeFile(
    join(consumer, 'types.tsx'),
    `
    import {Select} from '@labpics/ui-react/select';
    import type {LabSelect,LabSelectItem} from '@labpics/ui-core/select';
    import {renderSelect} from '@labpics/ui-vue/ssr';
    const items:LabSelectItem[]=[{value:'',label:'Empty key'}];
    const element:LabSelect=document.createElement('lab-select');element.value=null;element.showLabel=false;element.required=true;
    renderSelect({items,multiple:true,showLabel:false,value:[]});
    const react=<Select items={items} multiple label="Team" showLabel={false} required value={[]} onValueChange={(value:string[])=>void value}/>;void react;
  `,
  );
  execFileSync(
    process.execPath,
    [
      'node_modules/typescript/bin/tsc',
      '--noEmit',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'es2022',
      '--jsx',
      'react-jsx',
      '--skipLibCheck',
      'types.tsx',
    ],
    { cwd: consumer, stdio: 'pipe' },
  );
  execFileSync(process.execPath, ['server.mjs'], { cwd: consumer, stdio: 'pipe' });
  await writeFile(
    join(consumer, 'build.mjs'),
    `import {build} from 'esbuild';await build({entryPoints:['client.js'],outdir:'web',bundle:true,format:'esm',splitting:true,loader:{'.woff2':'file'},assetNames:'[name]-[hash]'});`,
  );
  execFileSync(process.execPath, ['build.mjs'], { cwd: consumer, stdio: 'pipe' });
  await writeFile(join(consumer, 'web/index.html'), await readFile(join(consumer, 'index.html')));
  server = createServer(async (request, response) => {
    const file = resolve(consumer, 'web', `.${request.url === '/' ? '/index.html' : request.url}`);
    if (!file.startsWith(join(consumer, 'web'))) return response.writeHead(403).end();
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
      const nojs = await browser.newPage({ javaScriptEnabled: false });
      await nojs.goto(url);
      for (const name of ['vue', 'solid', 'svelte', 'astro', 'react']) {
        await expect(nojs.locator(`[data-renderer="${name}"] .lab-chip-label`)).toHaveText([
          'Chip label',
          'Chip 2',
          'Chip 3',
        ]);
      }
      await expect(nojs.locator('[data-dropdown="s"] .lab-select-leading')).toBeVisible();
      await nojs.close();
      const page = await browser.newPage({
        viewport: { width: 1000, height: 1600 },
        deviceScaleFactor: 2,
      });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(url);
      await page.waitForFunction(() => window.hydrateSelect);
      await page.locator('[data-renderer] button').evaluateAll((nodes) => {
        for (const node of nodes) node.__original = true;
      });
      await page.evaluate(() => window.hydrateSelect());
      await page.waitForFunction(() => window.hydrated);
      await page.evaluate(() => document.fonts.ready);
      for (const name of ['vue', 'solid', 'svelte', 'astro', 'react']) {
        const section = page.locator(`[data-renderer="${name}"]`);
        assert.ok(
          await section
            .locator('button')
            .evaluateAll((nodes) => nodes.every((node) => node.__original)),
        );
        await section.getByRole('button', { name: 'Remove Chip 2' }).click();
        await expect(section.locator('.lab-chip-label')).toHaveText(['Chip label', 'Chip 3']);
        const form = name === 'react' ? section.locator('form') : section;
        await expect
          .poll(() => form.evaluate((node) => [...new FormData(node).values()]))
          .toEqual(['a', 'c']);
        await form.evaluate((node) => node.reset());
        await expect(section.locator('.lab-chip-label')).toHaveText([
          'Chip label',
          'Chip 2',
          'Chip 3',
        ]);
      }
      for (const name of ['vue', 'solid', 'svelte', 'astro']) {
        const controlled = page.locator(`[data-controlled="${name}"]`);
        await controlled.getByRole('button', { name: 'Remove Empty key' }).click();
        await expect(controlled.locator('.lab-chip-label')).toHaveText(['Empty key', 'Chip label']);
        await expect(controlled.getByRole('combobox')).toHaveAccessibleName(/Hidden caption/);
        await expect(page.locator(`[data-empty="${name}"] .lab-chip-label`)).toHaveCount(0);
      }
      const metrics = [];
      for (const theme of ['light', 'dark'])
        for (const scale of [1, 1.25, 2]) {
          await page.evaluate(
            ({ theme, scale }) => {
              document.documentElement.dataset.theme = theme;
              document.documentElement.style.fontSize = `${16 * scale}px`;
            },
            { theme, scale },
          );
          for (const [size, height] of [
            ['s', 32],
            ['m', 48],
            ['l', 56],
          ]) {
            const dropdown = page.locator(`[data-dropdown="${size}"]`);
            await expect
              .poll(() =>
                dropdown
                  .getByRole('combobox')
                  .evaluate((node) => node.getBoundingClientRect().height),
              )
              .toBe(height * scale);
            await expect(dropdown.locator('.lab-select-leading')).toBeVisible();
            await dropdown.screenshot({
              path: join(output, `${engine}-${theme}-${scale}-dropdown-${size}.png`),
            });
          }
          const multi = page.locator('[data-renderer="vue"]');
          metrics.push({
            theme,
            scale,
            frame: await multi.locator('.lab-select-control').boundingBox(),
            chip: await multi.getByRole('button', { name: 'Remove Chip label' }).boundingBox(),
          });
          await multi.screenshot({
            path: join(output, `${engine}-${theme}-${scale}-multiselect.png`),
          });
          const gallery = page.locator('[data-gallery]');
          const long = gallery.getByRole('button', {
            name: 'Remove An unusually long selected option that still needs its removal action',
          });
          const chipBounds = await long.boundingBox();
          const longBounds = await gallery.locator('[data-long]').boundingBox();
          assert.ok(
            chipBounds.x >= longBounds.x &&
              chipBounds.x + chipBounds.width <= longBounds.x + longBounds.width,
          );
          await expect(gallery.locator('[data-disabled]').getByRole('combobox')).toBeDisabled();
          await gallery.locator('[data-hover] .lab-select-control').hover();
          await gallery.screenshot({
            path: join(output, `${engine}-${theme}-${scale}-states.png`),
          });
          await gallery.locator('[data-open]').getByRole('combobox').focus();
          await page.keyboard.press('ArrowDown');
          const listbox = gallery.locator('[data-open]').getByRole('listbox');
          await expect(listbox).toBeVisible();
          await listbox.screenshot({ path: join(output, `${engine}-${theme}-${scale}-open.png`) });
          await page.keyboard.press('Escape');
        }
      await page
        .locator('[data-long]')
        .getByRole('button', {
          name: 'Remove An unusually long selected option that still needs its removal action',
        })
        .click();
      await expect(page.locator('[data-long] .lab-chip-label')).toHaveCount(0);
      assert.deepEqual(errors, []);
      records.push({
        engine,
        browser: browser.version(),
        archives,
        SSRHelpers: ['vue', 'solid', 'svelte', 'astro'],
        nativeReact: true,
        sameNodesAfterHydration: true,
        forms: true,
        controlledRejection: true,
        emptyStringKey: true,
        longTextRemoval: true,
        disabledHoverOpenRenders: true,
        metrics,
        errors,
      });
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    join(output, 'installed.generated.json'),
    `${JSON.stringify(records, null, 2)}\n`,
  );
  console.info('Select packed consumer, types, SSR, forms and both browser renders passed');
} finally {
  await new Promise((resolve) => server?.close(resolve) ?? resolve());
  await rm(consumer, { recursive: true, force: true });
}
