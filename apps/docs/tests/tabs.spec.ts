import { type Locator, expect, test } from '@playwright/test';

const tabs = (root: Locator) => root.locator('[role="tab"]');
const selected = (root: Locator) => root.locator('[role="tab"][aria-selected="true"]');
const activePaint = (root: Locator) => selected(root).locator('.lab-tabs-active');
test.beforeEach(async ({ page }) => {
  await page.goto('/tabs.html');
});

for (const renderer of ['lit', 'react']) {
  test(`${renderer}: selection, disabled skip, names and ARIA relationships`, async ({ page }) => {
    const root = page.getByTestId(`${renderer}-tabs`);
    await expect(tabs(root)).toHaveCount(3);
    await expect(selected(root)).toHaveText('Account');
    await tabs(root).nth(0).focus();
    await page.keyboard.press('End');
    await expect(tabs(root).nth(1)).toBeFocused();
    await expect(selected(root)).toHaveText('Password');
    const panel = root.locator('[role="tabpanel"]:not([hidden])');
    await expect(panel).toHaveAttribute(
      'id',
      (await selected(root).getAttribute('aria-controls')) ?? '',
    );
    await expect(panel).toHaveAttribute(
      'aria-labelledby',
      (await selected(root).getAttribute('id')) ?? '',
    );
    await tabs(root).nth(2).click({ force: true });
    await expect(selected(root)).toHaveText('Password');
    await tabs(root).nth(1).focus();
    await page.keyboard.press('Home');
    await expect(selected(root)).toHaveText('Account');
  });

  test(`${renderer}: controlled refusal preserves the approved panel`, async ({ page }) => {
    const root = page.getByTestId(`${renderer}-controlled`);
    await tabs(root).nth(1).click();
    await expect(selected(root)).toHaveText('Account');
    await expect(root.locator('[role="tabpanel"]').nth(0)).toBeVisible();
    await expect(root.locator('[role="tabpanel"]').nth(1)).toBeHidden();
    await expect(tabs(root).nth(1)).toBeFocused();
    if (renderer === 'lit')
      expect(await root.evaluate((el) => (el as HTMLElement & { value: string }).value)).toBe(
        'account',
      );
  });

  test(`${renderer}: manual activation waits for Enter and Space`, async ({ page }) => {
    const root = page.getByTestId(`${renderer}-tabs-manual`);
    await tabs(root).nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs(root).nth(1)).toBeFocused();
    await expect(selected(root)).toHaveText('Account');
    await page.keyboard.press('Enter');
    await expect(selected(root)).toHaveText('Password');
    await page.keyboard.press('ArrowLeft');
    await expect(tabs(root).nth(0)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(selected(root)).toHaveText('Account');
  });

  test(`${renderer}: manual Tab and Shift+Tab leave the tablist from the focused tab`, async ({
    page,
  }) => {
    const root = page.getByTestId(`${renderer}-tabs-manual`);
    const list = root.locator('[role="tablist"]');
    await tabs(root).first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs(root).nth(1)).toBeFocused();
    await expect(tabs(root).nth(1)).toHaveAttribute('tabindex', '0');
    await page.keyboard.press('Shift+Tab');
    expect(
      await list.evaluate((el) =>
        el.contains(
          el.getRootNode() instanceof ShadowRoot
            ? (el.getRootNode() as ShadowRoot).activeElement
            : document.activeElement,
        ),
      ),
    ).toBe(false);
    await tabs(root).nth(1).focus();
    await page.keyboard.press('Enter');
    await expect(selected(root)).toHaveText('Password');
    await page.keyboard.press('ArrowLeft');
    await expect(tabs(root).first()).toBeFocused();
    await page.keyboard.press('Tab');
    expect(
      await list.evaluate((el) =>
        el.contains(
          el.getRootNode() instanceof ShadowRoot
            ? (el.getRootNode() as ShadowRoot).activeElement
            : document.activeElement,
        ),
      ),
    ).toBe(false);
  });

  for (const variant of ['tinted', 'underlined']) {
    for (const orientation of ['horizontal', 'vertical']) {
      test(`${renderer}/${variant}/${orientation}: mounted panel keeps draft and identity`, async ({
        page,
      }) => {
        const root = page.getByTestId(`${renderer}-${variant}-${orientation}`);
        const editor = root.locator('textarea');
        await editor.fill('Unfinished 日本語 draft');
        await editor.evaluate((node) => {
          (node as HTMLElement & { retained?: boolean }).retained = true;
        });
        if (renderer === 'react') await root.getByRole('button', { name: 'Saved 0' }).click();
        await tabs(root).nth(1).click();
        await expect(editor).toBeHidden();
        await editor.evaluate((node) => node.focus());
        await expect(editor).not.toBeFocused();
        await expect(root.locator('[role="tabpanel"][hidden]').first()).toHaveAttribute(
          'inert',
          '',
        );
        await tabs(root).nth(0).click();
        await expect(editor).toHaveValue('Unfinished 日本語 draft');
        expect(
          await editor.evaluate((node) => (node as HTMLElement & { retained?: boolean }).retained),
        ).toBe(true);
        if (renderer === 'react')
          await expect(root.getByRole('button', { name: 'Saved 1' })).toBeVisible();
      });
    }
  }
}

test('Lit controlled acceptance, uncontrolled state, reordering and no selection are distinct', async ({
  page,
}) => {
  const root = page.getByTestId('lit-tabs');
  await tabs(root).nth(1).click();
  expect(
    await root.evaluate((el) => (el as HTMLElement & { value?: string }).value),
  ).toBeUndefined();
  await root.evaluate(async (el) => {
    const host = el as HTMLElement & {
      items: unknown[];
      value: string | null;
      updateComplete: Promise<unknown>;
    };
    host.value = null;
    await host.updateComplete;
    host.items = [...host.items].reverse();
  });
  await expect(selected(root)).toHaveCount(0);
  await expect(root.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
  await root.evaluate((el) =>
    el.addEventListener('value-change', (event) => {
      (el as HTMLElement & { value: string }).value = (
        event as CustomEvent<{ value: string }>
      ).detail.value;
    }),
  );
  await tabs(root).nth(1).click();
  await expect(selected(root)).toHaveText('Password');
});

test('React keyed fragments preserve each editor when tabs are reordered', async ({ page }) => {
  const root = page.getByTestId('react-reorder');
  await root.getByRole('textbox', { name: 'Draft a' }).fill('Retained A');
  await root.getByRole('tab', { name: 'b', exact: true }).click();
  await root.getByRole('textbox', { name: 'Draft b' }).fill('Retained B');
  await root.getByRole('button', { name: 'Reverse tabs' }).click();
  await expect(root.getByRole('textbox', { name: 'Draft b' })).toHaveValue('Retained B');
  await root.getByRole('tab', { name: 'a', exact: true }).click();
  await expect(root.getByRole('textbox', { name: 'Draft a' })).toHaveValue('Retained A');
});

test('vertical labels retain authored centered alignment', async ({ page }) => {
  for (const renderer of ['lit', 'react'])
    for (const variant of ['tinted', 'underlined']) {
      const root = page.getByTestId(`${renderer}-${variant}-vertical`);
      const error = await tabs(root)
        .first()
        .evaluate((node) => {
          const label = node.querySelector('.lab-tabs-label');
          if (!label) throw new Error('Tab label required');
          const control = node.getBoundingClientRect();
          const text = label.getBoundingClientRect();
          return Math.abs(control.x + control.width / 2 - text.x - text.width / 2);
        });
      expect(error).toBeLessThan(1);
    }
});

for (const orientation of ['horizontal', 'vertical']) {
  for (const mode of ['automatic', 'manual']) {
    for (const dir of ['ltr', 'rtl']) {
      test(`Lit keyboard ${orientation}/${mode}/${dir}`, async ({ page }) => {
        const root = page.getByTestId('lit-tinted-horizontal');
        await root.evaluate((host, props) => Object.assign(host, props), {
          orientation,
          activationMode: mode,
          dir,
        });
        await tabs(root).first().focus();
        await page.keyboard.press(
          orientation === 'vertical' ? 'ArrowDown' : dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight',
        );
        await expect(tabs(root).nth(1)).toBeFocused();
        await expect(selected(root)).toHaveText(mode === 'manual' ? 'Draft' : 'Details');
        if (mode === 'manual') await page.keyboard.press('Enter');
        await page.keyboard.press('End');
        await expect(tabs(root).nth(3)).toBeFocused();
      });
    }
  }
}

for (const theme of ['light', 'dark']) {
  for (const scale of [1, 1.25, 2]) {
    test(`authored geometry and renderer parity ${theme}/${scale}`, async ({ page }) => {
      await page.evaluate(
        ({ theme, scale }) => {
          document.documentElement.dataset.theme = theme;
          document.documentElement.style.fontSize = `${scale * 100}%`;
        },
        { theme, scale },
      );
      for (const variant of ['tinted', 'underlined']) {
        const lit = page.getByTestId(`lit-${variant}-horizontal`);
        const react = page.getByTestId(`react-${variant}-horizontal`);
        await expect(tabs(react).first()).toBeVisible();
        for (const root of [lit, react]) {
          const trigger = tabs(root).first();
          expect((await trigger.boundingBox())?.height).toBeCloseTo(48 * scale, 0);
          expect(await trigger.evaluate((node) => getComputedStyle(node).fontWeight)).toBe('500');
          expect(await trigger.evaluate((node) => getComputedStyle(node).letterSpacing)).toBe(
            'normal',
          );
          const size = await root.locator('[role="tablist"]').boundingBox();
          expect(size?.height).toBeCloseTo((variant === 'tinted' ? 52 : 48) * scale, 0);
        }
        const paint = (node: HTMLElement) => ({
          fill: getComputedStyle(node).backgroundColor,
          shadow: getComputedStyle(node).boxShadow,
        });
        expect(await activePaint(lit).evaluate(paint)).toEqual(
          await activePaint(react).evaluate(paint),
        );
        expect(
          await activePaint(lit).evaluate((node) => getComputedStyle(node).boxShadow),
        ).not.toBe('none');
      }
    });
  }
}

test('tinted equal widths, separators and the four-tab author exception', async ({ page }) => {
  for (const renderer of ['lit', 'react']) {
    const root = page.getByTestId(`${renderer}-tinted-horizontal`);
    const widths = await tabs(root).evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().width),
    );
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
    expect(
      await tabs(root)
        .nth(1)
        .evaluate((el) => getComputedStyle(el, '::before').display),
    ).toBe('none');
    expect(
      await tabs(root)
        .nth(2)
        .evaluate((el) => getComputedStyle(el, '::before').width),
    ).toBe('1px');
    await tabs(root).nth(1).click();
    expect(
      await tabs(root)
        .nth(2)
        .evaluate((el) => getComputedStyle(el, '::before').display),
    ).toBe('none');
  }
});

test('underlined edges mirror with RTL; icon-only Bottom uses 44px', async ({ page }) => {
  const root = page.getByTestId('lit-tabs');
  await root.evaluate((el) => {
    Object.assign(el, {
      items: [{ value: 'account', label: 'Account', iconOnly: true, icon: 'account-icon' }],
      orientation: 'horizontal',
      edge: 'end',
    });
    const icon = document.createElement('span');
    icon.slot = 'account-icon';
    icon.textContent = '◇';
    el.append(icon);
  });
  expect((await tabs(root).first().boundingBox())?.height).toBe(44);
  await expect(tabs(root).first()).toHaveAccessibleName('Account');
  await root.evaluate((el) => Object.assign(el, { edge: 'start' }));
  expect((await tabs(root).first().boundingBox())?.height).toBe(48);
  for (const dir of ['ltr', 'rtl']) {
    await root.evaluate(
      (el, dir) => Object.assign(el, { orientation: 'vertical', dir, edge: 'end' }),
      dir,
    );
    const trigger = await tabs(root).first().boundingBox();
    const line = await activePaint(root).boundingBox();
    if (!trigger || !line) throw new Error('Visible tab and indicator required');
    expect(line.width).toBe(1);
    expect(line.x).toBeCloseTo(dir === 'rtl' ? trigger.x : trigger.x + trigger.width - 1, 0);
  }
});

test('narrow 200% keeps long labels reachable without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const root = page.getByTestId('lit-tinted-horizontal');
  await root.evaluate((el) => {
    const host = el as HTMLElement & { items: { value: string; label: string }[] };
    host.items = host.items.map((item) => ({
      ...item,
      label: `Long project ${item.label} description`,
    }));
  });
  const list = root.locator('[role="tablist"]');
  expect(await list.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await tabs(root).first().focus();
  await page.keyboard.press('End');
  await expect(tabs(root).last()).toBeFocused();
  await expect.poll(() => list.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Motion respects reduced motion and rapid interruption without errors', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    document.documentElement.dataset.motionErrors = '0';
    document.addEventListener('motion-error', () => {
      document.documentElement.dataset.motionErrors = String(
        Number(document.documentElement.dataset.motionErrors) + 1,
      );
    });
  });
  for (const renderer of ['lit', 'react']) {
    const root = page.getByTestId(`${renderer}-tabs`);
    for (const index of [1, 0, 1, 0]) await tabs(root).nth(index).click();
    await expect(selected(root)).toHaveText('Account');
    await expect(activePaint(root)).toHaveCSS('opacity', '1');
  }
  expect(await page.evaluate(() => document.documentElement.dataset.motionErrors)).toBe('0');
});

test('horizontal panels follow their content height', async ({ page }) => {
  for (const renderer of ['lit', 'react']) {
    const panel = page.getByTestId(`${renderer}-tabs`).locator('[role="tabpanel"]:not([hidden])');
    expect((await panel.boundingBox())?.height).toBeLessThan(50);
  }
});
