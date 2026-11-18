import { badgeProfile } from '@labpics/ui-tokens';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/badge.html');
  await page.evaluate(() => document.fonts.ready);
});

for (const theme of ['light', 'dark'])
  test(`all 60 authored combinations: geometry and paint parity in ${theme}`, async ({ page }) => {
    await page.getByTestId('theme-select').selectOption(theme);
    for (const color of Object.keys(badgeProfile.colors))
      for (const type of ['fill', 'tinted'])
        for (const state of ['enabled', 'disabled']) {
          const id = `${color}-${type}-${state}`;
          const lit = page.getByTestId(`lit-${id}`).locator('.badge');
          const react = page.getByTestId(`react-${id}`);
          await expect(react).toBeVisible();
          const paint = (el: HTMLElement) => {
            const s = getComputedStyle(el);
            return {
              background: s.backgroundColor,
              color: s.color,
              fontSize: s.fontSize,
              weight: s.fontWeight,
              line: s.lineHeight,
              padding: s.padding,
              radius: s.borderRadius,
              height: el.getBoundingClientRect().height,
              width: el.getBoundingClientRect().width,
              opacity: s.opacity,
            };
          };
          const actual = await react.evaluate(paint);
          expect(actual, id).toEqual(await lit.evaluate(paint));
          expect(actual.height, id).toBe(20);
          expect(actual.fontSize).toBe('12px');
          expect(actual.line).toBe('12px');
          expect(actual.weight).toBe('500');
          expect(actual.opacity).toBe('1');
        }
  });

test('yellow preserves authored dark text; orange preserves white text', async ({ page }) => {
  await expect(page.getByTestId('react-yellow-fill-enabled')).toHaveCSS('color', 'rgb(31, 25, 0)');
  await expect(page.getByTestId('react-orange-fill-enabled')).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );
});

test('disabled paints use neutral roles and remain presentational', async ({ page }) => {
  const gray = page.getByTestId('react-gray-fill-disabled');
  await expect(gray).not.toHaveAttribute('role');
  await expect(gray).not.toHaveAttribute('tabindex');
  const reference = await gray.evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    fg: getComputedStyle(el).color,
  }));
  for (const color of Object.keys(badgeProfile.colors)) {
    const badge = page.getByTestId(`react-${color}-fill-disabled`);
    expect(
      await badge.evaluate((el) => ({
        bg: getComputedStyle(el).backgroundColor,
        fg: getComputedStyle(el).color,
      })),
    ).toEqual(reference);
  }
  await expect(page.locator('lab-badge button')).toHaveCount(0);
});

test('changing the contracted surface and label repaints both renderers', async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-badge-fill-blue', 'rgb(1, 2, 3)');
    document.documentElement.style.setProperty('--lab-badge-label-on-blue', 'rgb(240, 241, 242)');
  });
  for (const el of [
    page.getByTestId('lit-blue-fill-enabled').locator('.badge'),
    page.getByTestId('react-blue-fill-enabled'),
  ]) {
    await expect(el).toHaveCSS('background-color', 'rgb(1, 2, 3)');
    await expect(el).toHaveCSS('color', 'rgb(240, 241, 242)');
  }
});

test('text zoom grows geometry without clipping the label', async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  const lit = page.getByTestId('lit-brand-fill-enabled').locator('.badge');
  const react = page.getByTestId('react-brand-fill-enabled');
  for (const el of [lit, react]) {
    await expect(el).toHaveCSS('font-size', '24px');
    expect((await el.boundingBox())?.height).toBe(40);
  }
});
