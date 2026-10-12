import { type Locator, type Page, expect, test } from '@playwright/test';

test.describe.configure({ retries: 0 });

const surfaces = [
  'tooltip',
  'popover',
  'menu',
  'select',
  'combobox',
  'dialog',
  'alert',
  'lit-dialog',
  'lit-alert',
] as const;
type Surface = (typeof surfaces)[number];

function trigger(page: Page, surface: Surface): Locator {
  if (surface.startsWith('lit-')) return page.getByTestId(surface).locator('.trigger');
  const field = page.locator(`[data-surface="${surface}"]`);
  return surface === 'combobox' ? field.locator('input') : field.locator('button').first();
}

function content(page: Page, surface: Surface): Locator {
  if (surface.startsWith('lit-') || ['tooltip', 'popover', 'dialog', 'alert'].includes(surface)) {
    return page.getByTestId(`${surface.startsWith('lit-') ? surface : `react-${surface}`}-content`);
  }
  return page.locator(`.lab-${surface}-content`);
}

async function open(page: Page, surface: Surface): Promise<void> {
  const control = trigger(page, surface);
  if (surface === 'tooltip') await control.hover();
  else await control.click();
  await expect(content(page, surface)).toBeVisible();
}

async function colour(locator: Locator): Promise<string> {
  return locator.evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--lab-bg-primary').trim(),
  );
}

async function expectScope(page: Page, surface: Surface, material: string): Promise<void> {
  const control = trigger(page, surface);
  const floating = content(page, surface);
  const expected = await colour(control);
  expect(expected).not.toBe('');
  await expect.poll(() => colour(floating)).toBe(expected);
  await expect
    .poll(() =>
      floating.evaluate((element) => {
        const root = element.getRootNode();
        const surface = root instanceof ShadowRoot ? root.host : element;
        return surface.closest('[data-material]')?.getAttribute('data-material');
      }),
    )
    .toBe(material);
}

for (const surface of surfaces) {
  test(`${surface}: открытый портал следует за root flip`, async ({ page }) => {
    await page.goto('/_fixtures/portal-scope.html');
    await open(page, surface);
    const before = await colour(trigger(page, surface));
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.setAttribute('data-material', 'acrylic');
    });
    expect(await colour(trigger(page, surface))).not.toBe(before);
    await expectScope(page, surface, 'acrylic');
    await expect(content(page, surface)).toBeVisible();
  });

  test(`${surface}: ближайшие theme и material scopes независимы`, async ({ page }) => {
    await page.goto('/_fixtures/portal-scope.html');
    await page.evaluate(() => {
      document.querySelector('#scope')?.setAttribute('data-theme', 'dark');
      document.querySelector('#react-root')?.setAttribute('data-material', 'glass');
      document.querySelectorAll('lab-dialog, lab-alert-dialog').forEach((element) => {
        element.setAttribute('data-material', 'glass');
      });
    });
    await open(page, surface);
    await expectScope(page, surface, 'glass');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-material', 'acrylic');
      document.querySelector('#scope')?.setAttribute('data-theme', 'light');
    });
    await expectScope(page, surface, 'glass');
    await page.evaluate(() => {
      document.querySelector('#react-root')?.removeAttribute('data-material');
      document.querySelectorAll('lab-dialog, lab-alert-dialog').forEach((element) => {
        element.removeAttribute('data-material');
      });
    });
    await expectScope(page, surface, 'acrylic');
  });
}

test('OS fallback остаётся живым без явной темы', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/_fixtures/portal-scope.html');
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  await open(page, 'lit-dialog');
  const before = await colour(trigger(page, 'lit-dialog'));
  await expectScope(page, 'lit-dialog', 'solid');
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await colour(trigger(page, 'lit-dialog'))).not.toBe(before);
  await expectScope(page, 'lit-dialog', 'solid');
});

test('смена скоупа сохраняет ввод Combobox', async ({ page }) => {
  await page.goto('/_fixtures/portal-scope.html');
  const input = trigger(page, 'combobox');
  await input.fill('Al');
  await page.evaluate(() => document.querySelector('#scope')?.setAttribute('data-theme', 'dark'));
  await expect(input).toHaveValue('Al');
  await expectScope(page, 'combobox', 'solid');
});

test('удалённые порталы не получают queued или последующие изменения', async ({ page }) => {
  await page.goto('/_fixtures/portal-scope.html');
  await expect(page.locator('[data-lab-portal-scope], [data-lab-dialog-portal]')).toHaveCount(9);
  const result = await page.evaluate(async () => {
    const portals = [
      ...document.querySelectorAll('[data-lab-portal-scope], [data-lab-dialog-portal]'),
    ];
    document.documentElement.setAttribute('data-theme', 'dark');
    Reflect.get(window, 'unmountPortalScopes')();
    const attributes = portals.map((element) => [
      element.getAttribute('data-theme'),
      element.getAttribute('data-material'),
    ]);
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-material', 'glass');
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    return {
      remaining: document.querySelectorAll('[data-lab-portal-scope], [data-lab-dialog-portal]')
        .length,
      attributes,
      after: portals.map((element) => [
        element.getAttribute('data-theme'),
        element.getAttribute('data-material'),
      ]),
    };
  });
  expect(result.remaining).toBe(0);
  expect(result.after).toEqual(result.attributes);
});

test('назначение нового slot переносит независимые оси без remount', async ({ page }) => {
  await page.goto('/_fixtures/portal-scope.html');
  await expect(page.locator('[data-lab-portal-scope], [data-lab-dialog-portal]')).toHaveCount(9);
  await page.evaluate(async () => {
    await Reflect.get(window, 'mountUnassignedDialog')();
  });
  const dialog = page.getByTestId('slotted-dialog');
  const control = dialog.locator('.trigger');
  const input = page.getByTestId('slotted-dialog-content');
  const portal = page.locator('[data-portal-for="slotted-dialog"]');
  await expect(portal).toHaveAttribute('data-theme', 'light');
  expect(await dialog.evaluate((element) => element.assignedSlot)).toBeNull();

  // Меняется только shadow subtree: body/source/root mutation не подменяет slotchange evidence.
  await page.evaluate(() => {
    const root = document.querySelector('#slot-origin')?.shadowRoot;
    if (!root) throw new Error('Missing slot origin');
    const theme = document.createElement('div');
    theme.id = 'slot-theme';
    theme.setAttribute('data-theme', 'dark');
    const material = document.createElement('div');
    material.id = 'slot-material';
    material.setAttribute('data-material', 'glass');
    material.append(document.createElement('slot'));
    theme.append(material);
    root.append(theme);
  });
  await expect(portal).toHaveAttribute('data-theme', 'dark');
  await expect(portal).toHaveAttribute('data-material', 'glass');
  expect(await colour(control)).not.toBe('');
  await expect.poll(() => colour(input)).toBe(await colour(control));

  await control.click();
  await expect(input).toBeVisible();
  await input.fill('retained input');
  await page.evaluate(() => {
    document
      .querySelector('#slot-origin')
      ?.shadowRoot?.querySelector('#slot-theme')
      ?.setAttribute('data-theme', 'light');
  });
  await expect(portal).toHaveAttribute('data-theme', 'light');
  await expect(portal).toHaveAttribute('data-material', 'glass');
  await page.evaluate(() => {
    document
      .querySelector('#slot-origin')
      ?.shadowRoot?.querySelector('#slot-material')
      ?.setAttribute('data-material', 'acrylic');
  });
  await expect(portal).toHaveAttribute('data-theme', 'light');
  await expect(portal).toHaveAttribute('data-material', 'acrylic');
  await page.evaluate(() => {
    document
      .querySelector('#slot-origin')
      ?.shadowRoot?.querySelector('#slot-theme')
      ?.removeAttribute('data-theme');
    document
      .querySelector('#slot-origin')
      ?.shadowRoot?.querySelector('#slot-material')
      ?.removeAttribute('data-material');
  });
  await expect(portal).toHaveAttribute('data-theme', 'light');
  await expect(portal).toHaveAttribute('data-material', 'solid');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('retained input');
  expect(
    await page.evaluate(() => {
      const nodes = Reflect.get(window, 'slottedScopeNodes');
      const dialog = document.querySelector('[data-testid="slotted-dialog"]');
      return (
        nodes.dialog === dialog &&
        nodes.trigger === dialog?.shadowRoot?.querySelector('.trigger') &&
        nodes.input ===
          document
            .querySelector('[data-portal-for="slotted-dialog"]')
            ?.shadowRoot?.querySelector('[data-testid="slotted-dialog-content"]') &&
        nodes.portal === document.querySelector('[data-portal-for="slotted-dialog"]')
      );
    }),
  ).toBe(true);

  const disposed = await page.evaluate(async () => {
    const nodes = Reflect.get(window, 'slottedScopeNodes');
    const origin = document.querySelector('#slot-origin');
    const theme = origin?.shadowRoot?.querySelector('#slot-theme');
    theme?.setAttribute('data-theme', 'dark');
    origin?.remove();
    const attributes = [
      nodes.portal.getAttribute('data-theme'),
      nodes.portal.getAttribute('data-material'),
    ];
    theme?.setAttribute('data-theme', 'light');
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    return {
      connected: nodes.portal.isConnected,
      attributes,
      after: [nodes.portal.getAttribute('data-theme'), nodes.portal.getAttribute('data-material')],
    };
  });
  expect(disposed.connected).toBe(false);
  expect(disposed.after).toEqual(disposed.attributes);
});
