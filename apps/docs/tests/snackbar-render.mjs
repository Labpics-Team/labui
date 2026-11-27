import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const baseURL = process.argv[2] ?? 'http://127.0.0.1:4327';
const output = new URL('../../../docs/evidence/snackbar-20261117/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const measurements = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 2,
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const time = new Date('2026-11-17T12:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.goto(`${baseURL}/snackbar.html`);
  await page.waitForFunction(() => window.snackbarControls?.react);
  await page.evaluate(() => document.fonts.ready);
  for (const theme of ['light', 'dark']) {
    for (const material of ['solid', 'acrylic', 'glass']) {
      await page.evaluate(
        ({ theme, material }) => {
          document.documentElement.dataset.theme = theme;
          document.documentElement.dataset.material = material;
          for (const control of Object.values(window.snackbarControls)) control.show();
        },
        { theme, material },
      );
      await page.clock.runFor(1000);
      for (const renderer of ['lit', 'react']) {
        const panel = page.getByTestId(`${renderer}-snackbar`).locator('[data-lab-snackbar]');
        await expect(panel.locator('.lab-snackbar-count')).toHaveText('4');
        measurements.push({ theme, material, renderer, rect: await panel.boundingBox() });
        await panel.screenshot({
          path: fileURLToPath(new URL(`${renderer}-${theme}-${material}.png`, output)),
        });
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const runtimeErrors = await page.evaluate(() => window.snackbarErrors);
  if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
  await writeFile(
    new URL('render.json', output),
    `${JSON.stringify({ browser: browser.version(), errors, measurements }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}
