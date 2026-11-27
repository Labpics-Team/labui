import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect, webkit } from '@playwright/test';

const baseURL = process.argv[2] ?? 'http://127.0.0.1:4334';
const output = new URL('../../../docs/evidence/accordion-20261119/', import.meta.url);
await mkdir(output, { recursive: true });
const records = [];
for (const [engine, kind] of Object.entries({ chromium, webkit })) {
  const browser = await kind.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 1100 },
      deviceScaleFactor: 2,
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseURL}/accordion.html`);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
      document.body.style.background = 'white';
    });
    for (const renderer of ['lit', 'react'])
      for (const expanded of [false, true]) {
        const host = page.getByTestId(`${renderer}-source-${expanded}`);
        await host.evaluate((node) => {
          node.style.cssText =
            'position:fixed;left:0;top:0;width:503px;background:white;z-index:9999';
        });
        const item = host.locator('.lab-accordion-item');
        for (const hover of [false, true]) {
          if (hover) await item.hover();
          else await page.mouse.move(1000, 1000);
          const box = await item.boundingBox();
          assert.equal(box.width, 503);
          assert.equal(box.height, expanded ? 88 : 56);
          await item.screenshot({
            path: fileURLToPath(
              new URL(
                `${engine}-${renderer}-${expanded ? 'open' : 'closed'}-${hover ? 'hover' : 'rest'}.png`,
                output,
              ),
            ),
          });
        }
        await host.evaluate((node) => {
          node.style.cssText = 'width:503px';
        });
      }
    for (const theme of ['light', 'dark'])
      for (const scale of [1, 2]) {
        await page.evaluate(
          ({ theme, scale }) => {
            document.documentElement.dataset.theme = theme;
            document.documentElement.style.fontSize = `${scale * 100}%`;
            document.body.style.background = '';
          },
          { theme, scale },
        );
        for (const renderer of ['lit', 'react']) {
          const host = page.getByTestId(`${renderer}-source-true`);
          await host.evaluate((node) => {
            node.style.width = '320px';
          });
          const item = host.locator('.lab-accordion-item');
          const body = item.locator('.lab-accordion-body');
          const [itemBox, bodyBox] = await Promise.all([item.boundingBox(), body.boundingBox()]);
          assert.ok(bodyBox.width > 0 && itemBox.height >= 88 * scale);
          assert.ok(await body.evaluate((node) => node.scrollWidth <= node.clientWidth));
          await item.screenshot({
            path: fileURLToPath(
              new URL(`${engine}-${renderer}-${theme}-${scale * 100}.png`, output),
            ),
          });
          await expect(item.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
        }
      }
    assert.deepEqual(errors, []);
    records.push({
      engine,
      browser: browser.version(),
      sourceWidth: 503,
      sourceHeights: [56, 88],
      themes: ['light', 'dark'],
      fontScales: [1, 2],
      narrowWidth: 320,
      errors,
    });
  } finally {
    await browser.close();
  }
}
await writeFile(new URL('render.generated.json', output), `${JSON.stringify(records, null, 2)}\n`);
