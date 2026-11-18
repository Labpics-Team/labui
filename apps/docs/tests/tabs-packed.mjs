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
const output = join(root, 'docs/evidence/tabs-20261118');
const consumer = await mkdtemp(join(tmpdir(), 'labui-tabs-'));
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
      name: pkg.name,
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs', name)))
        .digest('hex'),
    });
  }
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'tabs-consumer',
      private: true,
      type: 'module',
      dependencies,
      pnpm: { overrides },
    }),
  );
  pnpm(
    ['install', '--ignore-scripts', '--config.auto-install-peers=false', '--prefer-offline'],
    consumer,
  );
  await writeFile(
    join(consumer, 'shared.mjs'),
    `
    import { createElement as h } from 'react';
    import { Tabs, Tab, TabPanel } from '@labpics/ui-react/tabs';
    import { Textarea } from '@labpics/ui-react/textarea';
    export const items = [{value:'draft',label:'Draft'},{value:'history',label:'History'}];
    export const tree = () => h(Tabs,{defaultValue:'draft',variant:'tinted',label:'Views'},
      h(Tab,{value:'draft'},'Draft'),h(Tab,{value:'history'},'History'),
      h(TabPanel,{value:'draft'},h(Textarea,{label:'Draft',defaultValue:'Original'})),h(TabPanel,{value:'history'},'History'));
  `,
  );
  await writeFile(
    join(consumer, 'server.mjs'),
    `
    import { writeFile } from 'node:fs/promises';
    import { renderToString } from 'react-dom/server';
    import { items, tree } from './shared.mjs';
    const { renderTabs: prior } = await import('@labpics/ui-vue/ssr');
    for(let i=0;i<3;i++) prior({items,defaultValue:'draft'});
    const parts=[];
    for(const name of ['vue','solid','svelte','astro']){
      const {renderTabs}=await import('@labpics/ui-'+name+'/ssr');
      const slots={dynamic:{draft:'<textarea aria-label="Draft">Original</textarea>',history:'History'}};
      parts.push('<section data-renderer="'+name+'">'+renderTabs({items,defaultValue:'draft',variant:'tinted',label:'Views'},slots)+'</section>');
      parts.push('<section data-null="'+name+'">'+renderTabs({items,defaultValue:'draft',value:null,label:'No selection'},slots)+'</section>');
      parts.push('<section data-controlled="'+name+'">'+renderTabs({items,value:'draft',label:'Controlled'},slots)+'</section>');
    }
    parts.push('<section data-renderer="react" id="react-root">'+renderToString(tree())+'</section>');
    await writeFile('index.html','<!doctype html><html class="lab-scope" data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/client.css"></head><body>'+parts.join('')+'<script type="module" src="/client.js"></script></body></html>');
  `,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
    import '@labpics/fonts/fonts.css';
    import '@labui/colors/contract.css';
    import '@labpics/ui-core/tokens.css';
    import '@labpics/ui-core/shadow.css';
    import '@labpics/ui-core/tabs.css';
    import '@labpics/ui-core/input.css';
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
    import { hydrateRoot } from 'react-dom/client';
    const items = [{value:'draft',label:'Draft'},{value:'history',label:'History'}];
    window.hydrateTabs=async()=>{
      for(const host of document.querySelectorAll('lab-tabs')) host.items=items;
      await import('@labpics/ui-core/tabs');
      await Promise.all([...document.querySelectorAll('lab-tabs')].map(el=>el.updateComplete));
      const {tree} = await import('./shared.mjs');
      hydrateRoot(document.getElementById('react-root'),tree());
      window.hydrated=true;
    };
  `,
  );
  await writeFile(
    join(consumer, 'types.tsx'),
    `
    import { Tabs, Tab, TabPanel } from '@labpics/ui-react/tabs';
    import type { LabTabs, LabTabItem } from '@labpics/ui-core/tabs';
    import { renderTabs } from '@labpics/ui-vue/ssr';
    const items: LabTabItem[]=[{value:'a',label:'A',icon:'a-icon',iconOnly:true}];
    renderTabs({items,value:null,variant:'tinted',edge:'start',dir:'rtl'});
    const tree=<Tabs value={null} variant="underlined" edge="end" dir="rtl"><Tab value="a" icon={<svg/>} iconOnly>A</Tab><TabPanel value="a">A</TabPanel></Tabs>;
    declare const host: LabTabs;
    host.value=null; const current:string|null=host.selectedValue;
    // @ts-expect-error logical edges exclude physical sides
    const invalid=<Tabs edge="left"/>;
    void tree; void current; void invalid;
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
    if (!file.startsWith(join(consumer, 'web'))) {
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
      for (const name of ['vue', 'solid', 'svelte', 'astro', 'react']) {
        const section = nojs.locator(`[data-renderer="${name}"]`);
        await expect(section.getByRole('tablist')).toHaveAccessibleName('Views');
        await expect(section.getByRole('tabpanel')).toHaveCount(1);
        await expect(section.getByRole('textbox')).toHaveValue('Original');
      }
      for (const name of ['vue', 'solid', 'svelte', 'astro'])
        await expect(nojs.locator(`[data-null="${name}"]`).getByRole('tabpanel')).toHaveCount(0);
      await nojs.close();
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.goto(url);
      await page.waitForFunction(() => typeof window.hydrateTabs === 'function');
      for (const name of ['vue', 'solid', 'svelte', 'astro', 'react']) {
        const section = page.locator(`[data-renderer="${name}"]`);
        await section.locator('[role="tab"],[role="tabpanel"]').evaluateAll((nodes) => {
          for (const node of nodes) {
            node.__ssrId = node.id;
            node.__original = true;
          }
        });
        await section.getByRole('textbox').fill('Edited before hydration');
      }
      await page.evaluate(() => window.hydrateTabs());
      await page.waitForFunction(() => window.hydrated);
      for (const name of ['vue', 'solid', 'svelte', 'astro', 'react']) {
        const section = page.locator(`[data-renderer="${name}"]`);
        await expect(section.getByRole('textbox')).toHaveValue('Edited before hydration');
        assert.ok(
          await section
            .locator('[role="tab"],[role="tabpanel"]')
            .evaluateAll((nodes) =>
              nodes.every((node) => node.__original && node.id === node.__ssrId),
            ),
        );
        await section.getByRole('tab', { name: 'History' }).click();
        await expect(section.locator('textarea')).toBeHidden();
        await section.getByRole('tab', { name: 'Draft' }).click();
        await expect(section.getByRole('textbox')).toHaveValue('Edited before hydration');
        assert.equal(
          await section
            .getByRole('tab', { name: 'Draft' })
            .evaluate((el) => getComputedStyle(el).padding),
          '12px',
        );
      }
      for (const name of ['vue', 'solid', 'svelte', 'astro']) {
        const empty = page.locator(`[data-null="${name}"]`);
        await expect(empty.getByRole('tabpanel')).toHaveCount(0);
        await empty.getByRole('tab', { name: 'History' }).click();
        await expect(empty.getByRole('tabpanel')).toHaveCount(0);
        const controlled = page.locator(`[data-controlled="${name}"]`);
        await controlled.getByRole('tab', { name: 'History' }).click();
        await expect(controlled.getByRole('tab', { name: 'Draft' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
      }
      assert.deepEqual(errors, []);
      records.push({
        engine,
        browser: browser.version(),
        adapters: 4,
        nativeReact: true,
        noJsFirstPaint: true,
        shiftedServerIds: true,
        controlledNullAndRefusal: true,
        sameNodesAfterHydration: true,
        preHydrationDraftPreserved: true,
        stylesIncluded: true,
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
  process.stdout.write('Packed Tabs: four SSR adapters + React; Chromium/WebKit passed\n');
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.equal(dirname(consumer), resolve(tmpdir()));
  assert.ok(consumer.includes('labui-tabs-'));
  await rm(consumer, { recursive: true, force: true });
}
