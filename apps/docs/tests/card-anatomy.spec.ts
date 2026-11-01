import type { LabCard } from '@labpics/ui-core/card';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { cardImage, longDescription, longHeading } from '../src/_fixtures/card-anatomy-cases';

const renderers = ['core', 'react'] as const;
type Renderer = (typeof renderers)[number];
const fixture = '/_fixtures/card-anatomy.html';
const card = (page: Page, renderer: Renderer, id: string) => page.locator(`#${renderer}-${id}`);
const content = (host: Locator, renderer: Renderer) =>
  host.locator(renderer === 'core' ? '[part="content"]' : '.lab-card-content');
const badge = (host: Locator, renderer: Renderer) =>
  host.locator(renderer === 'core' ? 'lab-badge' : '[data-lab-badge]');

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  if (!result) throw new Error('Элемент не имеет видимой геометрии');
  return result;
}

async function open(page: Page) {
  await page.goto(fixture);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#core-master img[alt="Цветовые полосы"]')).toBeVisible();
}

async function geometry(page: Page, renderer: Renderer, id: string) {
  const host = card(page, renderer, id);
  return {
    card: await box(host),
    content: await box(content(host, renderer)),
    image: await box(host.locator('img[alt="Цветовые полосы"]')),
    title: await box(host.getByRole('heading')),
    description: await box(host.getByText('Описание карточки', { exact: true })),
  };
}

function near(actual: number, expected: number, label: string) {
  expect(actual, label).toBeCloseTo(expected, 1);
}

// Числа взяты из опубликованного эталона, а не из генератора tokens:
// Card 400×294/400×400; Content HUG 94, image FILL; inside stroke вне layout.
test('первый SSR paint сохраняет source геометрию и типографику без JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await open(page);
    for (const renderer of renderers) {
      for (const [id, height, imageHeight] of [
        ['master', 294, 200],
        ['tall', 400, 306],
      ] as const) {
        const host = card(page, renderer, id);
        const actual = await geometry(page, renderer, id);
        near(actual.card.width, 400, 'ширина');
        near(actual.card.height, height, 'высота рамки');
        near(actual.content.height, 94, 'HUG Content');
        near(actual.content.width, 400, 'stroke не съедает Content');
        near(actual.image.height, imageHeight, 'изображение заполняет остаток');
        near(actual.image.width, 400, 'stroke не съедает изображение');
        near(actual.image.x, actual.card.x, 'изображение от края');
        near(actual.title.x - actual.card.x, 24, 'padding текста');
        near(actual.title.y - actual.content.y, 24, 'padding сверху');
        near(
          actual.description.y - actual.title.y - actual.title.height,
          2,
          'gap заголовок/описание',
        );
        const title = await host.getByRole('heading').evaluate((el) => {
          const cs = getComputedStyle(el);
          return {
            family: cs.fontFamily,
            weight: cs.fontWeight,
            size: Number.parseFloat(cs.fontSize),
            line: Number.parseFloat(cs.lineHeight),
            tracking: Number.parseFloat(cs.letterSpacing),
          };
        });
        expect(title.family).toContain('Geist');
        expect(title.weight).toBe('500');
        near(title.size, 20, 'размер заголовка');
        near(title.line, 20, 'line-height заголовка');
        near(title.tracking, -0.33, 'tracking заголовка');
        const description = await host
          .getByText('Описание карточки', { exact: true })
          .evaluate((el) => {
            const cs = getComputedStyle(el);
            return {
              weight: cs.fontWeight,
              size: Number.parseFloat(cs.fontSize),
              line: Number.parseFloat(cs.lineHeight),
              tracking: Number.parseFloat(cs.letterSpacing),
            };
          });
        expect(description.weight).toBe('400');
        near(description.size, 16, 'размер описания');
        near(description.line, 24, 'line-height описания');
        near(description.tracking, -0.25, 'tracking описания');
      }
      const auto = await geometry(page, renderer, 'intrinsic');
      near(auto.image.height, 250, 'intrinsic ratio 16:10');
      near(auto.card.height, 344, 'intrinsic + HUG');
    }
  } finally {
    await context.close();
  }
});

test('пустые optional области не оставляют gaps до hydration; явный padding сохраняется', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await open(page);
    for (const renderer of renderers) {
      for (const [id, expected] of [
        ['empty', 48],
        ['description', 72],
        ['caption', 60],
        ['lower', 60],
        ['caption-lower', 80],
        ['hint', 68],
        ['badge', 68],
      ] as const) {
        near(
          (await box(content(card(page, renderer, id), renderer))).height,
          expected,
          `${renderer}/${id}: только существующие группы`,
        );
      }
      const wrap = card(page, renderer, 'wrap');
      const wrapHeading = await box(wrap.getByRole('heading'));
      const wrapHint = await box(wrap.getByText('Title Hint', { exact: true }));
      const wrapBadge = await box(badge(wrap, renderer));
      near(wrapHint.y - wrapHeading.y - wrapHeading.height, 4, 'перенос heading/hint');
      near(wrapBadge.y - wrapHint.y - wrapHint.height, 4, 'перенос hint/badge');
      const all = card(page, renderer, 'all');
      const callerFooterHeight = (await box(all.getByRole('button', { name: 'Открыть' }))).height;
      // Footer — содержимое потребителя: его нативный border/padding зависят от UA.
      near(
        (await box(content(all, renderer))).height,
        190 + callerFooterHeight,
        'существующие группы + размер caller footer',
      );
      for (const [padding, expected] of [
        ['none', 0],
        ['s', 8],
        ['m', 16],
        ['l', 24],
      ] as const) {
        const host = card(page, renderer, `padding-${padding}`);
        const hostBox = await box(host);
        const titleBox = await box(host.getByRole('heading'));
        near(titleBox.x - hostBox.x, expected, `${renderer}/${padding}`);
        near((await box(content(host, renderer))).height, 46 + 2 * expected, 'padding Content');
      }
    }
    for (const rootSize of [16, 20]) {
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = `${size}px`;
      }, rootSize);
      const scale = rootSize / 16;
      for (const renderer of renderers) {
        const host = card(page, renderer, 'badge');
        const label = badge(host, renderer);
        const labelBox = await box(label);
        near(labelBox.height, 20 * scale, 'высота Badge по source');
        const textBox = await label.evaluate((element) => {
          const text = [...element.childNodes].find(
            (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === 'Badge',
          );
          if (!text) throw new Error('Нет текста Badge');
          const range = document.createRange();
          range.selectNodeContents(text);
          const rect = range.getBoundingClientRect();
          return { x: rect.x, width: rect.width };
        });
        // Source HUG: padding16 + glyph24 + gaps8 + естественная ширина текста.
        // Наблюдаемые в Figma 85px не задают фиксированную ширину другого текста.
        near(labelBox.width, textBox.width + 48 * scale, 'HUG Badge');
        await expect(label.locator('svg')).toHaveCount(2);
        await expect(label.getByRole('img')).toHaveCount(0);
        const glyphs = await label.locator('svg').all();
        for (const glyph of glyphs) {
          const glyphBox = await box(glyph);
          near(glyphBox.width, 12 * scale, 'ширина декоративного glyph');
          near(glyphBox.height, 12 * scale, 'высота декоративного glyph');
        }
        const [leading, trailing] = glyphs;
        if (!leading || !trailing) throw new Error('Нет пары glyph');
        const leadingBox = await box(leading);
        const trailingBox = await box(trailing);
        near(leadingBox.x - labelBox.x, 8 * scale, 'левый padding Badge');
        near(
          labelBox.x + labelBox.width - trailingBox.x - trailingBox.width,
          8 * scale,
          'правый padding Badge',
        );
        near(textBox.x - leadingBox.x - leadingBox.width, 4 * scale, 'leading gap Badge');
        near(trailingBox.x - textBox.x - textBox.width, 4 * scale, 'trailing gap Badge');
        const painted = renderer === 'core' ? label.locator('[part="badge"]') : label;
        const typography = await painted.evaluate((el) => {
          const cs = getComputedStyle(el);
          return {
            family: cs.fontFamily,
            weight: cs.fontWeight,
            size: Number.parseFloat(cs.fontSize),
            line: Number.parseFloat(cs.lineHeight),
          };
        });
        expect(typography.family).toContain('Geist');
        expect(typography.weight).toBe('500');
        near(typography.size, 12 * scale, 'кегль Badge');
        near(typography.line, 12 * scale, 'строка Badge');
      }
    }
  } finally {
    await context.close();
  }
});

test('один imageSrc заполняет две области, имеет один alt и выигрывает у media', async ({
  page,
}) => {
  await open(page);
  for (const renderer of renderers) {
    const host = card(page, renderer, 'override');
    await expect(host.locator('img')).toHaveCount(2);
    await expect(host.getByRole('img')).toHaveCount(1);
    await expect(host.getByRole('img')).toHaveAccessibleName('Цветовые полосы');
    await expect(host.locator('[data-probe="media"]')).toBeHidden();
    const images = await host.locator('img').evaluateAll((elements) =>
      elements.map((el) => {
        const image = el as HTMLImageElement;
        const cs = getComputedStyle(image);
        return {
          src: image.getAttribute('src'),
          alt: image.alt,
          fit: cs.objectFit,
          position: cs.objectPosition,
          width: image.getBoundingClientRect().width,
          height: image.getBoundingClientRect().height,
        };
      }),
    );
    expect(images.map((image) => image.src)).toEqual([cardImage, cardImage]);
    expect(images.every((image) => image.fit === 'cover' && image.position === '50% 50%')).toBe(
      true,
    );
    const underlay = images.find((image) => image.alt === '');
    expect(underlay).toMatchObject({ width: 400, height: 294 });
    await expect(card(page, renderer, 'media').locator('img')).toHaveCount(0);
    await expect(card(page, renderer, 'media').getByText('Своя медиа-область')).toBeVisible();
  }
});

test('header заменяет всю текстовую группу, headingLevel и полный текст сохраняют семантику', async ({
  page,
}) => {
  await open(page);
  for (const renderer of renderers) {
    const override = card(page, renderer, 'override');
    const assignedHeading = override.getByRole('heading', { name: 'Своя шапка' });
    await expect(assignedHeading).toBeVisible();
    // WebKit role selector включает unassigned fallback, хотя у него нет layout.
    // Проверяется реальный paint; доступность отдельно принадлежит native AX.
    expect(
      await override
        .locator('h2')
        .evaluateAll((elements) => elements.every((el) => el.getClientRects().length === 0)),
    ).toBe(true);
    await expect(override.getByText('Скрытая подпись')).toBeHidden();
    await expect(override.getByText('Скрытая нижняя подпись')).toBeHidden();
    await expect(override.getByText('Hint', { exact: true })).toBeHidden();
    await expect(badge(override, renderer)).toBeHidden();
    const headerBox = await box(assignedHeading);
    const bodyBox = await box(override.locator('[data-probe="body"]'));
    const footerBox = await box(override.locator('[data-probe="footer"]'));
    near(bodyBox.y - headerBox.y - headerBox.height, 16, 'header/body gap');
    near(footerBox.y - bodyBox.y - bodyBox.height, 16, 'body/footer gap');
    await expect(card(page, renderer, 'all').getByRole('heading', { level: 4 })).toHaveText(
      'Заголовок',
    );
    const long = card(page, renderer, 'long');
    await expect(long.getByRole('heading')).toHaveAccessibleName(longHeading);
    await expect(long.getByText(longDescription, { exact: true })).toHaveCount(2);
    near((await box(long.getByRole('heading'))).height, 20, 'заголовок в одну строку');
    const longBoxes = await long
      .getByText(longDescription, { exact: true })
      .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().height));
    const [descriptionHeight, lowerCaptionHeight] = longBoxes;
    if (descriptionHeight === undefined || lowerCaptionHeight === undefined) {
      throw new Error('Нет описания или нижней подписи');
    }
    near(descriptionHeight, 48, 'описание в две строки');
    near(lowerCaptionHeight, 24, 'нижняя подпись в две строки');
  }
});

test('root font-size масштабирует текст, интервалы и радиус без фиксированной media200', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '20px';
  });
  for (const renderer of renderers) {
    const actual = await geometry(page, renderer, 'tall');
    near(actual.content.height, 117.5, 'Content ×1.25');
    near(actual.image.height, 282.5, 'изображение заполняет новый остаток');
    near(actual.title.x - actual.card.x, 30, 'padding ×1.25');
    near(actual.title.height, 25, 'heading ×1.25');
    const host = card(page, renderer, 'tall');
    const surface = renderer === 'core' ? host.locator('article') : host;
    near(
      await surface.evaluate((el) => Number.parseFloat(getComputedStyle(el).borderTopLeftRadius)),
      20,
      'radius ×1.25',
    );
  }
});

test('тесная рамка сохраняет Content и доступный с клавиатуры footer', async ({ page }) => {
  await open(page);
  for (const renderer of renderers) {
    const host = card(page, renderer, 'tight');
    const article = renderer === 'core' ? host.locator('article') : host;
    const contentBox = await box(content(host, renderer));
    const footer = host.getByRole('button', { name: 'Открыть' });
    near(contentBox.height, 94 + 16 + (await box(footer)).height, 'Content не сжимается');
    near(
      await host
        .locator('img[alt="Цветовые полосы"]')
        .evaluate((el) => el.getBoundingClientRect().height),
      0,
      'image уходит до нуля',
    );
    await article.focus();
    await page.keyboard.press('Tab');
    await expect(footer).toBeFocused();
    const frame = await box(article);
    const control = await box(footer);
    expect(control.y).toBeGreaterThanOrEqual(frame.y);
    expect(control.y + control.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
    await page.keyboard.press('Enter');
  }
  expect(await page.evaluate(() => window.__cardAnatomy.activations.length)).toBe(2);
});

test('hydration/reconnect и смена imageSrc сохраняют геометрию и единственный материал', async ({
  page,
}) => {
  await open(page);
  await page.waitForFunction(() => !!window.__cardAnatomy);
  const before = new Map<Renderer, Awaited<ReturnType<typeof geometry>>>();
  const optionalBefore = new Map<string, number>();
  for (const renderer of renderers) before.set(renderer, await geometry(page, renderer, 'master'));
  for (const renderer of renderers)
    for (const id of ['description', 'caption', 'caption-lower', 'hint', 'badge', 'wrap']) {
      optionalBefore.set(
        `${renderer}-${id}`,
        (await box(content(card(page, renderer, id), renderer))).height,
      );
    }
  await page.evaluate(() => window.__cardAnatomy.hydrate());
  for (const renderer of renderers)
    expect(await geometry(page, renderer, 'master')).toEqual(before.get(renderer));
  expect(await page.evaluate(() => window.__cardAnatomy.errors)).toEqual([]);
  for (const renderer of renderers)
    for (const id of ['description', 'caption', 'caption-lower', 'hint', 'badge', 'wrap']) {
      expect((await box(content(card(page, renderer, id), renderer))).height).toBe(
        optionalBefore.get(`${renderer}-${id}`),
      );
    }
  await page.evaluate(() => window.__cardAnatomy.setImage(''));
  for (const renderer of renderers)
    await expect(card(page, renderer, 'master').locator('img')).toHaveCount(0);
  await page.evaluate((image) => window.__cardAnatomy.setImage(image), cardImage);
  await page.evaluate(() => window.__cardAnatomy.reconnect());
  for (const renderer of renderers) {
    const host = card(page, renderer, 'master');
    await expect(host.locator('img')).toHaveCount(2);
    await expect(host.locator('.lab-material')).toHaveCount(1);
    expect(await geometry(page, renderer, 'master')).toEqual(before.get(renderer));
  }
});

test('Core Badge сохраняет оба глифа при hydration, обновлении текста и совместном clear/readd', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  await page.waitForFunction(() => !!window.__cardAnatomy);
  const host = card(page, 'core', 'badge');
  const label = badge(host, 'core');
  const empty = card(page, 'core', 'empty');
  const ssrNodes = await host.evaluateHandle((element) => {
    const root = element.shadowRoot;
    if (!root) throw new Error('Нет SSR shadow root');
    return [root, ...root.querySelectorAll('lab-badge, svg')];
  });
  const ssrPaint = await label.screenshot();
  expect(await page.evaluate(() => customElements.get('lab-card') === undefined)).toBe(true);

  async function expectGlyphs(target: Locator, scale = 1) {
    const glyphs = target.locator('lab-badge svg');
    await expect(glyphs).toHaveCount(2);
    const painted = await glyphs.evaluateAll((elements) =>
      elements.map((element) => {
        const glyph = element as SVGSVGElement;
        const rect = glyph.getBoundingClientRect();
        const ink = glyph.getBBox();
        return {
          slot: glyph.slot,
          width: rect.width,
          height: rect.height,
          ink: { x: ink.x, y: ink.y, width: ink.width, height: ink.height },
        };
      }),
    );
    expect(painted.map((glyph) => glyph.slot)).toEqual(['leading', 'trailing']);
    for (const glyph of painted) {
      near(glyph.width, 12 * scale, 'ширина глифа');
      near(glyph.height, 12 * scale, 'высота глифа');
      expect(glyph.ink.width).toBeGreaterThan(0);
      expect(glyph.ink.height).toBeGreaterThan(0);
    }
    expect(painted[1]?.ink).toEqual(painted[0]?.ink);
  }

  async function setBadge(target: Locator, value: string) {
    await target.evaluate(async (element, next) => {
      const core = element as LabCard;
      core.badge = next;
      await core.updateComplete;
      await window.__cardAnatomy.settle();
    }, value);
  }

  await page.evaluate(() => window.__cardAnatomy.hydrate());
  expect(await ssrNodes.evaluate((nodes) => nodes.every((node) => node.isConnected))).toBe(true);
  await expect(label).toHaveCount(1);
  await expectGlyphs(host);
  expect(await label.screenshot()).toEqual(ssrPaint);
  expect(
    await page.evaluate(() => {
      const first = document.getElementById('core-badge')?.shadowRoot;
      const second = document.getElementById('core-wrap')?.shadowRoot;
      const id = 'lab-card-badge-glyph';
      const source = first?.getElementById(id);
      return !!source && source !== second?.getElementById(id) && !document.getElementById(id);
    }),
  ).toBe(true);

  await setBadge(host, 'Обновлено');
  await expect(label).toHaveText('Обновлено');
  expect(await ssrNodes.evaluate((nodes) => nodes.every((node) => node.isConnected))).toBe(true);
  await expectGlyphs(host);
  await expect(badge(empty, 'core')).toHaveCount(0);
  await setBadge(empty, 'Новый');
  await expectGlyphs(empty);

  for (const [theme, rootSize] of [
    ['light', 16],
    ['dark', 20],
  ] as const) {
    await page.evaluate(
      ([nextTheme, size]) => {
        document.documentElement.dataset.theme = nextTheme;
        document.documentElement.style.fontSize = `${size}px`;
      },
      [theme, rootSize] as const,
    );
    await setBadge(host, 'Badge');
    await expectGlyphs(host, rootSize / 16);
    const before = await label.screenshot();
    await setBadge(host, '');
    await expect(label).toHaveCount(0);
    await expect(host.locator('svg')).toHaveCount(0);
    await expectGlyphs(empty, rootSize / 16);
    await setBadge(host, 'Badge');
    await expectGlyphs(host, rootSize / 16);
    expect(await label.screenshot()).toEqual(before);
    await host.evaluate(async (element) => {
      const marker = document.createComment('reconnect');
      element.before(marker);
      element.remove();
      marker.replaceWith(element);
      await (element as LabCard).updateComplete;
      await window.__cardAnatomy.settle();
    });
    await expectGlyphs(host, rootSize / 16);
    expect(await label.screenshot()).toEqual(before);
  }
  expect(
    await ssrNodes.evaluate((nodes) => nodes.slice(1).every((node) => !node.isConnected)),
  ).toBe(true);
  await ssrNodes.dispose();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.__cardAnatomy.errors)).toEqual([]);
});
