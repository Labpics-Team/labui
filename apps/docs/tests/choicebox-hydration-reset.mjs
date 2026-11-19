import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Choicebox } from '@labpics/ui-react/choicebox';
import { chromium, expect, webkit } from '@playwright/test';
import { StrictMode, createElement as h } from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve('vite/package.json'));
const { build } = await import(pathToFileURL(viteRequire.resolve('esbuild')).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const defaults = [];
const items = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];
const tree = (strict) => {
  const control = h(Choicebox, {
    items,
    defaultValue: defaults,
    name: 'item',
    multiple: true,
    required: true,
  });
  return strict ? h(StrictMode, null, control) : control;
};
const built = await build({
  stdin: {
    resolveDir: resolve(root, 'apps/docs'),
    loader: 'js',
    contents: `
    import {StrictMode,createElement as h} from 'react';import {hydrateRoot} from 'react-dom/client';
    import {Choicebox} from '@labpics/ui-react/choicebox';
    const defaults=[];const items=${JSON.stringify(items)};window.requests=[];
    window.hydrate=()=>{
      for(const strict of [false,true]) {
        const control=h(Choicebox,{items,defaultValue:defaults,name:'item',multiple:true,required:true,onValueChange:next=>window.requests.push(next)});
        hydrateRoot(document.getElementById(strict?'strict':'normal'),strict?h(StrictMode,null,control):control);
      }
    };
  `,
  },
  bundle: true,
  tsconfigRaw: '{}',
  loader: { '.css': 'empty' },
  write: false,
  format: 'esm',
  logLevel: 'silent',
});
const html = `<!doctype html><html><body>${[false, true].map((strict) => `<form data-strict="${strict}"><section id="${strict ? 'strict' : 'normal'}">${renderToString(tree(strict))}</section></form>`).join('')}<script type="module" src="/client.js"></script></body></html>`;
const server = createServer((request, response) =>
  request.url === '/client.js'
    ? response.setHeader('Content-Type', 'text/javascript').end(built.outputFiles[0].text)
    : response.end(html),
);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const records = [];
try {
  for (const [engine, kind] of Object.entries({ chromium, webkit })) {
    const browser = await kind.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(() => typeof window.hydrate === 'function');
      await page.locator('form').evaluateAll((forms) => {
        for (const form of forms) form.querySelector('input[value="b"]').click();
      });
      await page.evaluate(async () => {
        window.hydrate();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      const state = () =>
        page.locator('form').evaluateAll((forms) =>
          forms.map((form) => ({
            checked: Array.from(form.querySelectorAll('input:checked'), (input) => input.value),
            selected: Array.from(
              form.querySelectorAll('[data-selected] input'),
              (input) => input.value,
            ),
            values: Array.from(new FormData(form)),
            valid: form.checkValidity(),
          })),
        );
      const chosen = { checked: ['b'], selected: ['b'], values: [['item', 'b']], valid: true };
      await expect.poll(state).toEqual([chosen, chosen]);
      assert.deepEqual(
        await page.evaluate(() => window.requests),
        [],
        'Hydration does not request a new choice',
      );
      await page.locator('form').evaluateAll((forms) => {
        for (const form of forms) form.reset();
      });
      const empty = { checked: [], selected: [], values: [], valid: false };
      await expect.poll(state).toEqual([empty, empty]);
      assert.deepEqual(
        await page.evaluate(() => window.requests),
        [],
        'Reset does not request a new choice',
      );
      await page.locator('form').evaluateAll((forms) => {
        for (const form of forms) {
          form.reset();
          form.querySelector('input[value="b"]').click();
        }
      });
      await expect.poll(state).toEqual([chosen, chosen]);
      assert.deepEqual(await page.evaluate(() => window.requests), [['b'], ['b']]);
      await page.locator('form').evaluateAll((forms) => {
        for (const form of forms) form.querySelector('input[value="b"]').click();
      });
      await expect.poll(state).toEqual([empty, empty]);
      assert.deepEqual(await page.evaluate(() => window.requests), [['b'], ['b'], [], []]);
      assert.deepEqual(errors, []);
      records.push({
        engine,
        browser: browser.version(),
        strictMode: true,
        earlySelectionAdopted: true,
        requiredAfterReset: true,
        resetThenInput: true,
        callbacks: true,
        errors,
      });
      process.stdout.write(
        `${engine}: multiple Choicebox adopts early SSR input and validates reset in normal/StrictMode roots\n`,
      );
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    resolve(root, 'docs/evidence/segmented-20261119/choicebox-hydration-reset.json'),
    `${JSON.stringify(records, null, 2)}\n`,
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
