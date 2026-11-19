import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const errors: string[] = [];
    Object.assign(window, { progressMotionErrors: errors });
    document.addEventListener('motion-error', (event) => {
      errors.push(String((event as CustomEvent).detail.error));
    });
  });
  await page.goto('/_fixtures/progress-author.html');
});
test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => Reflect.get(window, 'progressMotionErrors'))).toEqual([]);
});
for (const renderer of ['lit', 'react']) {
  test(`${renderer}: measured updates, zero, unknown and shape changes preserve meaning`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const root = page.getByTestId(`${renderer}-change`);
    const bar = root.getByRole('progressbar');
    const loader =
      renderer === 'lit'
        ? page.getByTestId('lit-loader-change').getByRole('progressbar')
        : page.getByTestId('react-loader-change');
    await expect(bar).toHaveAttribute('aria-valuenow', '25');
    await page.getByRole('button', { name: '75%', exact: true }).click();
    for (const indicator of [bar, loader])
      await expect(indicator).toHaveAttribute('aria-valuenow', '75');
    await page.getByRole('button', { name: 'Сменить форму' }).click();
    await expect(bar).toHaveClass('lab-progress-track');
    await expect(bar).toHaveAttribute('aria-valuenow', '75');
    await page.getByRole('button', { name: '0%', exact: true }).click();
    for (const indicator of [bar, loader])
      await expect(indicator).toHaveAttribute('aria-valuenow', '0');
    await expect(root.locator('.lab-progress-value-text')).toHaveText('0%');
    await page.getByRole('button', { name: 'Неизвестно' }).click();
    for (const indicator of [bar, loader]) {
      await expect(indicator).not.toHaveAttribute('aria-valuenow', /.*/);
      await expect(indicator).not.toHaveAttribute('aria-valuetext', /.*/);
    }
    await expect(root.locator('.lab-progress-value-text')).toHaveCount(0);
    await page.getByRole('button', { name: '75%', exact: true }).click();
    await expect(bar).toHaveAttribute('aria-valuenow', '75');
  });
}

test('first server frame and hydration retain adapter values and names', async ({
  page,
  request,
}) => {
  const html = await (await request.get('/_fixtures/progress-author.html')).text();
  expect(html).toContain('shadowrootmode="open"');
  expect(html).toContain('aria-valuenow="30"');
  const root = page.getByTestId('ssr-progress');
  const bar = root.getByRole('progressbar');
  await expect(bar).toHaveAccessibleName('Серверный прогресс');
  await expect(bar).toHaveAttribute('aria-valuenow', '30');
  await expect(root.locator('.lab-progress-value-text')).toHaveText('50%');
  await root.locator('lab-progress').evaluate((el) => el.setAttribute('size', 'l'));
  await expect(bar).toHaveAttribute('aria-valuenow', '30');
  await expect(bar).toHaveAttribute('aria-valuemin', '10');
  await expect(page.getByTestId('ssr-loader').getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '75',
  );
});

test('authored SVG and values are visible without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/_fixtures/progress-author.html');
    await expect(page.getByTestId('ssr-progress').getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '30',
    );
    await expect(page.getByTestId('ssr-progress').locator('.lab-progress-value-text')).toHaveText(
      '50%',
    );
    await expect(page.locator('#loaders lab-loader').first().locator('rect')).toHaveCount(8);
    await expect(page.locator('#loaders lab-loader').first().locator('svg').first()).toBeVisible();
  } finally {
    await context.close();
  }
});

test('linear geometry is proportional, has an empty zero and follows RTL', async ({ page }) => {
  const bars = page.locator('#lit .linear lab-progress');
  for (let i = 0; i < 5; i++) {
    const root = bars.nth(i);
    const track = await root.locator('.lab-progress-track').boundingBox();
    const fill = await root.locator('.lab-progress-range').boundingBox();
    expect(track?.height).toBe(4);
    expect(fill?.width ?? 0).toBeCloseTo(((track?.width ?? 0) * i) / 4, 1);
  }
  await page.locator('#lit .linear').evaluate((el) => el.setAttribute('dir', 'rtl'));
  const track = await bars.nth(1).locator('.lab-progress-track').boundingBox();
  const fill = await bars.nth(1).locator('.lab-progress-range').boundingBox();
  expect((fill?.x ?? 0) + (fill?.width ?? 0)).toBeCloseTo((track?.x ?? 0) + (track?.width ?? 0), 1);
});

test('round geometry and readable text survive both themes and 200% scale', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(
      (theme) => document.documentElement.setAttribute('data-theme', theme),
      theme,
    );
    await page
      .locator('#lit')
      .screenshot({ path: test.info().outputPath(`progress-${theme}-100.png`) });
    const track = await page
      .locator('#lit .circles lab-progress')
      .nth(1)
      .locator('circle')
      .first()
      .evaluate((el) => getComputedStyle(el).stroke);
    expect(track).toContain('0.32');
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
    document.documentElement.dir = 'rtl';
  });
  const circle = page.locator('#lit .circles lab-progress').nth(9);
  const box = await circle.locator('.lab-progress-circle').boundingBox();
  expect(box?.width).toBe(192);
  await expect(circle.locator('.lab-progress-value-text')).toHaveText('100%');
  const fits = await circle.locator('.lab-progress-value-text').evaluate((el) => {
    const style = getComputedStyle(el);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return false;
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return context.measureText(el.textContent ?? '').width < el.getBoundingClientRect().width;
  });
  expect(fits).toBe(true);
});

test('Motion changes the drawing and stops when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const spin = page.locator('#loaders lab-loader').first().locator('.lab-progress-spin');
  const before = await spin.evaluate((el) => getComputedStyle(el).transform);
  await expect.poll(() => spin.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before);
  await page.getByRole('button', { name: '75%', exact: true }).click();
  const root = page.getByTestId('lit-change').locator('.lab-progress-root');
  await expect(page.getByTestId('lit-change').getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '75',
  );
  await expect
    .poll(() =>
      root.evaluate((el) => Number(getComputedStyle(el).getPropertyValue('--_progress-ratio'))),
    )
    .toBe(0.75);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(spin).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  const resting = await spin.evaluate((el) => getComputedStyle(el).transform);
  await page.waitForTimeout(250);
  expect(await spin.evaluate((el) => getComputedStyle(el).transform)).toBe(resting);
  await page.getByRole('button', { name: 'Неизвестно' }).click();
  await expect(page.getByTestId('lit-change').getByRole('progressbar')).not.toHaveAttribute(
    'aria-valuenow',
    /.*/,
  );
});

test('unknown progress animates after shape changes and reconnects', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Неизвестно' }).click();
  for (const variant of ['circular', 'linear']) {
    for (const renderer of ['lit', 'react']) {
      const spin = page.getByTestId(`${renderer}-change`).locator('.lab-progress-spin');
      const before = await spin.evaluate((el) => getComputedStyle(el).transform);
      await expect
        .poll(() => spin.evaluate((el) => getComputedStyle(el).transform))
        .not.toBe(before);
    }
    if (variant === 'circular') await page.getByRole('button', { name: 'Сменить форму' }).click();
  }
  for (const id of ['lit-change', 'lit-loader-change']) {
    const host = page.getByTestId(id);
    await host.evaluate((el) => {
      const parent = el.parentElement;
      el.remove();
      parent?.append(el);
    });
    const spin = host.locator('.lab-progress-spin');
    const before = await spin.evaluate((el) => getComputedStyle(el).transform);
    await expect.poll(() => spin.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before);
  }
});

test('measured transitions show intermediate drawing while semantics update immediately', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() =>
    ['lit-change', 'lit-loader-change', 'react-change', 'react-loader-change'].every((id) => {
      const host = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      const root =
        host?.shadowRoot?.querySelector<HTMLElement>('.lab-progress-root,.lab-loader') ?? host;
      return root?.style.getPropertyValue('--_progress-ratio') === '0.25';
    }),
  );
  const observed = await page.evaluate(async () => {
    const hosts = ['lit-change', 'lit-loader-change', 'react-change', 'react-loader-change'].map(
      (id) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`),
    );
    const roots = hosts.map(
      (host) =>
        host?.shadowRoot?.querySelector<HTMLElement>('.lab-progress-root,.lab-loader') ?? host,
    );
    const values: number[][] = roots.map(() => []);
    const button = [...document.querySelectorAll('button')].find((el) => el.textContent === '75%');
    button?.click();
    for (let frame = 0; frame < 30; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      roots.forEach((root, index) => {
        if (root)
          values[index]?.push(Number(getComputedStyle(root).getPropertyValue('--_progress-ratio')));
      });
    }
    return values;
  });
  for (const frames of observed) {
    expect(frames.some((fraction) => fraction > 0.25 && fraction < 0.75)).toBe(true);
    expect(frames.at(-1)).toBe(0.75);
  }
});
