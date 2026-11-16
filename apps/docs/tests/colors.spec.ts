import { expect, test } from '@playwright/test';

test('authored first frame works without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/colors.html');
    await expect(page.locator('#theme-sample h2')).toHaveCSS('color', 'rgb(16, 16, 18)');
    await expect(page.locator('#theme-neighbor h2')).toHaveCSS('color', 'rgb(246, 248, 250)');
    await expect(page.locator('#sample-primary button')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(page.locator('#sample-primary button')).toHaveCSS(
      'background-color',
      'rgb(0, 122, 255)',
    );
    expect((await page.locator('#sample-primary button').boundingBox())?.height).toBe(42);
  } finally {
    await context.close();
  }
});

for (const width of [390, 1280]) {
  for (const scale of [16, 32]) {
    test(`SSR button geometry and nodes survive hydration at ${width}px/${scale}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      let release: () => void = () => {};
      const hydration = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/assets/colors-*.js', async (route) => {
        await hydration;
        await route.continue();
      });
      await page.goto('/colors.html', { waitUntil: 'commit' });
      await expect(page.locator('#sample-primary button')).toBeVisible();
      await page.locator('html').evaluate((element, value) => {
        element.style.fontSize = `${value}px`;
      }, scale);
      // WebKit's fonts.ready also waits for document loading, which this test
      // deliberately pauses. Load the faces without releasing hydration.
      await page.evaluate(() => Promise.all([...document.fonts].map((face) => face.load())));
      const beforeNode = await page.locator('#sample-primary button').elementHandle();
      const read = () =>
        page.locator('.theme-grid section, lab-button').evaluateAll((elements) =>
          elements.map((element) => {
            const box = element.getBoundingClientRect();
            const button = element.shadowRoot?.querySelector('button');
            const style = getComputedStyle(button ?? element);
            return {
              width: box.width,
              height: box.height,
              color: style.color,
              background: style.backgroundColor,
              radius: style.borderRadius,
              font: style.fontFamily,
              size: style.fontSize,
            };
          }),
        );
      const before = await read();
      release();
      await expect(page.locator('#theme-sample')).toHaveAttribute('data-contrast', 'normal');
      await page.evaluate(async () => {
        await customElements.whenDefined('lab-button');
        const button = document.querySelector('#sample-primary') as HTMLElement & {
          updateComplete: Promise<unknown>;
        };
        await button.updateComplete;
      });
      expect(await read()).toEqual(before);
      expect(
        await page
          .locator('#sample-primary button')
          .evaluate((element, serverNode) => element === serverNode, beforeNode),
      ).toBe(true);
    });
  }
}

test('setTheme and raw attributes retain observations and reconcile through the same runtime', async ({
  page,
}) => {
  await page.goto('/_fixtures/colors-scope.html');
  await page.waitForFunction(() => !!window.colorsProof);
  expect(
    await page.evaluate(() =>
      window.colorsProof.update({ theme: 'light', contrast: 'more', backgrounds: [[0, 0, 0]] }),
    ),
  ).toBe(true);
  await page.evaluate(() => window.colorsProof.setTheme('dark'));
  await expect(page.locator('#scope')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#scope h2')).toHaveCSS('color', 'rgb(246, 248, 250)');
  await expect.poll(() => page.evaluate(() => window.colorsProof.scope.state?.theme)).toBe('dark');
  await page.evaluate(() => window.colorsProof.setTheme('light'));
  await expect.poll(() => page.evaluate(() => window.colorsProof.scope.state?.theme)).toBe('light');
  await expect(page.locator('#scope h2')).toHaveCSS('color', 'rgb(246, 248, 250)');
  expect(
    await page.evaluate(() => {
      window.colorsProof.setTheme('dark');
      return window.colorsProof.update({ backgrounds: [[255, 255, 255]] });
    }),
  ).toBe(true);
  await expect(page.locator('#scope')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#scope h2')).toHaveCSS('color', 'rgb(16, 16, 18)');
  expect(
    await page.evaluate(() =>
      window.colorsProof.update({
        contrast: 'normal',
        backgrounds: [
          [0, 0, 0],
          [255, 255, 255],
        ],
      }),
    ),
  ).toBe(true);
  const before = await page.locator('#scope').evaluate((element) => element.outerHTML);
  await page.locator('#scope').evaluate((element) => element.setAttribute('data-contrast', 'more'));
  await expect.poll(() => page.evaluate(() => window.colorsProof.errors.length)).toBe(1);
  expect(await page.locator('#scope').evaluate((element) => element.outerHTML)).toBe(before);
});

test('theme layout keeps content at 100% and 200% on narrow and wide screens', async ({ page }) => {
  await page.goto('/colors.html');
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const fontSize of ['16px', '32px']) {
      await page.locator('html').evaluate((element, value) => {
        element.style.fontSize = value;
      }, fontSize);
      const widths = await page.locator('.theme-grid').evaluate((element) => ({
        scroll: element.scrollWidth,
        width: element.clientWidth,
      }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.width);
    }
  }
});

test('scoped update, rejection, recovery and disposal preserve the actual DOM', async ({
  page,
}) => {
  await page.goto('/_fixtures/colors-scope.html');
  await page.waitForFunction(() => !!window.colorsProof);
  const neighbor = await page.locator('#neighbor').evaluate((element) => element.outerHTML);
  const original = await page.locator('#scope').getAttribute('style');
  expect(await page.evaluate(() => window.colorsProof.update({ theme: 'dark' }))).toBe(true);
  await expect(page.locator('#scope h2')).toHaveCSS('color', 'rgb(246, 248, 250)');
  await expect(page.locator('#shadow-host span')).toHaveCSS('color', 'rgb(246, 248, 250)');
  expect(await page.locator('#neighbor').evaluate((element) => element.outerHTML)).toBe(neighbor);
  expect(
    await page.evaluate(() => window.colorsProof.update({ theme: 'light', contrast: 'more' })),
  ).toBe(true);
  const before = await page.locator('#scope').evaluate((element) => element.outerHTML);
  expect(
    await page.evaluate(() =>
      window.colorsProof.update({
        backgrounds: [
          [0, 0, 0],
          [255, 255, 255],
        ],
      }),
    ),
  ).toBe(false);
  expect(await page.locator('#scope').evaluate((element) => element.outerHTML)).toBe(before);
  expect(await page.evaluate(() => window.colorsProof.errors.length)).toBe(1);
  expect(await page.evaluate(() => window.colorsProof.update({ backgrounds: [[0, 0, 0]] }))).toBe(
    true,
  );
  await expect(page.locator('#shadow-host span')).toHaveCSS('color', 'rgb(246, 248, 250)');
  await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>('#scope');
    if (element) element.style.padding = '37px';
    window.colorsProof.scope.dispose();
    window.colorsProof.scope.dispose();
  });
  await expect(page.locator('#scope')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#scope h2')).toHaveCSS('color', 'rgb(16, 16, 18)');
  await expect(page.locator('#scope')).toHaveCSS('padding', '37px');
  expect(
    await page.locator('#scope').evaluate((element) => element.getAttribute('style')),
  ).not.toBe(original);
  expect(
    await page.locator('#scope').evaluate((element) => element.getAttribute('style')),
  ).not.toContain('--lab-');
});

test('the documented theme controls update a real LabUI button and keep the neighbor', async ({
  page,
}) => {
  await page.goto('/colors.html');
  await expect(page.locator('#theme-sample')).toHaveAttribute('data-contrast', 'normal');
  const neighbor = await page
    .locator('#theme-neighbor')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect(page.locator('#sample-primary button')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.locator('#theme-choice').selectOption('dark');
  await expect(page.locator('#theme-sample')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#sample-primary button')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.locator('#contrast-choice').check();
  await expect(page.locator('#theme-sample')).toHaveAttribute('data-contrast', 'more');
  expect(
    await page
      .locator('#theme-neighbor')
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe(neighbor);
});
