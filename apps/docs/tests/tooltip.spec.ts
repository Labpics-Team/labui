import { expect, test } from '@playwright/test';
const text = 'Hello, my name is Tooltip';
const placements = [
  'bottom-start',
  'bottom',
  'bottom-end',
  'right',
  'left',
  'top-start',
  'top',
  'top-end',
];
test.beforeEach(async ({ page }) => {
  await page.goto('/tooltip.html');
  await page.evaluate(() => document.fonts.ready);
});
for (const renderer of ['lit', 'react']) {
  test(`${renderer}: preserves the actual control, hoverable text, keyboard focus and Escape`, async ({
    page,
  }) => {
    const host = page.getByTestId(`${renderer}-tt-bottom`);
    const trigger = host.locator('button');
    const surface = host.locator('.lab-tooltip-content');
    await expect(trigger).toHaveCount(1);
    await expect(surface).toBeHidden();
    await trigger.evaluate((el) => {
      el.id = 'actual-control';
      el.setAttribute('data-state', 'ready');
      const description = document.createElement('span');
      description.id = 'existing-description';
      description.hidden = true;
      description.textContent = 'Existing description';
      el.after(description);
      el.setAttribute('aria-describedby', description.id);
    });
    await trigger.hover();
    await expect(surface).toBeVisible();
    await expect(trigger).toHaveAccessibleDescription(`Existing description ${text}`);
    await expect(trigger).toHaveAttribute('id', 'actual-control');
    await expect(trigger).toHaveAttribute('data-state', 'ready');
    await surface.hover();
    await page.waitForTimeout(250);
    await expect(surface).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(surface).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-describedby', 'existing-description');
    await page.mouse.move(0, 0);
    await page.keyboard.press('Tab');
    await trigger.focus();
    await expect(surface).toBeVisible();
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(surface).toBeHidden();
    await expect(trigger).toBeFocused();
    if (renderer === 'react') {
      await trigger.click();
      await expect(page.getByTestId('clicks')).toHaveText('1');
    }
  });
  test(`${renderer}: clipped transformed ancestors, local themes and no portal`, async ({
    page,
  }) => {
    const clipped = page.getByTestId(`${renderer}-clipped`);
    await clipped.locator('button').hover();
    const surface = clipped.locator('.lab-tooltip-content');
    await expect(surface).toBeVisible();
    expect(
      await clipped
        .locator('.lab-tooltip-positioner')
        .evaluate((el) => el.matches(':popover-open')),
    ).toBe(true);
    const box = await surface.boundingBox();
    const parent = await clipped.boundingBox();
    if (!box || !parent) throw new Error('Tooltip geometry is missing');
    expect(box.x + box.width).toBeGreaterThan(parent.x + parent.width);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(220);
    await expect(surface).toBeVisible();
    await page.mouse.move(0, 0);
    await page.keyboard.press('Escape');
    await page.locator('html').evaluate((el) => el.setAttribute('data-theme', 'dark'));
    const local = page.getByTestId(`${renderer}-local`);
    await local.locator('button').hover();
    await expect(local.locator('.lab-tooltip-content')).toBeVisible();
    expect(
      await local
        .locator('.lab-tooltip-content')
        .evaluate((el) => getComputedStyle(el, '::before').backgroundColor),
    ).toBe('rgb(255, 255, 255)');
  });
  test(`${renderer}: all 24 authored directions and types use Body and exact tails`, async ({
    page,
  }) => {
    for (const type of ['neutral', 'inverted', 'accent'])
      for (const placement of placements) {
        const host = page.getByTestId(`${renderer}-${type}-${placement}`);
        await host.locator('button').hover();
        const surface = host.locator('.lab-tooltip-content');
        await expect(surface).toBeVisible();
        await expect(surface).toHaveCSS('font-size', '16px');
        await expect(surface).toHaveCSS('line-height', '24px');
        await expect(surface).toHaveCSS('padding', '12px');
        await expect(surface).toHaveAttribute('data-type', type);
        expect((await surface.boundingBox())?.height).toBe(48);
        expect(
          await surface
            .locator('.lab-tooltip-arrow')
            .evaluate((el) => getComputedStyle(el, '::before').maskImage),
        ).toContain('13.5332');
        await page.mouse.move(0, 0);
        await page.keyboard.press('Escape');
      }
  });
}
test('live placement changes remeasure the arrow cross-axis and arrow=false removes its gap', async ({
  page,
}) => {
  const host = page.getByTestId('lit-tt-bottom');
  const trigger = host.locator('button');
  await trigger.hover();
  await expect(host.locator('.lab-tooltip-content')).toBeVisible();
  await host.evaluate((el) => {
    (el as HTMLElement & { placement: string }).placement = 'right';
  });
  await expect(host.locator('.lab-tooltip-positioner')).toHaveAttribute('data-side', 'right');
  await expect
    .poll(async () => {
      const a = await host.locator('.lab-tooltip-arrow').boundingBox();
      const t = await trigger.boundingBox();
      return a && t ? Math.abs(a.y + a.height / 2 - t.y - t.height / 2) : 99;
    })
    .toBeLessThan(1);
  await host.evaluate((el) => {
    (el as HTMLElement & { arrow: boolean }).arrow = false;
  });
  await expect(host.locator('.lab-tooltip-arrow')).toBeHidden();
});
test('dialog stays open and focused while its tooltip dismisses', async ({ page }) => {
  await page.evaluate(() => (document.querySelector('#dialog') as HTMLDialogElement).showModal());
  const dialog = page.locator('#dialog');
  const trigger = dialog.locator('button');
  await page.keyboard.press('Tab');
  await trigger.focus();
  await trigger.hover();
  await expect(dialog.locator('.lab-tooltip-content')).toBeVisible();
  await expect(trigger).toHaveAccessibleDescription('Inside dialog');
  await page.keyboard.press('Escape');
  await expect(dialog.locator('.lab-tooltip-content')).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(trigger).toBeFocused();
});
test('disabled, touch, repeated mount and cleanup leave no orphan surface or IDs', async ({
  page,
}) => {
  for (const renderer of ['lit', 'react']) {
    const host = page.getByTestId(`${renderer}-tt-disabled`);
    await host.locator('.lab-tooltip-fallback').hover();
    await page.waitForTimeout(450);
    await expect(host.locator('.lab-tooltip-content')).toBeHidden();
  }
  const host = page.getByTestId('react-tt-bottom');
  await host.locator('button').dispatchEvent('pointerover', { pointerType: 'touch' });
  await page.waitForTimeout(450);
  await expect(host.locator('.lab-tooltip-content')).toBeHidden();
  await host.locator('button').hover();
  await expect(host.locator('.lab-tooltip-content')).toBeVisible();
  await page.getByTestId('toggle').click();
  await expect(host).toHaveCount(0);
  await expect(page.locator(':popover-open')).toHaveCount(0);
  await page.getByTestId('toggle').click();
  await host.locator('button').hover();
  await expect(host.locator('.lab-tooltip-content')).toBeVisible();
  expect(
    await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
      return new Set(ids).size === ids.length;
    }),
  ).toBe(true);
});
test('Chromium accessibility tree describes Lit private button and React native button', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  const cdp = await page.context().newCDPSession(page);
  for (const renderer of ['lit', 'react']) {
    const host = page.getByTestId(`${renderer}-tt-bottom`);
    await host.locator('button').hover();
    await expect(host.locator('.lab-tooltip-content')).toBeVisible();
    const tree = await cdp.send('Accessibility.getFullAXTree');
    expect(
      tree.nodes.some(
        (node) =>
          node.role?.value === 'button' &&
          node.name?.value === 'Bottom' &&
          node.description?.value === text,
      ),
    ).toBe(true);
    await page.mouse.move(0, 0);
    await page.keyboard.press('Escape');
  }
});
