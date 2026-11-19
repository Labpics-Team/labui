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
const output = join(root, 'docs/evidence/slider-20261119');
const consumer = process.env.LAB_SLIDER_CONSUMER || await mkdtemp(join(tmpdir(), 'labui-slider-'));
const records = [];
const archives = [];
let server;
try {
  await mkdir(output, { recursive: true });
  await mkdir(join(consumer, 'packs'), { recursive: true });
  const dependencies = { react: '18.3.1', 'react-dom': '18.3.1', lit: '3.3.3', '@lit-labs/ssr': '4.1.0', '@lit-labs/ssr-client': '1.1.8', esbuild: '0.25.0' };
  const overrides = {};
  for (const folder of ['tokens', 'shadow', 'materials', 'fonts', 'colors', 'core', 'react', 'vue', 'solid', 'svelte', 'astro']) {
    const location = join(root, 'packages', folder);
    const pkg = JSON.parse(await readFile(join(location, 'package.json'), 'utf8'));
    runPnpm(['pack', '--pack-destination', join(consumer, 'packs')], location);
    const name = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
    dependencies[pkg.name] = overrides[pkg.name] = `file:./packs/${name}`;
    archives.push({ name: pkg.name, sha256: createHash('sha256').update(await readFile(join(consumer, 'packs', name))).digest('hex') });
  }
  await writePackedConsumerProject(consumer, { name: 'slider-consumer', dependencies, overrides });
  runPnpm(['install', '--ignore-scripts', '--config.auto-install-peers=false', '--prefer-offline'], consumer);
  await writeFile(join(consumer, 'app.js'), `
    import {createElement as h,useState} from 'react'; import {Slider} from '@labpics/ui-react/slider';
    export function App(){const [value,set]=useState([40]);return h('form',{id:'react-form'},
      h(Slider,{label:'Volume',value,onValueChange:set,onValueChangeEnd:value=>(window.reactEnds??=[]).push(value),name:'volume'}),
      h(Slider,{label:'Range',defaultValue:[20,80],name:'range'}),
      h(Slider,{label:'Fixed',value:[30],name:'fixed'}),
      h('fieldset',{disabled:true,id:'react-disabled'},h('legend',{},h(Slider,{label:'React legend',defaultValue:[25],name:'legend'})),h(Slider,{label:'React disabled',defaultValue:[35],name:'disabled'})),
      h(Slider,{label:'React external',defaultValue:[45],name:'external-react',form:'controls'}),
      h(Slider,{label:'React click dial',defaultValue:[0],variant:'circular',onValueChange:value=>(window.dialChanges??=[]).push(value)}),
      h(Slider,{label:'React RTL',defaultValue:[25],dir:'rtl'}),h('button',{type:'reset'},'Reset'));}
  `);
  await writeFile(join(consumer, 'server.mjs'), `
    import {writeFile} from 'node:fs/promises';import {createElement} from 'react';import{renderToString}from'react-dom/server';import{App}from'./app.js';
    const parts=[];for(const renderer of ['vue','solid','svelte','astro']){const {renderSlider}=await import('@labpics/ui-'+renderer+'/ssr');
      parts.push('<section data-renderer="'+renderer+'"><h2>'+renderer+'</h2><form>'+renderSlider({label:'Volume',defaultValue:[40],name:'volume'})+'<button type="reset">Reset</button></form></section>');}
    parts.push('<section data-renderer="react"><h2>React</h2><div id="react-root">'+renderToString(createElement(App))+'</div></section>');
    const specimens=[['linear',[0]],['linear',[50]],['circular',[0,0]],['circular',[0,50]],['circular',[0,100]],['large',[0]],['large',[50]],['large',[100]],['large',[7]]];
    let samples='<div id="authored">';for(let i=0;i<specimens.length;i++){const [variant,values]=specimens[i];samples+='<div class="sample" data-sample="'+i+'"><lab-slider label="Label" label-hidden variant="'+variant+'" default-value="'+values.join(',')+'"></lab-slider></div>';}samples+='</div>';
    const extra='<form id="controls"><lab-slider id="range" label="Budget" default-value="20,80" name="budget"></lab-slider><lab-slider id="dial" label="Dial" label-hidden variant="circular" default-value="95"></lab-slider><lab-slider id="controlled" label="Fixed" value="30" name="fixed"></lab-slider><lab-slider id="decimal" label="Fine" min="-0.7" max="1.3" step="0.2" default-value="0.1" name="fine"></lab-slider><button type="reset">Reset all</button></form>';
    await writeFile('index.html','<!doctype html><html class="lab-scope" data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/client.css"><style>html{font-family:var(--lab-font-family)}body{margin:24px;background:var(--lab-bg-primary);color:var(--lab-label-primary)}section,form#controls{width:628px;display:grid;gap:32px;margin-block:32px}h2{font-size:14px}#authored{width:628px;display:grid;gap:36px;padding:20px;background:var(--lab-bg-primary)}.sample{width:628px}.sample:has([variant=circular]){width:96px}</style></head><body>'+parts.join('')+samples+extra+'<script type="module" src="/client.js"></script></body></html>');
  `);
  await writeFile(join(consumer, 'client.js'), `
    import '@labpics/fonts/fonts.css';import '@labui/colors/contract.css';import '@labpics/ui-core/tokens.css';import '@labpics/ui-core/slider.css';
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';import{createElement}from'react';import{hydrateRoot}from'react-dom/client';import{App}from'./app.js';
    window.hydrate=async()=>{await import('@labpics/ui-core/slider');await Promise.all([...document.querySelectorAll('lab-slider')].map(el=>el.updateComplete));hydrateRoot(document.getElementById('react-root'),createElement(App));window.ready=true;};
  `);
  await writeFile(join(consumer, 'build.mjs'), `import{build}from'esbuild';await build({entryPoints:['client.js'],outdir:'web',bundle:true,format:'esm',splitting:true,loader:{'.woff2':'file'},assetNames:'[name]-[hash]'});`);
  execFileSync(process.execPath, ['server.mjs'], { cwd: consumer, stdio: 'pipe', windowsHide: true });
  execFileSync(process.execPath, ['build.mjs'], { cwd: consumer, stdio: 'pipe', windowsHide: true });
  await writeFile(join(consumer, 'web/index.html'), await readFile(join(consumer, 'index.html')));
  server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(consumer, 'web', `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(join(consumer, 'web') + sep)) return response.writeHead(403).end();
    try { response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.woff2') ? 'font/woff2' : 'text/html'); response.end(await readFile(file)); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  async function captureAuthored(page, path) {
    const specimens = page.locator('#authored');
    // Align the proof canvas independently of fractional sibling text baselines.
    await specimens.evaluate(node => {
      node.style.position = 'relative'; node.style.top = '0';
      const y = node.getBoundingClientRect().y + window.scrollY;
      node.style.top = `${Math.round(y) - y}px`;
    });
    await specimens.screenshot({ path });
  }
  for (const [engine, kind] of Object.entries({ chromium, webkit })) {
    const browser = await kind.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 960, height: 1000 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(url);
      await page.waitForFunction(() => !!window.hydrate);
      for (const renderer of ['vue', 'solid', 'svelte', 'astro', 'react']) {
        const input = page.locator(`[data-renderer='${renderer}']`).getByRole('slider', { name: 'Volume', exact: true });
        await expect(input).toHaveValue('40');
        await input.evaluate((node) => { node.__retained = true; });
      }
      // A real keyboard edit before custom-element hydration must survive it.
      await page.locator('[data-renderer=vue]').getByRole('slider').focus();
      await page.keyboard.press('ArrowRight');
      await page.evaluate(() => window.hydrate());
      await page.waitForFunction(() => window.ready);
      await page.evaluate(async () => { await document.fonts.load('500 16px Geist'); await document.fonts.ready; });
      for (const renderer of ['vue', 'solid', 'svelte', 'astro', 'react']) {
        const host = page.locator(`[data-renderer='${renderer}']`);
        const input = host.getByRole('slider', { name: 'Volume', exact: true });
        assert.equal(await input.evaluate((node) => node.__retained), true);
        const value = renderer === 'vue' ? 41 : 40;
        await expect(input).toHaveValue(String(value));
        await input.focus(); await page.keyboard.press('ArrowRight');
        await expect(input).toHaveValue(String(value + 1));
        assert.equal(await host.locator('form').evaluate((form) => new FormData(form).get('volume')), String(value + 1));
      }
      const fixed = page.locator('#controlled').getByRole('slider');
      await fixed.focus(); await page.keyboard.press('ArrowRight'); await expect(fixed).toHaveValue('30');
      await expect.poll(() => page.evaluate(() => window.reactEnds)).toEqual([[41]]);
      const react = page.locator('[data-renderer=react]');
      await expect(react.getByRole('slider', { name: 'React disabled', exact: true })).toBeDisabled();
      const legend = react.getByRole('slider', { name: 'React legend', exact: true });
      await expect(legend).toBeEnabled(); await legend.focus(); await page.keyboard.press('ArrowRight'); await expect(legend).toHaveValue('26');
      assert.equal(await react.locator('form').evaluate(form => new FormData(form).get('disabled')), null);
      await page.locator('#react-disabled').evaluate(fieldset => { fieldset.disabled = false; });
      await expect(react.getByRole('slider', { name: 'React disabled', exact: true })).toBeEnabled();
      assert.equal(await page.locator('#controls').evaluate(form => new FormData(form).get('external-react')), '45');
      await page.evaluate(async () => {
        const fieldset = document.createElement('fieldset'); fieldset.id = 'lit-disabled'; fieldset.disabled = true;
        fieldset.innerHTML = '<legend><lab-slider label="Lit legend" default-value="25" name="lit-legend"></lab-slider></legend><lab-slider label="Lit disabled" default-value="35" name="lit-disabled"></lab-slider>';
        document.querySelector('#controls').append(fieldset);
        const external = document.createElement('lab-slider'); external.label='Lit external'; external.defaultValue=[45]; external.name='external-lit'; external.form='controls'; document.body.append(external);
        const rtl = document.createElement('lab-slider'); rtl.id='lit-rtl'; rtl.label='Lit RTL'; rtl.defaultValue=[25]; rtl.dir='rtl'; rtl.style.width='400px'; document.body.append(rtl);
        await Promise.all([...document.querySelectorAll('lab-slider')].map(el=>el.updateComplete));
      });
      await expect(page.getByRole('slider', { name: 'Lit disabled', exact: true })).toBeDisabled();
      const litLegend = page.getByRole('slider', { name: 'Lit legend', exact: true });
      await expect(litLegend).toBeEnabled(); await litLegend.focus(); await page.keyboard.press('ArrowRight'); await expect(litLegend).toHaveValue('26');
      assert.equal(await page.locator('#controls').evaluate(form => new FormData(form).get('lit-disabled')), null);
      assert.equal(await page.locator('#controls').evaluate(form => new FormData(form).get('external-lit')), '45');
      await page.locator('#lit-disabled').evaluate(fieldset => { fieldset.disabled = false; });
      await expect(page.getByRole('slider', { name: 'Lit disabled', exact: true })).toBeEnabled();
      for (const name of ['Lit RTL','React RTL']) {
        const input = page.getByRole('slider', { name, exact: true });
        await input.focus(); await page.keyboard.press('ArrowLeft'); await expect(input).toHaveValue('26');
        const control = input.locator('xpath=../..'); await control.scrollIntoViewIfNeeded();
        const bounds = await control.boundingBox();
        await page.mouse.click(bounds.x + bounds.width * .25 + 6, bounds.y + bounds.height / 2);
        await expect(input).toHaveValue('75');
      }
      await page.evaluate(async () => {
        const dial = document.createElement('lab-slider'); dial.id='click-dial'; dial.label='Lit click dial'; dial.variant='circular'; dial.defaultValue=[0];
        dial.addEventListener('value-change', event => (window.dialChanges??=[]).push(event.detail.value));
        document.body.append(dial); await dial.updateComplete;
      });
      for (const name of ['Lit click dial', 'React click dial']) {
        const input = page.getByRole('slider', { name, exact: true });
        const control = input.locator('xpath=../..'); await control.scrollIntoViewIfNeeded();
        const bounds = await control.boundingBox();
        for (const [initial, target, key] of [[0,75,null], [100,25,'End']]) {
          if (key) { await input.focus(); await page.keyboard.press(key); }
          await expect(input).toHaveValue(String(initial));
          await page.evaluate(() => { window.dialChanges=[]; });
          await page.mouse.click(bounds.x + 48 + 46 * Math.sin(target * Math.PI / 50), bounds.y + 48 - 46 * Math.cos(target * Math.PI / 50));
          await expect(input).toHaveValue(String(target));
          assert.deepEqual(await page.evaluate(() => window.dialChanges), [[target]], `${name} initial track click must emit the chosen absolute value`);
        }
      }
      await page.evaluate(async () => {
        const field = document.createElement('lab-slider'); field.id='coincident'; field.label='Coincident'; field.labelHidden=true; field.defaultValue=[0,0]; field.style.width='400px';
        document.body.append(field); await field.updateComplete;
      });
      const coincident = page.locator('#coincident');
      for (const variant of ['linear','circular']) for (const dir of ['ltr','rtl']) {
        for (const [initial, delta] of [[0,20],[100,-20],[50,20],[50,-20]]) {
          await coincident.evaluate(async (node, { initial, variant, dir }) => {
            window.coincidentAbort?.abort(); window.coincidentAbort=new AbortController();
            node.variant=variant; node.dir=dir; node.value=[initial,initial];
            node.addEventListener('value-change', event => { node.value=event.detail.value; }, { signal: window.coincidentAbort.signal });
            await node.updateComplete;
          }, { initial, variant, dir });
          const control = coincident.locator('.lab-slider-control'); await control.scrollIntoViewIfNeeded();
          const bounds=await control.boundingBox();
          const point=fraction => variant==='circular'
            ? {x:bounds.x+48+46*Math.sin(fraction*Math.PI*2),y:bounds.y+48-46*Math.cos(fraction*Math.PI*2)}
            : {x:bounds.x+(dir==='rtl' ? bounds.width-(Math.max(12,bounds.width*fraction)-6) : Math.max(12,bounds.width*fraction)-6),y:bounds.y+bounds.height/2};
          const from=point(initial/100); await page.mouse.move(from.x,from.y); await page.mouse.down();
          for(let part=1;part<=8;part++){const at=point((initial+delta*part/8)/100);await page.mouse.move(at.x,at.y);}
          await page.mouse.up();
          await expect(coincident.getByRole('slider').nth(0)).toHaveValue(String(delta<0 ? initial+delta : initial));
          await expect(coincident.getByRole('slider').nth(1)).toHaveValue(String(delta>0 ? initial+delta : initial));
        }
      }
      const range = page.locator('#range').getByRole('slider');
      await range.nth(0).focus(); await page.keyboard.press('End'); await expect(range.nth(0)).toHaveValue('80');
      assert.deepEqual(await page.locator('#controls').evaluate((form) => new FormData(form).getAll('budget')), ['80', '80']);
      await range.nth(1).focus(); await page.keyboard.press('ArrowLeft'); await expect(range.nth(1)).toHaveValue('80');
      await page.getByRole('button', { name: 'Reset all' }).click();
      await expect(range.nth(0)).toHaveValue('20'); await expect(range.nth(1)).toHaveValue('80');
      await expect(fixed).toHaveValue('30');
      const fine = page.locator('#decimal').getByRole('slider'); await fine.focus(); await page.keyboard.press('ArrowRight'); await expect(fine).toHaveValue('0.3');
      // A cancelled native reset leaves the current form value untouched.
      await page.locator('#controls').evaluate((form) => form.addEventListener('reset', (event) => event.preventDefault(), { once: true }));
      await page.getByRole('button', { name: 'Reset all' }).click(); await expect(fine).toHaveValue('0.3');
      const dial = page.locator('#dial'); const control = await dial.locator('.lab-slider-control').boundingBox();
      const point = (value) => ({ x: control.x + 48 + 46 * Math.sin(value * Math.PI * 2), y: control.y + 48 - 46 * Math.cos(value * Math.PI * 2) });
      const first = point(.95); await page.mouse.move(first.x, first.y); await page.mouse.down();
      for (const value of [.97, .99, 1.01]) { const p = point(value); await page.mouse.move(p.x, p.y); }
      await expect(dial.getByRole('slider')).toHaveValue('100');
      const back = point(.97); await page.mouse.move(back.x, back.y); await page.mouse.up(); await expect(dial.getByRole('slider')).toHaveValue('97');
      // Esc cancels the live draft; detach retains the accepted uncontrolled value.
      const at = point(.97); await page.mouse.move(at.x, at.y); await page.mouse.down(); const other = point(.8); await page.mouse.move(other.x, other.y);
      await page.keyboard.press('Escape'); await page.mouse.up(); await expect(dial.getByRole('slider')).toHaveValue('97');
      await dial.evaluate(async (node) => { document.body.append(node); await node.updateComplete; });
      await expect(dial.getByRole('slider')).toHaveValue('97');
      const geometry = await page.locator('[data-sample="1"]').evaluate((host) => {
        const root = host.querySelector('lab-slider').shadowRoot; const track = root.querySelector('.lab-slider-track').getBoundingClientRect(); const thumb = root.querySelector('.lab-slider-thumb').getBoundingClientRect();
        return { track: track.height, diameter: thumb.width, center: thumb.x + thumb.width / 2 - track.x };
      });
      assert.deepEqual(geometry, { track: 4, diameter: 12, center: 308 });
      const raf = await page.evaluate(async () => { let count = 0; const original = window.requestAnimationFrame; window.requestAnimationFrame = (...args) => { count++; return original(...args); }; await new Promise((resolve) => setTimeout(resolve, 120)); window.requestAnimationFrame = original; return count; });
      assert.equal(raf, 0, 'No idle Slider animation loop');
      await page.evaluate(async () => {
        const field = document.querySelector('[data-sample="1"] lab-slider');
        field.max = 100; field.step = 30; field.value = [100]; await field.updateComplete;
      });
      await expect(page.locator('[data-sample="1"]').getByRole('slider')).toHaveValue('90');
      await page.evaluate(async () => {
        const field = document.querySelector('[data-sample="1"] lab-slider');
        field.step = 1; field.value = null; await field.updateComplete;
      });
      for (const scale of [1, 1.25, 2]) {
        const context = await browser.newContext({ viewport: { width: 960, height: 1000 }, deviceScaleFactor: scale });
        const capture = await context.newPage();
        try {
          await capture.goto(url);
          await capture.waitForFunction(() => !!window.hydrate);
          await capture.evaluate(() => window.hydrate());
          await capture.waitForFunction(() => window.ready);
          await capture.evaluate(async () => { await document.fonts.load('500 16px Geist'); await document.fonts.ready; });
          const sizes = await capture.locator('[data-sample="3"] .lab-slider-control').boundingBox();
          assert.equal(sizes.width, 96, 'DPR changes resolution without changing authored geometry');
          for (const theme of ['light', 'dark']) {
            await capture.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
            await captureAuthored(capture, join(output, `web-${engine}-${theme}-density-${scale}.png`));
          }
        } finally { await context.close(); }
      }
      for (const scale of [1, 1.25, 2]) {
        await page.evaluate((scale) => {
          document.documentElement.style.fontSize = `${16 * scale}px`;
          document.documentElement.dataset.theme = 'light';
          document.querySelector('[data-sample="8"] lab-slider').label = 'Очень длинная подпись с настройкой насыщенности изображения';
        }, scale);
        const sample = page.locator('[data-sample="1"]');
        await sample.scrollIntoViewIfNeeded();
        const control = await sample.locator('.lab-slider-control').boundingBox();
        const thumb = await sample.locator('.lab-slider-thumb').boundingBox();
        assert.equal(thumb.width, 12 * scale);
        await page.mouse.click(control.x + control.width * .8 - thumb.width / 2, control.y + control.height / 2);
        await expect(sample.getByRole('slider')).toHaveValue('80');
        await page.mouse.click(control.x + control.width * .5 - thumb.width / 2, control.y + control.height / 2);
        await expect(sample.getByRole('slider')).toHaveValue('50');
        const circle = await page.locator('[data-sample="3"] .lab-slider-control').boundingBox();
        assert.equal(circle.width, 96 * scale);
        await range.nth(0).focus(); await page.keyboard.press('ArrowRight');
        assert.equal(await page.locator('#controls').evaluate((form) => new FormData(form).get('budget')), '21');
        await page.keyboard.press('ArrowLeft');
        await captureAuthored(page, join(output, `web-${engine}-light-font-${scale * 100}.png`));
      }
      assert.deepEqual(errors, []);
      records.push({ engine, ssrHydratedRenderers: 5, geometry, density: [1, 1.25, 2], rootFontSize: [16, 20, 32], idleRaf: raf, behavior: 'controlled and end callback, keyboard including RTL, external forms, disabled fieldset/first legend, submit/reset/cancel, non-divisible steps, range collision and coincident thumb pointer directions, circular absolute click/callback and seam/cancel, reparent, pointer geometry and forms at each root font size' });
    } finally { await browser.close(); }
  }
  await writeFile(join(output, 'installed.generated.json'), `${JSON.stringify({ archives, records }, null, 2)}\n`);
  console.log(JSON.stringify(records));
} finally {
  await new Promise((resolve) => server ? server.close(resolve) : resolve());
  if (!process.env.LAB_SLIDER_CONSUMER) await rm(consumer, { recursive: true, force: true });
}
