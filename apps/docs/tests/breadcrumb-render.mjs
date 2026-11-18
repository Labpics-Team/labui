import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from '@playwright/test';

const output = new URL('../../../docs/evidence/breadcrumb-20261118/', import.meta.url);
await mkdir(output, { recursive: true });
const records = [];
const destination = (name) => fileURLToPath(new URL(name, output));
async function visit(page, query = '') {
  const errors = [];
  const onError = (error) => errors.push(error.message);
  const onResponse = (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  };
  page.on('pageerror', onError);
  page.on('response', onResponse);
  try {
    await page.goto(
      `http://127.0.0.1:${process.env.PW_PORT ?? 43617}/_fixtures/breadcrumb.html${query}`,
    );
    await page.locator('#react-author [aria-current="page"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    const font = await page.locator('#react-author nav').evaluate((element) => ({
      family: getComputedStyle(element).fontFamily,
      weight: getComputedStyle(element).fontWeight,
      loaded: [...document.fonts].some(
        (face) => face.family.replaceAll('"', '') === 'Geist' && face.status === 'loaded',
      ),
    }));
    assert.match(font.family, /Geist/);
    assert.equal(font.weight, '500');
    assert.equal(font.loaded, true, 'Authored Geist must be loaded before a visual comparison');
    assert.equal(await page.locator('vite-error-overlay').count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    page.off('pageerror', onError);
    page.off('response', onResponse);
  }
}
for (const [engine, runtime] of Object.entries({ chromium, webkit })) {
  const browser = await runtime.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 640, height: 260 },
      deviceScaleFactor: 2,
    });
    for (const theme of ['light', 'dark'])
      for (const scale of [1, 1.25, 2])
        for (const dir of ['ltr', 'rtl']) {
          await visit(page, `?theme=${theme}&scale=${scale}&dir=${dir}`);
          const name = `${engine}-${theme}-${scale}-${dir}.png`;
          await page.screenshot({ path: destination(name) });
          records.push({ engine, theme, scale, dir, image: name });
        }
    await page.setViewportSize({ width: 320, height: 900 });
    await visit(page, '?long&scale=2');
    await page.screenshot({ path: destination(`${engine}-narrow-200.png`), fullPage: true });
    const sourcePage = await browser.newPage({
      viewport: { width: 640, height: 200 },
      deviceScaleFactor: 4,
    });
    await visit(sourcePage);
    await sourcePage.screenshot({
      path: destination(`${engine}-source-4x.png`),
      clip: { x: 32, y: 32, width: 255, height: 16 },
    });
  } finally {
    await browser.close();
  }
}
await writeFile(new URL('render.generated.json', output), `${JSON.stringify(records, null, 2)}\n`);
