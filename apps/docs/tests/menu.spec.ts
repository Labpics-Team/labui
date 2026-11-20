import { type Locator, type Page, expect, test } from '@playwright/test';

const panel = (host: Locator) => host.locator('.lab-menu-content').first();
const row = (host: Locator, value: string) => host.locator(`[data-menu-value="${value}"]`);
async function open(host: Locator) {
  await host.locator('.lab-menu-trigger').click();
  await expect(panel(host)).toBeVisible();
  await expect(panel(host)).toBeFocused();
}
async function update(page: Page, key: string, change: string) {
  await page.evaluate(
    ({ key, change }) =>
      (window as unknown as { menuUpdate: Record<string, (v: string) => void> }).menuUpdate[key]?.(
        change,
      ),
    { key, change },
  );
}
test.beforeEach(async ({ page }) => {
  await page.goto('/menu.html');
});
for (const renderer of ['lit', 'react']) {
  test(`${renderer}: keyboard, disabled rows, selection and focus restoration`, async ({
    page,
  }) => {
    const host = page.getByTestId(`${renderer}-menu`);
    await open(host);
    await page.keyboard.press('Home');
    await expect(row(host, 'edit')).toHaveAttribute('data-highlighted');
    await page.keyboard.press('ArrowDown');
    await expect(row(host, 'guides')).toHaveAttribute('data-highlighted');
    await page.keyboard.press('Enter');
    await expect(row(host, 'guides')).toHaveAttribute('aria-checked', 'true');
    await row(host, 'large').click();
    await expect(row(host, 'large')).toHaveAttribute('aria-checked', 'true');
    await expect(row(host, 'small')).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');
    await expect(panel(host)).toBeHidden();
    await expect(host.locator('.lab-menu-trigger')).toBeFocused();
    await open(host);
    await row(host, 'edit').click();
    await expect(panel(host)).toBeHidden();
    await expect(page.locator('#event-log')).toContainText('edit');
    await expect(
      page.getByTestId(`${renderer}-disabled`).locator('.lab-menu-trigger'),
    ).toBeDisabled();
  });
  test(`${renderer}: two nested levels and submenu keyboard return`, async ({ page }) => {
    const host = page.getByTestId(`${renderer}-menu`);
    await open(host);
    await page.keyboard.press('s');
    await expect(row(host, 'guides')).toHaveAttribute('data-highlighted');
    await row(host, 'share').hover();
    const submenu = host.locator('.lab-menu-content').nth(1);
    await expect(submenu).toBeVisible();
    await submenu.focus();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowRight');
    const nested = host.locator('.lab-menu-content').nth(2);
    await expect(nested).toBeVisible();
    await expect(nested).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(nested).toBeHidden();
    await expect(submenu).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel(host)).toBeHidden();
  });
  test(`${renderer}: context pointer and keyboard invocation`, async ({ page }) => {
    const host = page.getByTestId(`${renderer}-context`);
    const target = host.locator('[data-menu-trigger]');
    await host.locator('.context-target').click({ button: 'right', position: { x: 20, y: 20 } });
    await expect(panel(host)).toBeVisible();
    await expect(panel(host)).toBeFocused();
    const triggerBox = await target.boundingBox();
    if (!triggerBox) throw new Error('Context trigger is hidden');
    await expect
      .poll(async () =>
        Math.abs(((await panel(host).boundingBox())?.x ?? Number.NaN) - (triggerBox.x + 20)),
      )
      .toBeLessThan(5);
    await page.keyboard.press('Escape');
    await target.focus();
    await page.keyboard.press('Shift+F10');
    await expect(panel(host)).toBeVisible();
    await expect(panel(host)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel(host)).toBeHidden();
    await expect(target).toBeFocused();
    await page.keyboard.press('Shift+F10');
    await expect(panel(host)).toBeVisible();
    await page.locator('#outside').click();
    await expect(panel(host)).toBeHidden();
  });
  test(`${renderer}: menubar roving, disabled skip, switch and RTL`, async ({ page }) => {
    const host = page.getByTestId(`${renderer}-menubar`);
    const file = host.getByRole('menuitem', { name: 'File', exact: true });
    const view = host.getByRole('menuitem', { name: 'View', exact: true });
    await file.focus();
    await page.keyboard.press('ArrowRight');
    await expect(view).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(host.getByRole('menu', { name: 'View', exact: true })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(host.getByRole('menu', { name: 'File', exact: true })).toBeVisible();
    await expect(host.locator('.lab-menu-content[data-state="open"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await update(page, `${renderer}-menubar`, 'rtl');
    await file.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(view).toBeFocused();
  });
  test(`${renderer}: controlled state waits for consumer`, async ({ page }) => {
    const host = page.getByTestId(`${renderer}-controlled`);
    await host.locator('.lab-menu-trigger').click();
    await expect(panel(host)).toBeHidden();
    await update(page, `${renderer}-controlled`, 'controlled-open');
    await expect(panel(host)).toBeVisible();
    await row(host, 'guides').click();
    await expect(row(host, 'guides')).toHaveAttribute('aria-checked', 'false');
  });
  test(`${renderer}: disabling an expanded parent closes its whole branch`, async ({ page }) => {
    const host = page.getByTestId(`${renderer}-menu`);
    await open(host);
    await row(host, 'share').hover();
    await expect(host.locator('.lab-menu-content').nth(1)).toBeVisible();
    await row(host, 'export').hover();
    await expect(host.locator('.lab-menu-content').nth(2)).toBeVisible();
    await update(page, `${renderer}-menu`, 'disable-submenu');
    await expect(host.locator('.lab-menu-content').nth(1)).toBeHidden();
    await expect(host.locator('.lab-menu-content').nth(2)).toBeHidden();
    await expect(row(host, 'share')).toHaveAttribute('aria-disabled', 'true');
    await expect(panel(host)).toBeVisible();
  });
  test(`${renderer}: forward arrow on a nested leaf switches menubar roots`, async ({ page }) => {
    const host = page.getByTestId(`${renderer}-menubar`);
    await host.locator('.lab-menubar-item').first().click();
    await expect(panel(host)).toBeFocused();
    await row(host, 'share').hover();
    const child = host.locator('.lab-menu-content').nth(1);
    await expect(child).toBeVisible();
    await child.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await expect(host.getByRole('menu', { name: 'View', exact: true })).toBeVisible();
    await expect(child).toBeHidden();
    await expect(panel(host)).toBeHidden();
  });
  test(`${renderer}: stable rows on reorder, disabled highlight and removed submenu`, async ({
    page,
  }) => {
    const host = page.getByTestId(`${renderer}-menu`);
    await open(host);
    await page.keyboard.press('Home');
    const handle = await row(host, 'edit').elementHandle();
    await update(page, `${renderer}-menu`, 'reorder');
    await expect(row(host, 'edit')).toContainText('Rename');
    expect(await row(host, 'edit').evaluate((node, old) => node === old, handle)).toBe(true);
    await update(page, `${renderer}-menu`, 'disable');
    await expect(row(host, 'edit')).not.toHaveAttribute('data-highlighted');
    await update(page, `${renderer}-menu`, 'remove-submenu');
    await expect(row(host, 'share')).toHaveCount(0);
    await expect(panel(host)).toBeVisible();
  });
  test(`${renderer}: authored geometry, materials and local top layer`, async ({ page }) => {
    const host = page.getByTestId(`${renderer}-menu`);
    await host.evaluate((el) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'lab-scope';
      dialog.setAttribute('data-theme', 'dark');
      const clip = document.createElement('div');
      clip.className = 'clipped';
      if (!el.parentNode) throw new Error('Detached menu fixture');
      el.parentNode.insertBefore(dialog, el);
      clip.append(el);
      dialog.append(clip);
      dialog.showModal();
    });
    await open(host);
    await expect(host.locator('.lab-menu-positioner').first()).toHaveJSProperty(
      'popover',
      'manual',
    );
    const geometry = await panel(host).evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        width: el.getBoundingClientRect().width,
        radius: s.borderRadius,
        font: s.fontSize,
        shadow: s.getPropertyValue('--lab-material-shadow'),
        mode: el.parentElement?.getAttribute('data-lab-material-mode'),
      };
    });
    expect(geometry.width).toBe(256);
    expect(geometry.radius).toBe('12px');
    expect(geometry.font).toBe('16px');
    expect(geometry.mode).toBe('acrylic');
    expect(geometry.shadow).not.toBe('none');
    expect(geometry.shadow.trim()).not.toBe('');
    await row(host, 'delete').click();
    await expect(panel(host)).toBeHidden();
  });
}
