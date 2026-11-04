import { type Page, expect, test } from '@playwright/test';

async function load(page: Page): Promise<void> {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto('/_fixtures/veil-length.html');
  await page.waitForFunction(() => !!window.__veilLength);
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      }),
  );
}

async function strength(page: Page, expected: number): Promise<void> {
  await expect
    .poll(async () => {
      const actual = await page.evaluate(() => window.__veilLength.snapshot().strength);
      return Math.abs(actual - expected);
    })
    .toBeLessThanOrEqual(0.02);
}

test('rem и медиа меняют радиус при неизменном боксе поверхности', async ({ page }) => {
  await load(page);
  await strength(page, 24);
  await page.evaluate(() => window.__veilLength.font(32));
  await strength(page, 48);
  await page.setViewportSize({ width: 1200, height: 600 });
  await strength(page, 64);
});

test('px-числа прежнего API обновляются через тот же контекст', async ({ page }) => {
  await load(page);
  await page.evaluate(() => window.__veilLength.strength('32'));
  await strength(page, 32);
  await page.evaluate(() => window.__veilLength.strength('40'));
  await strength(page, 40);
});

for (const value of ['0.0000001px', 'calc(1px / 10000000)', '1e-7']) {
  test(`допустимый радиус ${value} ниже порога не сообщает ошибку`, async ({ page }) => {
    await load(page);
    await strength(page, 24);
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.evaluate((input) => window.__veilLength.strength(input), value);
    await settle(page);
    expect(await page.evaluate(() => window.__veilLength.snapshot().count)).toBe(0);
    expect(errors).toEqual([]);
    await page.evaluate(() => window.__veilLength.strength('24px'));
    await strength(page, 24);
  });
}

test('нечисловой legacy ввод не становится конечной длиной CSS', async ({ page }) => {
  await load(page);
  await strength(page, 24);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.evaluate(() => window.__veilLength.strength('1e309'));
  await settle(page);
  expect(await page.evaluate(() => window.__veilLength.snapshot().count)).toBe(0);
  expect(errors.some((message) => message.includes('--lab-veil-strength'))).toBe(true);
});

test('отсутствующий и пустой токены сохраняют default, а media-смена пустого на ошибку наблюдаема', async ({
  page,
}) => {
  await load(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => window.__veilLength.css('.scope{--lab-veil-strength:initial}'));
  await settle(page);
  await strength(page, 24);
  await page.evaluate(() =>
    window.__veilLength.css(
      '.scope{--lab-veil-strength: }@media(prefers-color-scheme:dark){.scope{--lab-veil-strength:invalid}}',
    ),
  );
  await settle(page);
  await strength(page, 24);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => page.evaluate(() => window.__veilLength.snapshot().count)).toBe(0);
  await expect
    .poll(() => errors.some((message) => message.includes('--lab-veil-strength')))
    .toBe(true);
  await page.emulateMedia({ colorScheme: 'light' });
  await strength(page, 24);
});

test('явный профиль не зависит от перекрытого strength', async ({ page }) => {
  await load(page);
  await page.evaluate(() =>
    window.__veilLength.css(
      '.scope{--lab-veil-strength:auto;--lab-veil-stops:0 24px, 1 0px ease-out}',
    ),
  );
  await settle(page);
  await strength(page, 24);
  await page.evaluate(() => window.__veilLength.css('.scope{--lab-veil-strength:24px}'));
  await strength(page, 24);
});

test('container units вычисляются на поверхности, которая сама является контейнером', async ({
  page,
}) => {
  await load(page);
  await page.evaluate(() =>
    window.__veilLength.css(
      '.scope{container-type:size;width:500px;height:500px;--lab-veil-strength:10cqw}.veil,.reference{container-type:size}',
    ),
  );
  expect(await page.evaluate(() => window.__veilLength.snapshot().native)).toBe('blur(50px)');
  await strength(page, 50);
  await page.evaluate(() => window.__veilLength.containerWidth(700));
  expect(await page.evaluate(() => window.__veilLength.snapshot().native)).toBe('blur(70px)');
  await strength(page, 70);
  expect(await page.evaluate(() => window.__veilLength.snapshot().box)).toEqual([200, 200]);
});

test('media меняет legacy число без изменения DOM и размеров поверхности', async ({ page }) => {
  await load(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() =>
    window.__veilLength.css(
      '.scope{--lab-veil-strength:32}@media(prefers-color-scheme:dark){.scope{--lab-veil-strength:40}}',
    ),
  );
  await strength(page, 32);
  await page.emulateMedia({ colorScheme: 'dark' });
  await strength(page, 40);
  expect(await page.evaluate(() => window.__veilLength.snapshot().box)).toEqual([200, 200]);
});

for (const valid of ['32', '0', '0px']) {
  test(`media-смена ${valid} на проценты снимает эффект и сообщает ошибку`, async ({ page }) => {
    await load(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(
      (value) =>
        window.__veilLength.css(
          `.scope{--lab-veil-strength:${value}}@media(prefers-color-scheme:dark){.scope{--lab-veil-strength:50%}}`,
        ),
      valid,
    );
    await strength(page, Number.parseFloat(valid));
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => page.evaluate(() => window.__veilLength.snapshot().count)).toBe(0);
    await expect
      .poll(() => errors.some((message) => message.includes('--lab-veil-strength')))
      .toBe(true);
    await page.emulateMedia({ colorScheme: 'light' });
    await strength(page, Number.parseFloat(valid));
  });
}

test('feather принимает CSS-длину, эффект восстанавливается и освобождается', async ({ page }) => {
  await load(page);
  await page.evaluate(() => window.__veilLength.feather('0.5rem'));
  await settle(page);
  const rem = await page.evaluate(() => window.__veilLength.snapshot().masks);
  await page.evaluate(() => window.__veilLength.feather('8px'));
  await expect.poll(() => page.evaluate(() => window.__veilLength.snapshot().masks)).toEqual(rem);
  expect(rem.length).toBeGreaterThan(0);
  await page.evaluate(() => window.__veilLength.feather('0px'));
  await expect
    .poll(() => page.evaluate(() => window.__veilLength.snapshot().masks))
    .not.toEqual(rem);
  await page.evaluate(() => window.__veilLength.feather('0.5rem'));
  await expect.poll(() => page.evaluate(() => window.__veilLength.snapshot().masks)).toEqual(rem);
  await page.evaluate(() => window.__veilLength.replace());
  await strength(page, 24);
  await page.evaluate(() => window.__veilLength.dispose());
  expect(await page.evaluate(() => window.__veilLength.snapshot())).toMatchObject({
    count: 0,
    children: 0,
    types: 0,
  });
});

for (const mode of ['open', 'closed'] as const) {
  test(`проекции работают в ${mode} Shadow DOM и живут до последнего владельца`, async ({
    page,
  }) => {
    await load(page);
    await page.evaluate((value) => window.__veilLength.startShadow(value), mode);
    await expect
      .poll(() => page.evaluate(() => window.__veilLength.shadowSnapshot().native))
      .toBe('blur(28px)');
    await expect
      .poll(async () =>
        Math.abs((await page.evaluate(() => window.__veilLength.shadowSnapshot().strength)) - 28),
      )
      .toBeLessThanOrEqual(0.02);
    expect(await page.evaluate(() => window.__veilLength.shadowSnapshot())).toMatchObject({
      types: 1,
      rootTypes: 1,
    });
    await page.evaluate(() => window.__veilLength.dispose());
    expect(await page.evaluate(() => window.__veilLength.shadowSnapshot().types)).toBe(1);
    await page.evaluate(() => window.__veilLength.shadowFont(48));
    await expect
      .poll(async () =>
        Math.abs((await page.evaluate(() => window.__veilLength.shadowSnapshot().strength)) - 40),
      )
      .toBeLessThanOrEqual(0.02);
    await page.evaluate(() => window.__veilLength.stopShadow());
    expect(await page.evaluate(() => window.__veilLength.snapshot().types)).toBe(0);
  });
}

test('проценты не превращаются в px и не оставляют старый blur', async ({ page }) => {
  await load(page);
  await strength(page, 24);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.evaluate(() => window.__veilLength.strength('50%'));
  await expect
    .poll(async () => (await page.evaluate(() => window.__veilLength.snapshot())).count)
    .toBe(0);
  expect(errors.some((message) => message.includes('--lab-veil-strength'))).toBe(true);
  await page.evaluate(() => window.__veilLength.strength('1.5rem'));
  await strength(page, 24);
});
