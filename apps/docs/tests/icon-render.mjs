import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:4337';
const output = new URL('../../../docs/evidence/icon-20261119/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const records = [];
try {
  for (const width of [1000, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/experience.html`);
    await expect(page.getByRole('button', { name: 'Изменить настройки' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Тёмная тема' })).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    for (const scale of [100, 125, 200]) {
      const scaleInput = page.getByRole('radio', { name: `${scale}%`, exact: true });
      await scaleInput.focus();
      await scaleInput.press('Space');
      for (const theme of ['light', 'dark']) {
        const toggle = page.getByRole('switch', { name: 'Тёмная тема' });
        if ((await toggle.isChecked()) !== (theme === 'dark')) {
          await toggle.focus();
          await toggle.press('Space');
        }
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const metrics = await page.locator('.workspace-icon-state').evaluate((node) => ({
          text: getComputedStyle(node).fontSize,
          icon: node.querySelector('svg').getBoundingClientRect().width,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        }));
        assert.equal(metrics.text, `${(16 * scale) / 100}px`);
        assert.equal(metrics.icon, (20 * scale) / 100);
        assert.equal(metrics.overflow, false);
        await page.screenshot({
          path: fileURLToPath(new URL(`experience-${width}-${scale}-${theme}.png`, output)),
          fullPage: true,
        });
        records.push({ width, scale, theme, ...metrics });
      }
    }
    await page.getByRole('button', { name: 'Изменить настройки' }).click();
    const notifications = page
      .getByRole('dialog')
      .getByRole('switch', { name: 'Уведомления команды' });
    const wasChecked = await notifications.isChecked();
    await notifications.focus();
    await notifications.press('Space');
    if (!wasChecked)
      await page.getByRole('textbox', { name: 'Почта для уведомлений' }).fill('team@example.com');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.locator('.workspace-icon-state')).toContainText(
      wasChecked ? 'Выключены' : 'Включены',
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  await writeFile(
    new URL('render.json', output),
    `${JSON.stringify({ browser: browser.version(), records }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}
