import { expect, test } from '@playwright/test';

test('authored first frame works without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/colors.html');
    await expect(page.locator('#theme-sample h2')).toHaveCSS('color', 'rgb(16, 16, 18)');
    await expect(page.locator('#theme-neighbor h2')).toHaveCSS('color', 'rgb(246, 248, 250)');
  } finally {
    await context.close();
  }
});

test('theme layout keeps content at 100% and 200% on narrow and wide screens', async ({ page }) => {
  await page.goto('/colors.html');
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const fontSize of ['16px', '32px']) {
      await page.locator('html').evaluate((element, value) => {
        element.style.fontSize = value;
      }, fontSize);
      const widths = await page.locator('.theme-grid').evaluate((element) => ({
        scroll: element.scrollWidth,
        width: element.clientWidth,
      }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.width);
    }
  }
});

test('scoped update, rejection, recovery and disposal preserve the actual DOM', async ({
  page,
}) => {
  await page.goto('/_fixtures/colors-scope.html');
  await page.waitForFunction(() => !!window.colorsProof);
  const neighbor = await page.locator('#neighbor').evaluate((element) => element.outerHTML);
  const original = await page.locator('#scope').getAttribute('style');
  expect(await page.evaluate(() => window.colorsProof.update({ theme: 'dark' }))).toBe(true);
  await expect(page.locator('#scope h2')).toHaveCSS('color', 'rgb(246, 248, 250)');
  await expect(page.locator('#shadow-host span')).toHaveCSS('color', 'rgb(246, 248, 250)');
  expect(await page.locator('#neighbor').evaluate((element) => element.outerHTML)).toBe(neighbor);
  expect(
    await page.evaluate(() => window.colorsProof.update({ theme: 'light', contrast: 'more' })),
  ).toBe(true);
  const before = await page.locator('#scope').evaluate((element) => element.outerHTML);
  expect(
    await page.evaluate(() =>
      window.colorsProof.update({
        backgrounds: [
          [0, 0, 0],
          [255, 255, 255],
        ],
      }),
    ),
  ).toBe(false);
  expect(await page.locator('#scope').evaluate((element) => element.outerHTML)).toBe(before);
  expect(await page.evaluate(() => window.colorsProof.errors.length)).toBe(1);
  expect(await page.evaluate(() => window.colorsProof.update({ backgrounds: [[0, 0, 0]] }))).toBe(
    true,
  );
  await expect(page.locator('#shadow-host span')).toHaveCSS('color', 'rgb(246, 248, 250)');
  await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>('#scope');
    if (element) element.style.padding = '37px';
    window.colorsProof.scope.dispose();
    window.colorsProof.scope.dispose();
  });
  await expect(page.locator('#scope')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#scope h2')).toHaveCSS('color', 'rgb(16, 16, 18)');
  await expect(page.locator('#scope')).toHaveCSS('padding', '37px');
  expect(
    await page.locator('#scope').evaluate((element) => element.getAttribute('style')),
  ).not.toBe(original);
  expect(
    await page.locator('#scope').evaluate((element) => element.getAttribute('style')),
  ).not.toContain('--lab-');
});

test('the documented theme controls update a real LabUI button and keep the neighbor', async ({
  page,
}) => {
  await page.goto('/colors.html');
  await expect(page.locator('#theme-status')).toHaveText('Тема этой области обновлена.');
  const neighbor = await page
    .locator('#theme-neighbor')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect(page.locator('#sample-primary button')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.locator('#theme-choice').selectOption('dark');
  await expect(page.locator('#theme-sample')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#sample-primary button')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.locator('#contrast-choice').check();
  await expect(page.locator('#theme-sample')).toHaveAttribute('data-contrast', 'more');
  expect(
    await page
      .locator('#theme-neighbor')
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe(neighbor);
});
