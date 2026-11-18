import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/chip.html');
  await expect(page.locator('#react-matrix button')).toHaveCount(56);
  await page.evaluate(() => document.fonts.ready);
});

for (const renderer of ['lit', 'react']) {
  test(`${renderer}: keyboard, controlled refusal and native form reset`, async ({ page }) => {
    const form = page.locator(`#${renderer}-form`);
    const filter = form.getByRole('button', { name: 'Дизайн', exact: true });
    const refused = form.getByRole('button', { name: 'Согласованный', exact: true });
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await filter.focus();
    await page.keyboard.press('Space');
    await expect(filter).toHaveAttribute('aria-pressed', 'false');
    expect(
      await form.evaluate((form) => new FormData(form as HTMLFormElement).get('filter')),
    ).toBeNull();
    await page.keyboard.press('Enter');
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    expect(await form.evaluate((form) => new FormData(form as HTMLFormElement).get('filter'))).toBe(
      'design',
    );
    await refused.click();
    await expect(refused).toHaveAttribute('aria-pressed', 'true');
    await filter.click();
    await form.getByRole('button', { name: 'Сбросить' }).click();
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await filter.click();
    await form.evaluate((form) =>
      form.addEventListener('reset', (event) => event.preventDefault(), { once: true }),
    );
    await form.getByRole('button', { name: 'Сбросить' }).click();
    await expect(filter).toHaveAttribute('aria-pressed', 'false');
  });
}

test('pending preserves width, accessible name and focus while rejecting repeat activation', async ({
  page,
}) => {
  const react = page
    .locator('#react-pending')
    .getByRole('button', { name: 'Подтверждение фильтра' });
  const before = await react.boundingBox();
  await react.focus();
  await page.keyboard.press('Space');
  await expect(react).toHaveAttribute('aria-busy', 'true');
  await expect(react).toBeFocused();
  expect((await react.boundingBox())?.width).toBe(before?.width);
  await page.keyboard.press('Enter');
  await expect(react).toHaveAttribute('aria-pressed', 'true');
  await expect(react).toHaveAccessibleName('Подтверждение фильтра');
  const lit = page.locator('#lit-form lab-chip').first();
  const button = lit.getByRole('button');
  await button.focus();
  const width = (await button.boundingBox())?.width;
  await lit.evaluate((chip) => {
    (chip as HTMLElement & { loading: boolean }).loading = true;
  });
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await page.keyboard.press('Space');
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect((await button.boundingBox())?.width).toBe(width);
  expect(
    await button.locator('.lab-chip-label').evaluate((node) => getComputedStyle(node).opacity),
  ).toBe('0');
});

test('one semantic target; actions dispatch once; disabled and cancelable selection', async ({
  page,
}) => {
  await page.evaluate(() => {
    const counts = { action: 0, remove: 0, selection: 0 };
    Object.assign(window, { chipCounts: counts });
    document.querySelector('#lit-action')?.addEventListener('action', () => counts.action++);
    document.querySelector('#lit-remove')?.addEventListener('remove', () => counts.remove++);
    document.querySelector('#lit-form lab-chip')?.addEventListener('selected-change', (event) => {
      counts.selection++;
      event.preventDefault();
    });
  });
  await page.locator('#lit-action').getByRole('button').press('Enter');
  await page.locator('#lit-remove').getByRole('button').press('Space');
  await page.locator('#lit-form lab-chip').first().getByRole('button').click();
  expect(
    await page.evaluate(() => (window as unknown as { chipCounts: unknown }).chipCounts),
  ).toEqual({ action: 1, remove: 1, selection: 1 });
  await expect(page.locator('#lit-form lab-chip').first().getByRole('button')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#lit-disabled').getByRole('button')).toBeDisabled();
  await expect(page.locator('#lit-remove').getByRole('button')).toHaveAccessibleName(
    'Удалить Дизайн',
  );
  expect(await page.locator('#lit-remove button').getAttribute('aria-pressed')).toBeNull();
  expect(await page.locator('button button').count()).toBe(0);
});

test('all 56 author combinations have source geometry and matching web renderers', async ({
  page,
}) => {
  const read = async (renderer: string) =>
    page.locator(`#${renderer}-matrix button`).evaluateAll((buttons) =>
      buttons.map((button) => {
        const css = getComputedStyle(button);
        const box = button.getBoundingClientRect();
        return {
          height: box.height,
          width: box.width,
          radius: css.borderRadius,
          font: css.fontSize,
          line: css.lineHeight,
          weight: css.fontWeight,
          fill: css.backgroundColor,
          label: css.color,
        };
      }),
    );
  const lit = await read('lit');
  const react = await read('react');
  expect(lit).toEqual(react);
  for (const [index, value] of lit.entries()) {
    const medium = Math.floor(index / 14) % 2 === 1;
    const selected = Math.floor(index / 7) % 2 === 1;
    const sharp = index >= 28;
    expect(value.height).toBe(medium ? 40 : 28);
    expect(value.radius).toBe(sharp ? '4px' : medium ? '12px' : '9999px');
    expect(value.font).toBe(medium ? '16px' : '14px');
    expect(value.line).toBe(medium ? '24px' : '12px');
    expect(value.weight).toBe('500');
    expect(
      Math.abs(value.width - (medium ? (selected ? 133 : 101) : selected ? 99 : 83)),
    ).toBeLessThan(1);
  }
  const baselines = await page.locator('#react-matrix button').evaluateAll((buttons) =>
    [buttons[0], buttons[14]].map((button) => {
      if (!button) throw new Error('Missing chip');
      const label = button.querySelector('.lab-chip-label');
      if (!label) throw new Error('Missing label');
      const marker = document.createElement('span');
      marker.style.cssText = 'display:inline-block;width:0;height:0';
      label.append(marker);
      const baseline = marker.getBoundingClientRect().y - button.getBoundingClientRect().y;
      marker.remove();
      return baseline;
    }),
  );
  expect(baselines).toEqual([19, 26]);
});

test('200% type, RTL long label and reduced motion retain content without horizontal overflow', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  const button = page.locator('#narrow button');
  const bounds = await button.boundingBox();
  expect(bounds?.width).toBeLessThanOrEqual(190);
  expect(bounds?.height).toBeGreaterThan(80);
  expect(await button.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await expect(button).toHaveAccessibleName('ПодробныйОченьДлинныйФильтр с продолжением');
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('server markup and hydrated content have identical first geometry', async ({
  browser,
  page,
}) => {
  const cold = await browser.newContext({ javaScriptEnabled: false });
  const noJs = await cold.newPage();
  const response = await noJs.goto('/_fixtures/chip.html');
  const source = await response?.text();
  const removeHost = source?.match(/<lab-chip\b[^>]*aria-label="Удалить Дизайн"[^>]*>/g);
  expect(removeHost).toHaveLength(2);
  const adapterHost = removeHost?.find((host) => host.includes('form="adapter-form"'));
  expect(adapterHost?.match(/\saria-label=/g)).toHaveLength(1);
  expect(adapterHost?.match(/\sform=/g)).toHaveLength(1);
  const removed = noJs.locator('#ssr-adapter').getByRole('button', { name: 'Удалить Дизайн' });
  await expect(removed).toHaveCount(1);
  await expect(removed).not.toHaveAttribute('aria-pressed');
  await expect(noJs.locator('#ssr-adapter lab-chip').first()).toHaveAttribute(
    'form',
    'adapter-form',
  );
  const adapterForm = page.locator('#adapter-form');
  expect(
    await adapterForm.evaluate((form) => new FormData(form as HTMLFormElement).get('filter')),
  ).toBe('design');
  for (const renderer of ['lit', 'react']) {
    const before = await noJs.locator(`#ssr-${renderer} button`).boundingBox();
    const after = await page.locator(`#ssr-${renderer} button`).boundingBox();
    expect(after?.width).toBe(before?.width);
    expect(after?.height).toBe(before?.height);
    await expect(page.locator(`#ssr-${renderer} button`)).toHaveAttribute('aria-pressed', 'true');
  }
  await cold.close();
});
