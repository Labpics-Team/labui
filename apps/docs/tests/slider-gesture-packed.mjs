import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, webkit } from '@playwright/test';
import { runPnpm, writePackedConsumerProject } from './packed-consumer-project.mjs';

// Bounded installed-consumer regression: no screenshots or density matrix.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const consumer =
  process.env.LAB_SLIDER_GESTURE_CONSUMER ||
  (await mkdtemp(join(tmpdir(), 'labui-slider-gesture-')));
const archives = [];
const records = [];
let server;
try {
  await mkdir(join(consumer, 'packs'), { recursive: true });
  const dependencies = { react: '18.3.1', 'react-dom': '18.3.1', esbuild: '0.25.0' };
  const overrides = {};
  for (const folder of ['tokens', 'shadow', 'materials', 'fonts', 'colors', 'core', 'react']) {
    const location = join(root, 'packages', folder);
    const pkg = JSON.parse(await readFile(join(location, 'package.json'), 'utf8'));
    runPnpm(['pack', '--pack-destination', join(consumer, 'packs')], location);
    const name = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
    dependencies[pkg.name] = overrides[pkg.name] = `file:./packs/${name}`;
    archives.push({
      name: pkg.name,
      sha256: createHash('sha256')
        .update(await readFile(join(consumer, 'packs', name)))
        .digest('hex'),
    });
  }
  await writePackedConsumerProject(consumer, {
    name: 'slider-gesture-consumer',
    dependencies,
    overrides,
  });
  runPnpm(
    ['install', '--ignore-scripts', '--config.auto-install-peers=false', '--prefer-offline'],
    consumer,
  );
  await writeFile(
    join(consumer, 'client.js'),
    `
    import '@labpics/ui-core/slider';import '@labpics/ui-core/tokens.css';import '@labpics/ui-core/slider.css';
    import {createElement as h,useState} from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
    import {Slider} from '@labpics/ui-react/slider';
    let root;
    window.mount=async(renderer,props)=>{
      root?.unmount();root=undefined;document.body.innerHTML='<form id="field" style="width:400px;margin:40px"></form>';
      window.changes=[];window.ends=[];
      const change=value=>window.changes.push(value),end=value=>window.ends.push(value);
      const form=document.querySelector('form');
      if(renderer==='lit'){
        const slider=document.createElement('lab-slider');Object.assign(slider,{label:'Volume',labelHidden:true,name:'volume'},props);
        slider.addEventListener('value-change',event=>change(event.detail.value));slider.addEventListener('value-change-end',event=>end(event.detail.value));
        form.append(slider);await slider.updateComplete;
      }else{
        function App(){const [value,set]=useState(props.defaultValue);return h(Slider,{...props,label:'Volume',labelHidden:true,name:'volume',value,
          onValueChange:next=>{set(next);change(next)},onValueChangeEnd:end});}
        root=createRoot(form);flushSync(()=>root.render(h(App)));
      }
    };
  `,
  );
  await writeFile(
    join(consumer, 'build.mjs'),
    `import{build}from'esbuild';await build({entryPoints:['client.js'],outdir:'web',bundle:true,format:'esm',splitting:true});`,
  );
  execFileSync(process.execPath, ['build.mjs'], {
    cwd: consumer,
    stdio: 'pipe',
    windowsHide: true,
  });
  await writeFile(
    join(consumer, 'web/index.html'),
    '<!doctype html><link rel="stylesheet" href="/client.css"><script type="module" src="/client.js"></script>',
  );
  server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(consumer, 'web', `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(join(consumer, 'web') + sep)) return response.writeHead(403).end();
    try {
      response.setHeader(
        'Content-Type',
        file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html',
      );
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  for (const [engine, kind] of Object.entries({ chromium, webkit })) {
    const browser = await kind.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 700, height: 400 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(() => !!window.mount);
      for (const renderer of ['lit', 'react'])
        for (const dir of ['ltr', 'rtl']) {
          for (const props of [
            { defaultValue: [1] },
            { defaultValue: [2], step: 2 },
            { defaultValue: [-0.69], min: -0.7, max: 1.3, step: 0.01 },
            { defaultValue: [1, 2] },
            { defaultValue: [0] },
            { defaultValue: [20] },
          ]) {
            await page.evaluate(
              ([renderer, props]) => window.mount(renderer, props),
              [renderer, { ...props, dir }],
            );
            const inputs = page.getByRole('slider');
            // Reproduce the controlled keyboard -> pointer transition from review.
            if (
              renderer === 'react' &&
              props.defaultValue.length === 1 &&
              props.defaultValue[0] === 1
            ) {
              await inputs.focus();
              await page.keyboard.press('Home');
              await page.keyboard.press(dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
              await expect(inputs).toHaveValue('1');
            }
            await page.evaluate(() => {
              window.changes = [];
              window.ends = [];
            });
            const values = props.defaultValue.map(String);
            const readback = () => inputs.evaluateAll((nodes) => nodes.map((node) => node.value));
            const thumb = page.locator('.lab-slider-thumb').last();
            const box = await thumb.boundingBox();
            const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
            await page.mouse.click(from.x, from.y);
            assert.deepEqual(
              await readback(),
              values,
              `${engine} ${renderer} ${dir} stationary ${values}`,
            );
            assert.deepEqual(await page.evaluate(() => [window.changes, window.ends]), [[], []]);
            await page.mouse.move(from.x, from.y);
            await page.mouse.down();
            await page.mouse.move(from.x + (dir === 'rtl' ? -68 : 68), from.y);
            const moved =
              props.min === -0.7
                ? ['-0.3']
                : values.length === 2
                  ? ['1', '20']
                  : values[0] === '20'
                    ? ['37']
                    : ['20'];
            await expect.poll(readback).toEqual(moved);
            await page.mouse.move(from.x, from.y);
            await expect.poll(readback).toEqual(values);
            await page.mouse.up();
            assert.deepEqual(
              await page.locator('form').evaluate((form) => new FormData(form).getAll('volume')),
              values,
            );
            const [changes, ends] = await page.evaluate(() => [window.changes, window.ends]);
            assert.equal(changes.length, 2, 'Only movement and restoration request changes');
            assert.deepEqual(changes[1].map(String), values);
            assert.deepEqual(ends, [], 'A returned gesture does not commit a changed value');
            records.push({ engine, renderer, dir, ...props, changes, ends });
          }
        }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  }
  const evidence = {
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    }).trim(),
    archives,
    records,
  };
  await writeFile(
    join(root, 'docs/evidence/slider-20261119/gesture-installed.generated.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  console.info(
    `PASS ${records.length} installed Slider stationary/return gestures (Chromium + WebKit)`,
  );
} finally {
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  if (!process.env.LAB_SLIDER_GESTURE_CONSUMER)
    await rm(consumer, { recursive: true, force: true });
}
