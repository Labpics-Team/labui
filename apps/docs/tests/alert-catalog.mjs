import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const output = new URL('../../../docs/evidence/alert-20261119/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const records = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 1000 },
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto(
      `${process.env.LABUI_DOCS_URL ?? 'http://127.0.0.1:5377'}/components.html?component=alert`,
    );
    await expect(page.locator('h1')).toHaveText('lab-alert — Alert');
    await page.evaluate(() => document.fonts.ready);
    const live = page.locator('.live-stage');
    const alert = live.locator('lab-alert');
    const show = live.getByRole('button', { name: 'Показать сообщения' });
    const close = alert.getByRole('button', { name: 'Закрыть уведомление' });
    for (const theme of ['light', 'dark']) {
      await page.locator('#ctl-data-theme').selectOption(theme);
      await show.click();
      await expect(alert).toHaveJSProperty('quantity', 3);
      await close.focus();
      for (const heading of ['Экспорт подготовлен', 'Доступ обновлён']) {
        await page.keyboard.press('Enter');
        await expect(alert.locator('.lab-alert-heading')).toHaveText(heading);
        await expect(close).toBeFocused();
      }
      await page.keyboard.press('Space');
      await expect(alert.locator('[data-lab-alert]')).toBeHidden();
      await expect(show).toBeFocused();
      await show.click();
      await expect(alert.locator('.lab-alert-heading')).toHaveText('Изменения сохранены');
      await expect(alert).toHaveJSProperty('quantity', 3);
      await live.screenshot({
        path: new URL(`catalog-live-${theme}-${width}.png`, output).pathname.replace(
          /^\/(\w:)/,
          '$1',
        ),
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: new URL(`catalog-${theme}-${width}.png`, output).pathname.replace(/^\/(\w:)/, '$1'),
      });
      records.push({ width, theme, queueDismissal: true, focusReturn: true, reopen: true });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally {
  await browser.close();
}
await writeFile(new URL('catalog.json', output), `${JSON.stringify(records, null, 2)}\n`);
console.info('Alert catalog: desktop/mobile, both themes, keyboard queue and reopen PASS.');
