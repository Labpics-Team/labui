import { type Locator, expect, test } from '@playwright/test';

async function composingEscape(input: Locator) {
  await input.evaluate(async (el) => {
    el.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        isComposing: true,
        keyCode: 229,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    await new Promise<void>((done) =>
      requestAnimationFrame(() => requestAnimationFrame(() => done())),
    );
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/dialog-family.html');
});
for (const renderer of ['Lit', 'React']) {
  test(`${renderer}: modal task retains draft and returns focus`, async ({ page }) => {
    const trigger = page.getByRole('button', { name: `${renderer} dialog`, exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Настройки', exact: true });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const input = page.getByRole('textbox', { name: `${renderer} dialog draft`, exact: true });
    await input.fill('Keep this draft');
    await composingEscape(input);
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Outside', exact: true })).not.toBeFocused();
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(input).toHaveValue('Keep this draft');
  });
  test(`${renderer}: child Escape keeps the parent task open`, async ({ page }) => {
    await page.getByRole('button', { name: `${renderer} dialog`, exact: true }).click();
    const trigger = page.getByRole('button', { name: `${renderer} nested popover`, exact: true });
    await trigger.click();
    const child = page.getByRole('dialog', { name: 'Дополнительно', exact: true });
    await expect(child).toBeVisible();
    const input = page.getByRole('textbox', { name: `${renderer} nested draft`, exact: true });
    await input.focus();
    await composingEscape(input);
    await expect(child).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Настройки', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(child).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Настройки', exact: true })).toBeVisible();
    await expect(trigger).toBeFocused();
  });
}
