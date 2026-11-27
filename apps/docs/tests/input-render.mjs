import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const baseURL = process.argv[2] ?? 'http://127.0.0.1:4328';
const output = new URL('../../../docs/evidence/input-20261117/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseURL}/input.html`);
  await expect(page.locator('[data-testid="react-neutral"] input')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const theme of ['dark', 'light']) {
    await page.locator('#theme-select').selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    for (const renderer of ['lit', 'react']) {
      await page.locator(`[data-testid="${renderer}-renderer"]`).screenshot({
        path: fileURLToPath(new URL(`${renderer}-${theme}.png`, output)),
      });
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(
    new URL('render.json', output),
    `${JSON.stringify({ browser: browser.version(), errors }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}
