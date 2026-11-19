import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, webkit } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = join(root, 'docs/evidence/segmented-20261119');
const consumer = await mkdtemp(join(tmpdir(), 'labui-segmented-'));
const corepack = join(dirname(process.execPath), 'node_modules/corepack/dist/corepack.js');
const pnpm = (args, cwd = root) =>
  execFileSync(process.execPath, [corepack, 'pnpm', ...args], { cwd, stdio: 'pipe' });
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
    pnpm(['pack', '--pack-destination', join(consumer, 'packs')], location);
    const name = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
    dependencies[pkg.name] = `file:./packs/${name}`;
    overrides[pkg.name] = `file:./packs/${name}`;
    archives.push({
      name,
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs', name)))
        .digest('hex'),
    });
  }
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({ type: 'module', dependencies, pnpm: { overrides } }),
  );
  pnpm(['install', '--ignore-scripts'], consumer);
  await writeFile(
    join(consumer, 'shared.mjs'),
    `
    import {createElement as h,useState} from 'react';
    import {SegmentedControl} from '@labpics/ui-react/segmented-control';
    export const items=[{value:'day',label:'Day'},{value:'week',label:'Week',disabled:true},{value:'month',label:'Month'}];
    function Dynamic(){const [props,setProps]=useState({items});if(typeof window!=='undefined')window.updateSegmentedProps=setProps;return h('form',{'data-dynamic':'react'},h(SegmentedControl,{name:'period',label:'Dynamic period',defaultValue:'day',...props}))}
    export const tree=()=>h('div',null,h(Dynamic),h(SegmentedControl,{items:[{value:'list',label:'List view',iconOnly:true,icon:h('svg',{'aria-hidden':true})},{value:'grid',label:'Grid view',iconOnly:true,icon:h('svg',{'aria-hidden':true})}],defaultValue:'list',label:'View','data-icon-sample':'react'}),...['normal','empty','controlled','unnamed'].map(kind=>h('form',{'data-kind':kind,key:kind},
      h(SegmentedControl,{items,name:kind==='unnamed'?undefined:'period',label:'Period',required:true,defaultValue:'day',...(kind==='empty'?{value:null}:kind==='controlled'?{value:'day'}:{})}),
      h('button',{type:'reset'},'Reset'))));
  `,
  );
  await writeFile(
    join(consumer, 'server.mjs'),
    `
    import {writeFile} from 'node:fs/promises';
    import {renderToString} from 'react-dom/server';
    import {items,tree} from './shared.mjs';
    const parts=[];
    for(const renderer of ['vue','solid','svelte','astro']) {
      const {renderSegmentedControl:render}=await import('@labpics/ui-'+renderer+'/ssr');
      for(const kind of ['normal','empty','controlled']) parts.push('<form data-renderer="'+renderer+'" data-kind="'+kind+'">'+
        render({items,name:'period',label:'Period',required:true,defaultValue:'day',...(kind==='empty'?{value:null}:kind==='controlled'?{value:'day'}:{})})+'<button type="reset">Reset</button></form>');
    }
    parts.push('<section data-renderer="react" id="react">'+renderToString(tree())+'</section>');
    const {renderSegmentedControl:render}=await import('@labpics/ui-vue/ssr');
    for(const shape of ['rounded','regular','sharp']) for(let count=2;count<=5;count++) parts.push('<section data-sample="'+shape+'-'+count+'" style="width:370px">'+
      render({items:Array.from({length:count},(_,i)=>({value:String(i+1),label:'Label '+(i+1)})),defaultValue:'1',shape,label:'Sample'})+'</section>');
    await writeFile('index.html','<!doctype html><html data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/client.css"><style>body{background:white;margin:24px;font-family:Geist}form{width:370px;margin:12px 0}section[data-sample]{margin:8px 0}</style></head><body>'+parts.join('')+'<script type="module" src="/client.js"></script></body></html>');
  `,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
    import '@labpics/fonts/fonts.css'; import '@labui/colors/contract.css'; import '@labpics/ui-core/tokens.css';
    import '@labpics/ui-core/segmented-control.css';
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
    import {hydrateRoot} from 'react-dom/client';
    window.hydrateSegmented=async()=>{
      await import('@labpics/ui-core/segmented-control');
      await Promise.all([...document.querySelectorAll('lab-segmented-control')].map(el=>el.updateComplete));
      const {tree}=await import('./shared.mjs'); hydrateRoot(document.getElementById('react'),tree());
      window.hydrated=true;
    };
  `,
  );
  await writeFile(
    join(consumer, 'types.tsx'),
    `
    import {SegmentedControl} from '@labpics/ui-react/segmented-control';
    import type {LabSegmentedControl,LabSegmentedItem} from '@labpics/ui-core/segmented-control';
    import {renderSegmentedControl} from '@labpics/ui-vue/ssr';
    const items:LabSegmentedItem[]=[{value:'a',label:'A'}];
    renderSegmentedControl({items,value:null,shape:'sharp'});
    const tree=<SegmentedControl items={items} value={null} shape="regular"/>;
    declare const host:LabSegmentedControl;host.value=null;const current:string|null=host.selectedValue;
    // @ts-expect-error source shapes are finite
    const invalid=<SegmentedControl items={items} shape="square"/>;
    void tree;void current;void invalid;
  `,
  );
  await writeFile(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        jsx: 'react-jsx',
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ['types.tsx'],
    }),
  );
  pnpm(['exec', 'tsc'], consumer);
  execFileSync(process.execPath, ['server.mjs'], { cwd: consumer, stdio: 'pipe' });
  await writeFile(
    join(consumer, 'build.mjs'),
    `import {build} from 'esbuild';await build({entryPoints:['client.js'],outdir:'web',bundle:true,format:'esm',splitting:true,loader:{'.woff2':'file'},assetNames:'[name]-[hash]'});`,
  );
  execFileSync(process.execPath, ['build.mjs'], { cwd: consumer, stdio: 'pipe' });
  await writeFile(join(consumer, 'web/index.html'), await readFile(join(consumer, 'index.html')));
  server = createServer(async (request, response) => {
    const file = resolve(consumer, 'web', `.${request.url === '/' ? '/index.html' : request.url}`);
    if (
      !file.startsWith(`${join(consumer, 'web')}/`) &&
      !file.startsWith(`${join(consumer, 'web')}\\`)
    ) {
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
      const nojs = await browser.newPage({ javaScriptEnabled: false });
      await nojs.goto(url);
      for (const renderer of ['vue', 'solid', 'svelte', 'astro', 'react']) {
        const form = nojs.locator(
          renderer === 'react'
            ? '[data-renderer="react"] [data-kind="normal"]'
            : `[data-renderer="${renderer}"][data-kind="normal"]`,
        );
        await expect(form.getByRole('radio', { name: 'Day', exact: true })).toBeChecked();
        await expect(form.getByRole('radio', { name: 'Week', exact: true })).toBeDisabled();
        await expect(form.locator('input[tabindex="0"]')).toHaveCount(1);
      }
      await nojs.close();
      const page = await browser.newPage({
        viewport: { width: 1000, height: 900 },
        deviceScaleFactor: 2,
      });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => typeof window.hydrateSegmented === 'function');
      for (const input of await page.locator('input').all())
        await input.evaluate((node) => {
          node.__original = true;
        });
      for (const renderer of ['vue', 'solid', 'svelte', 'astro', 'react']) {
        const form = page.locator(
          renderer === 'react'
            ? '[data-renderer="react"] [data-kind="normal"]'
            : `[data-renderer="${renderer}"][data-kind="normal"]`,
        );
        await form.getByRole('radio', { name: 'Month', exact: true }).click();
      }
      await page.evaluate(() => window.hydrateSegmented());
      await page.waitForFunction(() => window.hydrated);
      const iconSample = page.locator('[data-icon-sample="react"]');
      await expect(iconSample.getByRole('radio', { name: 'List view', exact: true })).toBeChecked();
      await iconSample.getByRole('radio', { name: 'Grid view', exact: true }).click();
      await expect(iconSample.getByRole('radio', { name: 'Grid view', exact: true })).toBeChecked();
      const dynamic = page.locator('[data-dynamic="react"]');
      await dynamic.getByRole('radio', { name: 'Month', exact: true }).click();
      await page.evaluate(() =>
        window.updateSegmentedProps({
          items: [
            { value: 'month', label: 'Month' },
            { value: 'day', label: 'Day' },
          ],
        }),
      );
      await expect(dynamic.getByRole('radio', { name: 'Month', exact: true })).toBeChecked();
      assert.ok(
        await dynamic
          .locator('input')
          .evaluateAll((nodes) => nodes.every((node) => node.__original)),
      );
      await page.evaluate(() =>
        window.updateSegmentedProps({ items: [{ value: 'day', label: 'Day' }] }),
      );
      await expect(dynamic.locator('input:checked')).toHaveCount(0);
      await expect(dynamic.locator('input[tabindex="0"]')).toHaveValue('day');
      await page.evaluate(() =>
        window.updateSegmentedProps({
          items: [
            { value: 'day', label: 'Day' },
            { value: 'month', label: 'Month' },
          ],
          value: 'month',
        }),
      );
      await expect(dynamic.getByRole('radio', { name: 'Month', exact: true })).toBeChecked();
      await page.evaluate(() =>
        window.updateSegmentedProps({
          items: [
            { value: 'day', label: 'Day' },
            { value: 'month', label: 'Month' },
          ],
          value: 'day',
        }),
      );
      await expect(dynamic.getByRole('radio', { name: 'Day', exact: true })).toBeChecked();
      const typography = await page
        .locator('[data-sample="regular-2"] .lab-segment-label')
        .first()
        .evaluate((node) => {
          const style = getComputedStyle(node);
          return {
            fontFamily: style.fontFamily,
            fontWeight: style.fontWeight,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            loaded: document.fonts.check('500 14px Geist'),
          };
        });
      assert.equal(typography.fontWeight, '500');
      assert.equal(typography.fontSize, '14px');
      assert.equal(typography.lineHeight, '12px');
      assert.equal(typography.loaded, true);
      assert.equal(
        await page.locator('[data-kind="unnamed"]').evaluate((form) => form.checkValidity()),
        true,
      );
      assert.deepEqual(
        await page.locator('[data-kind="unnamed"]').evaluate((form) => [...new FormData(form)]),
        [],
      );
      for (const renderer of ['vue', 'solid', 'svelte', 'astro', 'react']) {
        const form = (mode) =>
          page.locator(
            renderer === 'react'
              ? `[data-renderer="react"] [data-kind="${mode}"]`
              : `[data-renderer="${renderer}"][data-kind="${mode}"]`,
          );
        const normal = form('normal');
        assert.ok(
          await normal
            .locator('input')
            .evaluateAll((nodes) => nodes.every((node) => node.__original)),
        );
        await expect(normal.getByRole('radio', { name: 'Month', exact: true })).toBeChecked();
        await normal.getByRole('button', { name: 'Reset' }).click();
        await expect(normal.getByRole('radio', { name: 'Day', exact: true })).toBeChecked();
        await normal.getByRole('radio', { name: 'Day', exact: true }).focus();
        await normal.getByRole('radio', { name: 'Day', exact: true }).press('ArrowRight');
        await expect(normal.getByRole('radio', { name: 'Month', exact: true })).toBeChecked();
        assert.equal(
          await normal.evaluate((form) => new FormData(form).get('period')),
          'month',
          `${engine}/${renderer}: radio form value`,
        );
        await normal.getByRole('button', { name: 'Reset' }).click();
        await expect(normal.getByRole('radio', { name: 'Day', exact: true })).toBeChecked();
        await normal.evaluate((node) => {
          node.dir = 'rtl';
        });
        await normal.getByRole('radio', { name: 'Day', exact: true }).press('ArrowLeft');
        await expect(normal.getByRole('radio', { name: 'Month', exact: true })).toBeChecked();
        await normal.getByRole('radio', { name: 'Month', exact: true }).press('Home');
        await expect(normal.getByRole('radio', { name: 'Day', exact: true })).toBeChecked();
        await normal.getByRole('radio', { name: 'Day', exact: true }).press('End');
        await expect(normal.getByRole('radio', { name: 'Month', exact: true })).toBeChecked();
        if (renderer === 'react') {
          await normal.evaluate((form) => {
            form.dir = 'ltr';
            form.reset();
            form.querySelector('input[value="day"]').dispatchEvent(
              new KeyboardEvent('keydown', {
                key: 'ArrowRight',
                bubbles: true,
                cancelable: true,
              }),
            );
          });
          await expect(normal.getByRole('radio', { name: 'Month', exact: true })).toBeChecked();
          assert.equal(await normal.evaluate((form) => new FormData(form).get('period')), 'month');
          await normal.evaluate(async (form) => {
            form.addEventListener('reset', (event) => event.preventDefault(), { once: true });
            form.reset();
            await new Promise((resolve) => setTimeout(resolve, 0));
          });
          await expect(normal.getByRole('radio', { name: 'Month', exact: true })).toBeChecked();
        }
        await form('controlled').getByRole('radio', { name: 'Month', exact: true }).click();
        await expect(
          form('controlled').getByRole('radio', { name: 'Day', exact: true }),
        ).toBeChecked();
        await form('empty').getByRole('radio', { name: 'Month', exact: true }).click();
        await expect(form('empty').locator('input:checked')).toHaveCount(0);
        assert.equal(await form('empty').evaluate((form) => form.checkValidity()), false);
        await normal.evaluate((form) => {
          const fieldset = document.createElement('fieldset');
          fieldset.disabled = true;
          form.before(fieldset);
          fieldset.append(form);
        });
        assert.equal(await normal.evaluate((form) => new FormData(form).get('period')), null);
        await expect(normal.getByRole('radio', { name: 'Month', exact: true })).toBeDisabled();
        await normal.evaluate((form) => {
          form.parentElement.disabled = false;
        });
      }
      for (const theme of ['light', 'dark']) {
        await page.evaluate((theme) => {
          document.documentElement.dataset.theme = theme;
          document.body.style.background = theme === 'light' ? 'white' : '#101012';
        }, theme);
        for (const shape of ['rounded', 'regular', 'sharp'])
          for (let count = 2; count <= 5; count++) {
            const sample = page.locator(`[data-sample="${shape}-${count}"]`);
            await sample.scrollIntoViewIfNeeded();
            await page.mouse.move(950, 850);
            const bounds = await sample.boundingBox();
            assert.equal(bounds.height, 40);
            await sample.screenshot({
              path: join(output, `${engine}-${theme}-${shape}-${count}.png`),
            });
            for (let index = 1; index <= count; index++) {
              await sample.getByRole('radio', { name: `Label ${index}`, exact: true }).click();
              await expect(sample.locator('input:checked')).toHaveCount(1);
            }
            await sample.getByRole('radio', { name: 'Label 1', exact: true }).click();
          }
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const sample = page.locator('[data-sample="regular-5"]');
      for (const scale of [1, 1.25, 2]) {
        await page.evaluate((scale) => {
          document.documentElement.style.fontSize = `${scale * 100}%`;
        }, scale);
        await sample.getByRole('radio', { name: 'Label 5', exact: true }).click();
        await sample.getByRole('radio', { name: 'Label 2', exact: true }).click();
        await expect(sample.getByRole('radio', { name: 'Label 2', exact: true })).toBeChecked();
        await expect(sample.locator('[data-selected] > .lab-segment-active')).toHaveCSS(
          'opacity',
          '1',
        );
        await sample.screenshot({
          path: join(output, `${engine}-dark-${Math.round(scale * 100)}.png`),
        });
      }
      assert.deepEqual(errors, []);
      records.push({
        engine,
        browser: browser.version(),
        SSRHelpers: ['vue', 'solid', 'svelte', 'astro'],
        react: true,
        iconOnlyAccessibleLabel: true,
        reactReorderRemovalAndControlledUpdate: true,
        typography,
        noJsFirstPaint: true,
        sameNodesAfterHydration: true,
        radioFormReset: true,
        requiredEmpty: true,
        preHydrationSelectionPreserved: true,
        controlledRefusal: true,
        fieldsetDisabled: true,
        rtlKeyboard: true,
        all42Variants: true,
        lightDark: true,
        reducedMotion: true,
        scale: [100, 125, 200],
        errors,
      });
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    join(output, 'packed.json'),
    `${JSON.stringify({ archives, declarations: true, records }, null, 2)}\n`,
  );
  process.stdout.write(
    'Packed Segmented: declarations, 4 SSR helpers + React, form/keyboard and visual matrix passed\n',
  );
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.equal(dirname(consumer), resolve(tmpdir()));
  assert.ok(consumer.includes('labui-segmented-'));
  await rm(consumer, { recursive: true, force: true });
}
