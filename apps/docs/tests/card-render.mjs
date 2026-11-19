import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const baseURL = process.argv[2] ?? 'http://127.0.0.1:4328';
const output = new URL('../../../docs/evidence/card-20261117/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const measurements = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
    deviceScaleFactor: 2,
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseURL}/card.html`);
  await expect(page.getByTestId('react-source')).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('img')].map((image) => image.decode()));
  });
  for (const theme of ['light', 'dark']) {
    for (const material of ['solid', 'acrylic', 'glass']) {
      await page.evaluate(
        ({ theme, material }) => {
          document.documentElement.dataset.theme = theme;
          document.documentElement.dataset.material = material;
        },
        { theme, material },
      );
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      for (const renderer of ['lit', 'react']) {
        const host = page.getByTestId(`${renderer}-source`);
        await host.scrollIntoViewIfNeeded();
        // Align the specimen to device pixels without changing its dimensions.
        // Fractional page layout must not add a row to the screenshot crop.
        await host.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          element.style.translate = `${Math.round(rect.x) - rect.x}px ${Math.round(rect.y) - rect.y}px`;
        });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
        measurements.push({ theme, material, renderer, rect: await host.boundingBox() });
        await host.screenshot({
          path: fileURLToPath(new URL(`${renderer}-${theme}-${material}.png`, output)),
        });
        await host.evaluate((element) => element.style.removeProperty('translate'));
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(
    new URL('render.json', output),
    `${JSON.stringify({ browser: browser.version(), errors, measurements }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}
