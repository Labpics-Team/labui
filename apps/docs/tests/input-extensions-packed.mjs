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
const output = join(root, 'docs/evidence/input-extensions-20261120');
const consumer = await mkdtemp(join(tmpdir(), 'labui-input-extensions-'));
const archives = [];
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
  await writePackedConsumerProject(consumer, {
    name: 'input-extensions-consumer',
    dependencies,
    overrides,
  });
  pnpm(['install', '--ignore-scripts', '--offline', '--config.auto-install-peers=false'], consumer);
  await writeFile(
    join(consumer, 'shared.mjs'),
    `
  import{createElement as h}from'react';import{Combobox}from'@labpics/ui-react/combobox';import{NumberInput}from'@labpics/ui-react/number-input';import{TagsInput}from'@labpics/ui-react/tags-input';
  export const items=[{value:'a',label:'Архитектура'},{value:'b',label:'Брендинг'},{value:'c',label:'Исследование',disabled:true}];
  export const props={combo:{label:'Специализация',name:'specialty',items,defaultValue:['a']},number:{label:'Количество',name:'quantity',min:0,max:10,step:.1,defaultValue:'2'},tags:{label:'Направления',name:'tags',defaultValue:['Дизайн','Системы'],addOnPaste:true}};
  export function App(){return h('form',null,h(Combobox,props.combo),h(NumberInput,props.number),h(TagsInput,props.tags),h('button',{type:'reset'},'Сбросить'))}
 `,
  );
  await writeFile(
    join(consumer, 'server.mjs'),
    `
  import{writeFile}from'node:fs/promises';import{createElement as h}from'react';import{renderToString}from'react-dom/server';import{App,props}from'./shared.mjs';
  const sections=['<section data-renderer="react"><h2>React</h2><div data-react>'+renderToString(h(App))+'</div></section>'];
  for(const name of ['vue','solid','svelte','astro']){const api=await import('@labpics/ui-'+name+'/ssr');sections.push('<section data-renderer="'+name+'"><h2>'+name+'</h2><form>'+api.renderCombobox(props.combo)+api.renderNumberInput(props.number)+api.renderTagsInput(props.tags)+'<button type="reset">Сбросить</button></form></section>');}
  await writeFile('index.html','<!doctype html><html class="lab-scope" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="client.css"><style>body{margin:32px;background:var(--lab-bg-primary);color:var(--lab-label-primary);font-family:var(--lab-font-family)}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:48px;max-width:1000px;margin:auto}form{display:flex;flex-direction:column;gap:32px;min-width:0}section{min-width:0}h2{font-size:1.25rem;margin:0 0 32px}button{font:inherit}button[type=reset]{align-self:flex-start;border:0;padding:0;background:transparent;color:var(--lab-label-secondary);cursor:pointer}@media(max-width:600px){main{grid-template-columns:1fr}}</style></head><body><main>'+sections.join('')+'</main><script type="module" src="client.js"></script></body></html>');
 `,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
  import'@labpics/fonts/fonts.css';import'@labui/colors/contract.css';import'@labpics/ui-core/tokens.css';import'@labpics/ui-core/input-extensions.css';
  import'@lit-labs/ssr-client/lit-element-hydrate-support.js';import{createElement as h}from'react';import{hydrateRoot}from'react-dom/client';import{App}from'./shared.mjs';
  window.hydrate=async()=>{await Promise.all([import('@labpics/ui-core/combobox'),import('@labpics/ui-core/number-input'),import('@labpics/ui-core/tags-input')]);const root=hydrateRoot(document.querySelector('[data-react]'),h(App));window.unmount=()=>root.unmount();window.ready=true};
 `,
  );
  await writeFile(
    join(consumer, 'types.mts'),
    `import{Combobox,type ComboboxProps}from'@labpics/ui-react/combobox';import{NumberInput,type NumberInputProps}from'@labpics/ui-react/number-input';import{TagsInput,type TagsInputProps}from'@labpics/ui-react/tags-input';const c:ComboboxProps={items:[],label:'Label',value:[]};const n:NumberInputProps={label:'Number',step:.1,onValueCommit:(value,number)=>{void value;void number}};const t:TagsInputProps={label:'Tags',allowDuplicates:true};void Combobox;void NumberInput;void TagsInput;void c;void n;void t;`,
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
      "require('@labpics/ui-react/combobox');require('@labpics/ui-react/number-input');require('@labpics/ui-react/tags-input')",
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
  server = createServer(async (req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0]);
    if (name === '/favicon.ico') return res.writeHead(204).end();
    if (name.includes('..')) return res.writeHead(403).end();
    try {
      res.setHeader(
        'Content-Type',
        name.endsWith('.js')
          ? 'text/javascript'
          : name.endsWith('.css')
            ? 'text/css'
            : name.endsWith('.woff2')
              ? 'font/woff2'
              : 'text/html',
      );
      res.end(
        await readFile(
          name === '/' ? join(consumer, 'index.html') : join(consumer, 'public', name.slice(1)),
        ),
      );
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  for (const [engine, type] of [
    ['chromium', chromium],
    ['webkit', webkit],
  ]) {
    const browser = await type.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 860 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      for (const renderer of ['react', 'vue', 'solid', 'svelte', 'astro']) {
        const host = page.locator(`[data-renderer="${renderer}"]`);
        await expect(host.locator('.lab-input-outline')).toHaveCount(3);
        await expect(host.locator('input[role="combobox"]')).toHaveValue('Архитектура');
      }
      await page.evaluate(() => window.hydrate());
      await page.waitForFunction(() => window.ready);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(
        await page.evaluate(() =>
          Array.from(document.fonts).some(
            (font) => font.family === 'Geist' && font.status === 'loaded',
          ),
        ),
        true,
      );
      for (const renderer of ['react', 'vue', 'solid', 'svelte', 'astro']) {
        const host = page.locator(`[data-renderer="${renderer}"]`);
        const form = host.locator('form');
        const combo = host.getByRole('combobox');
        const number = host.getByRole('spinbutton');
        await expect(combo).toHaveValue('Архитектура');
        await combo.fill('Брен');
        await combo.press('ArrowDown');
        await combo.press('Enter');
        await expect(combo).toHaveValue('Брендинг');
        await number.press('ArrowUp');
        await expect(number).toHaveValue('2.1');
        const tags = host.locator('.lab-tags-input-input');
        await tags.fill('Анимация');
        await tags.press('Enter');
        await expect
          .poll(() => form.evaluate((el) => [...new FormData(el)]))
          .toEqual([
            ['specialty', 'b'],
            ['quantity', '2.1'],
            ['tags', 'Дизайн'],
            ['tags', 'Системы'],
            ['tags', 'Анимация'],
          ]);
        await form.getByRole('button', { name: 'Сбросить' }).click();
        await expect(number).toHaveValue('2');
        records.push({
          engine,
          renderer,
          forms: true,
          hydration: true,
          keyboard: true,
          reset: true,
        });
      }
      for (const theme of ['light', 'dark']) {
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);
        await page.screenshot({ path: join(output, `${engine}-${theme}-100.png`), fullPage: true });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '32px';
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
        true,
      );
      for (const theme of ['light', 'dark']) {
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);
        await page.screenshot({ path: join(output, `${engine}-${theme}-200.png`), fullPage: true });
      }
      assert.deepEqual(errors, []);
      await page.evaluate(() => window.unmount());
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    join(output, 'packed.json'),
    `${JSON.stringify({ archives, records }, null, 2)}\n`,
  );
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(consumer, { recursive: true, force: true });
}
