import { type Page, expect, test } from '@playwright/test';

const expected = {
  standalone: { mode: 'solid', pixel: [180, 40, 30, 255] },
  'outer-glass': { mode: 'glass', pixel: [0, 0, 0, 255] },
  'closed-card': { mode: 'glass', pixel: [0, 0, 0, 255] },
  'explicit-solid': { mode: 'solid', pixel: [140, 35, 180, 255] },
  unknown: { mode: 'solid', pixel: [180, 40, 30, 255] },
  empty: { mode: 'solid', pixel: [180, 40, 30, 255] },
  'open-slot': { mode: 'glass', pixel: [0, 0, 0, 255] },
  'hidden-slot': { mode: 'glass', pixel: [0, 0, 0, 255] },
};

async function pixel(page: Page, id: string): Promise<number[]> {
  const stage = await page.locator(`[data-card="${id}"]`).boundingBox();
  if (!stage) throw new Error(`Нет стенда ${id}`);
  // Центр пустого Content, вдали от текста, границы и линзы.
  const png = await page.screenshot({
    clip: { x: stage.x + 136, y: stage.y + 64, width: 1, height: 1 },
  });
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Нет 2D-контекста');
    context.drawImage(image, 0, 0);
    return [...context.getImageData(0, 0, 1, 1).data];
  }, png.toString('base64'));
}

async function open(page: Page): Promise<void> {
  await page.goto('/_fixtures/card-material-shadow.html');
  await page.waitForFunction(() => !!window.__cardMaterial);
}

async function snapshot(page: Page, id: string) {
  return page.evaluate((id) => window.__cardMaterial.snapshot(id), id);
}

async function expectMode(
  page: Page,
  id: string,
  mode: string,
  browserName: string,
): Promise<void> {
  await expect.poll(async () => (await snapshot(page, id)).mode).toBe(mode);
  if (browserName === 'chromium') {
    await expect
      .poll(async () => (await snapshot(page, id)).filters)
      .toBe(mode === 'glass' ? 1 : 0);
    if (mode === 'glass')
      await expect.poll(async () => (await snapshot(page, id)).inlineBackdrop).toContain('url(');
  } else {
    expect((await snapshot(page, id)).filters).toBe(0);
  }
}

test('SSR Card рисует локальный материал без JavaScript, включая closed DSD', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/_fixtures/card-material-shadow.html');
    for (const [id, value] of Object.entries(expected)) {
      expect(await pixel(page, id), `${id}: первый непрозрачный paint или подложка стекла`).toEqual(
        value.pixel,
      );
    }
  } finally {
    await context.close();
  }
});

test('hydration сохраняет CSS-режим и paint Content; движок добавляется только по возможности браузера', async ({
  page,
  browserName,
}) => {
  await open(page);
  const before = new Map<string, { mode: string; background: string; pixel: number[] }>();
  for (const [id, value] of Object.entries(expected)) {
    const state = await snapshot(page, id);
    expect(state.mode).toBe(value.mode);
    expect(state.filters).toBe(0);
    expect(state.rect.height).toBeGreaterThan(0);
    before.set(id, {
      mode: state.mode,
      background: state.background,
      pixel: await pixel(page, id),
    });
  }
  await page.evaluate(() => window.__cardMaterial.hydrate());
  for (const [id, initial] of before) {
    await expectMode(page, id, initial.mode, browserName);
    const state = await snapshot(page, id);
    expect({
      mode: state.mode,
      background: state.background,
      pixel: await pixel(page, id),
    }).toEqual(initial);
  }
});

test('закрытый потребитель: режим предка, снятие override и reconnect доходят до Content', async ({
  page,
  browserName,
}) => {
  await open(page);
  await page.evaluate(() => window.__cardMaterial.hydrate());
  await expectMode(page, 'closed-card', 'glass', browserName);
  await page.evaluate(() => window.__cardMaterial.outerMode('solid'));
  await expectMode(page, 'closed-card', 'solid', browserName);
  expect(await pixel(page, 'closed-card')).toEqual([140, 35, 180, 255]);
  await page.evaluate(() => window.__cardMaterial.override('closed-card', 'glass'));
  await expectMode(page, 'closed-card', 'glass', browserName);
  await page.evaluate(() => window.__cardMaterial.override('closed-card', null));
  await expectMode(page, 'closed-card', 'solid', browserName);
  await page.evaluate(() => {
    window.__cardMaterial.connect('closed-card', false);
    window.__cardMaterial.outerMode('glass');
    window.__cardMaterial.connect('closed-card', true);
  });
  await expectMode(page, 'closed-card', 'glass', browserName);
});

test('открытый slot: runtime следует вычисленному CSS, явный Solid изолирует Card', async ({
  page,
  browserName,
}) => {
  await open(page);
  await page.evaluate(() => window.__cardMaterial.hydrate());
  await expectMode(page, 'open-slot', 'glass', browserName);
  expect(
    await page
      .locator('#open-slot')
      .evaluate((card) => card.closest('[data-material]')?.getAttribute('data-material')),
  ).toBe('solid');
  await page.evaluate(() => window.__cardMaterial.slotMode('solid'));
  await expectMode(page, 'open-slot', 'solid', browserName);
  expect(await pixel(page, 'open-slot')).toEqual([180, 40, 30, 255]);
  await page.evaluate(() => window.__cardMaterial.slotMode('glass'));
  await expectMode(page, 'open-slot', 'glass', browserName);
  await page.evaluate(() => window.__cardMaterial.override('open-slot', 'solid'));
  await expectMode(page, 'open-slot', 'solid', browserName);
  await page.evaluate(() => window.__cardMaterial.override('open-slot', null));
  await expectMode(page, 'open-slot', 'glass', browserName);
});
