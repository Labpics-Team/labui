import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/pagination.html');
  await page.getByTestId('react-pagination').getByLabel('Page 3', { exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
});

test('both renderers change the records, preserve controls, and reject controlled requests', async ({
  page,
}) => {
  for (const prefix of ['lit', 'react']) {
    const pagination = page.getByTestId(`${prefix}-pagination`);
    const fourth = pagination.getByLabel('Page 4', { exact: true });
    await fourth.evaluate((node) => {
      (window as unknown as { paginationIdentity: Element }).paginationIdentity = node;
    });
    await fourth.click();
    await expect(pagination.locator('[aria-current="page"]')).toHaveText('4');
    await expect(page.locator(`#${prefix}-records, [data-testid="${prefix}-records"]`)).toHaveText(
      'Study 10 · Study 11 · Study 12',
    );
    expect(
      await fourth.evaluate(
        (node) =>
          (window as unknown as { paginationIdentity: Element }).paginationIdentity === node,
      ),
    ).toBe(true);
    await pagination.getByLabel('Next page').focus();
    await page.keyboard.press('Space');
    await expect(pagination.locator('[aria-current="page"]')).toHaveText('5');
  }
  const refusal = page.getByTestId('react-pagination-refusal');
  await refusal.getByLabel('Next page').click();
  await expect(page.locator('#refused')).toHaveText('4');
  await expect(refusal.locator('[aria-current="page"]')).toHaveText('3');
  await page.getByTestId('lit-pagination-refusal').getByLabel('Next page').click();
  await expect(
    page.getByTestId('lit-pagination-refusal').locator('[aria-current="page"]'),
  ).toHaveText('3');
});

test('empty, invalid and changed data shapes never expose an out-of-range destination', async ({
  page,
}) => {
  const host = page.getByTestId('lit-pagination');
  await host.evaluate((element) => {
    element.setAttribute('count', '0');
  });
  await expect(host.getByLabel('Previous page')).toBeDisabled();
  await expect(host.getByLabel('Next page')).toBeDisabled();
  await expect(host.locator('[data-page]')).toHaveCount(0);
  await host.evaluate((element) => {
    element.setAttribute('count', '20');
    element.setAttribute('page', '100');
    element.setAttribute('page-size', '0');
  });
  await expect(host.locator('[aria-current]')).toHaveText('2');
  await expect(host.getByLabel('Next page')).toBeDisabled();
  await host.evaluate((element) => {
    element.setAttribute('count', 'NaN');
  });
  await expect(host.locator('[data-page]')).toHaveCount(0);
});

test('compact keyboard crosses its moving window and follows RTL', async ({ page }) => {
  for (const prefix of ['lit', 'react']) {
    const host = page.getByTestId(`${prefix}-compact`);
    await host.getByLabel('Page 3', { exact: true }).focus();
    await page.keyboard.press('End');
    await expect(host.locator('[aria-current]')).toHaveAttribute('data-page', '8');
    await expect(host.locator('[aria-current]')).toBeFocused();
    await expect(host.locator('[data-page]')).toHaveCount(5);
    await host.evaluate((el) => el.setAttribute('dir', 'rtl'));
    await page.keyboard.press('ArrowRight');
    await expect(host.locator('[aria-current]')).toHaveAttribute('data-page', '7');
  }
});

test('links keep native navigation, ellipses are passive, and disabled links are inert', async ({
  page,
}) => {
  const links = page.getByTestId('react-links');
  await expect(links.getByRole('link', { name: 'Page 4', exact: true })).toHaveAttribute(
    'href',
    '?page=4',
  );
  await links.getByRole('link', { name: 'Page 4', exact: true }).click();
  await expect(page).toHaveURL(/\?page=4$/);
  const host = page.getByTestId('lit-pagination');
  await host.evaluate((el) => {
    el.setAttribute('href', '?page={page}');
    el.setAttribute('disabled', '');
  });
  await expect(host.locator('a[href]')).toHaveCount(0);
  await expect(host.locator('.lab-pagination-ellipsis').first()).toHaveAttribute(
    'aria-hidden',
    'true',
  );
});

test('authored dimensions and semantic colors match at 100 and 200 percent without overflow', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const scale of [1, 2]) {
    await page.evaluate((scale) => {
      document.documentElement.style.fontSize = `${scale * 16}px`;
    }, scale);
    for (const prefix of ['lit', 'react']) {
      const host = page.getByTestId(`${prefix}-pagination`);
      const selected = host.locator('[aria-current]');
      expect(await selected.evaluate((el) => el.getBoundingClientRect().height)).toBe(40 * scale);
      expect(await selected.evaluate((el) => getComputedStyle(el).borderRadius)).toBe(
        `${12 * scale}px`,
      );
      expect(await selected.evaluate((el) => getComputedStyle(el).fontWeight)).toBe('500');
    }
  }
  await page.setViewportSize({ width: 360, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
