import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/calendar.html');
  await page.locator('#react-form .lab-calendar-day').first().waitFor();
});

test('intrinsic size survives centered flex without overflowing a narrow parent', async ({
  page,
}) => {
  await page.evaluate(() => {
    for (const form of document.querySelectorAll<HTMLElement>('#lit,#react-form'))
      Object.assign(form.style, { display: 'flex', flexDirection: 'column', alignItems: 'center' });
  });
  for (const [size, width] of [
    ['s', 320],
    ['m', 400],
  ] as const) {
    await page.evaluate((size) => window.calendarFixture.set({ size }), size);
    for (const form of ['#lit', '#react-form']) {
      const calendar = page.locator(form).locator('[data-lab-calendar]');
      await expect(calendar).toHaveAttribute('data-size', size);
      expect(await calendar.evaluate((el) => el.getBoundingClientRect().width)).toBeCloseTo(
        width,
        0,
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const form of ['#lit', '#react-form'])
    expect(
      await page
        .locator(form)
        .locator('[data-lab-calendar]')
        .evaluate((el) => el.getBoundingClientRect().width),
    ).toBeCloseTo(358, 0);
});

test('date selection, FormData and reset agree in both renderers', async ({ page }) => {
  for (const form of ['#lit', '#react-form']) {
    const root = page.locator(form);
    await expect(root.locator('.lab-calendar-day')).toHaveCount(42);
    await expect(root.locator('[data-date="2024-05-15"]')).toHaveAccessibleName(/7 events/);
    await root.locator('[data-date="2024-05-17"]').click();
    await expect(root.locator('[data-date="2024-05-17"]')).toHaveAttribute('data-active', '');
    expect(
      await root.evaluate((el) => new FormData(el as HTMLFormElement).getAll('dates')),
    ).toEqual(['2024-05-17']);
    await root.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(root.locator('[data-date="2024-05-15"]')).toHaveAttribute('data-active', '');
  }
});

for (const accept of [true, false])
  test(`controlled parent ${accept ? 'accepts' : 'refuses'} date and month requests`, async ({
    page,
  }) => {
    await page.evaluate((accept) => window.calendarFixture.controlled(accept), accept);
    for (const form of ['#lit', '#react-form']) {
      const root = page.locator(form);
      await root.locator('[data-date="2024-05-17"]').click();
      await expect(root.locator(`[data-date="2024-05-${accept ? '17' : '15'}"]`)).toHaveAttribute(
        'data-active',
        '',
      );
      await root.getByRole('button', { name: 'Next month' }).click();
      await expect(root.locator('.lab-calendar-title')).toHaveText(
        accept ? 'June 2024' : 'May 2024',
      );
      expect(
        await root.evaluate((el) => new FormData(el as HTMLFormElement).getAll('dates')),
      ).toEqual([`2024-05-${accept ? '17' : '15'}`]);
    }
  });

test('range spans months, reverses endpoints and cannot cross unavailable dates', async ({
  page,
}) => {
  await page.evaluate(() => window.calendarFixture.set({ selection: 'range', value: undefined }));
  // Lit uses null to indicate uncontrolled selection.
  await page.evaluate(() => {
    window.calendarFixture.lit.value = null;
  });
  for (const form of ['#lit', '#react-form']) {
    const root = page.locator(form);
    await root.getByRole('button', { name: 'Next month' }).click();
    await root.locator('[data-date="2024-06-03"]').click();
    expect(
      await root.evaluate((el) => new FormData(el as HTMLFormElement).getAll('dates')),
    ).toEqual(['2024-05-15', '2024-06-03']);
    await root.locator('[data-date="2024-06-10"]').click();
    await root.getByRole('button', { name: 'Previous month' }).click();
    await root.locator('[data-date="2024-05-29"]').click();
    expect(
      await root.evaluate((el) => new FormData(el as HTMLFormElement).getAll('dates')),
    ).toEqual(['2024-05-29', '2024-06-10']);
  }
  await page.evaluate(() =>
    window.calendarFixture.set({ isDateUnavailable: (date) => date === '2024-06-01' }),
  );
  for (const form of ['#lit', '#react-form']) {
    const root = page.locator(form);
    await root.locator('[data-date="2024-05-29"]').click();
    await root.getByRole('button', { name: 'Next month' }).click();
    await root.locator('[data-date="2024-06-03"]').click();
    expect(
      await root.evaluate((el) => new FormData(el as HTMLFormElement).getAll('dates')),
    ).toEqual(['2024-05-29']);
  }
});

test('keyboard follows week, month and year without stealing focus between calendars', async ({
  page,
}) => {
  for (const form of ['#lit', '#react-form']) {
    const root = page.locator(form);
    await root.locator('[data-date="2024-05-15"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(root.locator('[data-date="2024-05-16"]')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(root.locator('[data-date="2024-05-16"]')).toHaveAttribute('data-active', '');
    await page.keyboard.press('Home');
    await expect(root.locator('[data-date="2024-05-12"]')).toBeFocused();
    await page.keyboard.press('End');
    await expect(root.locator('[data-date="2024-05-18"]')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('PageDown');
    await expect(root.locator('.lab-calendar-title')).toHaveText('June 2024');
    await expect(root.locator('[data-date="2024-06-16"]')).toBeFocused();
    await page.keyboard.press('Shift+PageUp');
    await expect(root.locator('.lab-calendar-title')).toHaveText('June 2023');
  }
});

test('RTL, read-only and disabled preserve accepted values', async ({ page }) => {
  await page.evaluate(() => window.calendarFixture.set({ dir: 'rtl', readOnly: true }));
  for (const form of ['#lit', '#react-form']) {
    const root = page.locator(form);
    await root.locator('[data-date="2024-05-15"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(root.locator('[data-date="2024-05-14"]')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(root.locator('[data-date="2024-05-15"]')).toHaveAttribute('data-active', '');
    await root.getByRole('button', { name: 'Next month' }).click();
    await expect(root.locator('.lab-calendar-title')).toHaveText('June 2024');
  }
  await page.evaluate(() => window.calendarFixture.set({ disabled: true }));
  for (const form of ['#lit', '#react-form']) {
    await expect(page.locator(form).getByRole('button', { name: 'Next month' })).toBeDisabled();
    expect(
      await page
        .locator(form)
        .evaluate((el) => new FormData(el as HTMLFormElement).getAll('dates')),
    ).toEqual([]);
  }
});

test('new bounds never silently clamp controlled selection', async ({ page }) => {
  await page.evaluate(() => {
    window.calendarFixture.controlled(false);
    window.calendarFixture.set({
      value: ['2024-05-15'],
      month: '2024-05-01',
      min: '2024-05-20',
      max: '2024-05-28',
    });
  });
  for (const form of ['#lit', '#react-form']) {
    const root = page.locator(form);
    await expect(root.locator('[data-date="2024-05-15"]')).toHaveAttribute('data-active', '');
    await expect(root.locator('[data-date="2024-05-15"]')).toHaveAttribute('aria-disabled', 'true');
    expect(
      await root.evaluate((el) => new FormData(el as HTMLFormElement).getAll('dates')),
    ).toEqual(['2024-05-15']);
    await expect(root.getByRole('button', { name: 'Next month' })).toBeDisabled();
  }
});

test('rejected month request retains the last accepted focused day', async ({ page }) => {
  await page.evaluate(() => window.calendarFixture.controlled(false));
  for (const form of ['#lit', '#react-form']) {
    const root = page.locator(form);
    await root.locator('[data-date="2024-05-31"]').click();
    await page.keyboard.press('ArrowRight');
    await expect(root.locator('.lab-calendar-title')).toHaveText('May 2024');
    await expect(root.locator('[data-date="2024-05-31"]')).toBeFocused();
  }
});

test('delayed month acceptance follows keyboard focus without stealing a later focus', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.calendarFixture.controlled(true, 150);
  });
  for (const form of ['#lit', '#react-form']) {
    const root = page.locator(form);
    await root.locator('[data-date="2024-05-31"]').click();
    await page.keyboard.press('ArrowRight');
    await expect(root.locator('.lab-calendar-title')).toHaveText('June 2024');
    await expect(root.locator('[data-date="2024-06-01"]')).toBeFocused();
    await root.locator('[data-date="2024-06-30"]').click();
    await page.keyboard.press('ArrowRight');
    await root.getByRole('button', { name: 'Reset', exact: true }).focus();
    await expect(root.locator('.lab-calendar-title')).toHaveText('July 2024');
    await expect(root.getByRole('button', { name: 'Reset', exact: true })).toBeFocused();
  }
});

test('keyboard inherits document RTL and adjacent month dates are passive', async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });
  for (const form of ['#lit', '#react-form']) {
    const root = page.locator(form);
    await root.locator('[data-date="2024-05-15"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(root.locator('[data-date="2024-05-14"]')).toBeFocused();
    await expect(root.locator('[data-date="2024-06-01"]')).toHaveAttribute('aria-disabled', 'true');
    await root.locator('[data-date="2024-06-01"]').dispatchEvent('click');
    await expect(root.locator('.lab-calendar-title')).toHaveText('May 2024');
    expect(
      await root.evaluate((el) => new FormData(el as HTMLFormElement).getAll('dates')),
    ).toEqual(['2024-05-15']);
  }
});

test('locales, required partial ranges and narrow large text use the real form/grid', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.calendarFixture.set({
      locale: 'ru-RU',
      selection: 'range',
      required: true,
      firstDayOfWeek: 1,
    }),
  );
  for (const form of ['#lit', '#react-form']) {
    const root = page.locator(form);
    await expect(root.locator('.lab-calendar-title')).toContainText('май');
    expect(await root.evaluate((el) => (el as HTMLFormElement).checkValidity())).toBe(false);
    await root.locator('[data-date="2024-05-17"]').click();
    expect(await root.evaluate((el) => (el as HTMLFormElement).checkValidity())).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
    window.calendarFixture.set({ size: 'm' });
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const form of ['#lit', '#react-form']) {
    await expect(page.locator(form).locator('[data-lab-calendar]')).toHaveAttribute(
      'data-size',
      'm',
    );
    const area = page.locator(form).locator('.lab-calendar-area');
    expect(await area.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await page.locator(form).locator('[data-date="2024-05-19"]').focus();
    expect(await area.evaluate((el) => el.scrollLeft > 0)).toBe(true);
  }
});
