import { type Locator, type Page, expect, test } from '@playwright/test';
import { waitForThemePaint } from './helpers/theme-paint.js';

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

/** Compare pixels well outside each rounded corner, away from the antialiased arc. */
async function cornerDifference(page: Page, first: Buffer, second: Buffer): Promise<number[]> {
  return page.evaluate(
    async ([a, b]) => {
      const decode = async (base64: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Нет canvas 2d');
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height);
      };
      const [left, right] = await Promise.all([decode(a ?? ''), decode(b ?? '')]);
      if (left.width !== right.width || left.height !== right.height)
        throw new Error('Размеры снимков различаются');
      return [
        [2, 2],
        [left.width - 3, 2],
        [2, left.height - 3],
        [left.width - 3, left.height - 3],
      ].map(([x, y]) => {
        const offset = ((y ?? 0) * left.width + (x ?? 0)) * 4;
        return Math.max(
          ...[0, 1, 2].map((channel) =>
            Math.abs((left.data[offset + channel] ?? 0) - (right.data[offset + channel] ?? 0)),
          ),
        );
      });
    },
    [first.toString('base64'), second.toString('base64')],
  );
}

async function overrideFilter(surface: Locator, disabled: boolean): Promise<void> {
  await surface.evaluate((element, off) => {
    const root = element.getRootNode();
    const owner = root instanceof ShadowRoot ? root : element.ownerDocument.head;
    owner.querySelector('#corner-filter-control')?.remove();
    if (!off) return;
    const style = document.createElement('style');
    style.id = 'corner-filter-control';
    style.textContent =
      '[part="content"],.lab-card-content{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
    owner.append(style);
  }, disabled);
}

test('catalogue: Glass Card with Switch and Sheet preserves the rounded paint boundary', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/components.html?component=card');
  await page.getByTestId('data-theme-select').selectOption('dark');
  await page.getByTestId('data-material-select').selectOption('glass');
  const card = page.locator('.live-stage > lab-card');
  const surface = card.locator('.card > [part="content"]');
  await waitForThemePaint(page, card);
  await page.evaluate(() => document.fonts.ready);
  await card.scrollIntoViewIfNeeded();
  await settle(page);
  const bounds = await card.boundingBox();
  if (!bounds) throw new Error('Нет геометрии Card');
  const clip = {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  };
  const capture = () => page.screenshot({ clip, animations: 'disabled', scale: 'css' });
  await capture();
  const enabled = await capture();
  await overrideFilter(surface, true);
  await settle(page);
  const control = await capture();
  expect(await cornerDifference(page, enabled, control)).toEqual([0, 0, 0, 0]);
});

for (const renderer of ['core', 'react'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const material of ['solid', 'glass', 'acrylic'] as const) {
      test(`${renderer} ${theme} ${material}: material respects Card corners with and without media`, async ({
        page,
      }, testInfo) => {
        await page.goto('/_fixtures/card-backdrop.html');
        await page.addStyleTag({
          content:
            'main { overflow: auto; position: relative; background: var(--lab-bg-secondary); }',
        });
        await page.evaluate(
          ({ theme, material }) => {
            document.documentElement.dataset.theme = theme;
            document.documentElement.dataset.material = material;
            document.body.style.background = 'var(--lab-bg-primary)';
          },
          { theme, material },
        );
        const card = page.locator(renderer === 'core' ? '#core-card article' : '#react-card');
        const surface = card.locator(
          renderer === 'core' ? '[part="content"]' : '.lab-card-content',
        );
        await expect(surface).toBeVisible();
        await page.evaluate(() => document.fonts.ready);

        for (const media of ['none', 'slot', 'none', 'whitespace', 'image', 'none'] as const) {
          await page.evaluate((kind) => window.cardImageFixture.setMedia(kind), media);
          await overrideFilter(surface, false);
          await settle(page);
          await card.scrollIntoViewIfNeeded();
          const bounds = await card.boundingBox();
          if (!bounds) throw new Error('Нет геометрии Card');
          expect(bounds.y).toBeGreaterThanOrEqual(0);
          expect(bounds.y + bounds.height).toBeLessThanOrEqual(
            await page.evaluate(() => innerHeight),
          );
          const clip = {
            x: Math.round(bounds.x),
            y: Math.round(bounds.y),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
          };
          const capture = () => page.screenshot({ clip, animations: 'disabled', scale: 'css' });
          // A second capture observes the settled compositor, including a newly loaded SVG map.
          await capture();
          const enabled = await capture();
          await overrideFilter(surface, true);
          await settle(page);
          const control = await capture();
          const difference = await cornerDifference(page, enabled, control);
          await testInfo.attach(`${media}-corners`, {
            body: JSON.stringify({ difference, clip }),
            contentType: 'application/json',
          });
          await testInfo.attach(`${media}-material`, { body: enabled, contentType: 'image/png' });
          await testInfo.attach(`${media}-no-filter`, { body: control, contentType: 'image/png' });
          expect(difference, `${media}: filter changes no pixels outside the rounded Card`).toEqual(
            [0, 0, 0, 0],
          );
          await expect(card).toHaveCSS('border-radius', '16px');
          await expect(card).toHaveCSS('overflow', 'auto');
          const topRadius = media === 'none' || media === 'whitespace' ? '16px' : '0px';
          await expect(surface).toHaveCSS('border-top-left-radius', topRadius);
          await expect(surface).toHaveCSS('border-top-right-radius', topRadius);
          await expect(surface).toHaveCSS('border-bottom-left-radius', '16px');
          await expect(surface).toHaveCSS('border-bottom-right-radius', '16px');
        }
      });
    }
  }
}
