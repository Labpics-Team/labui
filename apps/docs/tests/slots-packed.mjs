import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, webkit } from '@playwright/test';
import { runPnpm, writePackedConsumerProject } from './packed-consumer-project.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = join(root, 'docs/evidence/alert-20261119/slots');
const consumer = await mkdtemp(join(tmpdir(), 'labui-slots-'));
async function checkProjectedStyles(page, scale) {
  const icon = await page.locator('[data-pressure]').evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height, flex: getComputedStyle(el).flex };
  });
  assert.deepEqual(icon, { width: scale * 1.5, height: scale * 1.5, flex: '0 0 auto' });
  const dot = await page.locator('[data-dot]').evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      font: Number.parseFloat(style.fontSize),
      background: style.backgroundColor,
      color: style.color,
      radius: Number.parseFloat(style.borderTopLeftRadius),
      gap: Number.parseFloat(style.marginInlineEnd),
    };
  });
  assert.equal(dot.width, dot.font / 2);
  assert.equal(dot.height, dot.font / 2);
  assert.equal(dot.background, dot.color);
  assert.notEqual(dot.background, 'rgba(0, 0, 0, 0)');
  assert.ok(dot.radius > 0);
  assert.ok(dot.gap > 0);
  return { icon, dot };
}
let server;
try {
  await mkdir(output, { recursive: true });
  await mkdir(join(consumer, 'packs'));
  const dependencies = {
    vue: '3.5.42',
    svelte: '5.19.0',
    lit: '3.3.3',
    '@lit-labs/ssr': '4.1.0',
    '@lit-labs/ssr-client': '1.1.8',
    '@labpics/icons': '0.4.0',
    esbuild: '0.25.12',
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
    'vue',
    'solid',
    'svelte',
    'astro',
  ]) {
    const location = join(root, 'packages', folder);
    const pkg = JSON.parse(await readFile(join(location, 'package.json'), 'utf8'));
    runPnpm(['pack', '--pack-destination', join(consumer, 'packs')], location);
    const archive = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
    dependencies[pkg.name] = overrides[pkg.name] = `file:./packs/${archive}`;
    archives.push({
      name: archive,
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs', archive)))
        .digest('hex'),
    });
  }
  if (process.env.LAB_ICONS_TARBALL) {
    await copyFile(process.env.LAB_ICONS_TARBALL, join(consumer, 'packs/icons.tgz'));
    dependencies['@labpics/icons'] = overrides['@labpics/icons'] = 'file:./packs/icons.tgz';
    archives.push({
      name: 'icons.tgz',
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs/icons.tgz')))
        .digest('hex'),
    });
  }
  await writePackedConsumerProject(consumer, {
    name: 'labui-slots-consumer',
    dependencies,
    overrides,
  });
  runPnpm(['install', '--ignore-scripts', '--prefer-offline'], consumer);
  await cp(join(root, 'apps/docs/tests/fixtures/slots'), consumer, { recursive: true });
  execFileSync(process.execPath, ['--conditions=development', 'build.mjs'], {
    cwd: consumer,
    stdio: 'pipe',
    windowsHide: true,
  });
  await writeFile(
    join(consumer, 'render.mjs'),
    `
    import {writeFile} from 'node:fs/promises';
    const name='panel" &<>';let content='';
    for(const adapter of ['vue','solid','svelte','astro']){
      const {renderAlert,renderCard,renderTabs}=await import('@labpics/ui-'+adapter+'/ssr');
      content+='<section data-adapter="'+adapter+'">'+renderAlert({heading:'SSR '+adapter},{icon:'<svg data-icon width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>'});
      content+=renderCard({}, {footer:'<span data-first style="display:inline-block;width:17px">A</span>Text &lt; &amp; &quot;<input data-draft value="Draft"><span data-last>B</span>'});
      content+=renderTabs({items:[{value:name,label:'Escaped slot'}],value:name},{dynamic:{[name]:'<span data-dynamic>Dynamic</span>'}})+'</section>';
    }
    await writeFile('public/render.html','<!doctype html><html data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/vue-client.css"><style>body{font-family:Geist}section{width:600px;margin:24px}</style></head><body>'+content+'<script type="module" src="/render-client.js"></script></body></html>');
  `,
  );
  execFileSync(process.execPath, ['render.mjs'], {
    cwd: consumer,
    stdio: 'pipe',
    windowsHide: true,
  });
  await writeFile(
    join(consumer, 'render-client.mjs'),
    "import '@lit-labs/ssr-client/lit-element-hydrate-support.js';window.hydrate=async()=>{await Promise.all([import('@labpics/ui-core/alert'),import('@labpics/ui-core/card'),import('@labpics/ui-core/tabs')]);window.ready=true};",
  );
  runPnpm(
    [
      'exec',
      'esbuild',
      'render-client.mjs',
      '--bundle',
      '--format=esm',
      '--outfile=public/render-client.js',
    ],
    consumer,
  );
  server = createServer(async (request, response) => {
    const name = decodeURIComponent(request.url.split('?')[0]);
    if (name.includes('..')) return response.writeHead(403).end();
    try {
      response.setHeader(
        'content-type',
        name.endsWith('.js')
          ? 'text/javascript'
          : name.endsWith('.css')
            ? 'text/css'
            : name.endsWith('.woff2')
              ? 'font/woff2'
              : 'text/html',
      );
      const body = await readFile(join(consumer, 'public', name));
      response.end(
        name.endsWith('.html') && request.url.endsWith('?large')
          ? body.toString().replace('<html ', '<html style="font-size:32px" ')
          : body,
      );
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const records = [];
  for (const [engine, launcher] of [
    ['chromium', chromium],
    ['webkit', webkit],
  ]) {
    const browser = await launcher.launch({ headless: true });
    try {
      for (const framework of ['vue', 'svelte', 'render'])
        for (const ssr of framework === 'render' ? [true] : [true, false]) {
          console.info(`Checking ${engine} ${framework}, server rendered: ${ssr}`);
          const url = `http://127.0.0.1:${server.address().port}/${framework}${framework === 'render' ? '' : `-${ssr}`}.html`;
          if (ssr) {
            const staticPage = await browser.newPage({ javaScriptEnabled: false });
            await staticPage.goto(`${url}?large`);
            const sizes = await staticPage
              .locator('svg[data-icon]')
              .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
            assert.deepEqual(sizes, Array(framework === 'render' ? 4 : 1).fill(48));
            if (framework !== 'render') await checkProjectedStyles(staticPage, 32);
            records.push({ engine, framework, phase: 'javascript-disabled', scale: 32, sizes });
            await staticPage.close();
          }
          const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
          const errors = [];
          page.on('pageerror', (error) => {
            if (!errors.length) console.info('First browser error:', error.stack);
            errors.push(String(error));
          });
          page.on('console', (message) => {
            if (/hydration.*mismatch/i.test(message.text())) errors.push(message.text());
          });
          await page.goto(url);
          await page.evaluate(() => document.fonts.ready);
          const check = async (phase) => {
            for (const scale of [16, 20, 32]) {
              await page.evaluate((size) => {
                document.documentElement.style.fontSize = `${size}px`;
              }, scale);
              const sizes = await page.locator('svg[data-icon]').evaluateAll((els) =>
                els.map((el) => ({
                  width: el.getBoundingClientRect().width,
                  height: el.getBoundingClientRect().height,
                })),
              );
              assert.equal(sizes.length, framework === 'render' ? 4 : 1);
              for (const size of sizes)
                assert.deepEqual(size, { width: scale * 1.5, height: scale * 1.5 });
              for (const element of await page.locator('[data-first]').all())
                assert.equal((await element.boundingBox()).width, 17);
              if (framework !== 'render') {
                const nested = await page.locator('demo-symbol').evaluate((el) =>
                  ['svg', 'circle'].map((selector) => {
                    const rect = el.shadowRoot?.querySelector(selector)?.getBoundingClientRect();
                    return { width: rect?.width, height: rect?.height };
                  }),
                );
                assert.deepEqual(nested, [
                  { width: scale * 1.5, height: scale * 1.5 },
                  { width: scale, height: scale },
                ]);
              }
              const rootStyles =
                framework === 'render' ? undefined : await checkProjectedStyles(page, scale);
              records.push({ engine, framework, ssr, phase, scale, sizes, rootStyles });
            }
          };
          if (ssr) {
            await check('before-hydration');
            await page.locator('[data-draft]').first().fill('User draft');
            await page
              .locator('[data-draft]')
              .first()
              .evaluate((el) => {
                window.originalDraft = el;
              });
          }
          await page.evaluate((ssr) => window.hydrate(ssr), ssr);
          await page.waitForFunction(() => window.ready);
          await check('hydrated');
          if (ssr) {
            assert.equal(
              await page
                .locator('[data-draft]')
                .first()
                .evaluate((el) => el === window.originalDraft),
              true,
            );
            await expect(page.locator('[data-draft]').first()).toHaveValue('User draft');
          }
          if (framework !== 'render') {
            await page.locator('[data-update]').click();
            await expect(page.locator('[data-default]')).toHaveText('Default Updated < & " text');
            await expect(page.locator('lab-card lab-slot[slot="footer"]')).toContainText(
              'Updated < & " text',
            );
            await page.locator('[data-draft]').fill('Neighbor draft');
            await page.locator('[data-draft]').evaluate((el) => {
              window.retainedFooter = el;
            });
            await page.locator('[data-toggle]').click();
            await expect(page.locator('svg[data-icon]')).toHaveCount(0);
            await expect(page.locator('[data-header-draft]')).toHaveCount(0);
            assert.equal(
              await page.locator('[data-draft]').evaluate((el) => el === window.retainedFooter),
              true,
            );
            await expect(page.locator('[data-draft]')).toHaveValue('Neighbor draft');
            await page.locator('[data-toggle]').click();
            await expect(page.locator('[data-header-draft]')).toHaveCount(1);
            assert.equal(
              await page.locator('[data-draft]').evaluate((el) => el === window.retainedFooter),
              true,
            );
            await expect(page.locator('[data-draft]')).toHaveValue('Neighbor draft');
            await check('remounted');
          } else {
            assert.deepEqual(
              await page
                .locator('lab-tabs lab-slot')
                .evaluateAll((els) => els.map((el) => el.getAttribute('slot'))),
              Array(4).fill('panel" &<>'),
            );
            await expect(page.locator('[data-dynamic]')).toHaveCount(4);
          }
          await page.screenshot({
            path: join(output, `${engine}-${framework}-${ssr}.png`),
            fullPage: true,
          });
          assert.deepEqual(errors, []);
          await page.close();
        }
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    join(output, 'packed.json'),
    `${JSON.stringify({ archives, publicIcons: !process.env.LAB_ICONS_TARBALL, records }, null, 2)}\n`,
  );
  console.info(
    'Slot consumers: Vue/Svelte mount + SSR, four generated SSR bindings, delayed hydration, SVG geometry, fragments, escaping and state retention PASS.',
  );
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.equal(dirname(consumer), resolve(tmpdir()));
  assert.ok(consumer.includes('labui-slots-'));
  await rm(consumer, { recursive: true, force: true });
}
