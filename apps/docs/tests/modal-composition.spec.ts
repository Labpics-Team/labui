import { type Page, expect, test } from '@playwright/test';
import { modalFocus } from './helpers/modal-focus.js';

const portal = (page: Page, id: string) => page.locator(`[data-portal-for="${id}"]`);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/_fixtures/modal-composition.html');
  await expect(page.locator('html')).toHaveAttribute('data-modal-composition-ready', 'true');
});

for (const id of ['lit', 'vue', 'solid', 'react'] as const) {
  test(`${id}: consumer DOM, CSS, делегированные события и форма сохраняют своего владельца`, async ({
    page,
  }) => {
    const before = await page.evaluate((id) => window.modalCompositionFixture.inspect(id), id);
    expect(before.documentOwned).toBe(true);
    expect(before.parentPreserved).toBe(true);
    expect(before).toMatchObject({
      background: 'rgb(12, 123, 45)',
      minHeight: '144px',
      padding: '16px',
      border: '3px',
      marginTop: '11px',
      borderBottom: id === 'vue' ? '7px' : '3px',
    });

    const host = page.getByTestId(id);
    await host.locator('.trigger').click();
    await expect(portal(page, id).locator('.content')).toBeVisible();
    await expect.poll(() => portal(page, id).evaluate(modalFocus)).toMatchObject({ inside: true });
    const reached = new Set<string>();
    for (let step = 0; step < 6; step++) {
      await page.keyboard.press('Tab');
      const focus = await portal(page, id).evaluate(modalFocus);
      expect(focus.inside).toBe(true);
      reached.add(focus.id);
    }
    expect(reached.has(`${id}-name`)).toBe(true);
    expect(reached.has(`${id}-action`)).toBe(true);
    await host.locator(`#${id}-name`).fill('Несохранённое имя');
    await host.locator(`#${id}-action`).click();
    expect(await page.evaluate((id) => window.modalCompositionFixture.counters[id], id)).toBe(1);
    await expect(host).toHaveAttribute('open', '');

    const panel = portal(page, id).locator('.content');
    const height = (await panel.boundingBox())?.height;
    expect(height).toBeDefined();
    await page.evaluate(() => {
      const sheet = (document.getElementById('consumer-rules') as HTMLStyleElement).sheet;
      (sheet?.cssRules[0] as CSSStyleRule).style.setProperty('min-height', '240px');
    });
    await expect
      .poll(async () => ((await panel.boundingBox())?.height ?? 0) - (height ?? 0))
      .toBeCloseTo(96, 1);

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(host.locator('.trigger')).toBeFocused();
    await host.locator('.trigger').click();
    await expect(host.locator(`#${id}-name`)).toHaveValue('Несохранённое имя');
    const after = await page.evaluate((id) => window.modalCompositionFixture.inspect(id), id);
    expect(after.documentOwned).toBe(true);
    expect(after.parentPreserved).toBe(true);
  });
}

test('React заменяет содержимое уже открытой панели и сохраняет делегированное действие', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const host = page.getByTestId('react');
  await host.locator('.trigger').click();
  await expect(portal(page, 'react').locator('.content')).toBeVisible();
  await page.evaluate(() => window.modalCompositionFixture.replaceReactBody());
  expect(
    await page.evaluate(() => window.modalCompositionFixture.originalReactBodyConnected()),
  ).toBe(false);
  await expect(host.locator('#react-action')).toHaveText('Сохранить заново');
  await host.locator('#react-action').click();
  expect(await page.evaluate(() => window.modalCompositionFixture.counters.react)).toBe(1);
  await expect(host).toHaveAttribute('open', '');
  expect(errors).toEqual([]);
});
