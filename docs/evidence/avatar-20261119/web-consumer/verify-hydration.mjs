import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { Avatar } from '@labpics/ui-react/avatar';
import { renderAvatar } from '@labpics/ui-vue/ssr';
import { chromium, firefox, webkit } from '@playwright/test';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

// Run from the packed consumer; its HTTP server serves this generated hydration.html.
const [baseURL, output] = process.argv.slice(2);
assert.ok(baseURL && output);
const props = { name: 'Даниил', initials: 'Д', src: '/avatar-cache.svg', decorative: true };
await build({
  entryPoints: ['hydration.tsx'],
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  outfile: 'dist/hydration.js',
});
writeFileSync(
  'avatar-cache.svg',
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#3586da"/></svg>',
);
writeFileSync(
  'hydration.html',
  `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/dist/consumer.css"></head><body>
${renderAvatar(props)}<div id="react-ssr">${renderToString(createElement(Avatar, props))}</div>
<script>window.avatarSsrProps=${JSON.stringify(props)}</script><script type="module" src="/dist/hydration.js"></script></body></html>`,
);
const results = [];
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  let release;
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/dist/hydration.js', async (route) => {
    await hold;
    await route.continue();
  });
  try {
    await page.goto(new URL('hydration.html', baseURL).href, { waitUntil: 'commit' });
    await page.waitForFunction(() =>
      [
        document.querySelector('lab-avatar')?.shadowRoot?.querySelector('img'),
        document.querySelector('#react-ssr img'),
      ].every((image) => image?.complete && image.naturalWidth > 0),
    );
    await page.evaluate(() => {
      window.originalImages = [
        document.querySelector('lab-avatar').shadowRoot.querySelector('img'),
        document.querySelector('#react-ssr img'),
      ];
    });
    release();
    await page.waitForFunction(
      () =>
        window.avatarHydrated &&
        window.originalImages.every((image) => getComputedStyle(image).opacity === '1'),
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.originalImages[0] ===
            document.querySelector('lab-avatar').shadowRoot.querySelector('img') &&
          window.originalImages[1] === document.querySelector('#react-ssr img'),
      ),
      true,
    );
    assert.equal(await page.evaluate(() => document.querySelector('lab-avatar').decorative), true);
    await page.evaluate(() => {
      Object.assign(document.querySelector('lab-avatar'), {
        src: undefined,
        initials: 'Я',
        decorative: false,
      });
      window.updateReactAvatar({ name: 'Яна', initials: 'Я', decorative: false });
    });
    await page.waitForFunction(
      () =>
        document.querySelector('lab-avatar').shadowRoot.querySelector('.lab-avatar-initials')
          ?.textContent === 'Я' &&
        document.querySelector('#react-ssr .lab-avatar-initials')?.textContent === 'Я',
    );
    assert.equal(await page.locator('lab-avatar [role="img"]').count(), 1);
    assert.equal(await page.locator('#react-ssr [role="img"]').count(), 1);
    assert.deepEqual(errors, []);
    results.push({
      browser: name,
      version: browser.version(),
      imageNodesReused: true,
      decoded: true,
      booleanInputRetained: true,
      reactiveUpdate: true,
      errors,
    });
  } catch (error) {
    const images = await page.evaluate(() =>
      [
        document.querySelector('lab-avatar')?.shadowRoot?.querySelector('img'),
        document.querySelector('#react-ssr img'),
      ].map(
        (image) =>
          image && { complete: image.complete, width: image.naturalWidth, src: image.currentSrc },
      ),
    );
    throw new Error(`${name}: ${JSON.stringify({ errors, images })}`, { cause: error });
  } finally {
    release();
    await browser.close();
  }
}
writeFileSync(output, `${JSON.stringify(results, null, 2)}\n`);
console.info('Installed SSR hydration passed in Chromium, Firefox and WebKit.');
