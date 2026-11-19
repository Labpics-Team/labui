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
const output = join(root, 'docs/evidence/alert-20261119');
const consumer = await mkdtemp(join(tmpdir(), 'labui-alert-'));
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
    name: 'labui-alert-consumer',
    dependencies,
    overrides,
  });
  pnpm(['install', '--ignore-scripts', '--prefer-offline'], consumer);
  await writeFile(
    join(consumer, 'shared.mjs'),
    `import {createElement as h,useState} from 'react';import {Alert} from '@labpics/ui-react/alert';
    export function App(){const [props,setProps]=useState({});if(typeof window!=='undefined')window.reactProps=setProps;return h(Alert,{heading:'Saved',description:'Changes are available',...props,onDismiss:()=>window.calls.push('react')})}`,
  );
  await writeFile(
    join(consumer, 'server.mjs'),
    `import {writeFile} from 'node:fs/promises';import {createElement as h} from 'react';import {renderToString} from 'react-dom/server';import {App} from './shared.mjs';
    const parts=['<button id="origin">Open notification</button><section id="react">'+renderToString(h(App))+'</section>'];
    for(const renderer of ['vue','solid','svelte','astro']){const {renderAlert}=await import('@labpics/ui-'+renderer+'/ssr');parts.push('<section data-renderer="'+renderer+'">'+renderAlert({heading:'Saved',description:'Changes are available',quantity:3,controlled:true})+'</section>')}
    const {renderAlert}=await import('@labpics/ui-vue/ssr');parts.push('<section id="false">'+renderAlert({heading:'Hidden',open:false,showIcon:false})+'</section>');
    parts.push('<div id="matrix">');for(const quantity of [1,2,3])for(const type of ['neutral','danger'])parts.push('<section data-source="'+type+'-'+quantity+'">'+renderAlert({heading:'Alert',description:'Alert description that warning about something',type,quantity,controlled:true})+'</section>');parts.push('</div>');
    await writeFile('index.html','<!doctype html><html data-theme="light" data-material="solid"><head><meta charset="utf-8"><link rel="stylesheet" href="client.css"><style>body{margin:24px;font-family:Geist;background:var(--lab-bg-primary);color:var(--lab-label-primary)}section{width:450px;max-width:100%;margin-block:24px}#matrix{display:grid;grid-template-columns:450px 450px;gap:32px;background:linear-gradient(120deg,#302bfd,transparent)}#matrix section{margin:0}</style></head><body>'+parts.join('')+'<script type="module" src="client.js"></script></body></html>');`,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `import '@labpics/fonts/fonts.css';import '@labui/colors/contract.css';import '@labpics/ui-core/tokens.css';import '@labpics/ui-core/alert.css';import '@labpics/ui-materials/material.css';
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';import {createElement as h} from 'react';import {hydrateRoot} from 'react-dom/client';import {App} from './shared.mjs';
    window.calls=[];window.hydrate=async()=>{await import('@labpics/ui-core/alert');hydrateRoot(document.querySelector('#react'),h(App));document.querySelectorAll('lab-alert').forEach(el=>el.addEventListener('dismiss',()=>window.calls.push(el.closest('section').dataset.renderer)));window.ready=true};`,
  );
  await writeFile(
    join(consumer, 'types.mts'),
    `import {Alert,type AlertProps} from '@labpics/ui-react/alert';import type {LabAlertType} from '@labpics/ui-core/alert';import {renderAlert} from '@labpics/ui-vue/ssr';const type:LabAlertType='danger';const props:AlertProps={heading:'Alert',type,open:true,onDismiss:event=>event.preventDefault()};renderAlert({showIcon:false,open:false,heading:'Hidden'});void Alert;void props;
    // @ts-expect-error unsupported authored type
    const bad:AlertProps={heading:'Bad',type:'success'};void bad;`,
  );
  pnpm(
    [
      'exec',
      'tsc',
      '--noEmit',
      '--strict',
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
  execFileSync(
    process.execPath,
    [
      '-e',
      "require('@labpics/ui-react/alert');require('@labpics/ui-vue/ssr').renderAlert({heading:'Alert'});",
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
    if (name.includes('..')) return response.writeHead(403).end();
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
        viewport: { width: 1100, height: 1100 },
        reducedMotion: 'reduce',
      });
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.addInitScript(() => {
        const raf = window.requestAnimationFrame;
        window.rafCalls = 0;
        window.requestAnimationFrame = (...args) => {
          window.rafCalls++;
          return raf.apply(window, args);
        };
      });
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(() => document.fonts.ready);
      const first = page.locator('[data-renderer="vue"] [data-lab-alert]');
      const initial = await first.boundingBox();
      assert.equal(initial.height, 96);
      await expect(page.locator('#false [data-lab-alert]')).toBeHidden();
      assert.equal(await page.locator('#false .lab-alert-icon').count(), 0);
      await page.locator('#origin').focus();
      await page.evaluate(() => window.hydrate());
      await page.waitForFunction(() => window.ready);
      await expect(page.locator('#origin')).toBeFocused();
      await expect(first).toHaveJSProperty('offsetHeight', 96);
      await page.locator('#react .lab-alert-close').focus();
      await page.keyboard.press('Space');
      await expect(page.locator('#react [data-lab-alert]')).toBeHidden();
      await expect(page.locator('#origin')).toBeFocused();
      for (const renderer of ['vue', 'solid', 'svelte', 'astro']) {
        const host = page.locator(`[data-renderer="${renderer}"] lab-alert`);
        await host.locator('.lab-alert-close').focus();
        await page.keyboard.press('Enter');
        await expect(host.locator('[data-lab-alert]')).toBeVisible();
        await host.evaluate((el) => {
          el.controlled = false;
        });
        await page.keyboard.press('Space');
        await expect(host.locator('[data-lab-alert]')).toBeHidden();
        await host.evaluate((el) => {
          el.open = true;
          el.description = '';
          el.showIcon = false;
        });
        await expect(host.locator('.lab-alert-icon')).toHaveCount(0);
        await expect(host.locator('.lab-alert-description')).toHaveCount(0);
      }
      const source = page.locator('[data-source="neutral-3"] lab-alert');
      await expect(source.locator('[role="status"]')).toHaveText(
        'Alert. Alert description that warning about something',
      );
      await source.evaluate((el) => {
        const live = el.shadowRoot.querySelector('[role="status"]');
        window.announcements = 0;
        new MutationObserver(() => window.announcements++).observe(live, { childList: true });
        el.quantity = 2;
      });
      await page.waitForTimeout(80);
      assert.equal(await page.evaluate(() => window.announcements), 0);
      await source.evaluate((el) => {
        el.quantity = 3;
      });
      for (const theme of ['light', 'dark'])
        for (const scale of [100, 125, 200])
          for (const material of ['solid', 'acrylic', 'glass']) {
            await page.evaluate(
              ({ theme, scale, material }) => {
                document.documentElement.dataset.theme = theme;
                document.documentElement.dataset.material = material;
                document.documentElement.style.fontSize = `${(16 * scale) / 100}px`;
              },
              { theme, scale, material },
            );
            await page.waitForTimeout(80);
            const geometry = await source.locator('[data-lab-alert]').evaluate((panel) => {
              const box = panel.getBoundingClientRect();
              const surface = panel.querySelector('.lab-alert-surface').getBoundingClientRect();
              const text = panel.querySelector('.lab-alert-description').getBoundingClientRect();
              const close = panel.querySelector('.lab-alert-close').getBoundingClientRect();
              return {
                width: box.width,
                height: box.height,
                frontHeight: surface.height,
                radius: getComputedStyle(panel.querySelector('.lab-alert-surface'))
                  .borderTopLeftRadius,
                textRight: text.right,
                closeX: close.x,
                stackHeight: box.height - surface.height,
                lineBoxes: Array.from(
                  panel.querySelectorAll('.lab-alert-heading, .lab-alert-description'),
                ).map((el) => {
                  const css = getComputedStyle(el);
                  const height =
                    el.getBoundingClientRect().height +
                    Number.parseFloat(css.marginTop) +
                    Number.parseFloat(css.marginBottom);
                  const node = [...el.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
                  const lineTops = new Set();
                  if (node) {
                    const range = document.createRange();
                    for (let i = 0; i < node.length; i++) {
                      range.setStart(node, i);
                      range.setEnd(node, i + 1);
                      lineTops.add(range.getBoundingClientRect().top);
                    }
                  }
                  return {
                    height,
                    lineHeight: Number.parseFloat(css.lineHeight),
                    lineTops: [...lineTops].sort((a, b) => a - b),
                  };
                }),
                svg: panel
                  .querySelector('lab-icon')
                  .shadowRoot.querySelector('svg')
                  .getBoundingClientRect().width,
                paints: Array.from(panel.querySelectorAll('.lab-material')).map((el) => ({
                  renderer: el.dataset.labMaterialPaintRenderer,
                  normal: getComputedStyle(el).getPropertyValue('--_tint'),
                  blend: getComputedStyle(el).getPropertyValue('--_blend'),
                  background: getComputedStyle(el).backgroundColor,
                  blendMode: getComputedStyle(el.querySelector('.lab-material__blend') ?? el)
                    .mixBlendMode,
                })),
              };
            });
            assert.equal(geometry.width, 450);
            assert.ok(Math.abs(geometry.stackHeight - (16 * scale) / 100) < 1);
            assert.ok(geometry.textRight <= geometry.closeX - (24 * scale) / 100 + 1);
            assert.equal(geometry.svg, (24 * scale) / 100);
            for (const text of geometry.lineBoxes) {
              assert.ok(
                Math.abs(
                  text.height - Math.round(text.height / text.lineHeight) * text.lineHeight,
                ) < 1,
                'Wrapped text retains authored line-height',
              );
              for (let line = 1; line < text.lineTops.length; line++)
                assert.ok(
                  Math.abs(text.lineTops[line] - text.lineTops[line - 1] - text.lineHeight) < 0.01,
                  'Actual wrapped baselines retain line-height',
                );
            }
            await page
              .locator('#matrix')
              .screenshot({ path: join(output, `${engine}-${theme}-${scale}-${material}.png`) });
            records.push({ engine, theme, scale, material, ...geometry });
          }
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '32px';
        document.querySelector('[data-source="neutral-3"]').style.width = '280px';
      });
      await expect(source.locator('.lab-alert-description')).toHaveCSS('overflow-wrap', 'anywhere');
      const narrow = await source.locator('[data-lab-alert]').evaluate((el) => ({
        width: el.clientWidth,
        scroll: el.scrollWidth,
        text: el.querySelector('.lab-alert-description').getBoundingClientRect().height,
      }));
      assert.equal(narrow.width, narrow.scroll);
      assert.ok(narrow.text > 48);
      await source.screenshot({ path: join(output, `${engine}-narrow-200.png`) });
      await page.waitForTimeout(250);
      await page.evaluate(() => {
        window.rafCalls = 0;
      });
      await page.waitForTimeout(160);
      assert.equal(await page.evaluate(() => window.rafCalls), 0, 'No idle RAF');
      await page.keyboard.press('Escape');
      await expect(source.locator('[data-lab-alert]')).toBeVisible();
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    join(output, 'packed.json'),
    `${JSON.stringify({ archives, publicIcons: !process.env.LAB_ICONS_TARBALL, declarations: true, records }, null, 2)}\n`,
  );
  console.info(
    'Alert packed consumers: declarations, CJS, SSR/hydration, React + four generated bindings, dismissal/focus, 0 idle RAF, both themes × 3 scales × 3 materials passed.',
  );
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.equal(dirname(consumer), resolve(tmpdir()));
  assert.ok(consumer.includes('labui-alert-'));
  await rm(consumer, { recursive: true, force: true });
}
