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
const output = join(root, 'docs/evidence/menu');
const consumer = await mkdtemp(join(tmpdir(), 'labui-menu-'));
let server;
try {
  await mkdir(output, { recursive: true });
  await mkdir(join(consumer, 'packs'));
  const dependencies = {
    react: '18.3.1',
    'react-dom': '18.3.1',
    vue: '3.5.42',
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
    archives.push({
      name: 'icons-0.4.0',
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs/icons.tgz')))
        .digest('hex'),
    });
  }
  await writePackedConsumerProject(consumer, {
    name: 'labui-menu-consumer',
    dependencies,
    overrides,
  });
  await writeFile(
    join(consumer, 'pnpm-workspace.yaml'),
    JSON.stringify({ packages: ['.'], overrides, autoInstallPeers: false }),
  );
  pnpm(['install', '--ignore-scripts', '--prefer-offline'], consumer);
  await writeFile(
    join(consumer, 'model.mjs'),
    `
    import {symbol as component} from '@labpics/icons/symbols/component';
    import {symbol as bin} from '@labpics/icons/symbols/bin';
    import {symbol as duplicate} from '@labpics/icons/symbols/duplicate';
    import {symbol as plus} from '@labpics/icons/symbols/plus-circle';
    import {symbol as earth} from '@labpics/icons/symbols/earth';
    import {symbol as share} from '@labpics/icons/symbols/arrow-redo';
    import {symbol as print} from '@labpics/icons/symbols/print';
    const shortcuts=[['⌘','⇧','H'],['⌘','G'],['⌘','F'],['⌘','D'],[],['⇧','Z'],[],['⌘','⇧','Q']];
    export const dropdown=Array.from({length:8},(_,i)=>({value:'item-'+i,label:'Label',icon:component,iconVariant:'filled',type:i===0?'accent':i===7?'danger':'neutral',disabled:i===6,shortcut:shortcuts[i]})).flatMap((item,i)=>[item,...[2,4,6].includes(i)?[{value:'sep-'+i,kind:'separator'}]:[]]);
    export const context=[{value:'back',label:'Back',shortcut:['⌘','[']},{value:'forward',label:'Forward',disabled:true},{value:'reload',label:'Reload',shortcut:['⌘','R']},{value:'sep1',kind:'separator'},...['1st','2nd','3rd'].map((s,i)=>({value:'check'+i,label:s+' option',kind:'check',shortcut:['⌘','⇧',String.fromCharCode(65+i)],closeOnSelect:false})),{value:'sep2',kind:'separator'},{value:'team',label:'Team',kind:'submenu',items:[{value:'invite',label:'Invite member'},{value:'share',label:'Share',kind:'submenu',items:[{value:'link',label:'Copy link'}]}]},{value:'sep3',kind:'separator'},...['1st','2nd'].map((s,i)=>({value:'radio'+i,label:s+' option',kind:'radio',group:'choice',shortcut:['⌘',String.fromCharCode(65+i)],closeOnSelect:false})),{value:'sep4',kind:'separator'},{value:'delete',label:'Delete',type:'danger',icon:bin}];
    export const menus=[{value:'file',label:'File',items:[{value:'tab',label:'New Tab',icon:duplicate,shortcut:['⌘','T']},{value:'window',label:'New Window',icon:plus,shortcut:['⌘','N']},{value:'incognito',label:'New Incognito Window',icon:earth,disabled:true},{value:'fsep1',kind:'separator'},{value:'share',label:'Share',icon:share,kind:'submenu',items:[{value:'link',label:'Copy link'}]},{value:'print',label:'Print',icon:print,shortcut:['⌘','P']}]},{value:'edit',label:'Edit',items:[{value:'undo',label:'Undo'}]},{value:'view',label:'View',items:[{value:'zoom',label:'Zoom in'}]},{value:'profiles',label:'Profiles',items:[{value:'account',label:'Account'}]}];
  `,
  );
  await writeFile(
    join(consumer, 'server.mjs'),
    `
    import {writeFile} from 'node:fs/promises';
    const rows=[];
    for(const framework of ['vue','solid','svelte','astro']) {
      const api=await import('@labpics/ui-'+framework+'/ssr');
      rows.push('<section data-framework="'+framework+'">'+api.renderMenu({label:'Actions',items:[{value:'run',label:'Run'}]})+api.renderContextMenu({label:'Context',items:[{value:'run',label:'Run'}]},{default:'Context target'})+api.renderMenubar({menus:[{value:'file',label:'File',items:[{value:'run',label:'Run'}]}]})+'</section>');
    }
    await writeFile('index.html','<!doctype html><html class="lab-scope" data-theme="light" data-material="acrylic"><head><meta charset="utf-8"><link rel="stylesheet" href="client.css"><style>body{margin:40px;background:var(--lab-bg-primary);color:var(--lab-label-primary);font-family:Geist}section{margin-block:24px;display:flex;gap:30px}.source{min-height:540px;align-items:flex-start}.context-target{padding:20px;border:1px dashed var(--lab-border-base)}#react{display:flex;gap:30px}button{font:inherit}</style></head><body><section id="source" class="source"><lab-menu id="dropdown" label="Actions" heading="Headline"></lab-menu><lab-context-menu id="context" label="Context actions"><div class="context-target">Context target</div></lab-context-menu><lab-menubar id="menubar"></lab-menubar></section><section id="react"></section><section id="vue"></section><section><lab-tooltip id="tooltip" content="Help"><button>Help</button></lab-tooltip><lab-select id="select" label="Selection"></lab-select></section>'+rows.join('')+'<button id="outside">Outside</button><script type="module" src="client.js"></script></body></html>');
  `,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
    import '@labpics/fonts/fonts.css'; import '@labui/colors/contract.css'; import '@labpics/ui-core/tokens.css'; import '@labpics/ui-core/shadow.css';
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
    import {createElement as h,StrictMode} from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
    import {Menu,ContextMenu,Menubar} from '@labpics/ui-react/menu';
    import {createApp,h as vh} from 'vue'; import {Menu as VueMenu} from '@labpics/ui-vue';
    import {dropdown,context,menus} from './model.mjs';
    await Promise.all([import('@labpics/ui-core/menu'),import('@labpics/ui-core/context-menu'),import('@labpics/ui-core/menubar'),import('@labpics/ui-core/tooltip'),import('@labpics/ui-core/select')]);
    document.querySelector('#dropdown').items=dropdown;document.querySelector('#context').items=context;document.querySelector('#context').checkedValues=['check0','check1','radio0'];document.querySelector('#menubar').menus=menus;
    document.querySelector('#select').items=[{value:'a',label:'Alpha'}];
    window.selections=[];const choose=value=>window.selections.push(value);
    const react=createRoot(document.querySelector('#react'));
    const app=()=>h(StrictMode,null,h(Menu,{label:'React menu',items:context,onSelect:choose}),h(ContextMenu,{label:'React context',items:context,onSelect:choose},'React target'),h(Menubar,{menus,onSelect:choose}));
    window.remount=()=>{flushSync(()=>react.render(null));flushSync(()=>react.render(app()))};window.unmount=()=>flushSync(()=>react.render(null));window.remount();
    createApp({render:()=>vh(VueMenu,{label:'Vue actions',items:[{value:'vue-run',label:'Run Vue'}],onSelect:event=>choose(event.detail.value)})}).mount('#vue');
    window.ready=true;
  `,
  );
  await writeFile(
    join(consumer, 'types.mts'),
    `import type {LabMenuItem,LabMenubarItem} from '@labpics/ui-core/menu/runtime';import {Menu,ContextMenu,Menubar,type MenubarProps} from '@labpics/ui-react/menu';import {renderMenu,renderContextMenu,renderMenubar} from '@labpics/ui-vue/ssr';const items:LabMenuItem[]=[{value:'check',label:'Check',kind:'check'}];const menus:LabMenubarItem[]=[{value:'file',label:'File',items}];const props:MenubarProps={menus,value:null};void [Menu,ContextMenu,Menubar,renderMenu,renderContextMenu,renderMenubar,props];`,
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
  execFileSync(process.execPath, ['server.mjs'], { cwd: consumer, stdio: 'inherit' });
  pnpm(
    [
      'exec',
      'esbuild',
      'client.js',
      '--bundle',
      '--format=esm',
      '--target=es2022',
      '--outfile=client.js.bundle',
      '--loader:.woff2=file',
      '--loader:.woff=file',
      '--loader:.png=file',
      '--loader:.svg=file',
    ],
    consumer,
  );
  // esbuild's CSS sibling follows the requested output filename.
  await copyFile(join(consumer, 'client.js.bundle'), join(consumer, 'client.js'));
  await copyFile(join(consumer, 'client.js.css'), join(consumer, 'client.css'));
  server = createServer(async (req, res) => {
    const name = new URL(req.url ?? '/', 'http://localhost').pathname;
    try {
      const path = join(consumer, name === '/' ? 'index.html' : name.slice(1));
      const body = await readFile(path);
      res.setHeader(
        'Content-Type',
        path.endsWith('.js')
          ? 'text/javascript'
          : path.endsWith('.css')
            ? 'text/css'
            : path.endsWith('.html')
              ? 'text/html'
              : 'application/octet-stream',
      );
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const measurements = [];
  for (const [name, engine] of [
    ['chromium', chromium],
    ['webkit', webkit],
  ]) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1240, height: 1000 } });
      const errors = [];
      page.on('pageerror', (e) => {
        errors.push(String(e));
        console.error(e);
      });
      await page.goto(url);
      await page.waitForFunction(() => window.ready);
      await page.evaluate(() => document.fonts.ready);
      assert.deepEqual(errors, []);
      for (const framework of ['vue', 'solid', 'svelte', 'astro']) {
        const region = page.locator(`[data-framework="${framework}"]`);
        await region.locator('lab-menu .lab-menu-trigger').click();
        await expect(region.locator('lab-menu .lab-menu-content')).toBeVisible();
        await expect(region.locator('lab-menu .lab-menu-content')).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(region.locator('lab-menu .lab-menu-content')).toBeHidden();
        await expect(region.locator('lab-menu .lab-menu-trigger')).toBeFocused();
        await region.locator('lab-context-menu [data-menu-trigger]').focus();
        await expect(region.locator('lab-context-menu [data-menu-trigger]')).toBeFocused();
        await page.keyboard.press('Shift+F10');
        await expect(region.locator('lab-context-menu .lab-menu-content')).toBeVisible();
        await expect(region.locator('lab-context-menu .lab-menu-content')).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(region.locator('lab-context-menu .lab-menu-content')).toBeHidden();
        await expect(region.locator('lab-context-menu [data-menu-trigger]')).toBeFocused();
        await region.locator('lab-menubar .lab-menubar-item').click();
        await expect(region.locator('lab-menubar .lab-menu-content')).toBeVisible();
        await expect(region.locator('lab-menubar .lab-menu-content')).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(region.locator('lab-menubar .lab-menu-content')).toBeHidden();
        await expect(region.locator('lab-menubar .lab-menubar-item')).toBeFocused();
      }
      await page.locator('#vue .lab-menu-trigger').click();
      await page.getByRole('menuitem', { name: 'Run Vue' }).click();
      await expect.poll(() => page.evaluate(() => window.selections)).toEqual(['vue-run']);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);
        for (const [id, variant] of [
          ['dropdown', 'menu'],
          ['context', 'context'],
          ['menubar', 'menubar'],
        ]) {
          await page.evaluate(() => window.scrollTo(0, 0));
          const host = page.locator(`#${id}`);
          if (variant === 'context')
            await host
              .locator('.context-target')
              .click({ button: 'right', position: { x: 8, y: 8 } });
          else
            await host
              .locator(variant === 'menubar' ? '.lab-menubar-item' : '.lab-menu-trigger')
              .first()
              .click();
          const panel = host.locator('.lab-menu-content').first();
          await expect(panel).toBeVisible();
          await expect(panel).toBeFocused();
          await expect
            .poll(() =>
              panel.evaluate((el) =>
                Number.parseFloat(getComputedStyle(el.parentElement).getPropertyValue('--x')),
              ),
            )
            .not.toBeNaN();
          if (variant === 'context') await page.keyboard.press('t');
          const box = await panel.boundingBox();
          assert.equal(box.width, 256);
          if (variant === 'menu') assert.equal(box.height, 386);
          const surface = host.locator('.lab-menu-surface').first();
          await expect(surface).toHaveAttribute('data-lab-material-contour');
          assert.equal(await surface.evaluate((el) => getComputedStyle(el).overflow), 'visible');
          assert.equal(
            await surface
              .locator(
                '.lab-material__contour-shadow:not(.lab-material__contour-shadow--inset) feFlood',
              )
              .count(),
            4,
          );
          if (variant === 'menubar') {
            const active = host.locator('.lab-menubar-item').first();
            await active.hover();
            assert.equal(
              await active.evaluate((el) => getComputedStyle(el).backgroundColor),
              'rgb(255, 255, 255)',
            );
            const barBox = await host.locator('.lab-menubar').boundingBox();
            assert.ok(Math.abs(box.x - barBox.x) < 1);
            assert.ok(Math.abs(box.y - (barBox.y + barBox.height) - 4) < 1);
          }
          const control =
            variant === 'menubar' ? await host.locator('.lab-menubar').boundingBox() : box;
          const left = Math.max(0, Math.min(box.x, control.x) - 24);
          const top = Math.max(0, Math.min(box.y, control.y) - 16);
          await page.screenshot({
            path: join(output, `${name}-${variant}-${theme}.png`),
            clip: {
              x: left,
              y: top,
              width: Math.max(box.x + box.width, control.x + control.width) - left + 24,
              height: Math.max(box.y + box.height, control.y + control.height) - top + 36,
            },
          });
          await page.keyboard.press('Escape');
        }
      }
      const timing = await page.evaluate(async () => {
        const results = {};
        for (const [id, property] of [
          ['dropdown', 'label'],
          ['tooltip', 'content'],
          ['select', 'label'],
        ]) {
          const element = document.getElementById(id);
          const start = performance.now();
          for (let i = 0; i < 1000; i++) {
            element[property] = `Updated ${i}`;
            await element.updateComplete;
          }
          results[id] = performance.now() - start;
        }
        return results;
      });
      for (const value of Object.values(timing))
        assert.ok(value < 15000, `1000 updates took ${value}ms`);
      measurements.push({ browser: name, updates: 1000, milliseconds: timing });
      const trees = await page.evaluate(async () => {
        const results = [];
        const tick = () =>
          new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const host = document.getElementById('dropdown');
        for (const children of [0, 1, 10]) {
          host.items = Array.from({ length: 50 }, (_, i) =>
            children === 0
              ? { value: `root-${i}`, label: `Command ${i}` }
              : {
                  value: `root-${i}`,
                  label: `Command ${i}`,
                  kind: 'submenu',
                  items: Array.from({ length: children }, (_, j) => ({
                    value: `child-${i}-${j}`,
                    label: `Child ${j}`,
                  })),
                },
          );
          await host.updateComplete;
          await tick();
          const samples = [];
          for (let repeat = 0; repeat < 3; repeat++) {
            const start = performance.now();
            (host.shadowRoot ?? host).querySelector('.lab-menu-trigger').click();
            await tick();
            samples.push(performance.now() - start);
            (host.shadowRoot ?? host).querySelector('.lab-menu-trigger').click();
            await tick();
          }
          results.push({
            roots: 50,
            children,
            medianMilliseconds: samples.sort((a, b) => a - b)[1],
          });
        }
        return results;
      });
      measurements.at(-1).trees = trees;
      assert.ok(
        trees[2].medianMilliseconds < Math.max(150, trees[0].medianMilliseconds * 6),
        `Hidden menu tree multiplies open work: ${JSON.stringify(trees)}`,
      );
      for (let i = 0; i < 20; i++) await page.evaluate(() => window.remount());
      await page.locator('#react .lab-menu-trigger').click();
      await page.locator('#react [data-menu-value="delete"]').first().click();
      await expect
        .poll(() =>
          page.evaluate(() => window.selections.filter((value) => value === 'delete').length),
        )
        .toBe(1);
      await page.evaluate(() => window.unmount());
      await expect(page.locator('#react .lab-menu-positioner')).toHaveCount(0);
      await page.locator('#tooltip button').hover();
      await expect(page.locator('#tooltip .lab-tooltip-content')).toBeVisible();
      await expect(page.locator('#tooltip .lab-tooltip-content')).toContainText('Updated 999');
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    join(output, 'packed.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        archives,
        measurements,
        checks: [
          'installed ESM declarations',
          'four adapter SSR hydration paths',
          'Vue live command',
          'React StrictMode remount cleanup',
          'source geometry and 12 renders',
          '1000 Menu/Tooltip/ZagController updates',
        ],
      },
      null,
      2,
    )}\n`,
  );
  console.info(JSON.stringify({ result: 'PASS', measurements }));
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (process.env.LAB_MENU_KEEP_CONSUMER === '1')
    console.info(`Installed menu consumer: ${consumer}`);
  else await rm(consumer, { recursive: true, force: true });
}
