import { expect, test } from '@playwright/test';
import { waitForThemePaint } from './helpers/theme-paint.js';

test.use({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });

for (const component of ['card', 'button', 'select']) {
  test(`${component}: catalogue fits mobile at root20 and keeps wide tables reachable`, async ({
    page,
  }) => {
    await page.goto(`/components.html?component=${component}`);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '20px';
    });
    const live = page.getByRole('region', { name: 'Live example', exact: true });
    const specimen = live.locator(`.live-stage > lab-${component}`);
    await waitForThemePaint(page, specimen);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    await live.scrollIntoViewIfNeeded();
    const bounds = await specimen.boundingBox();
    if (!bounds) throw new Error('Live specimen has no visible box');
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
    await expect(page.locator('.doc-sidebar')).toHaveCSS('position', 'static');

    const matrix = page.locator('.matrix-scroll');
    await matrix.scrollIntoViewIfNeeded();
    expect(await matrix.evaluate((e) => e.scrollWidth)).toBeGreaterThan(
      await matrix.evaluate((e) => e.clientWidth),
    );
    await matrix.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => matrix.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);

    if (component === 'select') {
      for (const select of [
        specimen,
        matrix.locator('tbody tr').first().locator('lab-select').last(),
      ]) {
        const trigger = select.getByRole('combobox');
        await trigger.click();
        const listbox = select.getByRole('listbox');
        await expect(listbox).toBeVisible();
        await listbox.getByRole('option', { name: 'Cherry', exact: true }).click();
        await expect(listbox).toBeHidden();
        await expect(trigger).toContainText('Cherry');
        await expect(trigger).toBeFocused();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
      }
    }

    if (component === 'card') {
      const track = specimen.getByTestId('notification-enabled').locator('.control');
      await expect(track).toHaveCSS('width', '45px');
      await expect(track).toHaveCSS('height', '25px');
      const trigger = specimen.getByRole('button', { name: 'Настроить', exact: true });
      await expect(trigger).toHaveCSS('height', '60px');
      await trigger.click();
      const panel = page.getByRole('dialog', { name: 'Настройки уведомлений', exact: true });
      await expect(panel).toBeVisible();
      const box = await panel.boundingBox();
      expect(box?.x).toBe(0);
      expect(box?.width).toBe(375);
      await specimen.getByTestId('settings-done').getByRole('button').click();
      await expect(panel).toBeHidden();
      await expect(trigger).toBeFocused();
    }
  });
}

test('live controls initially show the real component settings', async ({ page }) => {
  await page.goto('/components.html?component=card');
  const card = page.locator('.live-stage > lab-card');
  await expect(card).toBeVisible();
  await expect(page.locator('#live-padding')).toHaveValue('l');
  await expect(card.locator('.card > .content')).toHaveCSS('padding', '24px');
  await page.locator('#live-padding').selectOption('s');
  await expect(card.locator('.card > .content')).toHaveCSS('padding', '8px');

  await page.goto('/components.html?component=button');
  await expect(page.locator('#live-size')).toHaveValue('m');
  await expect(page.locator('.live-stage > lab-button button')).toHaveCSS('height', '48px');

  await page.goto('/components.html?component=switch');
  await expect(page.locator('#live-checked')).toBeChecked();
  await expect(page.locator('#live-disabled')).not.toBeChecked();
  await page.locator('#live-checked').uncheck();
  await expect(page.locator('.live-stage > lab-switch').getByRole('checkbox')).not.toBeChecked();
});
