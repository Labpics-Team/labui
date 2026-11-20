import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/dialog-family.html');
});
for (const renderer of ['Lit', 'React']) {
  test(`${renderer}: safe focus and confirmation waits for completion`, async ({ page }) => {
    const trigger = page.getByRole('button', { name: `${renderer} alert`, exact: true });
    await trigger.click();
    const dialog = page.getByRole('alertdialog');
    const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
    await expect(cancel).toBeFocused();
    await page.mouse.click(2, 2);
    await expect(dialog).toBeVisible();
    const confirm = page.getByRole('button', { name: 'Continue', exact: true });
    await confirm.click();
    await expect(confirm).toBeDisabled();
    await expect(dialog).toBeVisible();
    await cancel.click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}
