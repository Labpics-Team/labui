import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium, webkit } from '@playwright/test';
import { runPnpm, writePackedConsumerProject } from './packed-consumer-project.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = join(root, 'docs/evidence/pin-input-20261119');
const consumer = await mkdtemp(join(tmpdir(), 'labui-pin-installed-'));
const results = [];
let server;
try {
  await mkdir(join(consumer, 'packs'));
  await mkdir(join(consumer, 'public'));
  const dependencies = {
    react: '18.3.1',
    'react-dom': '18.3.1',
    esbuild: '0.25.12',
    lit: '3.3.3',
    '@lit-labs/ssr': '4.1.0',
    '@lit-labs/ssr-client': '1.1.8',
  };
  const overrides = {};
  for (const folder of ['fonts', 'tokens', 'colors', 'shadow', 'materials', 'core', 'react']) {
    const location = join(root, 'packages', folder);
    const pkg = JSON.parse(await readFile(join(location, 'package.json'), 'utf8'));
    runPnpm(['pack', '--pack-destination', join(consumer, 'packs')], location);
    const archive = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
    dependencies[pkg.name] = overrides[pkg.name] = `file:./packs/${archive}`;
  }
  await writePackedConsumerProject(consumer, {
    name: 'pin-input-installed',
    dependencies,
    overrides,
  });
  runPnpm(['install', '--ignore-scripts', '--offline'], consumer);
  await writeFile(
    join(consumer, 'ssr.mjs'),
    `
    import {writeFile} from 'node:fs/promises';
    import {html,renderToString} from '@labpics/ui-core/ssr';
    import '@labpics/ui-core/pin-input';
    const fields = renderToString(html\`<form id="dirty"><lab-pin-input label="Code" name="code" count="4" default-value="12" required></lab-pin-input></form>
      <form id="autofill"><lab-pin-input label="Code" name="code" count="4" default-value="12" required></lab-pin-input></form>
      <form id="controlled"><lab-pin-input label="Code" name="code" count="4" value="12" required></lab-pin-input></form>
      <form id="invalid-numeric"><lab-pin-input label="Code" name="code" count="4" value-type="numeric" required></lab-pin-input></form>
      <form id="invalid-alphabetic"><lab-pin-input label="Code" name="code" count="4" value-type="alphabetic" required></lab-pin-input></form>
      <form id="invalid-alphanumeric"><lab-pin-input label="Code" name="code" count="4" value-type="alphanumeric" required></lab-pin-input></form>\`);
    await writeFile('public/hydration.html','<!doctype html><html><body>'+fields+'<script type="module" src="hydrate.js"></script></body></html>');
  `,
  );
  execFileSync(process.execPath, ['ssr.mjs'], { cwd: consumer });
  await writeFile(
    join(consumer, 'hydrate.js'),
    `
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
    window.hydrate = async () => {
      await import('@labpics/ui-core/pin-input');
      await Promise.all([...document.querySelectorAll('lab-pin-input')].map(field=>field.updateComplete));
    };
  `,
  );
  runPnpm(
    ['exec', 'esbuild', 'hydrate.js', '--bundle', '--format=esm', '--outdir=public'],
    consumer,
  );
  await cp(join(evidence, 'web-consumer/main.tsx'), join(consumer, 'main.tsx'));
  await cp(join(evidence, 'web-consumer/index.html'), join(consumer, 'public/index.html'));
  runPnpm(
    [
      'exec',
      'esbuild',
      'main.tsx',
      '--bundle',
      '--format=esm',
      '--jsx=automatic',
      '--outdir=public',
      '--loader:.woff2=file',
      '--loader:.webp=file',
    ],
    consumer,
  );
  server = createServer(async (request, response) => {
    try {
      const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = resolve(consumer, 'public', name === '/' ? 'index.html' : `.${name}`);
      assert.ok(file.startsWith(`${join(consumer, 'public')}${sep}`));
      response.setHeader(
        'content-type',
        {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.woff2': 'font/woff2',
        }[extname(file)] ?? 'application/octet-stream',
      );
      response.end(await readFile(file));
    } catch {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [name, engine] of [
    ['chromium', chromium],
    ['webkit', webkit],
  ]) {
    const browser = await engine.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 1800, height: 1050 },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${base}/hydration.html`);
      await page.waitForFunction(() => typeof window.hydrate === 'function');
      await page.locator('#dirty .lab-pin-input-segment').first().fill('9');
      await page.locator('#autofill .lab-pin-input-segment').first().fill('6789');
      await page.locator('#controlled .lab-pin-input-segment').first().fill('9');
      const invalidValues = [
        ['numeric', 'abcd', '1234'],
        ['alphabetic', '1234', 'abcd'],
        ['alphanumeric', '!!!!', 'a1b2'],
      ];
      for (const [type, invalid] of invalidValues)
        await page.locator(`#invalid-${type} .lab-pin-input-segment`).first().fill(invalid);
      await page.evaluate(() => window.hydrate());
      for (const [type, invalid, corrected] of invalidValues) {
        const form = page.locator(`#invalid-${type}`);
        assert.equal(await form.evaluate((form) => new FormData(form).get('code')), invalid);
        assert.equal(await form.evaluate((form) => form.checkValidity()), false);
        await form.evaluate((form) =>
          form.addEventListener('value-complete', () => {
            form.dataset.corrected = String(form.checkValidity());
          }),
        );
        await form.locator('.lab-pin-input-segment').first().focus();
        await form
          .locator('.lab-pin-input-segment')
          .first()
          .evaluate((node, text) => {
            const clipboardData = new DataTransfer();
            clipboardData.setData('text/plain', text);
            node.dispatchEvent(
              new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
            );
          }, corrected);
        await page.waitForFunction(
          ({ type, corrected }) => {
            const form = document.querySelector(`#invalid-${type}`);
            return form.checkValidity() && new FormData(form).get('code') === corrected;
          },
          { type, corrected },
        );
        assert.equal(await form.getAttribute('data-corrected'), 'true');
      }
      for (const [id, expected] of [
        ['dirty', '92'],
        ['autofill', '6789'],
        ['controlled', '12'],
      ]) {
        assert.equal(
          await page.locator(`#${id}`).evaluate((form) => new FormData(form).get('code')),
          expected,
        );
        assert.equal(
          await page
            .locator(`#${id} .lab-pin-input-segment`)
            .evaluateAll((inputs) => inputs.map((input) => input.value).join('')),
          expected,
        );
      }
      await page.locator('#dirty').evaluate((form) => form.reset());
      await page.waitForFunction(
        () => new FormData(document.querySelector('#dirty')).get('code') === '12',
      );
      await page.addInitScript(() => {
        window.pinFrames = 0;
        window.pinTimers = 0;
        const raf = window.requestAnimationFrame.bind(window);
        const timer = window.setTimeout.bind(window);
        window.requestAnimationFrame = (callback) => {
          window.pinFrames++;
          return raf(callback);
        };
        window.setTimeout = (...args) => {
          window.pinTimers++;
          return timer(...args);
        };
      });
      await page.goto(base);
      await page.locator('#react-form .lab-pin-input-segment').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const metrics = [];
      for (const theme of ['light', 'dark'])
        for (const scale of [1, 1.25, 2]) {
          await page.evaluate(
            ({ theme, scale }) => {
              document.documentElement.dataset.theme = theme;
              document.documentElement.style.fontSize = `${16 * scale}px`;
            },
            { theme, scale },
          );
          const dimensions = await page
            .locator('#lit-matrix lab-pin-input')
            .nth(1)
            .locator('.lab-pin-input-segment')
            .first()
            .evaluate((node) => {
              const rect = node.getBoundingClientRect();
              const style = getComputedStyle(node);
              return {
                width: rect.width,
                height: rect.height,
                stroke: style.borderWidth,
                radius: style.borderRadius,
                border: style.borderColor,
              };
            });
          assert.equal(dimensions.width, 48 * scale);
          assert.equal(dimensions.height, 56 * scale);
          assert.ok(
            Math.abs(Number.parseFloat(dimensions.stroke) - 2 * scale) < 1,
            'CSS borders snap to physical pixels at fractional zoom',
          );
          assert.equal(dimensions.radius, `${12 * scale}px`);
          const dot = await page
            .locator('#lit-matrix lab-pin-input')
            .nth(1)
            .locator('.lab-pin-input-dot')
            .first()
            .boundingBox();
          assert.equal(dot.width, 8 * scale);
          assert.equal(dot.height, 8 * scale);
          metrics.push({ theme, scale, ...dimensions });
          await page
            .locator('main')
            .screenshot({ path: join(evidence, `web-${name}-${theme}-${scale * 100}.png`) });
        }
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '16px';
        document.documentElement.dataset.theme = 'light';
      });
      const accessibility = await new AxeBuilder({ page }).include('main').analyze();
      assert.deepEqual(
        accessibility.violations.map((v) => ({ id: v.id, impact: v.impact })),
        [],
      );
      for (const renderer of ['lit', 'react']) {
        const form = page.locator(`#${renderer}-form`);
        await form.evaluate((form, renderer) => {
          form.addEventListener('submit', (event) => {
            event.preventDefault();
            form.dataset.submitted = String(new FormData(form).get('code'));
          });
          form.addEventListener(renderer === 'lit' ? 'value-complete' : 'pin-complete', () => {
            form.dataset.completedValue = String(new FormData(form).get('code'));
            form.dataset.completedValid = String(form.checkValidity());
            form.requestSubmit();
          });
        }, renderer);
        const input = form.locator('.lab-pin-input-segment').first();
        await input.focus();
        await input.evaluate((node) => {
          const data = new DataTransfer();
          data.setData('text/plain', '123456');
          node.dispatchEvent(
            new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }),
          );
        });
        await page.waitForFunction(
          (renderer) =>
            new FormData(document.getElementById(`${renderer}-form`)).get('code') === '123456',
          renderer,
        );
        assert.equal(await form.evaluate((node) => node.checkValidity()), true);
        assert.equal(await form.getAttribute('data-completed-value'), '123456');
        assert.equal(await form.getAttribute('data-completed-valid'), 'true');
        assert.equal(await form.getAttribute('data-submitted'), '123456');
        if (renderer === 'react')
          assert.equal(await form.locator('output').textContent(), '123456');
        await form.locator('button').click();
        await page.waitForFunction(
          (renderer) =>
            new FormData(document.getElementById(`${renderer}-form`)).get('code') === '',
          renderer,
        );
      }
      await page.locator('body').click({ position: { x: 5, y: 5 } });
      await page.waitForTimeout(100);
      const start = await page.evaluate(() => ({
        frames: window.pinFrames,
        timers: window.pinTimers,
      }));
      await page.waitForTimeout(250);
      const idle = await page.evaluate(
        (start) => ({
          frames: window.pinFrames - start.frames,
          timers: window.pinTimers - start.timers,
        }),
        start,
      );
      assert.deepEqual(idle, { frames: 0, timers: 0 });
      assert.deepEqual(errors, []);
      results.push({
        engine: name,
        installed: true,
        geometry: metrics,
        accessibilityViolations: 0,
        hydration: {
          dirtyValue: '92',
          autofillValue: '6789',
          controlledValue: '12',
          resetValue: '12',
        },
        idle,
      });
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    join(evidence, 'installed-web.generated.json'),
    `${JSON.stringify(results, null, 2)}\n`,
  );
  console.info(
    'Installed npm consumer passed in Chromium/WebKit: forms, source geometry, 12 theme/scale renders, axe, zero idle frames/timers.',
  );
} finally {
  if (server) await new Promise((done) => server.close(done));
  assert.ok(resolve(consumer).startsWith(`${resolve(tmpdir())}${sep}labui-pin-installed-`));
  await rm(consumer, { recursive: true, force: true });
}
