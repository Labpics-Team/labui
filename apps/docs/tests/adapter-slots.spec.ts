import { type Locator, expect, test } from '@playwright/test';

async function dimensions(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Ожидалось видимое содержимое слота');
  return { width: box.width, height: box.height };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/adapter-slots.html');
});

test('Svelte: fill-slot передаёт размер ядра и схлопывается при пустом snippet', async ({
  page,
}) => {
  const badge = page.getByTestId('svelte-badge');
  const bare = page.getByTestId('svelte-bare');
  const icon = badge.locator('svg');
  const toggle = page.getByTestId('svelte-show-icon');

  for (const root of [16, 20]) {
    // Размер ядра — 0.75rem; SVG 24px должен следовать ему при масштабе потребителя.
    await page.evaluate((px) => {
      document.documentElement.style.fontSize = `${px}px`;
    }, root);
    const size = root * 0.75;
    await expect(icon).toBeVisible();
    await expect.poll(() => dimensions(icon)).toEqual({ width: size, height: size });
    const populated = await dimensions(badge);
    expect(populated.width).toBeGreaterThan((await dimensions(bare)).width);

    await toggle.uncheck();
    await expect(icon).toHaveCount(0);
    // Сравнение с тем же Badge без snippet обнаруживает и лишнюю ширину, и gap.
    await expect
      .poll(async () => (await dimensions(badge)).width)
      .toBe((await dimensions(bare)).width);

    await toggle.check();
    await expect(icon).toBeVisible();
    await expect.poll(() => dimensions(icon)).toEqual({ width: size, height: size });
    await expect.poll(() => dimensions(badge)).toEqual(populated);
  }
});

test('Svelte: обычный Button.end сохраняет размер SVG потребителя', async ({ page }) => {
  const button = page.getByTestId('svelte-button');
  await expect(button.getByRole('button', { name: 'Действие' })).toBeVisible();
  for (const show of [true, false, true]) {
    await page.getByTestId('svelte-show-icon').setChecked(show);
    await expect(button.locator('svg')).toBeVisible();
    expect(await dimensions(button.locator('svg'))).toEqual({ width: 24, height: 24 });
  }
});
