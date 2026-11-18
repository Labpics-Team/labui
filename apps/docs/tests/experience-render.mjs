import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';

const baseURL = process.argv[2] ?? 'http://127.0.0.1:4328';
const output = process.argv[3]
  ? pathToFileURL(`${process.argv[3].replace(/\\/g, '/').replace(/\/$/, '')}/`)
  : new URL('../../../docs/evidence/experience-20261118/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const errors = [];
try {
  for (const [device, viewport] of Object.entries({
    desktop: { width: 1280, height: 900 },
    mobile: { width: 390, height: 844 },
  })) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseURL}/experience.html`);
    await page.getByRole('switch', { name: 'Тёмная тема' }).waitFor();
    await expect(page.getByRole('switch', { name: 'Тёмная тема' })).toBeEnabled();
    await page.getByRole('button', { name: 'Изменить настройки' }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') {
        const dark = page.getByRole('switch', { name: 'Тёмная тема' });
        await dark.focus();
        await dark.press('Space');
      }
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.screenshot({
        path: fileURLToPath(new URL(`${device}-${theme}.png`, output)),
        fullPage: true,
      });
      await page.getByRole('button', { name: 'Изменить настройки' }).click();
      await page.getByRole('dialog').waitFor();
      await page.screenshot({
        path: fileURLToPath(new URL(`sheet-${device}-${theme}.png`, output)),
        fullPage: true,
      });
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    await context.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(
    new URL('render.json', output),
    `${JSON.stringify(
      {
        browser: browser.version(),
        viewport: ['1280×900', '390×844'],
        themes: ['light', 'dark'],
        pageErrors: errors,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await browser.close();
}
