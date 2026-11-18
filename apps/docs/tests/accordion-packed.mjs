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
const output = join(root, 'docs/evidence/accordion-20261119');
const consumer = await mkdtemp(join(tmpdir(), 'labui-accordion-'));
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
      name: 'accordion-consumer',
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
    import {createElement as h} from 'react';
    import {Accordion,AccordionItem} from '@labpics/ui-react/accordion';
    import {Textarea} from '@labpics/ui-react/textarea';
    export const items=[{value:'draft',label:'Draft'},{value:'history',label:'History'}];
    export const tree=()=>h(Accordion,{defaultValue:['draft'],headingLevel:2},
      h(AccordionItem,{value:'draft',label:'Draft'},h(Textarea,{defaultValue:'Original',label:'Draft'})),
      h(AccordionItem,{value:'history',label:'History'},'History'));
  `,
  );
  await writeFile(
    join(consumer, 'server.mjs'),
    `
    import {writeFile} from 'node:fs/promises';
    import {renderToString} from 'react-dom/server';
    import {items,tree} from './shared.mjs';
    const {renderAccordion:prior}=await import('@labpics/ui-vue/ssr');
    for(let i=0;i<3;i++) prior({items,defaultValue:['draft']});
    const parts=[];
    for(const name of ['vue','solid','svelte','astro']) {
      const {renderAccordion}=await import('@labpics/ui-'+name+'/ssr');
      const slots={dynamic:{draft:'<textarea aria-label="Draft">Original</textarea>',history:'History'}};
      parts.push('<section data-renderer="'+name+'">'+renderAccordion({items,defaultValue:['draft'],headingLevel:2},slots)+'</section>');
      parts.push('<section data-empty="'+name+'">'+renderAccordion({items,value:[],defaultValue:['draft']},slots)+'</section>');
      parts.push('<section data-fixed="'+name+'">'+renderAccordion({items,defaultValue:['draft'],collapsible:false},slots)+'</section>');
      parts.push('<section data-controlled="'+name+'">'+renderAccordion({items,value:['draft']},slots)+'</section>');
    }
    parts.push('<section data-renderer="react" id="react-root">'+renderToString(tree())+'</section>');
    await writeFile('index.html','<!doctype html><html data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/client.css"></head><body>'+parts.join('')+'<script type="module" src="/client.js"></script></body></html>');
  `,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
    import '@labpics/fonts/fonts.css';
    import '@labui/colors/contract.css';
    import '@labpics/ui-core/tokens.css';
    import '@labpics/ui-core/accordion.css';
    import '@labpics/ui-core/input.css';
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
    import {hydrateRoot} from 'react-dom/client';
    window.hydrateAccordion=async()=>{
      await import('@labpics/ui-core/accordion');
      await Promise.all([...document.querySelectorAll('lab-accordion')].map(el=>el.updateComplete));
      const {tree}=await import('./shared.mjs');
      hydrateRoot(document.getElementById('react-root'),tree());
      window.hydrated=true;
    };
  `,
  );
  await writeFile(
    join(consumer, 'types.tsx'),
    `
    import {Accordion,AccordionItem} from '@labpics/ui-react/accordion';
    import type {LabAccordion,LabAccordionItem} from '@labpics/ui-core/accordion';
    import {renderAccordion} from '@labpics/ui-vue/ssr';
    const items:LabAccordionItem[]=[{value:'a',label:'A'}];
    renderAccordion({items,value:[],headingLevel:2});
    const tree=<Accordion value={[]} headingLevel={2}><AccordionItem value="a" label="A">A</AccordionItem></Accordion>;
    declare const host:LabAccordion;
    host.value=null; const current:readonly string[]=host.expandedValues;
    // @ts-expect-error heading levels are finite
    const invalid=<Accordion headingLevel={8}/>;
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
        await expect(section.getByRole('heading', { level: 2 })).toHaveCount(2);
        await expect(section.getByRole('region')).toHaveCount(1);
        await expect(section.getByRole('textbox')).toHaveValue('Original');
      }
      await nojs.close();
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.goto(url);
      await page.waitForFunction(() => typeof window.hydrateAccordion === 'function');
      for (const name of ['vue', 'solid', 'svelte', 'astro', 'react']) {
        const section = page.locator(`[data-renderer="${name}"]`);
        await section.locator('button,[role="region"]').evaluateAll((nodes) => {
          for (const node of nodes) {
            node.__ssrId = node.id;
            node.__original = true;
          }
        });
        await section.getByRole('textbox').fill('Edited before hydration');
      }
      await page.evaluate(() => window.hydrateAccordion());
      await page.waitForFunction(() => window.hydrated);
      for (const name of ['vue', 'solid', 'svelte', 'astro', 'react']) {
        const section = page.locator(`[data-renderer="${name}"]`);
        assert.deepEqual(errors, []);
        await expect(section.getByRole('textbox')).toHaveValue('Edited before hydration');
        assert.ok(
          await section
            .locator('button,[role="region"]')
            .evaluateAll((nodes) =>
              nodes.every((node) => node.__original && node.id === node.__ssrId),
            ),
        );
        await section.getByRole('button', { name: 'History' }).click();
        await expect(section.locator('textarea')).toBeHidden();
        await section.getByRole('button', { name: 'Draft' }).click();
        await expect(section.getByRole('textbox')).toHaveValue('Edited before hydration');
        await expect(section.getByRole('button', { name: 'Draft' })).toHaveCSS(
          'font-weight',
          '500',
        );
      }
      for (const name of ['vue', 'solid', 'svelte', 'astro']) {
        const empty = page.locator(`[data-empty="${name}"]`);
        await expect(empty.getByRole('region')).toHaveCount(0);
        await empty.getByRole('button', { name: 'History' }).click();
        await expect(empty.getByRole('region')).toHaveCount(0);
        const fixed = page.locator(`[data-fixed="${name}"]`);
        await fixed.getByRole('button', { name: 'Draft' }).click();
        await expect(fixed.getByRole('button', { name: 'Draft' })).toHaveAttribute(
          'aria-expanded',
          'true',
        );
        const controlled = page.locator(`[data-controlled="${name}"]`);
        await controlled.getByRole('button', { name: 'History' }).click();
        await expect(controlled.getByRole('button', { name: 'Draft' })).toHaveAttribute(
          'aria-expanded',
          'true',
        );
      }
      assert.deepEqual(errors, []);
      records.push({
        engine,
        browser: browser.version(),
        SSRHelpers: ['vue', 'solid', 'svelte', 'astro'],
        nativeReact: true,
        noJsFirstPaint: true,
        shiftedServerIds: true,
        controlledEmptyAndRefusal: true,
        sameNodesAfterHydration: true,
        preHydrationDraftPreserved: true,
        itemsRestoredFromHTML: true,
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
    'Packed Accordion: four SSR helpers + Lit upgrade and React hydration passed\n',
  );
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.equal(dirname(consumer), resolve(tmpdir()));
  assert.ok(consumer.includes('labui-accordion-'));
  await rm(consumer, { recursive: true, force: true });
}
