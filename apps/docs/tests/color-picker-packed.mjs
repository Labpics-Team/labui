import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, webkit } from '@playwright/test';
import { runPnpm, writePackedConsumerProject } from './packed-consumer-project.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = join(root, 'docs/evidence/color-picker-20261123');
const consumer =
  process.env.LAB_COLOR_PICKER_CONSUMER || (await mkdtemp(join(tmpdir(), 'labui-color-picker-')));
const records = [];
const archives = [];
let server;
try {
  await mkdir(output, { recursive: true });
  await mkdir(join(consumer, 'packs'), { recursive: true });
  const dependencies = {
    react: '18.3.1',
    'react-dom': '18.3.1',
    lit: '3.3.3',
    '@lit-labs/ssr': '4.1.0',
    '@lit-labs/ssr-client': '1.1.8',
    esbuild: '0.25.0',
    typescript: '5.7.3',
    '@types/react': '18.3.18',
    vue: '3.5.42',
    'solid-js': '1.9.4',
    svelte: '5.55.1',
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
  }
  await writePackedConsumerProject(consumer, {
    name: 'color-picker-consumer',
    dependencies,
    overrides,
  });
  runPnpm(
    ['install', '--ignore-scripts', '--config.auto-install-peers=false', '--prefer-offline'],
    consumer,
  );

  const raw = {
    space: 'lch',
    coords: [72.09123456789, 84.86123456789, 65.34123456789],
    alpha: 0.5019607843137255,
  };
  await writeFile(
    join(consumer, 'types.mts'),
    `
    import {type LabColorValue,parseColor,serializeColor} from '@labpics/ui-core/color-picker';
    import {ColorPicker,type ColorPickerProps} from '@labpics/ui-react/color-picker';
    import {ColorPicker as VueColorPicker} from '@labpics/ui-vue';
    import {ColorPicker as SolidColorPicker} from '@labpics/ui-solid';
    import {renderColorPicker} from '@labpics/ui-astro/ssr';
    const value:LabColorValue={space:'lch',coords:[50,60,70],alpha:.123456789};
    const props:ColorPickerProps={value,pickScreenColor:async(signal)=>signal.aborted?null:value};
    parseColor(serializeColor(value)); renderColorPicker({defaultValue:value});
    // @ts-expect-error CSS LCH is not OKLCH
    const invalid:LabColorValue={space:'oklch',coords:[50,60,70],alpha:1};
  `,
  );
  await writeFile(
    join(consumer, 'types.cts'),
    `import {type LabColorValue,parseColor} from '@labpics/ui-core/color-picker';const color:LabColorValue={space:'srgb',coords:[1,0,0],alpha:1};parseColor('#ff0000');`,
  );
  runPnpm(
    [
      'exec',
      'tsc',
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2022',
      'types.mts',
      'types.cts',
    ],
    consumer,
  );
  await writeFile(
    join(consumer, 'app.js'),
    `
    import {createElement as h} from 'react'; import {ColorPicker} from '@labpics/ui-react/color-picker';
    export const raw=${JSON.stringify(raw)};
    export function App(){return h('form',{id:'react-form'},h(ColorPicker,{defaultValue:raw,defaultModel:'lch',name:'color'}),h('button',{type:'reset'},'Reset'));}
  `,
  );
  await writeFile(
    join(consumer, 'server.mjs'),
    `
    import assert from 'node:assert/strict';import{createRequire}from'node:module';import{writeFile}from'node:fs/promises';
    import {createElement} from 'react';import{renderToString}from'react-dom/server';import{App,raw}from'./app.js';
    const require=createRequire(import.meta.url);const cjs=require('@labpics/ui-core/color-picker');assert.deepEqual(cjs.parseColor(cjs.serializeColor(raw)),raw);
    assert.equal(typeof require('@labpics/ui-react/color-picker').ColorPicker,'function');
    const {renderToString:renderLit,html}=await import('@labpics/ui-core/ssr');await import('@labpics/ui-core/color-picker');
    const parts=['<section data-renderer="lit"><form>'+renderLit(html\`<lab-color-picker .defaultValue=\${raw} default-model="lch" name="color"></lab-color-picker>\`)+'<button type="reset">Reset</button></form></section>'];
    for(const renderer of ['vue','solid','svelte','astro']){const {renderColorPicker}=await import('@labpics/ui-'+renderer+'/ssr');
      if(renderer!=='svelte')assert.equal(typeof require('@labpics/ui-'+renderer+'/ssr').renderColorPicker,'function');
      parts.push('<section data-renderer="'+renderer+'"><form>'+renderColorPicker({defaultValue:raw,defaultModel:'lch',name:'color'})+'<button type="reset">Reset</button></form></section>');}
    parts.push('<section data-renderer="react"><div id="react-root">'+renderToString(createElement(App))+'</div></section>');
    await writeFile('index.html','<!doctype html><html class="lab-scope" data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/client.css"><style>body{margin:24px;background:var(--lab-bg-primary);color:var(--lab-label-primary)}section{margin-block:24px}</style></head><body>'+parts.join('')+'<script type="module" src="/client.js"></script></body></html>');
  `,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
    import '@labpics/fonts/fonts.css';import '@labui/colors/contract.css';import '@labpics/ui-core/tokens.css';import '@labpics/ui-core/color-picker.css';
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';import{createElement}from'react';import{hydrateRoot}from'react-dom/client';import{App}from'./app.js';
    window.hydrate=async()=>{await import('@labpics/ui-core/color-picker');await Promise.all([...document.querySelectorAll('lab-color-picker')].map(el=>el.updateComplete));hydrateRoot(document.getElementById('react-root'),createElement(App));window.ready=true;};
  `,
  );
  await writeFile(
    join(consumer, 'build.mjs'),
    `import{build}from'esbuild';await build({entryPoints:['client.js'],outdir:'web',bundle:true,format:'esm',splitting:true,loader:{'.woff2':'file'},assetNames:'[name]-[hash]'});`,
  );
  execFileSync(process.execPath, ['server.mjs'], {
    cwd: consumer,
    stdio: 'pipe',
    windowsHide: true,
  });
  execFileSync(process.execPath, ['build.mjs'], {
    cwd: consumer,
    stdio: 'pipe',
    windowsHide: true,
  });
  await writeFile(join(consumer, 'web/index.html'), await readFile(join(consumer, 'index.html')));
  server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(consumer, 'web', `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(join(consumer, 'web') + sep)) return response.writeHead(403).end();
    try {
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
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  for (const [engine, kind] of Object.entries({ chromium, webkit })) {
    const browser = await kind.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(() => !!window.hydrate);
      for (const renderer of ['lit', 'vue', 'solid', 'svelte', 'astro', 'react']) {
        const hidden = page.locator(`[data-renderer=${renderer}] [data-form-value]`);
        assert.deepEqual(
          JSON.parse(await hidden.getAttribute('value')),
          raw,
          `${renderer} SSR preserves raw form text`,
        );
        await page.locator(`[data-renderer=${renderer}] [data-color-text]`).evaluate((node) => {
          node.__retained = true;
        });
      }
      assert.deepEqual(
        await page
          .locator('#react-form')
          .evaluate((form) => JSON.parse(new FormData(form).get('color'))),
        raw,
        'React SSR submits before hydration',
      );
      await page.evaluate(() => window.hydrate());
      await page.waitForFunction(() => window.ready);
      for (const renderer of ['lit', 'vue', 'solid', 'svelte', 'astro', 'react']) {
        const section = page.locator(`[data-renderer=${renderer}]`);
        const text = section.locator('[data-color-text]');
        assert.equal(
          await text.evaluate((node) => node.__retained),
          true,
          `${renderer} retained SSR field`,
        );
        const value = () =>
          section.locator('form').evaluate((form) => JSON.parse(new FormData(form).get('color')));
        assert.deepEqual(await value(), raw);
        await text.focus();
        await text.blur();
        assert.deepEqual(await value(), raw, 'untouched focus/blur is lossless');
        await text.focus();
        await text.fill((await text.inputValue()).replace('72.09123456789', '50'));
        await text.press('Enter');
        assert.deepEqual(await value(), { ...raw, coords: [50, raw.coords[1], raw.coords[2]] });
        await section.getByRole('button', { name: 'Reset', exact: true }).click();
        await expect.poll(value).toEqual(raw);
      }
      assert.deepEqual(errors, []);
      records.push({
        engine,
        ssrAndHydratedRenderers: 6,
        types: 'ESM+CJS',
        behavior:
          'serialized raw SSR, retained hydration, exact focus and partial LCH edit, real FormData and reset',
      });
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    join(output, 'installed.generated.json'),
    `${JSON.stringify({ archives, records }, null, 2)}\n`,
  );
  console.info(JSON.stringify(records));
} finally {
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  const taskPrefix = join(tmpdir(), 'labui-color-picker-');
  if (!process.env.LAB_COLOR_PICKER_CONSUMER && resolve(consumer).startsWith(resolve(taskPrefix)))
    await rm(consumer, { recursive: true, force: true });
}
