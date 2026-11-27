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
const scenes = [
  { name: 'desktop', width: 1280, height: 900, scale: 100 },
  { name: 'mobile', width: 390, height: 844, scale: 100 },
  { name: 'mobile-125', width: 390, height: 844, scale: 125 },
  { name: 'mobile-200', width: 390, height: 844, scale: 200 },
  { name: 'small-200', width: 320, height: 844, scale: 200 },
];
try {
  for (const { name: device, width, height, scale } of scenes) {
    const viewport = { width, height };
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseURL}/experience.html`);
    await page.getByRole('switch', { name: 'Тёмная тема' }).waitFor();
    await expect(page.getByRole('switch', { name: 'Тёмная тема' })).toBeEnabled();
    await page.getByRole('button', { name: 'Изменить настройки' }).waitFor();
    await page.evaluate(async (scale) => {
      document.documentElement.style.fontSize = `${(16 * scale) / 100}px`;
      await document.fonts.ready;
    }, scale);
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
        fullPage: false,
      });
      if (scale > 100) {
        await page.getByRole('textbox', { name: 'Почта для уведомлений' }).scrollIntoViewIfNeeded();
        await page.screenshot({
          path: fileURLToPath(new URL(`sheet-${device}-${theme}-email.png`, output)),
        });
      }
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await expect(page.getByRole('button', { name: 'Изменить настройки' })).toBeFocused();
    }
    await context.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(
    new URL('render.generated.json', output),
    `${JSON.stringify(
      {
        browser: browser.version(),
        scenes,
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
