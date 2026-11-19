import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = join(root, 'docs/evidence/framework-ssr-20261119');
const consumer = await mkdtemp(join(tmpdir(), 'labui-framework-ssr-'));
const corepack = join(
  dirname(process.execPath),
  process.platform === 'win32'
    ? 'node_modules/corepack/dist/pnpm.js'
    : '../lib/node_modules/corepack/dist/pnpm.js',
);
const pnpm = (args, cwd) =>
  execFileSync(process.execPath, [corepack, ...args], { cwd, stdio: 'pipe', encoding: 'utf8' });
const records = [];
const archives = [];
let server;
try {
  await mkdir(output, { recursive: true });
  await mkdir(join(consumer, 'packs'));
  const dependencies = {
    vue: '3.5.42',
    'solid-js': '1.9.4',
    svelte: '5.19.0',
    'svelte-check': '4.1.4',
    vite: '6.4.4',
    lit: '3.3.3',
    '@lit-labs/ssr': '4.1.0',
    '@lit-labs/ssr-client': '1.1.8',
    esbuild: '0.25.12',
    typescript: '5.7.3',
  };
  const overrides = {};
  for (const folder of [
    'tokens',
    'shadow',
    'colors',
    'materials',
    'core',
    'vue',
    'solid',
    'svelte',
  ]) {
    const location = join(root, 'packages', folder);
    const pkg = JSON.parse(await readFile(join(location, 'package.json'), 'utf8'));
    pnpm(['pack', '--pack-destination', join(consumer, 'packs')], location);
    const archive = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
    dependencies[pkg.name] = overrides[pkg.name] = `file:./packs/${archive}`;
    archives.push({
      name: pkg.name,
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs', archive)))
        .digest('hex'),
    });
  }
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'framework-ssr-consumer',
      private: true,
      type: 'module',
      dependencies,
      pnpm: { overrides },
    }),
  );
  console.info('Installing packed native framework adapters');
  pnpm(
    ['install', '--ignore-scripts', '--config.auto-install-peers=false', '--prefer-offline'],
    consumer,
  );
  await cp(join(root, 'apps/docs/tests/fixtures/framework-ssr'), consumer, { recursive: true });
  await writeFile(
    join(consumer, 'types.cts'),
    `import {renderElementParts} from '@labpics/ui-core/element-ssr';const value=renderElementParts('lab-tabs',{specs:[],props:{}});void value;`,
  );
  await writeFile(
    join(consumer, 'types.mts'),
    `import {renderElementParts} from '@labpics/ui-core/element-ssr';renderElementParts('lab-tabs',{specs:[],props:{value:null}});`,
  );
  await writeFile(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ['types.cts', 'types.mts'],
    }),
  );
  pnpm(['exec', 'tsc'], consumer);
  // Svelte's resolver reads the packaged component declarations; plain tsc falls
  // back to its ambient *.svelte module and cannot qualify snippet prop types.
  await writeFile(
    join(consumer, 'Types.svelte'),
    `<script lang="ts">\nimport {Tabs} from '@labpics/ui-svelte';import type {ComponentProps} from 'svelte';\n// @ts-expect-error snippets retain framework ownership; strings are not snippets\nconst invalid:ComponentProps<typeof Tabs>={slots:{draft:'HTML'}};void invalid;\n</script>\n{#snippet draft()}<p>Draft</p>{/snippet}\n<Tabs items={[{value:'draft',label:'Draft'}]} slots={{draft}} />`,
  );
  await writeFile(
    join(consumer, 'tsconfig.svelte.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ['Types.svelte'],
    }),
  );
  pnpm(['exec', 'svelte-check', '--tsconfig', 'tsconfig.svelte.json'], consumer);
  execFileSync(process.execPath, ['--conditions=development', 'build-consumer.mjs'], {
    cwd: consumer,
    stdio: 'inherit',
  });
  server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    const path = resolve(
      consumer,
      'web',
      `.${url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname}`,
    );
    if (!path.startsWith(`${join(consumer, 'web')}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      response.setHeader(
        'content-type',
        path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
      );
      response.end(await readFile(path));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  for (const [browserName, type] of Object.entries({ chromium, webkit })) {
    const browser = await type.launch({ headless: true });
    try {
      for (const framework of ['vue', 'solid', 'svelte']) {
        console.info(`Checking ${framework} SSR -> ${browserName} hydration`);
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        page.on('console', (message) => {
          if (
            message.type() === 'error' ||
            (/hydration|mismatch/i.test(message.text()) && message.type() === 'warning')
          )
            errors.push(message.text());
        });
        await page.goto(`http://127.0.0.1:${server.address().port}/${framework}/`);
        await page.waitForFunction(() => typeof window.hydrate === 'function');
        const before = await page.evaluate(() => {
          const host = document.querySelector('#tabs');
          const shadow = host.shadowRoot;
          window.before = {
            host,
            hosts: [...document.querySelectorAll('*')].filter((x) =>
              x.localName.startsWith('lab-'),
            ),
            trigger: shadow.querySelector('[role="tab"]'),
            panel: shadow.querySelector('[role="tabpanel"]'),
            editor: document.querySelector('#editor'),
            save: document.querySelector('#save'),
            footer: document.querySelector('#footer'),
            field: document.querySelector('#field').shadowRoot.querySelector('textarea'),
          };
          return {
            defined: !!customElements.get('lab-tabs'),
            hosts: document.querySelectorAll('#tabs').length,
            hostCount: window.before.hosts.length,
            labels: [...shadow.querySelectorAll('[role="tab"]')].map((x) => x.textContent.trim()),
            height: window.before.trigger.getBoundingClientRect().height,
            background: getComputedStyle(shadow.querySelector('[role="tablist"]')).backgroundColor,
            styles: shadow.querySelectorAll('style').length,
            selected: window.before.trigger.getAttribute('aria-selected'),
            field: window.before.field.value,
          };
        });
        assert.equal(before.defined, false);
        assert.deepEqual(before.labels, ['Draft', 'History']);
        assert.equal(before.hosts, 1);
        assert.equal(before.hostCount, 6);
        assert.equal(before.selected, 'true');
        assert(before.height > 20);
        assert(!['transparent', 'rgba(0, 0, 0, 0)'].includes(before.background));
        assert(before.styles > 0);
        assert.equal(before.field, 'Server field');
        assert.equal(await page.getByRole('tablist', { name: 'Files' }).count(), 1);
        assert.equal(await page.locator('#tabs').getAttribute('label'), null);
        assert.equal((await page.locator('#tabs').getAttribute('class')).trim(), 'my-tabs active');
        await page.locator('#editor').fill('Typed before hydration & retained');
        await page.locator('#field textarea').fill('Dirty component field');
        await page.evaluate(() => {
          window.before.editor.setSelectionRange(6, 12);
          window.before.field.setSelectionRange(2, 8);
        });
        await page.evaluate(() => window.hydrate());
        const after = await page.evaluate(() => {
          const host = document.querySelector('#tabs');
          const hosts = [...document.querySelectorAll('*')].filter((x) =>
            x.localName.startsWith('lab-'),
          );
          return {
            hosts: document.querySelectorAll('#tabs').length,
            allHosts:
              hosts.length === window.before.hosts.length &&
              hosts.every((node, index) => node === window.before.hosts[index]),
            host: host === window.before.host,
            editor: document.querySelector('#editor') === window.before.editor,
            save: document.querySelector('#save') === window.before.save,
            footer: document.querySelector('#footer') === window.before.footer,
            trigger: host.shadowRoot.querySelector('[role="tab"]') === window.before.trigger,
            panel: host.shadowRoot.querySelector('[role="tabpanel"]') === window.before.panel,
            field:
              document.querySelector('#field').shadowRoot.querySelector('textarea') ===
              window.before.field,
            text: window.before.editor.value,
            selection: [window.before.editor.selectionStart, window.before.editor.selectionEnd],
            fieldText: window.before.field.value,
            fieldSelection: [window.before.field.selectionStart, window.before.field.selectionEnd],
            tabs: host.shadowRoot.querySelectorAll('[role="tab"]').length,
            collapsible: document.querySelector('#accordion').collapsible,
            nullValue: document.querySelector('#null-tabs').value,
            arrow: document.querySelector('#tooltip').arrow,
            defaultArrow: document.querySelector('#default-tooltip').arrow,
          };
        });
        for (const key of [
          'host',
          'allHosts',
          'editor',
          'save',
          'footer',
          'trigger',
          'panel',
          'field',
        ])
          assert.equal(after[key], true, `${framework}/${browserName}: same ${key}`);
        assert.equal(after.hosts, 1);
        assert.equal(after.tabs, 2);
        assert.equal(after.text, 'Typed before hydration & retained');
        assert.deepEqual(after.selection, [6, 12]);
        assert.equal(after.fieldText, 'Dirty component field');
        assert.deepEqual(after.fieldSelection, [2, 8]);
        assert.equal(after.collapsible, false);
        assert.equal(after.nullValue, null);
        assert.equal(after.arrow, false);
        assert.equal(after.defaultArrow, true);
        await page.locator('#save').click();
        assert.equal(await page.locator('#clicks').textContent(), '1');
        await page.locator('#rename').click();
        await page.waitForFunction(
          () =>
            document
              .querySelector('#tabs')
              .shadowRoot.querySelector('[role="tab"]')
              .textContent.trim() === 'Renamed',
        );
        assert.equal(await page.locator('#caption').textContent(), 'Renamed');
        await page.locator('#tabs').getByRole('tab', { name: 'History' }).click();
        await page.waitForFunction(() => document.querySelector('#events').textContent === '1');
        await page.locator('#tabs').getByRole('tab', { name: 'Renamed' }).click();
        await page.waitForFunction(() => document.querySelector('#events').textContent === '2');
        assert.equal(
          await page.locator('#editor').inputValue(),
          'Typed before hydration & retained',
        );
        assert.equal(await page.locator('#field textarea').inputValue(), 'Dirty component field');
        await page.locator('#lock-field').click();
        await page.waitForFunction(
          () => document.querySelector('#field').shadowRoot.querySelector('textarea').readOnly,
        );
        assert.equal(await page.locator('#field textarea').inputValue(), 'Dirty component field');
        await page.locator('#set-field').click();
        await page.waitForFunction(
          () =>
            document.querySelector('#field').shadowRoot.querySelector('textarea').value ===
            'External update',
        );
        assert(
          await page.evaluate(
            () =>
              document.querySelector('#field').shadowRoot.querySelector('textarea') ===
              window.before.field,
          ),
        );
        assert.deepEqual(errors, []);
        records.push({
          framework,
          browser: browserName,
          before,
          after,
          events: 2,
          clicks: 1,
          errors,
        });
        await page.screenshot({
          path: join(output, `${framework}-${browserName}.png`),
          fullPage: true,
        });
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }
  const qualification = JSON.parse(await readFile(join(consumer, 'qualification.json'), 'utf8'));
  qualification.types = { nodeNextEsm: true, nodeNextCjs: true, svelteSlots: true };
  await writeFile(
    join(output, 'result.json'),
    `${JSON.stringify({ archives, qualification, records }, null, 2)}\n`,
  );
  console.info('Six installed native framework SSR/hydration cases passed');
} finally {
  if (server) await new Promise((done) => server.close(done));
  assert(
    resolve(consumer).startsWith(`${resolve(tmpdir())}${sep}`) &&
      basename(consumer).startsWith('labui-framework-ssr-'),
  );
  await rm(consumer, { recursive: true, force: true });
}
