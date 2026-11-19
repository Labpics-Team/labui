import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, webkit } from '@playwright/test';
import { runPnpm, writePackedConsumerProject } from './packed-consumer-project.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = join(root, 'docs/evidence/tooltip');
const consumer = await mkdtemp(join(tmpdir(), 'labui-tooltip-frameworks-'));
const archives = [];
const commands = [];
const records = [];
const dependencies = {
  vue: '3.5.42',
  'solid-js': '1.9.4',
  svelte: '5.19.0',
  astro: '7.2.8',
  lit: '3.3.3',
  '@lit-labs/ssr': '4.1.0',
  '@lit-labs/ssr-client': '1.1.8',
  '@labpics/icons': '0.4.0',
  esbuild: '0.25.12',
};
const versions = { ...dependencies };
const text = 'Hello, my name is Tooltip';
const styles = `
import '@labpics/fonts/fonts.css';
import '@labui/colors/contract.css';
import '@labpics/ui-core/tokens.css';
import '@labpics/ui-core/tooltip.css';
`;
const pageStyle =
  'body{margin:0;background:#f4f4f4;font-family:Geist}main{position:absolute;left:360px;top:260px}button{font:inherit;padding:8px 16px}';
let server;
const pnpm = (args, cwd = consumer) => {
  commands.push({
    command: ['pnpm', ...args],
    cwd: cwd === consumer ? '<consumer>' : cwd.replace(root, '<repo>'),
  });
  return runPnpm(args, cwd);
};
const node = (args) => {
  commands.push({ command: ['node', ...args], cwd: '<consumer>' });
  return execFileSync(process.execPath, args, {
    cwd: consumer,
    stdio: 'pipe',
    encoding: 'utf8',
    windowsHide: true,
  });
};

try {
  await mkdir(output, { recursive: true });
  await mkdir(join(consumer, 'packs'));
  const overrides = {};
  for (const folder of [
    'tokens',
    'shadow',
    'materials',
    'fonts',
    'colors',
    'core',
    'vue',
    'solid',
    'svelte',
    'astro',
  ]) {
    const location = join(root, 'packages', folder);
    const pkg = JSON.parse(await readFile(join(location, 'package.json'), 'utf8'));
    pnpm(['pack', '--pack-destination', join(consumer, 'packs')], location);
    const archive = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
    dependencies[pkg.name] = overrides[pkg.name] = `file:./packs/${archive}`;
    archives.push({
      name: pkg.name,
      version: pkg.version,
      archive,
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs', archive)))
        .digest('hex'),
    });
  }
  if (process.env.LAB_ICONS_TARBALL) {
    await copyFile(process.env.LAB_ICONS_TARBALL, join(consumer, 'packs/icons.tgz'));
    dependencies['@labpics/icons'] = overrides['@labpics/icons'] = 'file:./packs/icons.tgz';
    archives.push({
      name: '@labpics/icons',
      version: '0.4.0',
      archive: 'icons.tgz',
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs/icons.tgz')))
        .digest('hex'),
    });
  }
  await writePackedConsumerProject(consumer, {
    name: 'labui-tooltip-framework-consumer',
    dependencies,
    overrides,
  });
  console.info('Installing packed Tooltip framework consumers');
  pnpm(['install', '--ignore-scripts', '--config.auto-install-peers=false', '--prefer-offline']);

  await writeFile(
    join(consumer, 'VueApp.vue'),
    `
<script setup>
import {Tooltip} from '@labpics/ui-vue';
import {reactive,onMounted,onUnmounted,nextTick} from 'vue';
const props=reactive({content:${JSON.stringify(text)},type:'neutral',size:'m',tail:'chevron',placement:'bottom'});
onMounted(()=>{window.updateTooltip=async(next)=>{Object.assign(props,next);await nextTick();await document.querySelector('lab-tooltip').updateComplete}});
onUnmounted(()=>window.frameworkCleanups++);
const opened=event=>window.openEvents.push(event.detail.open);
const clicked=()=>window.clicks++;
</script>
<template><main><Tooltip id="tooltip" v-bind="props" :onOpenChange="opened"><button id="trigger" @click="clicked">Help</button></Tooltip></main></template>
`,
  );
  await writeFile(
    join(consumer, 'solid-app.mjs'),
    `
import {Tooltip} from '@labpics/ui-solid';
import {createComponent,createSignal,mergeProps,onMount,onCleanup} from 'solid-js';
import {Dynamic} from 'solid-js/web';
const element=(component,props={})=>createComponent(Dynamic,mergeProps({component},props));
export function App(){
  const [props,setProps]=createSignal({content:${JSON.stringify(text)},type:'neutral',size:'m',tail:'chevron',placement:'bottom'});
  onMount(()=>{window.updateTooltip=async(next)=>{setProps({...props(),...next});await Promise.resolve();await document.querySelector('lab-tooltip').updateComplete}});
  onCleanup(()=>{if(typeof window!=='undefined')window.frameworkCleanups++});
  return element('main',{get children(){return createComponent(Tooltip,{
    id:'tooltip',get content(){return props().content},get type(){return props().type},get size(){return props().size},get tail(){return props().tail},get placement(){return props().placement},
    onOpenChange:event=>window.openEvents.push(event.detail.open),
    get children(){return element('button',{id:'trigger',onClick:()=>window.clicks++,children:'Help'})}
  })}})
}
`,
  );
  await writeFile(
    join(consumer, 'SvelteApp.svelte'),
    `
<script>
import {Tooltip} from '@labpics/ui-svelte';
import {onMount,onDestroy,flushSync} from 'svelte';
let props=$state({content:${JSON.stringify(text)},type:'neutral',size:'m',tail:'chevron',placement:'bottom'});
onMount(()=>{window.updateTooltip=async(next)=>{flushSync(()=>{props={...props,...next}});await document.querySelector('lab-tooltip').updateComplete}});
onDestroy(()=>{if(typeof window!=='undefined')window.frameworkCleanups++});
</script>
<main><Tooltip id="tooltip" {...props} onOpenChange={event=>window.openEvents.push(event.detail.open)}><button id="trigger" onclick={()=>window.clicks++}>Help</button></Tooltip></main>
`,
  );

  // Use the installed public components with each framework's actual renderer.
  // No adapter /ssr helper or workspace-source alias is used by these apps.
  await writeFile(
    join(consumer, 'build-consumer.mjs'),
    `
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {build} from 'esbuild';
import {compile} from 'svelte/compiler';
import {compileScript,parse} from 'vue/compiler-sfc';
const compiler=server=>({name:'installed-framework-components',setup(build){build.onLoad({filter:/\\.(vue|svelte)$/},async({path})=>({loader:'js',contents:path.endsWith('.vue')?compileScript(parse(await readFile(path,'utf8'),{filename:path}).descriptor,{id:basename(path),inlineTemplate:true,templateOptions:{ssr:server}}).content:compile(await readFile(path,'utf8'),{filename:path,generate:server?'server':'client',dev:true}).js.code}))}});
const frameworks={
vue:{server:"import {createSSRApp} from 'vue';import {renderToString} from 'vue/server-renderer';import App from './VueApp.vue';export const html=await renderToString(createSSRApp(App));",client:"import {createSSRApp,nextTick} from 'vue';import App from './VueApp.vue';export async function mount(){const app=createSSRApp(App);app.mount('#app');await nextTick();window.unmountTooltip=()=>app.unmount()};"},
solid:{server:"import {renderToString,generateHydrationScript} from 'solid-js/web';import {createComponent} from 'solid-js';import {App} from './solid-app.mjs';export const html=renderToString(()=>createComponent(App,{}));export const hydrationScript=generateHydrationScript();",client:"import {hydrate} from 'solid-js/web';import {createComponent} from 'solid-js';import {App} from './solid-app.mjs';export function mount(){const dispose=hydrate(()=>createComponent(App,{}),document.getElementById('app'));window.unmountTooltip=()=>dispose()};"},
svelte:{server:"import {render} from 'svelte/server';import App from './SvelteApp.svelte';export const html=render(App).body;",client:"import {hydrate,flushSync,unmount} from 'svelte';import App from './SvelteApp.svelte';export function mount(){const app=hydrate(App,{target:document.getElementById('app')});flushSync();window.unmountTooltip=async()=>{await unmount(app);flushSync()}};"}
};
const qualification=[];
for(const [name,source] of Object.entries(frameworks)){
 await mkdir('web/'+name,{recursive:true});
 await writeFile(name+'-server.mjs',source.server);
 await writeFile(name+'-hydrate.mjs',source.client);
 await writeFile(name+'-client.mjs',${JSON.stringify(styles)}+"import '@lit-labs/ssr-client/lit-element-hydrate-support.js';window.clicks=0;window.openEvents=[];window.frameworkCleanups=0;window.hydrate=async()=>{const {mount}=await import('./"+name+"-hydrate.mjs');await mount();await document.querySelector('lab-tooltip').updateComplete;window.ready=true};");
 await build({entryPoints:[name+'-server.mjs'],outfile:'server/'+name+'.mjs',bundle:true,format:'esm',platform:'node',conditions:['development'],tsconfigRaw:{},plugins:[compiler(true)],external:['vue','vue/*','solid-js','solid-js/*','svelte','svelte/*','@labpics/ui-core','@labpics/ui-core/*','@labpics/ui-vue','@labpics/ui-vue/*','@labpics/ui-solid','@labpics/ui-solid/*']});
 const browser=await build({entryPoints:[name+'-client.mjs'],outdir:'web/'+name,bundle:true,format:'esm',platform:'browser',splitting:true,conditions:['development'],tsconfigRaw:{},plugins:[compiler(false)],metafile:true,loader:{'.webp':'file','.woff':'file','.woff2':'file','.ttf':'file'},define:{__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'true'}});
 const inputs=Object.keys(browser.metafile.inputs);
 assert(!inputs.some(x=>/@lit-labs\\/ssr\\//.test(x)),name+': SSR engine entered browser');
 assert(!inputs.some(x=>/packages\\/(core|vue|solid|svelte)\\/src\\//.test(x)),name+': workspace source substituted installed artifact');
 assert(inputs.some(x=>x.includes('ui-'+name+'/dist/')),name+': missing actual installed framework binding');
 const rendered=await import('./server/'+name+'.mjs');
 assert(rendered.html.includes('shadowrootmode'),name+': missing DSD: '+rendered.html.slice(0,1200));
 assert.equal((rendered.html.match(/<button[ >]/g)||[]).length,1,name+': expected one server control');
 await writeFile('web/'+name+'/index.html','<!doctype html><html data-theme="light"><head><meta charset="utf-8">'+(rendered.hydrationScript??'')+'<link rel="stylesheet" href="/'+name+'/'+name+'-client.css"><style>'+${JSON.stringify(pageStyle)}+'</style></head><body><div id="app">'+rendered.html+'</div><script type="module" src="/'+name+'/'+name+'-client.js"></script></body></html>');
 qualification.push({framework:name,server:source.server,client:source.client,browserModules:inputs.length,installedBindings:inputs.filter(x=>x.includes('ui-'+name+'/dist/')&&/index\\.js|tooltip|Tooltip/.test(x)),serverEngineInBrowser:false});
}
await writeFile('qualification.json',JSON.stringify(qualification,null,2));
`,
  );
  console.info('Building Vue, Solid and Svelte SSR and hydration consumers');
  node(['--conditions=development', 'build-consumer.mjs']);

  // Astro's public .astro wrapper ships its own client script. Build that wrapper
  // as a real page; do not claim Astro has a reactive client component runtime.
  await mkdir(join(consumer, 'src/pages'), { recursive: true });
  await writeFile(
    join(consumer, 'src/pages/index.astro'),
    `
---
import Tooltip from '@labpics/ui-astro/Tooltip.astro';
${styles}
---
<!doctype html><html data-theme="light"><head><meta charset="utf-8"/><style is:global>${pageStyle}</style></head><body><div id="app"><main><Tooltip content=${JSON.stringify(text)} type="neutral" size="m" tail="chevron" placement="bottom"><button id="trigger">Help</button></Tooltip></main></div>
<script>
window.clicks=0;window.openEvents=[];window.frameworkCleanups=0;
await customElements.whenDefined('lab-tooltip');
const tooltip=document.querySelector('lab-tooltip');
await tooltip.updateComplete;
const click=()=>window.clicks++;
const changed=event=>window.openEvents.push(event.detail.open);
document.querySelector('#trigger').addEventListener('click',click);
tooltip.addEventListener('open-change',changed);
window.updateTooltip=async(next)=>{Object.assign(tooltip,next);await tooltip.updateComplete};
window.unmountTooltip=()=>{document.querySelector('#trigger').removeEventListener('click',click);tooltip.removeEventListener('open-change',changed);document.querySelector('main').remove();window.frameworkCleanups++};
window.ready=true;
</script></body></html>
`,
  );
  await writeFile(
    join(consumer, 'astro.config.mjs'),
    "import {defineConfig} from 'astro/config';export default defineConfig({output:'static',outDir:'./web/astro',vite:{build:{target:'es2022'}}});\n",
  );
  console.info('Building installed public Tooltip.astro page');
  pnpm(['exec', 'astro', 'build']);
  const astroHtml = await readFile(join(consumer, 'web/astro/index.html'), 'utf8');
  assert(astroHtml.includes('shadowrootmode'), 'Astro build must include DSD');
  assert.match(
    astroHtml,
    /<script[^>]*type="module"/,
    'Astro wrapper must deliver a client script',
  );
  assert.equal((astroHtml.match(/<button[ >]/g) ?? []).length, 1);

  server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') return response.writeHead(204).end();
    const relative = url.pathname.startsWith('/_astro/') ? `/astro${url.pathname}` : url.pathname;
    const path = resolve(
      consumer,
      'web',
      `.${relative.endsWith('/') ? `${relative}index.html` : relative}`,
    );
    if (!path.startsWith(`${join(consumer, 'web')}${sep}`)) return response.writeHead(403).end();
    try {
      response.setHeader(
        'content-type',
        {
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.woff2': 'font/woff2',
          '.woff': 'font/woff',
          '.ttf': 'font/ttf',
          '.webp': 'image/webp',
          '.html': 'text/html',
        }[extname(path)] ?? 'application/octet-stream',
      );
      response.end(await readFile(path));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  for (const [engine, launch] of Object.entries({ chromium, webkit })) {
    const browser = await launch.launch({ headless: true });
    try {
      for (const framework of ['vue', 'solid', 'svelte', 'astro']) {
        console.info(`Checking installed ${framework}: ${engine}`);
        const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('response', (response) => {
          if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
        });
        page.on('console', (message) => {
          if (
            message.type() === 'error' ||
            (message.type() === 'warning' && /hydrat|mismatch/i.test(message.text()))
          )
            errors.push(message.text());
        });
        let releaseScripts;
        if (framework === 'astro') {
          const released = new Promise((done) => {
            releaseScripts = done;
          });
          await page.route('**/*.js', async (route) => {
            await released;
            await route.continue();
          });
        }
        await page.goto(`http://127.0.0.1:${server.address().port}/${framework}/`, {
          waitUntil: framework === 'astro' ? 'commit' : 'load',
        });
        const trigger = page.locator('#trigger');
        const host = page.locator('lab-tooltip');
        const surface = host.locator('.lab-tooltip-content');
        await expect(trigger).toHaveCount(1);
        await expect(surface).toBeAttached();
        const before = await page.evaluate(() => {
          const host = document.querySelector('lab-tooltip');
          window.before = {
            host,
            trigger: document.querySelector('#trigger'),
            surface: host.shadowRoot.querySelector('.lab-tooltip-content'),
          };
          return {
            controls: document.querySelectorAll('#app button').length,
            registered: !!customElements.get('lab-tooltip'),
            shadow: !!host.shadowRoot,
            surfaceHidden: window.before.surface.hidden,
            type: host.getAttribute('type'),
            size: host.getAttribute('size'),
          };
        });
        assert.deepEqual(
          before,
          {
            controls: 1,
            registered: false,
            shadow: true,
            surfaceHidden: true,
            type: 'neutral',
            size: 'm',
          },
          `${framework}/${engine}: SSR before registration`,
        );
        if (framework === 'astro') releaseScripts();
        else await page.evaluate(() => window.hydrate());
        await page.waitForFunction(() => window.ready);
        await page.evaluate(() => document.fonts.ready);
        const after = await page.evaluate(() => ({
          controls: document.querySelectorAll('#app button').length,
          sameHost: document.querySelector('lab-tooltip') === window.before.host,
          sameTrigger: document.querySelector('#trigger') === window.before.trigger,
          sameSurface:
            document
              .querySelector('lab-tooltip')
              .shadowRoot.querySelector('.lab-tooltip-content') === window.before.surface,
          fallbackTabindex: document
            .querySelector('lab-tooltip')
            .shadowRoot.querySelector('.lab-tooltip-fallback')
            .getAttribute('tabindex'),
        }));
        assert.deepEqual(
          after,
          {
            controls: 1,
            sameHost: true,
            sameTrigger: true,
            sameSurface: true,
            fallbackTabindex: null,
          },
          `${framework}/${engine}: hydration must adopt the original control`,
        );
        await trigger.hover();
        await expect(surface).toBeVisible();
        await expect(trigger).toHaveAccessibleDescription(text);
        const metrics = await surface.evaluate((element) => {
          const style = getComputedStyle(element);
          const arrow = element.querySelector('.lab-tooltip-arrow');
          return {
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height,
            font: style.fontSize,
            lineHeight: style.lineHeight,
            tracking: style.letterSpacing,
            padding: style.padding,
            radius: style.borderRadius,
            type: element.dataset.type,
            size: element.dataset.size,
            background: getComputedStyle(element, '::before').backgroundColor,
            clip: getComputedStyle(element, '::before').clipPath,
            tail: arrow.dataset.tail,
            mask: getComputedStyle(arrow, '::before').maskImage,
          };
        });
        assert.equal(metrics.height, 48);
        assert.equal(metrics.font, '16px');
        assert.equal(metrics.lineHeight, '24px');
        assert.equal(metrics.tracking, '-0.25px');
        assert.equal(metrics.padding, '12px');
        assert.equal(metrics.radius, '12px');
        assert.equal(metrics.type, 'neutral');
        assert.equal(metrics.size, 'm');
        assert.equal(metrics.tail, 'chevron');
        assert.notEqual(metrics.clip, 'none');
        assert.notEqual(metrics.mask, 'none');
        assert(!['transparent', 'rgba(0, 0, 0, 0)'].includes(metrics.background));
        await surface.hover();
        await page.waitForTimeout(220);
        await expect(surface).toBeVisible();
        await page.screenshot({ path: join(output, `framework-${framework}-${engine}.png`) });
        await page.keyboard.press('Escape');
        await expect(surface).toBeHidden();
        await page.mouse.move(0, 0);
        await page.keyboard.press('Tab');
        await trigger.focus();
        await expect(surface).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(surface).toBeHidden();
        await expect(trigger).toBeFocused();
        await trigger.click();
        assert.equal(
          await page.evaluate(() => window.clicks),
          1,
          `${framework}: consumer click handler`,
        );
        await page.mouse.move(0, 0);
        await trigger.evaluate((element) => element.blur());
        await trigger.hover();
        await expect(surface).toBeVisible();
        await page.evaluate(() =>
          window.updateTooltip({
            type: 'accent',
            tail: 'bubble',
            placement: 'left',
            content: 'Updated framework description',
          }),
        );
        await expect(surface).toHaveAttribute('data-type', 'accent');
        await expect(host.locator('.lab-tooltip-arrow')).toHaveAttribute('data-tail', 'bubble');
        await expect(host.locator('.lab-tooltip-positioner')).toHaveAttribute('data-side', 'left');
        await expect(trigger).toHaveAccessibleDescription('Updated framework description');
        const updated = await host.evaluate((element) => {
          const surface = element.shadowRoot.querySelector('.lab-tooltip-content');
          return {
            type: element.type,
            tail: element.tail,
            placement: element.placement,
            content: element.content,
            background: getComputedStyle(surface, '::before').backgroundColor,
            mask: getComputedStyle(surface.querySelector('.lab-tooltip-arrow'), '::before')
              .maskImage,
          };
        });
        assert.equal(updated.type, 'accent');
        assert.equal(updated.tail, 'bubble');
        assert.equal(updated.placement, 'left');
        assert.notEqual(updated.background, metrics.background);
        assert.notEqual(updated.mask, metrics.mask);
        assert(
          await page.evaluate(
            () => window.openEvents.includes(true) && window.openEvents.includes(false),
          ),
          `${framework}: adapter open-change events`,
        );
        await page.evaluate(async () => {
          const trigger = window.before.trigger;
          window.descriptionNodes = trigger
            .getAttribute('aria-describedby')
            .split(/\s+/)
            .map((id) => trigger.getRootNode().getElementById(id));
          await window.unmountTooltip();
          window.eventsAfterUnmount = window.openEvents.length;
          window.before.trigger.dispatchEvent(
            new PointerEvent('pointerenter', { pointerType: 'mouse' }),
          );
          window.before.trigger.dispatchEvent(new FocusEvent('focus'));
        });
        await page.waitForTimeout(450);
        const cleanup = await page.evaluate(() => ({
          controls: document.querySelectorAll('#app button').length,
          hostConnected: window.before.host.isConnected,
          describedBy: window.before.trigger.getAttribute('aria-describedby'),
          descriptionsRemoved:
            window.descriptionNodes.length > 0 &&
            window.descriptionNodes.every((node) => !node.isConnected),
          popoverOpen: window.before.host.shadowRoot
            .querySelector('.lab-tooltip-positioner')
            .matches(':popover-open'),
          eventsAfterUnmount: window.openEvents.length - window.eventsAfterUnmount,
          frameworkCleanups: window.frameworkCleanups,
        }));
        assert.deepEqual(
          cleanup,
          {
            controls: 0,
            hostConnected: false,
            describedBy: null,
            descriptionsRemoved: true,
            popoverOpen: false,
            eventsAfterUnmount: 0,
            frameworkCleanups: 1,
          },
          `${framework}/${engine}: framework teardown must release Tooltip`,
        );
        assert.deepEqual(errors, [], `${framework}/${engine}: browser and hydration errors`);
        records.push({
          engine,
          framework,
          before,
          after,
          metrics,
          interactions: {
            hover: true,
            hoverableContent: true,
            focus: true,
            escapeKeepsFocus: true,
            consumerClick: true,
            openChangeEvents: true,
          },
          updated,
          cleanup,
          errors,
        });
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }
  const qualification = JSON.parse(await readFile(join(consumer, 'qualification.json'), 'utf8'));
  await writeFile(
    join(output, 'frameworks.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), command: 'node apps/docs/tests/tooltip-frameworks-packed.mjs', node: process.version, publicIcons: !process.env.LAB_ICONS_TARBALL, versions, archives, commands, qualification, astro: { entry: '@labpics/ui-astro/Tooltip.astro', build: 'astro build', client: 'The public .astro wrapper hydrates the shared Lit element; reactive updates use its DOM properties, not an Astro client framework runtime.' }, records }, null, 2)}\n`,
  );
  console.info(
    'Installed Tooltip: Vue, Solid, Svelte native SSR/hydration and real Astro build passed in Chromium and WebKit.',
  );
} finally {
  if (server) await new Promise((done) => server.close(done));
  assert(
    resolve(consumer).startsWith(`${resolve(tmpdir())}${sep}`) &&
      basename(consumer).startsWith('labui-tooltip-frameworks-'),
  );
  await rm(consumer, { recursive: true, force: true });
}
