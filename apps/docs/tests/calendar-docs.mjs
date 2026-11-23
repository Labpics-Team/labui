import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const evidence = new URL('../../../docs/evidence/calendar-20261123/', import.meta.url);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const route = '/components.html?component=calendar';
  await page.goto(`${process.env.PW_DOCS_URL ?? 'http://127.0.0.1:4428'}${route}`);
  await expect(
    page.getByRole('heading', { name: 'lab-calendar — Calendar', exact: true }),
  ).toBeVisible();
  const calendar = page
    .locator('lab-calendar')
    .filter({ has: page.getByRole('grid', { name: /^Даты исследования,/ }) })
    .last();
  await expect(calendar).toHaveCount(1);
  const cells = calendar.locator('.lab-calendar-day:not([aria-disabled="true"])');
  await cells.nth(5).click();
  await cells.nth(8).click();
  const value = await calendar.evaluate((el) => el.selectedDates);
  expect(value).toHaveLength(2);
  await expect(calendar.locator('[data-active]')).toHaveCount(4);
  const matrixWidths = await page
    .locator('.matrix-cell lab-calendar [data-lab-calendar]')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  expect(matrixWidths).toEqual([320, 400, 320, 400]);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: fileURLToPath(new URL('docs-page.png', evidence)) });
  const responsive = [];
  for (const scale of [100, 200]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate((scale) => {
      document.documentElement.style.fontSize = `${(16 * scale) / 100}px`;
    }, scale);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await calendar.scrollIntoViewIfNeeded();
    await page.screenshot({ path: fileURLToPath(new URL(`docs-narrow-${scale}.png`, evidence)) });
    responsive.push({
      scale,
      documentWidth: await page.evaluate(() => document.documentElement.scrollWidth),
      calendarWidth: await calendar.evaluate((el) => el.getBoundingClientRect().width),
    });
  }
  expect(errors).toEqual([]);
  await writeFile(
    new URL('docs-page.json', evidence),
    `${JSON.stringify({ route, browser: browser.version(), rangeSelection: value, matrixWidths, responsive, errors }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}
