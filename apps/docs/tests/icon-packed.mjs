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
const output = join(root, 'docs/evidence/icon-20261119');
const consumer = await mkdtemp(join(tmpdir(), 'labui-icon-'));
let server;
let browser;
try {
  await mkdir(output, { recursive: true });
  await mkdir(join(consumer, 'packs'));
  const dependencies = {
    react: '18.3.1',
    'react-dom': '18.3.1',
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
  for (const folder of [
    'tokens',
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
    const pkg = JSON.parse(
      (await readFile(join(location, 'package.json'), 'utf8')).replace(/^\uFEFF/, ''),
    );
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
  // Allows release qualification before publication, without repository path overrides.
  if (process.env.LAB_ICONS_TARBALL) {
    await copyFile(process.env.LAB_ICONS_TARBALL, join(consumer, 'packs/icons.tgz'));
    dependencies['@labpics/icons'] = overrides['@labpics/icons'] = 'file:./packs/icons.tgz';
  }
  await writePackedConsumerProject(consumer, {
    name: 'labui-icon-consumer',
    dependencies,
    overrides,
  });
  const workspace = JSON.parse(await readFile(join(consumer, 'pnpm-workspace.yaml'), 'utf8'));
  await writeFile(
    join(consumer, 'pnpm-workspace.yaml'),
    JSON.stringify({ ...workspace, autoInstallPeers: false }),
  );
  pnpm(['install', '--ignore-scripts'], consumer);
  await writeFile(
    join(consumer, 'shared.mjs'),
    `
    import {createElement as h,useState} from 'react';
    import {Icon} from '@labpics/ui-react/icon';
    import {createTypographyScale} from '@labpics/ui-core/typography';
    import {symbol as plus} from '@labpics/icons/symbols/plus';
    import {symbol as bookmark} from '@labpics/icons/symbols/bookmark';
    import {symbol as refresh} from '@labpics/icons/symbols/refresh';
    import {symbol as calendar} from '@labpics/icons/symbols/calendar-number';
    export {plus,bookmark,refresh,calendar};
    export const initial={symbol:plus,size:'1.5em',scale:createTypographyScale('body',16)};
    export function App(){const[props,set]=useState(initial);if(typeof window!=='undefined')window.setIcon=set;return h(Icon,{...props,id:'react-icon'});}
  `,
  );
  await writeFile(
    join(consumer, 'server.mjs'),
    `
    import {writeFile} from 'node:fs/promises';import {createElement as h} from 'react';import {renderToString} from 'react-dom/server';
    import {App,initial,calendar} from './shared.mjs';
    const sections=[];
    for(const renderer of ['vue','solid','svelte','astro']){const{renderIcon}=await import('@labpics/ui-'+renderer+'/ssr');sections.push('<section data-renderer="'+renderer+'">'+renderIcon(initial)+'</section>');const calendarHtml=renderIcon({symbol:calendar,date:new Date('2026-11-19T22:00:00Z'),timeZone:'Europe/Moscow'});if(!calendarHtml.includes('date="2026-11-19T22:00:00.000Z"'))throw Error(renderer+' calendar date missing');}
    sections.push('<section id="react">'+renderToString(h(App))+'</section>');
    await writeFile('index.html','<!doctype html><html><head><meta charset="utf-8"><style>body{color:#172028;font:16px system-ui;padding:24px}section{display:inline-flex;padding:24px;align-items:center}#static{display:flex;flex-wrap:wrap;max-width:600px;gap:10px}</style></head><body>'+sections.join('')+'<div id="static"></div><script type="module" src="/client.js"></script></body></html>');
  `,
  );
  await writeFile(
    join(consumer, 'server.cjs'),
    `
    const assert=require('node:assert/strict');const React=require('react');const{renderToString}=require('react-dom/server');
    const{Icon}=require('@labpics/ui-react/icon');
    (async()=>{const{symbol}=await import('@labpics/icons/symbols/plus');assert.match(renderToString(React.createElement(Icon,{symbol})),/<svg/);
    for(const framework of ['vue','solid','astro'])assert.match(require('@labpics/ui-'+framework+'/ssr').renderIcon({symbol}),/<svg/);})().catch(e=>{console.error(e);process.exitCode=1});
  `,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
    import {createElement as h} from 'react';import {hydrateRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
    import {createIconController,iconMarkup} from '@labpics/ui-core/icon/runtime';
    import {createTypographyScale} from '@labpics/ui-core/typography';
    import {App,initial,plus,bookmark,refresh,calendar} from './shared.mjs';
    window.iconFrames=0;const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>{window.iconFrames++;return raf(cb)};
    window.upgrade=async()=>{await import('@labpics/ui-core/icon');await Promise.all([...document.querySelectorAll('lab-icon')].map(el=>el.updateComplete))};
    window.hydrate=async()=>{document.querySelectorAll('lab-icon').forEach(el=>el.symbol=plus);await Promise.all([...document.querySelectorAll('lab-icon')].map(el=>el.updateComplete));flushSync(()=>hydrateRoot(document.getElementById('react'),h(App)));};
    window.update=async props=>{if(props.symbol==='bookmark')props.symbol=bookmark;if(props.symbol==='plus')props.symbol=plus;if(props.root) {props.scale=createTypographyScale('body',props.root);delete props.root;}
      document.querySelectorAll('lab-icon').forEach(el=>Object.assign(el,props));flushSync(()=>window.setIcon(prev=>({...prev,...props})));await Promise.all([...document.querySelectorAll('lab-icon')].map(el=>el.updateComplete));};
    window.staticIcons=count=>{window.staticControllers?.forEach(c=>c.dispose());const root=document.getElementById('static');root.innerHTML='';window.staticControllers=[];
      for(let i=0;i<count;i++){const el=document.createElement('span');el.style.cssText='width:24px;height:24px';el.innerHTML=iconMarkup({symbol:plus});root.append(el);window.staticControllers.push(createIconController(el,{symbol:plus}));}};
    window.race=async()=>{const el=document.createElement('span');document.body.append(el);const c=createIconController(el,{symbol:plus});c.update({symbol:plus,state:'selected'});c.update({symbol:bookmark,state:'unselected'});c.dispose();el.remove();};
    window.coverage=paths=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const ctx=canvas.getContext('2d');ctx.scale(4,4);for(const path of paths)ctx.fill(new Path2D(path),'evenodd');return Array.from(ctx.getImageData(0,0,96,96).data).filter((_,i)=>i%4===3)};
    window.expected=(props)=>{const div=document.createElement('div');div.innerHTML=iconMarkup({...initial,...props,symbol:props.symbol==='bookmark'?bookmark:plus});return window.coverage([...div.querySelectorAll('path')].map(p=>p.getAttribute('d')))};
    window.effectControls=async()=>{const root=document.createElement('span');document.body.append(root);const c=createIconController(root,{symbol:refresh});const playback=await c.playEffect('cycle',{duration:200});playback.pause();playback.seek(80);const paused=playback.state;const pausedListeners=window.iconMediaListeners;playback.play();const resumedListeners=window.iconMediaListeners;playback.finish();const finished=await playback.finished;const finishedListeners=window.iconMediaListeners;c.dispose();const count=root.children.length;root.remove();return{paused,finished:finished.status,count,pausedListeners,resumedListeners,finishedListeners}};
    window.lifecycle=async()=>{const el=document.createElement('lab-icon');el.symbol=plus;document.body.append(el);await el.updateComplete;el.remove();el.symbol=bookmark;el.size=32;el.state='selected';await el.updateComplete;document.body.append(el);await el.updateComplete;const expected=document.createElement('div');expected.innerHTML=iconMarkup({symbol:bookmark,size:32,state:'selected'});const reconnected=el.shadowRoot.querySelector('svg').outerHTML===expected.querySelector('svg').outerHTML;el.remove();el.symbol=refresh;el.state=undefined;el.effect='cycle';const before=window.iconFrames;await el.updateComplete;await new Promise(r=>setTimeout(r,100));return{reconnected,detachedFrames:window.iconFrames-before,hasMotionParts:!!el.shadowRoot.querySelector('[data-part]')}};
    window.calendarTest=async()=>{const el=document.createElement('lab-icon');el.symbol=calendar;el.date=new Date('2026-11-19T22:00:00Z');el.timeZone='Europe/Moscow';el.reducedMotion=true;document.body.append(el);await el.updateComplete;const before=el.shadowRoot.querySelector('span').innerHTML;el.date=new Date('2026-11-20T22:00:00Z');await el.updateComplete;await new Promise(r=>setTimeout(r,50));const after=el.shadowRoot.querySelector('span').innerHTML;el.remove();return before!==after};
    window.ready=true;
  `,
  );
  await writeFile(
    join(consumer, 'types.tsx'),
    `
    import {Icon,type IconHandle} from '@labpics/ui-react/icon';import type{LabIcon}from'@labpics/ui-core/icon';
    import {symbol} from '@labpics/icons/symbols/plus';import {createTypographyScale}from'@labpics/ui-core/typography';
    import {renderIcon as vue}from'@labpics/ui-vue/ssr';import {renderIcon as solid}from'@labpics/ui-solid/ssr';import {renderIcon as svelte}from'@labpics/ui-svelte/ssr';import {renderIcon as astro}from'@labpics/ui-astro/ssr';
    const scale=createTypographyScale('body',20);const x=<Icon symbol={symbol} scale={scale} size="1.5em" opsz="auto" state="selected"/>;
    for(const render of [vue,solid,svelte,astro])render({symbol,scale,size:'1.5em',date:new Date(),timeZone:'Europe/Moscow'});
    declare const el:LabIcon;declare const handle:IconHandle;void el.playEffect('rotate');void handle.playEffect('rotate');void x;
    // @ts-expect-error unsupported variant
    const bad=<Icon symbol={symbol} variant="bold"/>;void bad;
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
  for (const file of ['server.mjs', 'server.cjs'])
    execFileSync(process.execPath, [file], { cwd: consumer, stdio: 'pipe', windowsHide: true });
  const html = await readFile(join(consumer, 'index.html'), 'utf8');
  assert.ok(
    !html.includes('coordinates') && !html.includes('&quot;symbol&quot;'),
    'Resources must not repeat in SSR HTML',
  );
  await writeFile(
    join(consumer, 'build.mjs'),
    `
    import{build}from'esbuild';import{writeFile}from'node:fs/promises';
    const options={outdir:'web',bundle:true,format:'esm',splitting:true,minify:true,metafile:true};
    const result=await build({...options,entryPoints:['client.js']});await writeFile('meta.json',JSON.stringify(result.metafile));
    await build({...options,entryPoints:['client.js'],outdir:'web/development',conditions:['development'],minify:false,define:{'process.env.NODE_ENV':'"development"'}});
    const pure=await build({...options,stdin:{contents:"import{iconMarkup}from'@labpics/ui-core/icon/runtime';import{symbol}from'@labpics/icons/symbols/plus';console.log(iconMarkup({symbol}));",resolveDir:process.cwd()},outdir:'static'});await writeFile('static-meta.json',JSON.stringify(pure.metafile));
  `,
  );
  execFileSync(process.execPath, ['build.mjs'], {
    cwd: consumer,
    stdio: 'pipe',
    windowsHide: true,
  });
  const staticMeta = JSON.parse(await readFile(join(consumer, 'static-meta.json'), 'utf8'));
  // esbuild can emit orphaned dynamic chunks for a tree-shaken function. Only
  // outputs reachable from the requested entry belong to the static consumer.
  const staticOutputs = new Set();
  function visitStatic(path) {
    if (staticOutputs.has(path)) return;
    staticOutputs.add(path);
    const file = staticMeta.outputs[path];
    assert.ok(file);
    for (const edge of file.imports) {
      assert.notEqual(
        edge.kind,
        'dynamic-import',
        'Pure static entry must not retain a lazy loader',
      );
      if (!edge.external) visitStatic(edge.path);
    }
  }
  visitStatic(
    Object.keys(staticMeta.outputs).find(
      (path) => staticMeta.outputs[path].entryPoint === '<stdin>',
    ),
  );
  const retained = [...staticOutputs].flatMap((path) =>
    Object.entries(staticMeta.outputs[path].inputs)
      .filter(([, size]) => size.bytesInOutput > 0)
      .map(([name]) => name),
  );
  assert.ok(
    !retained.some((name) => /motion|compiler|catalog|registry/.test(name)),
    retained.join('\n'),
  );
  assert.deepEqual(
    retained
      .filter((name) => /icons\/dist\/symbols\//.test(name))
      .map((name) => name.split('/').at(-1)),
    ['plus.js'],
  );
  await copyFile(join(consumer, 'index.html'), join(consumer, 'web/index.html'));
  await writeFile(
    join(consumer, 'web/development.html'),
    html.replace('src="/client.js"', 'src="/development/client.js"'),
  );
  server = createServer(async (request, response) => {
    const path = resolve(consumer, 'web', `.${request.url === '/' ? '/index.html' : request.url}`);
    if (!path.startsWith(join(consumer, 'web'))) return response.writeHead(403).end();
    try {
      response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/html');
      response.end(await readFile(path));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  const nojs = await browser.newPage({ javaScriptEnabled: false });
  await nojs.goto(url);
  await expect(nojs.locator('svg')).toHaveCount(5);
  await nojs.close();
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.iconMediaListeners = 0;
    const listeners = new WeakMap();
    const add = MediaQueryList.prototype.addEventListener;
    const remove = MediaQueryList.prototype.removeEventListener;
    MediaQueryList.prototype.addEventListener = function (type, listener, options) {
      if (type === 'change') {
        let set = listeners.get(this);
        if (!set) {
          set = new Set();
          listeners.set(this, set);
        }
        if (!set.has(listener)) {
          set.add(listener);
          window.iconMediaListeners++;
        }
      }
      return add.call(this, type, listener, options);
    };
    MediaQueryList.prototype.removeEventListener = function (type, listener, options) {
      if (type === 'change' && listeners.get(this)?.delete(listener)) window.iconMediaListeners--;
      return remove.call(this, type, listener, options);
    };
    window.iconResources = { observers: 0, media: 0 };
    const Observer = window.ResizeObserver;
    window.ResizeObserver = class extends Observer {
      constructor(callback) {
        super(callback);
        window.iconResources.observers++;
      }
    };
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      window.iconResources.media++;
      return matchMedia(query);
    };
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(url);
  await page.waitForFunction(() => window.ready);
  await page.locator('svg').evaluateAll((nodes) => {
    for (const node of nodes) node.__original = true;
  });
  await page.evaluate(() => window.upgrade());
  assert.ok(
    await page.locator('svg').evaluateAll((nodes) => nodes.every((node) => node.__original)),
    'Upgrade without resources preserves server SVG',
  );
  await page.evaluate(() => window.hydrate());
  assert.ok(
    await page.locator('svg').evaluateAll((nodes) => nodes.every((node) => node.__original)),
    'Hydration adopts SVG',
  );
  const idle = [];
  for (const count of [1, 100]) {
    const resources = await page.evaluate(() => ({ ...window.iconResources }));
    await page.evaluate((count) => window.staticIcons(count), count);
    const frames = await page.evaluate(() => window.iconFrames);
    await page.waitForTimeout(150);
    const afterResources = await page.evaluate(() => window.iconResources);
    idle.push({
      icons: count,
      frames: (await page.evaluate(() => window.iconFrames)) - frames,
      observers: afterResources.observers - resources.observers,
      media: afterResources.media - resources.media,
    });
    assert.equal(idle.at(-1).frames, 0);
    assert.equal(idle.at(-1).observers, 0);
    assert.equal(idle.at(-1).media, 0);
  }
  await page.evaluate(() => {
    window.staticIcons(0);
  });
  // The first state change races lazy loading; only the final request may remain.
  await page.evaluate(async () => {
    await window.update({ state: 'selected' });
    await window.update({ state: 'unselected' });
    await window.update({ state: 'selected' });
    await window.race();
  });
  await page.waitForTimeout(350);
  await expect(page.locator('svg')).toHaveCount(5);
  await page.evaluate(() => window.update({ symbol: 'bookmark', state: 'selected' }));
  await page.waitForTimeout(250);
  await page.evaluate(() => window.update({ state: 'unselected' }));
  await page.waitForTimeout(50);
  await page.evaluate(() => window.update({ state: 'selected' }));
  await page.waitForTimeout(250);
  const paths = await page
    .locator('#react-icon path')
    .evaluateAll((nodes) =>
      nodes
        .filter((n) => Number(n.getAttribute('opacity') ?? 1) > 0.999)
        .map((n) => n.getAttribute('d')),
    );
  const expectedPaths = await page.evaluate(() =>
    window.expected({ symbol: 'bookmark', state: 'selected' }),
  );
  const actualCoverage = await page.evaluate((paths) => window.coverage(paths), paths);
  assert.deepEqual(
    actualCoverage,
    expectedPaths,
    'Interrupted state reaches the imported final pose',
  );
  assert.equal(
    await page.evaluate(() => window.iconMediaListeners),
    0,
    'Settled transitions release subscriptions',
  );
  assert.deepEqual(await page.evaluate(() => window.effectControls()), {
    paused: 'paused',
    finished: 'finished',
    count: 0,
    pausedListeners: 0,
    resumedListeners: 1,
    finishedListeners: 0,
  });
  await page.evaluate(() => window.update({ state: 'unselected' }));
  await page.waitForTimeout(30);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(30);
  const afterReduced = await page.evaluate(() => window.iconFrames);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.iconFrames), afterReduced);
  const sizes = [];
  for (const rootSize of [16, 20, 32]) {
    await page.evaluate((root) => window.update({ root }), rootSize);
    sizes.push({
      root: rootSize,
      widths: await page
        .locator('svg')
        .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().width)),
    });
    assert.ok(sizes.at(-1).widths.every((width) => width === rootSize * 1.5));
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(await page.evaluate(() => window.lifecycle()), {
    reconnected: true,
    detachedFrames: 0,
    hasMotionParts: false,
  });
  assert.equal(await page.evaluate(() => window.calendarTest()), true);
  // A missing optional motion chunk cannot keep the old semantic artwork.
  const metadata = JSON.parse(await readFile(join(consumer, 'meta.json'), 'utf8'));
  const motionPaths = new Set(
    Object.entries(metadata.outputs)
      .filter(([, file]) =>
        Object.keys(file.inputs).some((name) => /icons\/dist\/motion\/index\.js/.test(name)),
      )
      .map(([name]) => `/${name.split('/').at(-1)}`),
  );
  assert.ok(motionPaths.size > 0);
  for (const preference of ['explicit', 'system']) {
    const waiting = await browser.newPage();
    let release;
    let requested;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    const pending = new Promise((resolve) => {
      requested = resolve;
    });
    await waiting.route('**/*.js', async (route) => {
      if (motionPaths.has(new URL(route.request().url()).pathname)) {
        requested();
        await held;
      }
      await route.continue();
    });
    try {
      await waiting.goto(url);
      await waiting.waitForFunction(() => window.ready);
      await waiting.evaluate(async () => {
        await window.upgrade();
        await window.hydrate();
        await window.update({ state: 'selected' });
      });
      await pending;
      if (preference === 'system') await waiting.emulateMedia({ reducedMotion: 'reduce' });
      else await waiting.evaluate(() => window.update({ reducedMotion: true }));
      await waiting.waitForTimeout(30);
      assert.deepEqual(
        await waiting
          .locator('#react-icon path')
          .evaluateAll((nodes) => window.coverage(nodes.map((n) => n.getAttribute('d')))),
        await waiting.evaluate(() => window.expected({ state: 'selected' })),
        `${preference} reduced motion resolves the pending semantic state before chunk delivery`,
      );
      release();
      await waiting.waitForTimeout(100);
      await expect(waiting.locator('[data-part]')).toHaveCount(0);
    } finally {
      release();
      await waiting.close();
    }
  }
  const failed = await browser.newPage();
  await failed.route('**/*.js', (route) =>
    motionPaths.has(new URL(route.request().url()).pathname)
      ? route.abort('failed')
      : route.continue(),
  );
  await failed.goto(url);
  await failed.waitForFunction(() => window.ready);
  await failed.evaluate(async () => {
    window.motionErrors = 0;
    document.addEventListener('icon-error', () => window.motionErrors++);
    await window.upgrade();
    await window.hydrate();
    await window.update({ state: 'selected' });
  });
  await failed.waitForFunction(() => window.motionErrors === 5);
  assert.deepEqual(
    await failed
      .locator('#react-icon path')
      .evaluateAll((nodes) => window.coverage(nodes.map((n) => n.getAttribute('d')))),
    await failed.evaluate(() => window.expected({ state: 'selected' })),
  );
  await failed.close();
  const development = [];
  for (const [name, engine] of [
    ['chromium', chromium],
    ['webkit', webkit],
  ]) {
    const devBrowser = await engine.launch({ headless: true });
    try {
      const devPage = await devBrowser.newPage();
      const devErrors = [];
      devPage.on('pageerror', (error) => devErrors.push(error.message));
      await devPage.goto(`${url}/development.html`);
      await devPage.waitForFunction(() => window.ready);
      await devPage.evaluate(async () => {
        await window.upgrade();
        await window.hydrate();
        for (const size of [24, 48, 24, 32, 24]) await window.update({ size });
        await window.update({ symbol: 'bookmark', state: 'selected', duration: 0 });
        await window.update({ label: 'Saved item', size: 32 });
      });
      assert.deepEqual(
        await devPage
          .locator('svg')
          .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width)),
        [32, 32, 32, 32, 32],
      );
      assert.deepEqual(await devPage.evaluate(() => window.lifecycle()), {
        reconnected: true,
        detachedFrames: 0,
        hasMotionParts: false,
      });
      await devPage.evaluate(async () => {
        await window.update({ state: 'unselected', duration: 30 });
        await window.update({ label: 'Item', size: 24 });
      });
      await devPage.waitForFunction(() =>
        [...document.querySelectorAll('lab-icon')].every((icon) =>
          icon.shadowRoot.querySelector('[data-part]'),
        ),
      );
      await devPage.evaluate(() => window.update({ label: 'Updated item' }));
      assert.deepEqual(devErrors, []);
      development.push({
        engine: name,
        repeatedSizeUpdates: true,
        reconnect: true,
        motionUpdates: true,
        errors: 0,
      });
    } finally {
      await devBrowser.close();
    }
  }
  const result = {
    archives,
    serverHtmlBytes: Buffer.byteLength(html),
    staticBytes: [...staticOutputs].reduce((n, path) => n + staticMeta.outputs[path].bytes, 0),
    idle,
    sizes,
    development,
    publicIcons: !process.env.LAB_ICONS_TARBALL,
    checks: [
      'ESM+CJS SSR',
      'installed NodeNext types',
      'all four generated SSR adapters',
      'no-JS SVG',
      'resource hydration SVG identity',
      'lazy-load state races',
      'symbol replacement and dispose',
      'interrupted state pose',
      'effect pause/seek/play/finish and dispose',
      'reduced motion',
      'explicit/system reduced motion during held lazy HTTP import',
      'optional motion load failure preserves requested state',
      'static tree shaking',
      'reconnect latest symbol/size/state and detached resource cleanup',
      'calendar Date/IANA SSR and updates',
    ],
  };
  await writeFile(join(output, 'installed.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser?.close();
  await new Promise((done) => (server ? server.close(done) : done()));
  await rm(consumer, { recursive: true, force: true });
}
