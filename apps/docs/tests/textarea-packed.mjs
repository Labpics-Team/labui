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
const output = join(root, 'docs/evidence/textarea-20261118');
const consumer = await mkdtemp(join(tmpdir(), 'labui-textarea-'));
const corepack = join(dirname(process.execPath), 'node_modules/corepack/dist/corepack.js');
const pnpm = (args, cwd = root) =>
  execFileSync(process.execPath, [corepack, 'pnpm', ...args], { cwd, stdio: 'pipe' });
const packages = [
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
];
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
  };
  const overrides = {};
  const archives = [];
  for (const folder of packages) {
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
      name: 'textarea-consumer',
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
    join(consumer, 'interop.mjs'),
    `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    let renderTooltip;
    if (process.argv[2] === 'cjs-first') {
      require('@labpics/ui-core/ssr');
      require('@labpics/ui-core/tooltip');
      ({renderTooltip} = await import('@labpics/ui-vue/ssr'));
    } else {
      await import('@labpics/ui-core/ssr');
      await import('@labpics/ui-core/tooltip');
      ({renderTooltip} = require('@labpics/ui-vue/ssr'));
    }
    const output = renderTooltip({arrow:false});
    assert.ok(output.includes('data-lab-inputs="{&quot;arrow&quot;:false}"'));
    assert.ok(!output.includes('part="arrow"'));
  `,
  );
  for (const order of ['cjs-first', 'esm-first'])
    execFileSync(process.execPath, ['interop.mjs', order], { cwd: consumer, stdio: 'pipe' });
  const value = '\nFirst </textarea><script>window.injected=true</script> & second\n日本語';
  const props = {
    label: 'Описание',
    value,
    name: 'notes',
    helper: 'Подсказка',
    invalid: true,
    error: 'Ошибка',
    required: true,
    minLength: 3,
    autoResize: true,
    disabled: false,
    readonly: false,
  };
  const linebreaks = ['\r\nFirst\r\nSecond', '\rFirst\rSecond', '\nFirst\nSecond'];
  await writeFile(join(consumer, 'props.json'), JSON.stringify(props));
  await writeFile(join(consumer, 'linebreaks.json'), JSON.stringify(linebreaks));
  await writeFile(
    join(consumer, 'server.mjs'),
    `
    import { writeFile } from 'node:fs/promises';
    import props from './props.json' with { type: 'json' };
    import linebreaks from './linebreaks.json' with { type: 'json' };
    import '@labpics/ui-core/textarea';
    import { Textarea } from '@labpics/ui-react/textarea';
    import { createElement } from 'react';
    import { renderToString as reactRender } from 'react-dom/server';
    const { renderTextarea: previousTextarea, renderInput: previousInput } = await import('@labpics/ui-vue/ssr');
    // A long-lived server renders other requests before a fresh client starts.
    for (let request = 0; request < 2; request++) {
      previousTextarea(props);
      previousInput({ ...props, value: 'Title' });
    }
    const parts = [];
    const linebreakParts = [];
    for (const name of ['vue', 'solid', 'svelte', 'astro']) {
      const { renderTextarea, renderInput, renderTooltip } = await import('@labpics/ui-' + name + '/ssr');
      parts.push('<form data-renderer="' + name + '">' + renderTextarea(props) + renderInput({ ...props, name: 'title', value: 'Title' }) + '</form>');
      parts.push('<section data-boolean="' + name + '">' + renderTooltip({ arrow: false, content: 'Explicit false' }) + renderTooltip({ content: 'Constructor default' }) + '</section>');
      linebreaks.forEach((value, i) => linebreakParts.push('<div data-renderer="' + name + '" data-linebreak="' + i + '">' + renderTextarea({ label: 'Lines', value }) + '</div>'));
    }
    const { html, renderToString } = await import('@labpics/ui-core/ssr');
    parts.push('<form data-renderer="core">' + renderToString(html\`<lab-textarea .value=\${props.value} .label=\${props.label} .helper=\${props.helper} .error=\${props.error} .minLength=\${3} .invalid=\${true} .required=\${true} .name=\${'notes'}></lab-textarea>\`) + '</form>');
    parts.push('<form data-renderer="react"><div id="react-root">' + reactRender(createElement(Textarea, { ...props, value: undefined, defaultValue: props.value })) + '</div></form>');
    linebreaks.forEach((value, i) => linebreakParts.push('<div data-renderer="react" data-linebreak="' + i + '">' + reactRender(createElement(Textarea, { label: 'Lines', defaultValue: value }), { identifierPrefix: 'lines' + i }) + '</div>'));
    await writeFile('index.html', '<!doctype html><html class="lab-scope" data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/client.css"></head><body>' + parts.join('') + '<script type="module" src="/client.js"></script></body></html>');
    await writeFile('linebreaks.html', '<!doctype html><html><head><meta charset="utf-8"></head><body>' + linebreakParts.join('') + '</body></html>');
  `,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
    import '@labpics/fonts/fonts.css';
    import '@labui/colors/contract.css';
    import '@labpics/ui-core/tokens.css';
    import '@labpics/ui-core/input.css';
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
    import { createElement } from 'react';
    import { hydrateRoot } from 'react-dom/client';
    import props from './props.json';
    window.hydrateTextarea = async () => {
      await import('@labpics/ui-core/input');
      await import('@labpics/ui-core/textarea');
      await import('@labpics/ui-core/tooltip');
      const { Textarea } = await import('@labpics/ui-react/textarea');
      await Promise.all([...document.querySelectorAll('lab-input,lab-textarea,lab-tooltip')].map(el => el.updateComplete));
      hydrateRoot(document.getElementById('react-root'), createElement(Textarea, { ...props, value: undefined, defaultValue: props.value }));
      window.hydrated = true;
    };
  `,
  );
  await writeFile(
    join(consumer, 'build.mjs'),
    `
    import { build } from 'esbuild';
    await build({entryPoints:['client.js'],outdir:'web',bundle:true,format:'esm',splitting:true,loader:{'.woff2':'file'},assetNames:'[name]-[hash]'});
  `,
  );
  execFileSync(process.execPath, ['server.mjs'], { cwd: consumer, stdio: 'pipe' });
  execFileSync(process.execPath, ['build.mjs'], { cwd: consumer, stdio: 'pipe' });
  await writeFile(
    join(consumer, 'web', 'index.html'),
    await readFile(join(consumer, 'index.html')),
  );
  await writeFile(
    join(consumer, 'web', 'linebreaks.html'),
    await readFile(join(consumer, 'linebreaks.html')),
  );
  server = createServer(async (request, response) => {
    const path = request.url === '/' ? '/index.html' : request.url;
    const file = resolve(consumer, 'web', `.${path}`);
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
      const beforeScripts = await browser.newPage({ javaScriptEnabled: false });
      await beforeScripts.goto(url);
      for (const renderer of ['vue', 'solid', 'svelte', 'astro', 'react', 'core']) {
        await expect(
          beforeScripts.locator(`[data-renderer="${renderer}"]`).locator('textarea'),
        ).toHaveValue(value);
      }
      for (const name of ['vue', 'solid', 'svelte', 'astro']) {
        const tips = beforeScripts.locator(`[data-boolean="${name}"] lab-tooltip`);
        await expect(tips.nth(0).locator('[part="arrow"]')).toHaveCount(0);
        await expect(tips.nth(1).locator('[part="arrow"]')).toHaveCount(1);
      }
      await beforeScripts.goto(`${url}/linebreaks.html`);
      for (const renderer of ['vue', 'solid', 'svelte', 'astro', 'react']) {
        for (const [index, source] of linebreaks.entries()) {
          const matches = await beforeScripts
            .locator(`[data-renderer="${renderer}"][data-linebreak="${index}"] textarea`)
            .evaluate((control, value) => {
              const native = document.createElement('textarea');
              native.value = value;
              return control.value === native.value;
            }, source);
          assert.equal(matches, true, `${renderer}: SSR line break ${index} matches native setter`);
        }
      }
      await beforeScripts.close();
      const page = await browser.newPage({ viewport: { width: 640, height: 900 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(url);
      await page.waitForFunction(() => typeof window.hydrateTextarea === 'function');
      assert.equal(
        await page.evaluate(() => customElements.get('lab-textarea') !== undefined),
        false,
      );
      await page.evaluate(() => document.fonts.ready);
      for (const renderer of ['vue', 'solid', 'svelte', 'astro', 'react', 'core']) {
        await page
          .locator(`[data-renderer="${renderer}"]`)
          .locator('input,textarea')
          .evaluateAll((controls) => {
            for (const control of controls) control.__ssrId = control.id;
          });
        const control = page.locator(`[data-renderer="${renderer}"]`).locator('textarea');
        await expect(control).toHaveValue(value);
        await expect(control).toBeVisible();
        await expect(control).toHaveAttribute('minlength', '3');
        await control.fill('Edited before hydration\n日本語');
        await control.evaluate((el) => {
          el.__sameNode = true;
          el.focus();
          el.setSelectionRange(2, 5);
        });
      }
      assert.equal(await page.evaluate(() => window.injected), undefined);
      await page.evaluate(() => window.hydrateTextarea());
      await page.waitForFunction(() => window.hydrated);
      for (const renderer of ['vue', 'solid', 'svelte', 'astro', 'react', 'core']) {
        const form = page.locator(`[data-renderer="${renderer}"]`);
        const control = form.locator('textarea');
        await expect(control).toHaveValue('Edited before hydration\n日本語');
        assert.equal(
          await control.evaluate((el) => el.__sameNode),
          true,
          `${renderer}: hydration retained textarea`,
        );
        assert.deepEqual(
          await control.evaluate((el) => [el.selectionStart, el.selectionEnd]),
          [2, 5],
        );
        await control.fill('Edited\n日本語');
        const relationships = await form.locator('input,textarea').evaluateAll((controls) =>
          controls.map((control) => {
            const root = control.getRootNode();
            const referenced = ['aria-describedby', 'aria-errormessage'].flatMap((name) =>
              (control.getAttribute(name) ?? '').split(/\s+/).filter(Boolean),
            );
            return {
              stableId: control.id === control.__ssrId,
              labelled: control.labels?.[0]?.htmlFor === control.id,
              missing: referenced.filter((id) => !root.getElementById(id)),
              references: referenced.length,
            };
          }),
        );
        assert.deepEqual(
          relationships,
          Array.from({ length: renderer === 'react' || renderer === 'core' ? 1 : 2 }, () => ({
            stableId: true,
            labelled: true,
            missing: [],
            references: 3,
          })),
          `${renderer}: Input and Textarea keep SSR label/helper/error relationships`,
        );
        await expect
          .poll(() => form.evaluate((form) => new FormData(form).get('notes')))
          .toBe('Edited\n日本語');
        await form.evaluate((form) => form.reset());
        await expect(control).toHaveValue(value);
      }
      for (const name of ['vue', 'solid', 'svelte', 'astro']) {
        const tips = page.locator(`[data-boolean="${name}"] lab-tooltip`);
        assert.deepEqual(await tips.evaluateAll((elements) => elements.map((el) => el.arrow)), [
          false,
          true,
        ]);
        await expect(tips.nth(0).locator('[part="arrow"]')).toHaveCount(0);
        await expect(tips.nth(1).locator('[part="arrow"]')).toHaveCount(1);
      }
      assert.deepEqual(errors, []);
      records.push({
        engine,
        browser: browser.version(),
        adapters: 4,
        nativeReact: true,
        firstPaintValue: true,
        escapedMarkup: true,
        lineBreaksMatchNativeSetter: true,
        shiftedServerIds: true,
        inputAndTextareaAriaTargets: true,
        sameNodeAfterHydration: true,
        preHydrationEditPreserved: true,
        propertyBoundDraftPreserved: true,
        falseOverridesTrueDefault: true,
        mixedModuleRegistry: true,
        selectionPreserved: true,
        formEditAndReset: true,
        errors,
      });
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    join(output, 'packed.json'),
    `${JSON.stringify({ archives, records }, null, 2)}\n`,
  );
  process.stdout.write('Packed Textarea: 4 SSR adapters + React; Chromium/WebKit passed\n');
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.equal(dirname(consumer), resolve(tmpdir()));
  assert.ok(consumer.includes('labui-textarea-'));
  await rm(consumer, { recursive: true, force: true });
}
