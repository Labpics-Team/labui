import { type Page, expect, test } from '@playwright/test';

async function load(page: Page): Promise<void> {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto('/_fixtures/veil-length.html');
  await page.waitForFunction(() => !!window.__veilLength);
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      }),
  );
}

async function strength(page: Page, expected: number): Promise<void> {
  await expect
    .poll(async () => {
      const actual = await page.evaluate(() => window.__veilLength.snapshot().strength);
      return Math.abs(actual - expected);
    })
    .toBeLessThanOrEqual(0.02);
}

test('rem и медиа меняют радиус при неизменном боксе поверхности', async ({ page }) => {
  await load(page);
  await strength(page, 24);
  await page.evaluate(() => window.__veilLength.font(32));
  await strength(page, 48);
  await page.setViewportSize({ width: 1200, height: 600 });
  await strength(page, 64);
});

test('px-числа прежнего API обновляются через тот же контекст', async ({ page }) => {
  await load(page);
  await page.evaluate(() => window.__veilLength.strength('32'));
  await strength(page, 32);
  await page.evaluate(() => window.__veilLength.strength('40'));
  await strength(page, 40);
});

test('feather принимает CSS-длину, эффект восстанавливается и освобождается', async ({ page }) => {
  await load(page);
  await page.evaluate(() => window.__veilLength.feather('0.5rem'));
  await settle(page);
  const rem = await page.evaluate(() => window.__veilLength.snapshot().masks);
  await page.evaluate(() => window.__veilLength.feather('8px'));
  await expect.poll(() => page.evaluate(() => window.__veilLength.snapshot().masks)).toEqual(rem);
  await page.evaluate(() => window.__veilLength.replace());
  await strength(page, 24);
  await page.evaluate(() => window.__veilLength.dispose());
  expect(await page.evaluate(() => window.__veilLength.snapshot())).toMatchObject({
    count: 0,
    children: 0,
  });
});

test('проценты не превращаются в px и не оставляют старый blur', async ({ page }) => {
  await load(page);
  await strength(page, 24);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.evaluate(() => window.__veilLength.strength('50%'));
  await expect
    .poll(async () => (await page.evaluate(() => window.__veilLength.snapshot())).count)
    .toBe(0);
  expect(errors.some((message) => message.includes('--lab-veil-strength'))).toBe(true);
  await page.evaluate(() => window.__veilLength.strength('1.5rem'));
  await strength(page, 24);
});
