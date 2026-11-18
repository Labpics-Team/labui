import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect, webkit } from '@playwright/test';

const baseURL = process.argv[2] ?? 'http://127.0.0.1:43581';
const output = new URL('../../../docs/evidence/tabs-20261118/', import.meta.url);
await mkdir(output, { recursive: true });
const records = [];
for (const [engine, kind] of Object.entries({ chromium, webkit })) {
  const browser = await kind.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1000 },
      deviceScaleFactor: 2,
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseURL}/tabs.html`);
    await page.evaluate(() => document.fonts.ready);
    for (const theme of ['light', 'dark'])
      for (const scale of [1, 1.25, 2]) {
        await page.evaluate(
          ({ theme, scale }) => {
            document.documentElement.dataset.theme = theme;
            document.documentElement.style.fontSize = `${scale * 100}%`;
          },
          { theme, scale },
        );
        for (const renderer of ['lit', 'react']) {
          const target = page.getByTestId(`${renderer}-tinted-horizontal`);
          await target.screenshot({
            path: fileURLToPath(
              new URL(`${engine}-${renderer}-${theme}-${scale * 100}.png`, output),
            ),
          });
        }
        for (const material of ['solid', 'glass', 'acrylic']) {
          const target = page.getByTestId(`tabs-material-${material}`);
          await expect(target.locator('[data-lab-material-mode]').first()).toHaveAttribute(
            'data-lab-material-mode',
            material,
          );
          const editor = target.locator('textarea');
          await editor.fill('Persistent project draft');
          await target.getByRole('tab', { name: 'Details' }).click();
          await expect(editor).toBeHidden();
          await target.getByRole('tab', { name: 'Draft' }).click();
          await expect(editor).toHaveValue('Persistent project draft');
          if (scale === 1)
            await target.screenshot({
              path: fileURLToPath(new URL(`${engine}-${material}-${theme}.png`, output)),
            });
        }
      }
    // Same two-segment geometry as the author exports; source IDs stay outside the repository.
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.style.fontSize = '100%';
      const host = document.querySelector('[data-testid="lit-tabs"]');
      host.items = [
        { value: 'first', label: 'Label 1' },
        { value: 'second', label: 'Label 2' },
      ];
      host.value = 'first';
      host.style.cssText =
        'position:fixed;inset:0 auto auto 0;width:778px;margin:0;background:white;z-index:9999';
    });
    for (const variant of ['tinted', 'underlined']) {
      await page.getByTestId('lit-tabs').evaluate(async (host, variant) => {
        host.variant = variant;
        await host.updateComplete;
      }, variant);
      await expect(
        page.getByTestId('lit-tabs').locator('[role=tab][data-selected] > .lab-tabs-active'),
      ).toHaveCSS('opacity', '1');
      await page
        .getByTestId('lit-tabs')
        .locator('[role=tablist]')
        .screenshot({ path: fileURLToPath(new URL(`${engine}-source-${variant}.png`, output)) });
    }
    assert.deepEqual(errors, []);
    records.push({
      engine,
      browser: browser.version(),
      themes: ['light', 'dark'],
      fontScales: [1, 1.25, 2],
      materials: ['solid', 'glass', 'acrylic'],
      sourceComparisonScale: 2,
      errors,
    });
  } finally {
    await browser.close();
  }
}
await writeFile(new URL('render.generated.json', output), `${JSON.stringify(records, null, 2)}\n`);
