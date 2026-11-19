import { expect, test } from '@playwright/test';

for (const renderer of ['lit', 'react'] as const) {
  const selector = renderer === 'lit' ? '[data-testid="lit-author"]' : '#react-author';
  test(`${renderer}: inserted and removed ancestors keep the focused destination`, async ({
    page,
  }) => {
    await page.goto('/_fixtures/breadcrumb.html?maxItems=0');
    const host = page.locator(selector);
    const target = host.getByRole('link', { name: 'Services', exact: true });
    await target.focus();
    const original = [
      { label: 'Home', href: '#home' },
      { label: 'Team', href: '#team' },
      { label: 'Projects', href: '#projects' },
      { label: 'Services', href: '#services' },
      { label: 'Design' },
    ];
    for (const items of [
      [original[0], { label: 'Organisation', href: '#organisation' }, ...original.slice(1)],
      original.slice(1),
    ]) {
      await page.evaluate(
        (next) =>
          (window as unknown as { updateBreadcrumb(items: unknown): void }).updateBreadcrumb(next),
        items,
      );
      await expect(target).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#services$/);
    }
  });
  test(`${renderer}: disclosure reveals real ancestor links and retains keyboard focus`, async ({
    page,
  }) => {
    await page.goto('/_fixtures/breadcrumb.html');
    const host = page.locator(selector);
    await expect(host.getByRole('navigation', { name: 'Навигационная цепочка' })).toBeVisible();
    await expect(host.getByRole('link')).toHaveCount(2);
    await expect(host.locator('[aria-current="page"]')).toHaveText('Design');
    const expand = host.getByRole('button', { name: 'Показать все разделы' });
    await expand.focus();
    await expand.press('Enter');
    await expect(host.getByRole('link')).toHaveCount(4);
    await expect(host.getByRole('link', { name: 'Team', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#team$/);
    await expect(host.locator('.lab-breadcrumb-separator')).toHaveCount(4);
    await expect(host.getByRole('button')).toHaveCount(0);
  });

  for (const direction of ['ltr', 'rtl'])
    test(`${renderer}: complete long labels at 200% ${direction}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 1000 });
      await page.goto(`/_fixtures/breadcrumb.html?long&scale=2&dir=${direction}`);
      const host = page.locator(selector);
      await expect(host.locator('[aria-current="page"]')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const measurements = await host.locator('.lab-breadcrumb-list').evaluate((element) => {
        const texts = Array.from(
          element.querySelectorAll('.lab-breadcrumb-link, .lab-breadcrumb-current'),
        ) as HTMLElement[];
        return {
          width: document.documentElement.scrollWidth,
          labels: texts.map((text) => ({
            width: text.clientWidth,
            scrollWidth: text.scrollWidth,
            height: text.clientHeight,
            lineHeight: Number.parseFloat(getComputedStyle(text).lineHeight),
          })),
        };
      });
      expect(measurements.width).toBe(320);
      for (const label of measurements.labels) {
        expect(label.scrollWidth).toBeLessThanOrEqual(label.width + 1);
        expect(label.height).toBeGreaterThan(label.lineHeight);
        expect(label.lineHeight).toBe(40);
      }
      const transform = await host
        .locator('.lab-breadcrumb-chevron')
        .first()
        .evaluate((el) => getComputedStyle(el).transform);
      expect(transform).toBe(direction === 'rtl' ? 'matrix(-1, 0, 0, 1, 0, 0)' : 'none');
    });

  test(`${renderer}: invalid limits retain usable defaults and grouping labels receive disclosure focus`, async ({
    page,
  }) => {
    await page.goto('/_fixtures/breadcrumb.html?maxItems=NaN&size=unknown&group');
    const host = page.locator(selector);
    await expect(host.locator('.lab-breadcrumb-item')).toHaveCount(4);
    await expect(host.locator('nav')).toHaveAttribute('data-size', 'm');
    await host.getByRole('button', { name: 'Показать все разделы' }).click();
    await expect(host.getByText('Team', { exact: true })).toBeFocused();
    await expect(host.getByRole('link', { name: 'Team', exact: true })).toHaveCount(0);
    await page.goto('/_fixtures/breadcrumb.html?maxItems=0');
    await expect(host.locator('.lab-breadcrumb-item')).toHaveCount(5);
    await expect(host.getByRole('button')).toHaveCount(0);
    if (renderer === 'lit') {
      await host.evaluate((element) => {
        element.setAttribute('max-items', '3');
        element.setAttribute('size', 'l');
      });
      await expect(host.locator('.lab-breadcrumb-item')).toHaveCount(3);
      await host.evaluate((element) => {
        element.removeAttribute('max-items');
        element.removeAttribute('size');
      });
      await expect(host.locator('.lab-breadcrumb-item')).toHaveCount(4);
      await expect(host.locator('nav')).toHaveAttribute('data-size', 'm');
    }
  });

  test(`${renderer}: system contrast preserves glyphs and keyboard focus`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Chromium exposes forced-colors emulation');
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/_fixtures/breadcrumb.html');
    const host = page.locator(selector);
    const expand = host.getByRole('button', { name: 'Показать все разделы' });
    await expand.focus();
    await expect(expand).toHaveCSS('outline-style', 'solid');
    const glyph = host.locator('.lab-breadcrumb-ellipsis');
    await expect(glyph).toHaveCSS('forced-color-adjust', 'none');
    const actual = await glyph.evaluate((el) => ({
      color: getComputedStyle(el).backgroundColor,
      mask: getComputedStyle(el).maskImage,
    }));
    expect(actual.color).not.toBe('rgba(0, 0, 0, 0)');
    expect(actual.mask).toContain('data:image/svg+xml');
  });
}

test('both renderers preserve the authored type, geometry and source colors', async ({ page }) => {
  await page.goto('/_fixtures/breadcrumb.html');
  await page.locator('#react-author [aria-current="page"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const values = [];
  for (const selector of ['[data-testid="lit-author"]', '#react-author']) {
    values.push(
      await page
        .locator(selector)
        .locator('.lab-breadcrumb-list')
        .evaluate((el) => {
          const text = el.querySelector('.lab-breadcrumb-current');
          if (!text) throw new Error('Missing current breadcrumb');
          const style = getComputedStyle(text);
          const bounds = el.getBoundingClientRect();
          const items = Array.from(el.children).map((c) => c.getBoundingClientRect());
          const first = items[0];
          const last = items.at(-1);
          if (!first || !last) throw new Error('Missing breadcrumb items');
          const labels = Array.from(
            el.querySelectorAll('.lab-breadcrumb-link, .lab-breadcrumb-current'),
          ).map((label) => label.getBoundingClientRect().width);
          return {
            width: last.right - first.left,
            labels,
            height: bounds.height,
            fontSize: style.fontSize,
            weight: style.fontWeight,
            tracking: style.letterSpacing,
            color: style.color,
            gaps: items.slice(1).map((r, i) => {
              const previous = items[i];
              if (!previous) throw new Error('Missing preceding breadcrumb');
              return r.left - previous.right;
            }),
          };
        }),
    );
  }
  expect(values[0]).toEqual(values[1]);
  expect(values[0]).toMatchObject({
    height: 16,
    fontSize: '14px',
    weight: '500',
    tracking: 'normal',
    gaps: [8, 8, 8],
  });
  // Figma's auto-width text boxes are whole pixels. Browser text advances remain fractional.
  const source = values[0];
  if (!source) throw new Error('Missing source measurements');
  expect(source.labels.map(Math.ceil)).toEqual([39, 58, 46]);
  expect(Math.abs(source.width - 255)).toBeLessThan(3);
});
