import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect, webkit } from '@playwright/test';

const baseURL = process.argv[2] ?? 'http://127.0.0.1:43579';
const output = new URL('../../../docs/evidence/textarea-20261118/', import.meta.url);
await mkdir(output, { recursive: true });
const records = [];
for (const [engine, kind] of Object.entries({ chromium, webkit })) {
  const browser = await kind.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseURL}/textarea.html`);
    await expect(page.getByTestId('react-neutral').locator('textarea')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    for (const theme of ['light', 'dark']) {
      await page.locator('#theme-select').selectOption(theme);
      for (const renderer of ['lit', 'react']) {
        await page.getByTestId(`${renderer}-renderer`).screenshot({
          path: fileURLToPath(new URL(`${engine}-${renderer}-${theme}.png`, output)),
        });
        const active = page.getByTestId(`${renderer}-neutral`).locator('textarea');
        await active.fill('Input text');
        await active.focus();
        await active.scrollIntoViewIfNeeded();
        const activeBox = await page.getByTestId(`${renderer}-neutral`).boundingBox();
        await page.screenshot({
          path: fileURLToPath(new URL(`${engine}-${renderer}-${theme}-active.png`, output)),
          clip: {
            x: Math.max(0, activeBox.x - 12),
            y: Math.max(0, activeBox.y - 16),
            width: activeBox.width + 24,
            height: activeBox.height + 32,
          },
        });
        await active.fill('');
        await active.blur();
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
      const label = 'Описание проекта и материалов для публикации';
      const host = document.querySelector('[data-testid="lit-neutral"]');
      host.label = label;
      const field = document.querySelector('[data-testid="react-neutral"]');
      field.querySelector('.lab-field-label-text').textContent = label;
      field.querySelector('legend').textContent = label;
    });
    for (const renderer of ['lit', 'react']) {
      const host = page.getByTestId(`${renderer}-neutral`);
      await host.scrollIntoViewIfNeeded();
      const box = await host.boundingBox();
      await page.screenshot({
        path: fileURLToPath(new URL(`${engine}-${renderer}-dark-390-200.png`, output)),
        clip: {
          x: Math.max(0, box.x - 8),
          y: Math.max(0, box.y - 24),
          width: box.width + 16,
          height: box.height + 48,
        },
      });
    }
    records.push({
      engine,
      browser: browser.version(),
      themes: ['light', 'dark'],
      narrow: { width: 390, fontScale: 2 },
      errors,
    });
    if (errors.length) throw new Error(errors.join('\n'));
  } finally {
    await browser.close();
  }
}
await writeFile(new URL('render.json', output), `${JSON.stringify(records, null, 2)}\n`);
