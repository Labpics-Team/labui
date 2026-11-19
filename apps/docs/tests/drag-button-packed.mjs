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
const output = join(root, 'docs/evidence/drag-button-20261119');
const consumer = await mkdtemp(join(tmpdir(), 'labui-drag-'));
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
  }
  await writePackedConsumerProject(consumer, {
    name: 'labui-drag-consumer',
    dependencies,
    overrides,
  });
  await writeFile(
    join(consumer, 'pnpm-workspace.yaml'),
    JSON.stringify({ packages: ['.'], overrides, autoInstallPeers: false }),
  );
  pnpm(['install', '--ignore-scripts', '--prefer-offline'], consumer);
  await writeFile(
    join(consumer, 'shared.mjs'),
    `
    import {createElement as h,useState} from 'react';
    import {DragButton} from '@labpics/ui-react/drag-button';
    export function App(){const [props,setProps]=useState({});if(typeof window!=='undefined')window.reactProps=setProps;return h(DragButton,{label:'Send transfer','data-attempt':props.resetKey??'',...props,onComplete:source=>window.calls.push({renderer:'react',source})})}
  `,
  );
  await writeFile(
    join(consumer, 'server.mjs'),
    `
    import {writeFile} from 'node:fs/promises';import {createElement as h} from 'react';import {renderToString} from 'react-dom/server';import {App} from './shared.mjs';
    const parts=['<section id="react" data-renderer="react">'+renderToString(h(App))+'</section>'];
    for(const renderer of ['vue','solid','svelte','astro']){
      const {renderDragButton}=await import('@labpics/ui-'+renderer+'/ssr');
      parts.push('<section data-renderer="'+renderer+'">'+renderDragButton({label:'Send transfer'})+'</section>');
    }
    const {renderDragButton}=await import('@labpics/ui-vue/ssr');
    parts.push('<section data-source>'+renderDragButton({label:'Confirm'})+'</section>');
    for(const status of ['pending','success','danger'])parts.push('<section data-result="'+status+'">'+renderDragButton({label:'Send transfer',status})+'</section>');
    await writeFile('index.html','<!doctype html><html data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="client.css"><style>body{margin:24px;font-family:Geist;background:var(--lab-bg-primary)}section{width:416px;margin-block:16px}section[data-source]{width:1144px}#react{display:block}button{font-family:inherit}</style></head><body>'+parts.join('')+'<script type="module" src="client.js"></script></body></html>');
  `,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
    import '@labpics/fonts/fonts.css';import '@labui/colors/contract.css';import '@labpics/ui-core/tokens.css';import '@labpics/ui-core/drag-button.css';
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';import {createElement as h} from 'react';import {hydrateRoot} from 'react-dom/client';import {App} from './shared.mjs';
    window.calls=[];window.hydrate=async()=>{await import('@labpics/ui-core/drag-button');hydrateRoot(document.querySelector('#react'),h(App));document.querySelectorAll('lab-drag-button').forEach(el=>el.addEventListener('complete',e=>window.calls.push({renderer:el.closest('section').dataset.renderer,source:e.detail.source})));window.ready=true};
  `,
  );
  await writeFile(
    join(consumer, 'types.mts'),
    `import {DragButton,type DragButtonProps} from '@labpics/ui-react/drag-button';import type {LabDragButtonStatus} from '@labpics/ui-core/drag-button';const status:LabDragButtonStatus='danger';const props:DragButtonProps={label:'Send',status,onComplete:source=>source satisfies 'drag'|'press'};void DragButton;void props;`,
  );
  pnpm(
    [
      'exec',
      'tsc',
      '--noEmit',
      '--skipLibCheck',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      'types.mts',
    ],
    consumer,
  );
  execFileSync(process.execPath, ['server.mjs'], {
    cwd: consumer,
    stdio: 'pipe',
    windowsHide: true,
  });
  // Every supported CJS entry must carry bundled symbol packets rather than require ESM-only Icons entries.
  execFileSync(
    process.execPath,
    [
      '-e',
      "require('@labpics/ui-react/drag-button');require('@labpics/ui-vue/ssr').renderDragButton({label:'Send'});",
    ],
    { cwd: consumer, stdio: 'pipe', windowsHide: true },
  );
  pnpm(
    [
      'exec',
      'esbuild',
      'client.js',
      '--bundle',
      '--format=esm',
      '--outdir=public',
      '--loader:.woff2=file',
      '--loader:.woff=file',
      '--loader:.ttf=file',
    ],
    consumer,
  );
  server = createServer(async (request, response) => {
    const name = decodeURIComponent(request.url.split('?')[0]);
    if (name.includes('..')) {
      response.writeHead(403).end();
      return;
    }
    try {
      const path =
        name === '/' ? join(consumer, 'index.html') : join(consumer, 'public', name.slice(1));
      response.setHeader(
        'Content-Type',
        name.endsWith('.js')
          ? 'text/javascript'
          : name.endsWith('.css')
            ? 'text/css'
            : name.endsWith('.woff2')
              ? 'font/woff2'
              : 'text/html',
      );
      response.end(await readFile(path));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const records = [];
  for (const [engine, launcher] of [
    ['chromium', chromium],
    ['webkit', webkit],
  ]) {
    const browser = await launcher.launch({
      headless: true,
      ...(engine === 'chromium' ? { args: ['--mute-audio'] } : {}),
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 1240, height: 1000 },
        reducedMotion: 'reduce',
      });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => document.fonts.load('500 16px Geist', 'Swipe it'));
      await expect(page.locator('[data-result="danger"] button')).toHaveAttribute(
        'data-status',
        'danger',
      );
      const first = await page.locator('[data-renderer="vue"] button').elementHandle();
      await page.evaluate(() => window.hydrate());
      await page.waitForFunction(() => window.ready && typeof window.reactProps === 'function');
      await expect(page.locator('lab-drag-button').first()).toHaveJSProperty('hasUpdated', true);
      assert.equal(await first.evaluate((node) => node.isConnected), true);
      async function reset(renderer, props = {}) {
        await page.evaluate(
          ({ renderer, props }) => {
            window.calls = [];
            if (renderer === 'react')
              window.reactProps({ status: 'idle', resetKey: Math.random(), ...props });
            else {
              const node = document.querySelector(`[data-renderer="${renderer}"] lab-drag-button`);
              Object.assign(node, {
                status: 'idle',
                disabled: false,
                resetKey: String(Math.random()),
                ...props,
              });
            }
          },
          { renderer, props },
        );
        await expect(page.locator(`[data-renderer="${renderer}"] button`)).toHaveAttribute(
          'data-status',
          props.status ?? 'idle',
        );
      }
      async function drag(button, fraction, release = true) {
        const bounds = await button.boundingBox();
        const rtl = await button.evaluate((node) => getComputedStyle(node).direction === 'rtl');
        const handle = await button.locator('.lab-drag-fill').boundingBox();
        const inset = (bounds.height - handle.height) / 2;
        const start = rtl
          ? bounds.x + bounds.width - inset - handle.height / 2
          : bounds.x + inset + handle.height / 2;
        const end = start + (rtl ? -1 : 1) * (bounds.width - inset * 2 - handle.height) * fraction;
        await page.mouse.move(start, bounds.y + bounds.height / 2);
        await page.mouse.down();
        await page.mouse.move(end, bounds.y + bounds.height / 2, { steps: 8 });
        if (release) await page.mouse.up();
      }
      for (const renderer of ['react', 'vue', 'solid', 'svelte', 'astro']) {
        const button = page.locator(`[data-renderer="${renderer}"] button`);
        await reset(renderer);
        await drag(button, 0.5);
        assert.equal(await page.evaluate(() => window.calls.length), 0);
        await drag(button, 1.02);
        await expect(button).toHaveAttribute('data-status', 'pending');
        assert.deepEqual(await page.evaluate(() => window.calls), [{ renderer, source: 'drag' }]);
        await button.press('Enter');
        assert.equal(await page.evaluate(() => window.calls.length), 1);
        await reset(renderer);
        await button.click();
        await expect(button).toHaveAttribute('data-status', 'pending');
        assert.deepEqual(await page.evaluate(() => window.calls), [{ renderer, source: 'press' }]);
        await reset(renderer);
        await button.focus();
        await button.press('Space');
        await expect(button).toHaveAttribute('data-status', 'pending');
        assert.deepEqual(await page.evaluate(() => window.calls), [{ renderer, source: 'press' }]);
        await reset(renderer);
        await drag(button, 0.5, false);
        await button.press('Escape');
        await page.mouse.up();
        assert.equal(await page.evaluate(() => window.calls.length), 0);
        await reset(renderer);
        await drag(button, 0.5, false);
        await button.evaluate((node) => {
          const event = new PointerEvent('pointercancel', { pointerId: 1, bubbles: true });
          node.dispatchEvent(event);
        });
        await page.mouse.up();
        assert.equal(await page.evaluate(() => window.calls.length), 0);
        await reset(renderer);
        await drag(button, 0.5, false);
        await page.locator(`[data-renderer="${renderer}"]`).evaluate((node) => {
          node.style.width = '360px';
        });
        await page.waitForTimeout(50);
        await page.mouse.up();
        assert.equal(await page.evaluate(() => window.calls.length), 0);
        await reset(renderer);
        await button.evaluate((node) => {
          node.dir = 'rtl';
        });
        await drag(button, 1.02);
        assert.deepEqual(await page.evaluate(() => window.calls), [{ renderer, source: 'drag' }]);
        await button.evaluate((node) => {
          node.dir = 'ltr';
        });
        await reset(renderer, { disabled: true });
        await button.click({ force: true });
        assert.equal(await page.evaluate(() => window.calls.length), 0);
        await reset(renderer, { status: 'success' });
        await expect(button).toHaveAttribute('aria-disabled', 'true');
        await reset(renderer);
        await button.press('Enter');
        assert.equal(await page.evaluate(() => window.calls.length), 1);
        if (renderer !== 'react') {
          await reset(renderer);
          await button.click();
          const host = page.locator(`[data-renderer="${renderer}"] lab-drag-button`);
          await host.evaluate(async (node) => {
            const destination = document.createElement('div');
            node.parentNode.append(destination);
            destination.append(node);
            await node.updateComplete;
          });
          await expect(host).toHaveJSProperty('status', 'idle');
          await expect(button).toHaveAttribute('data-status', 'pending');
          await expect(button).toHaveAttribute('aria-disabled', 'true');
          await button.press('Enter');
          await button.press('Space');
          await button.click({ force: true });
          assert.equal(
            await page.evaluate(() => window.calls.length),
            1,
            'Reparenting must preserve the committed attempt',
          );
          await host.evaluate(async (node) => {
            const destination = node.parentNode;
            node.remove();
            node.resetKey += ':next';
            await node.updateComplete;
            destination.append(node);
            await node.updateComplete;
          });
          await expect(button).toHaveAttribute('data-status', 'idle');
          await button.press('Enter');
          assert.equal(
            await page.evaluate(() => window.calls.length),
            2,
            'A reset key changed while detached opens the next attempt',
          );
          await host.evaluate(async (node) => {
            const destination = node.parentNode;
            node.status = 'success';
            await node.updateComplete;
            node.remove();
            node.status = 'idle';
            await node.updateComplete;
            destination.append(node);
            await node.updateComplete;
          });
          await expect(button).toHaveAttribute('data-status', 'idle');
          await button.press('Enter');
          assert.equal(
            await page.evaluate(() => window.calls.length),
            3,
            'Returning a controlled result to idle while detached opens the next attempt',
          );
        }
        records.push({
          engine,
          renderer,
          partialCancel: true,
          singleCommit: true,
          clickKeyboard: true,
          escapePointerCancelResize: true,
          rtl: true,
          disabledResultReset: true,
          ...(renderer !== 'react' ? { reconnectPreservesAttemptAndExplicitResets: true } : {}),
        });
      }
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      for (const renderer of ['react', 'vue']) {
        const button = page.locator(`[data-renderer="${renderer}"] button`);
        await reset(renderer);
        await drag(button, 0.6);
        await drag(button, 1.02, false);
        await page.waitForTimeout(400);
        const full = await button.locator('.lab-drag-fill').boundingBox();
        const bounds = await button.boundingBox();
        assert.ok(
          Math.abs(full.width - (bounds.width - 8)) < 1,
          'An old return animation must not overwrite a new drag',
        );
        await page.mouse.up();
        assert.deepEqual(await page.evaluate(() => window.calls), [{ renderer, source: 'drag' }]);
        await reset(renderer);
        await drag(button, 0.6);
        await page.waitForTimeout(400);
        assert.equal(
          await button.locator('.lab-drag-fill').evaluate((node) => node.style.width),
          '',
        );
        assert.ok(Math.abs((await button.locator('.lab-drag-fill').boundingBox()).width - 48) < 1);
        records.push({ engine, renderer, normalMotionReturnAndInterruption: true });
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const source = page.locator('[data-source] button');
      records.push({
        engine,
        typography: await source.locator('.lab-drag-helper').evaluate((node) => {
          const style = getComputedStyle(node);
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          context.font = style.font;
          return {
            family: style.fontFamily,
            weight: style.fontWeight,
            size: style.fontSize,
            synthesis: style.fontSynthesis,
            variations: style.fontVariationSettings,
            loaded: document.fonts.check('500 16px Geist', 'Swipe it'),
            width: context.measureText('Swipe it').width,
            faces: [...document.fonts].map((face) => ({
              family: face.family,
              weight: face.weight,
              status: face.status,
            })),
          };
        }),
      });
      for (const theme of ['light', 'dark'])
        for (const scale of [100, 125, 200])
          for (const width of [320, 416, 1144]) {
            await page.evaluate(
              ({ theme, scale, width }) => {
                document.documentElement.dataset.theme = theme;
                document.documentElement.style.fontSize = `${(16 * scale) / 100}px`;
                const section = document.querySelector('[data-source]');
                section.style.width = `${width}px`;
                Object.assign(section.querySelector('lab-drag-button'), {
                  status: 'idle',
                  resetKey: String(Math.random()),
                });
              },
              { theme, scale, width },
            );
            await source.scrollIntoViewIfNeeded();
            await page.waitForTimeout(40);
            const bounds = await source.boundingBox();
            const handle = await source.locator('.lab-drag-fill').boundingBox();
            assert.ok(Math.abs(bounds.height - (56 * scale) / 100) < 1);
            assert.ok(Math.abs(handle.width - (48 * scale) / 100) < 1);
            assert.ok(Math.abs(handle.height - (48 * scale) / 100) < 1);
            await source.screenshot({
              path: join(output, `${engine}-${theme}-${scale}-${width}-idle.png`),
            });
            if (scale === 100 && width === 1144) {
              await drag(source, (568 - 48) / (1136 - 48), false);
              await source.screenshot({ path: join(output, `${engine}-${theme}-half.png`) });
              const bounds = await source.boundingBox();
              await page.mouse.move(bounds.x + 1116, bounds.y + 28);
              await source.screenshot({ path: join(output, `${engine}-${theme}-full.png`) });
              await page.mouse.up();
              for (const status of ['success', 'danger']) {
                await source.evaluate((node, status) => {
                  node.getRootNode().host.status = status;
                }, status);
                await expect(source).toHaveAttribute('data-status', status);
                await source.screenshot({ path: join(output, `${engine}-${theme}-${status}.png`) });
              }
            }
            if (scale === 200 && width === 320) {
              await source.evaluate((node) =>
                Object.assign(node.getRootNode().host, {
                  status: 'success',
                  successText: 'Перевод успешно отправлен получателю',
                }),
              );
              await expect(source).toHaveAttribute('data-status', 'success');
              const result = await source.locator('.lab-drag-result-text').boundingBox();
              const fill = await source.locator('.lab-drag-fill').boundingBox();
              assert.ok(result.x >= fill.x && result.x + result.width <= fill.x + fill.width + 1);
              assert.ok(result.y >= fill.y && result.y + result.height <= fill.y + fill.height + 1);
              await source.screenshot({
                path: join(output, `${engine}-${theme}-200-320-long-success.png`),
              });
              await source.evaluate((node) => {
                node.getRootNode().host.successText = 'Success';
              });
            }
          }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    join(output, 'packed.json'),
    JSON.stringify(
      { archives, publicIcons: !process.env.LAB_ICONS_TARBALL, declarations: true, records },
      null,
      2,
    ),
  );
  console.log(
    'Packed Drag Button: React + four generated adapters, SSR/hydration, pointer/keyboard lifecycle and both-theme render matrix passed.',
  );
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.equal(dirname(consumer), resolve(tmpdir()));
  assert.ok(consumer.includes('labui-drag-'));
  await rm(consumer, { recursive: true, force: true });
}
