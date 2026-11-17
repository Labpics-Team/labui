import { type Page, expect, test } from '@playwright/test';

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const found: string[] = [];
  errors.set(page, found);
  page.on('pageerror', (error) => found.push(error.message));
  await page.goto('/card.html');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByTestId('react-source')).toBeVisible();
});
test.afterEach(({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

for (const renderer of ['lit', 'react']) {
  test(`${renderer}: исходная анатомия, типографика и изображение`, async ({ page }) => {
    const host = page.getByTestId(`${renderer}-source`);
    const card = renderer === 'lit' ? host.locator('[data-lab-card]') : host;
    const metrics = await card.evaluate((element) => {
      const content = element.querySelector<HTMLElement>('.lab-card-content');
      const title = element.querySelector('.lab-card-title');
      const description = element.querySelector('.lab-card-description');
      if (!content || !title || !description) throw new Error('Missing Card anatomy');
      const cs = getComputedStyle(content);
      const ts = getComputedStyle(title);
      const ds = getComputedStyle(description);
      return {
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
        contentHeight: content.getBoundingClientRect().height,
        padding: cs.padding,
        title: [ts.fontSize, ts.lineHeight, ts.fontWeight, ts.letterSpacing],
        description: [ds.fontSize, ds.lineHeight, ds.fontWeight, ds.letterSpacing],
        complete: [...element.querySelectorAll('img')].every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      };
    });
    expect(metrics).toEqual({
      width: 400,
      height: 294,
      contentHeight: 94,
      padding: '24px',
      title: ['20px', '20px', '500', '-0.33px'],
      description: ['16px', '24px', '400', '-0.25px'],
      complete: true,
    });
    await expect(host.getByRole('heading', { name: 'Title' })).toBeVisible();
  });

  test(`${renderer}: тема и материал сохраняют содержимое и размер`, async ({ page }) => {
    const host = page.getByTestId(`${renderer}-source`);
    const content = host.locator('.lab-card-content');
    const before = await host.boundingBox();
    for (const theme of ['dark', 'light']) {
      for (const material of ['solid', 'acrylic', 'glass']) {
        await page.evaluate(
          ({ theme, material }) => {
            document.documentElement.dataset.theme = theme;
            document.documentElement.dataset.material = material;
          },
          { theme, material },
        );
        await expect(content).toBeVisible();
        await expect(host.getByText('Description', { exact: true })).toBeVisible();
        const after = await host.boundingBox();
        expect([after?.width, after?.height]).toEqual([before?.width, before?.height]);
      }
    }
  });

  test(`${renderer}: узкая ширина и масштаб сохраняют читаемый текст`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    const card = page.getByTestId(`${renderer}-source`);
    await expect(card.getByRole('heading', { name: 'Title' })).toBeVisible();
    const box = await card.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(360);
    expect(
      await card.locator('.lab-card-content').evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  });

  test(`${renderer}: заданная высота расширяет изображение, сохраняя Content как в Figma`, async ({
    page,
  }) => {
    const host = page.getByTestId(`${renderer}-source`);
    await host.evaluate((element) => {
      element.style.height = '400px';
    });
    await expect
      .poll(async () => (await host.locator('.lab-card-media').boundingBox())?.height)
      .toBe(306);
    expect((await host.locator('.lab-card-content').boundingBox())?.height).toBe(94);
  });

  test(`${renderer}: действие принадлежит кнопке и доступно с клавиатуры`, async ({ page }) => {
    const card = page.getByTestId(`${renderer}-elevated`);
    const button = card.getByRole('button', { name: 'Открыть пространство' });
    await button.focus();
    await expect(button).toBeFocused();
    await button.press('Enter');
    await expect(card).not.toHaveAttribute('role', 'button');
  });
}

test('Lit: изменение и переподключение сохраняют пустые области без лишних интервалов', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const card = document.querySelector('lab-card[data-testid="lit-source"]');
    const parent = card?.parentElement;
    if (!card || !parent) throw new Error('Missing Lit Card');
    card.remove();
    parent.prepend(card);
    card.setAttribute('caption', 'Caption');
    card.setAttribute(
      'description',
      'Длинное описание с переносом на следующую строку внутри карточки',
    );
  });
  const card = page.getByTestId('lit-source');
  await expect(card.getByText('Caption', { exact: true })).toBeVisible();
  await expect(card.getByText('Длинное описание', { exact: false })).toBeVisible();
  await page.evaluate(() => {
    const card = document.querySelector('lab-card[data-testid="lit-source"]');
    if (!card) throw new Error('Missing Lit Card');
    card.removeAttribute('caption');
    card.setAttribute('description', 'Description');
  });
  await expect.poll(async () => (await card.boundingBox())?.height).toBe(294);
});

test('Lit: текст и размер сохраняются от серверного HTML до hydration', async ({ page }) => {
  let releaseScripts = () => {};
  const scripts = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route('**/*.js', async (route) => {
    await scripts;
    await route.continue();
  });
  try {
    await page.goto('/card.html', { waitUntil: 'commit' });
    const card = page.getByTestId('lit-source');
    const title = card.getByRole('heading', { name: 'Title' });
    await expect(title).toBeVisible();
    await page.evaluate(() => document.fonts.load('500 20px Geist'));
    await expect.poll(async () => (await card.boundingBox())?.height).toBe(294);
    const serverTitle = await title.elementHandle();
    const before = await card.boundingBox();
    expect(await page.evaluate(() => customElements.get('lab-card') === undefined)).toBe(true);
    expect(
      await card
        .locator('img')
        .first()
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    ).toBe(true);
    releaseScripts();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => customElements.get('lab-card') !== undefined);
    await page.evaluate(async () => {
      const card = document.querySelector('lab-card') as HTMLElement & {
        updateComplete: Promise<unknown>;
      };
      await card.updateComplete;
    });
    expect(await serverTitle?.evaluate((element) => element.isConnected)).toBe(true);
    expect((await card.boundingBox())?.height).toBe(before?.height);
    await expect(title).toHaveText('Title');
  } finally {
    releaseScripts();
    if (!page.isClosed()) await page.unroute('**/*.js');
  }
});

test('Lit: одна подпись не создаёт пустую группу заголовка', async ({ page }) => {
  const card = page.getByTestId('lit-outlined');
  await card.evaluate((element) => {
    element.style.alignSelf = 'start';
    element.removeAttribute('heading');
    element.removeAttribute('description');
    element.setAttribute('caption', 'Подпись');
  });
  await expect(card.getByText('Подпись')).toBeVisible();
  await expect
    .poll(async () => (await card.locator('[data-lab-card]').boundingBox())?.height)
    .toBe(60);
});

test('media: пользовательское изображение сохраняет естественную высоту в обоих исполнениях', async ({
  page,
}) => {
  await page.goto('/_fixtures/card-content.html');
  for (const renderer of ['lit', 'react']) {
    const card = page.getByTestId(`${renderer}-media`);
    const image = card.getByRole('img', { name: 'Preview' });
    await expect(image).toBeVisible();
    await expect.poll(async () => (await image.boundingBox())?.height).toBe(250);
    expect((await card.locator('.lab-card-media').boundingBox())?.height).toBe(250);
  }
});

test('Lit: существующий Text node становится видимым без обновления компонента', async ({
  page,
}) => {
  await page.goto('/_fixtures/card-content.html');
  const card = page.getByTestId('lit-dynamic');
  await card.evaluate(async (element) => {
    const text = document.createTextNode('');
    element.append(text);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    text.data = 'Dynamically loaded text';
  });
  await expect(card).toContainText('Dynamically loaded text');
  expect(
    await card.evaluate((element) => {
      const range = document.createRange();
      range.selectNode(element.lastChild as Node);
      return range.getBoundingClientRect().height;
    }),
  ).toBeGreaterThan(0);
});

test('Lit SSR: пустая media не сдвигает содержимое карточки фиксированной высоты', async ({
  page,
}) => {
  let releaseScripts = () => {};
  const scripts = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route('**/*.js', async (route) => {
    await scripts;
    await route.continue();
  });
  try {
    await page.goto('/_fixtures/card-content.html', { waitUntil: 'commit' });
    const card = page.getByTestId('lit-fixed');
    const title = card.getByRole('heading', { name: 'SSR fixed' });
    await expect(title).toBeVisible();
    await page.evaluate(() => document.fonts.load('500 20px Geist'));
    const media = page.getByTestId('lit-media');
    const fixedContent = card.locator('.lab-card-content');
    const mediaContent = media.locator('.lab-card-content').first();
    await expect(fixedContent).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(fixedContent).toHaveCSS('border-top-left-radius', '16px');
    await expect(mediaContent).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(mediaContent).toHaveCSS('border-top-left-radius', '0px');
    await media.evaluate((element) => {
      const child = document.createElement('lab-card');
      child.dataset.testid = 'nested-card';
      child.setAttribute('heading', 'Nested');
      element.append(child);
    });
    await expect(page.getByTestId('nested-card')).toHaveCSS('--_card-slotted-top-radius', '1rem');
    const before = {
      title: await title.boundingBox(),
      footer: await card.getByText('Footer').boundingBox(),
    };
    const host = await card.boundingBox();
    expect(before.title?.y).toBe((host?.y ?? 0) + 24);
    expect((await card.locator('.lab-card-media').boundingBox())?.height).toBe(0);
    expect(await page.evaluate(() => customElements.get('lab-card') === undefined)).toBe(true);
    releaseScripts();
    await page.waitForLoadState('domcontentloaded');
    await card.evaluate(async (element) => {
      await customElements.whenDefined('lab-card');
      await (element as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    });
    expect({
      title: await title.boundingBox(),
      footer: await card.getByText('Footer').boundingBox(),
    }).toEqual(before);
    expect((await card.boundingBox())?.height).toBe(400);
    await expect(fixedContent).toHaveCSS('border-top-left-radius', '16px');
    await expect(mediaContent).toHaveCSS('border-top-left-radius', '0px');
    await expect(page.getByTestId('nested-card').locator('.lab-card-content')).toHaveCSS(
      'border-top-left-radius',
      '16px',
    );
    // Hydration moves the paint into the smoothed surface. Inspect its visible
    // pixels instead of requiring the original CSS background implementation.
    for (const content of [fixedContent, mediaContent]) {
      await content.scrollIntoViewIfNeeded();
      const box = await content.boundingBox();
      if (!box) throw new Error('Missing visible Card content');
      const sample = await page.screenshot({
        clip: { x: box.x + box.width - 40, y: box.y + box.height - 32, width: 8, height: 8 },
      });
      expect(
        await page.evaluate(async (base64) => {
          const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
          const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 8;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Missing image decoder');
          context.drawImage(image, 0, 0);
          image.close();
          return [...context.getImageData(0, 0, 8, 8).data].every((channel) => channel === 255);
        }, sample.toString('base64')),
      ).toBe(true);
    }
  } finally {
    releaseScripts();
    if (!page.isClosed()) await page.unroute('**/*.js');
  }
});
