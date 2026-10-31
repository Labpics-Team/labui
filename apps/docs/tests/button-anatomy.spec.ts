import { type Locator, expect, test } from '@playwright/test';

// Значения read-only эталона; не выводятся из product tokens или второго renderer.
const reference = [
  {
    size: 's',
    height: 36,
    inset: 12,
    region: 20,
    font: 14,
    line: 12,
    descriptionWeight: 500,
    tracking: 0,
  },
  {
    size: 'm',
    height: 48,
    inset: 12,
    region: 24,
    font: 16,
    line: 24,
    descriptionWeight: 400,
    tracking: -0.25,
  },
  {
    size: 'l',
    height: 56,
    inset: 16,
    region: 24,
    font: 16,
    line: 24,
    descriptionWeight: 400,
    tracking: -0.25,
  },
] as const;

type Renderer = 'lit' | 'react' | 'vue';
function nativeButton(host: Locator, renderer: Renderer) {
  return renderer === 'react' ? host : host.locator('button');
}
function region(host: Locator, renderer: Renderer, position: 'start' | 'end') {
  return host.locator(
    renderer === 'react'
      ? `.lab-button-icon[data-position="${position}"]`
      : `slot[name="${position === 'start' ? 'icon' : 'end'}"]`,
  );
}

async function glyphInRegion(
  host: Locator,
  renderer: Renderer,
  position: 'start' | 'end',
  size: number,
) {
  const cell = await bounds(region(host, renderer, position));
  const glyph = await bounds(host.locator(`[data-glyph="${position}"]`));
  expect(cell.width).toBeCloseTo(size, 1);
  expect(cell.height).toBeCloseTo(size, 1);
  expect(glyph.width, 'Явный caller width остаётся 16px при любом root size').toBe(16);
  expect(glyph.height).toBe(16);
  expect(glyph.x - cell.x).toBeCloseTo((size - 16) / 2, 1);
  expect(glyph.y - cell.y).toBeCloseTo((size - 16) / 2, 1);
  return cell;
}

async function bounds(locator: Locator) {
  const value = await locator.boundingBox();
  if (!value) throw new Error('Ожидалась видимая область кнопки');
  return value;
}

test('Lit: anatomy keeps caller glyph size and renders description and end icon', async ({
  page,
}) => {
  await page.goto('/button.html');
  await page.evaluate(async () => {
    await customElements.whenDefined('lab-button');
    const host = document.createElement('lab-button');
    host.dataset.testid = 'anatomy-witness';
    host.setAttribute('description', 'Description');
    host.innerHTML =
      '<svg slot="icon" data-glyph="start" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor"/></svg><span>Button</span><svg slot="end" data-glyph="end" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor"/></svg>';
    document.body.append(host);
  });
  const host = page.getByTestId('anatomy-witness');
  const button = host.locator('button');
  await expect(button).toBeVisible();
  const glyph = await bounds(host.locator('[data-glyph="start"]'));
  expect.soft(glyph.width, 'Размер SVG задаётся вызывающим кодом').toBe(16);
  expect.soft(glyph.height, 'Размер SVG задаётся вызывающим кодом').toBe(16);
  await expect.soft(host.getByText('Description', { exact: true })).toBeVisible();
  await expect.soft(host.locator('[data-glyph="end"]')).toBeVisible();
  await expect.soft(button).toHaveAccessibleName('Button Description');
});

for (const renderer of ['lit', 'react', 'vue'] as const) {
  for (const rootPx of [16, 20]) {
    test(`${renderer}: anatomy dimensions and wrappers at root ${rootPx}`, async ({
      page,
    }, testInfo) => {
      await page.goto('/_fixtures/button-anatomy.html');
      await page.evaluate(async (value) => {
        document.documentElement.style.fontSize = `${value}px`;
        await document.fonts.ready;
      }, rootPx);
      await expect(page.getByTestId(`${renderer}-anatomy-s-full`)).toBeVisible();
      await expect(
        nativeButton(page.getByTestId(`${renderer}-anatomy-s-full`), renderer),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const faces = await page.evaluate(() =>
        [...document.fonts]
          .filter((font) => font.status === 'loaded')
          .map((font) => font.family.replace(/["']/g, '')),
      );
      expect(faces).toContain('Geist');
      const scale = rootPx / 16;
      for (const expected of reference) {
        const plain = page.getByTestId(`${renderer}-anatomy-${expected.size}-plain`);
        const plainBox = await bounds(nativeButton(plain, renderer));
        const empty = page.getByTestId(`${renderer}-anatomy-${expected.size}-empty`);
        const emptyBox = await bounds(nativeButton(empty, renderer));
        expect(
          emptyBox.width - plainBox.width,
          'Пустой назначенный span резервирует одну ячейку',
        ).toBeCloseTo(expected.region * scale, 1);
        expect(plainBox.height).toBeCloseTo(expected.height * scale, 1);
        for (const mode of ['full', 'wrapped'] as const) {
          const host = page.getByTestId(`${renderer}-anatomy-${expected.size}-${mode}`);
          const button = nativeButton(host, renderer);
          await expect(button).toHaveAccessibleName('Button Description');
          const buttonBox = await bounds(button);
          const start = await glyphInRegion(host, renderer, 'start', expected.region * scale);
          const end = await glyphInRegion(host, renderer, 'end', expected.region * scale);
          expect(buttonBox.height).toBeCloseTo(expected.height * scale, 1);
          expect(start.x - buttonBox.x).toBeCloseTo(expected.inset * scale, 1);
          expect(buttonBox.x + buttonBox.width - end.x - end.width).toBeCloseTo(
            expected.inset * scale,
            1,
          );
          const label = host.locator('[data-label]');
          const description = host.getByText('Description', { exact: true });
          const labelBox = await bounds(label);
          const descriptionBox = await bounds(description);
          expect(labelBox.x - start.x - start.width, 'Inset группы label').toBeCloseTo(
            8 * scale,
            1,
          );
          expect(
            descriptionBox.x - labelBox.x - labelBox.width,
            'Gap label-description',
          ).toBeCloseTo(8 * scale, 1);
          expect(
            end.x - descriptionBox.x - descriptionBox.width,
            'Trailing inset группы label',
          ).toBeCloseTo(8 * scale, 1);
          const metrics = await description.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              font: Number.parseFloat(style.fontSize),
              line: Number.parseFloat(style.lineHeight),
              weight: Number.parseFloat(style.fontWeight),
              tracking: Number.parseFloat(style.letterSpacing) || 0,
            };
          });
          expect(metrics.font).toBeCloseTo(expected.font * scale, 1);
          expect(metrics.line).toBeCloseTo(expected.line * scale, 1);
          expect(metrics.weight).toBe(expected.descriptionWeight);
          expect(metrics.tracking).toBeCloseTo(expected.tracking * scale, 2);
        }
      }
      if (renderer === 'lit' && rootPx === 16) {
        const path = testInfo.outputPath('button-anatomy.png');
        await page.locator('#lit-anatomy').screenshot({ path });
        await testInfo.attach('Button anatomy with authored glyph', {
          path,
          contentType: 'image/png',
        });
        await page.getByTestId('lit-anatomy-loading').check();
        const loadingPath = testInfo.outputPath('button-anatomy-loading.png');
        await page.locator('#lit-anatomy').screenshot({ path: loadingPath });
        await testInfo.attach('Button anatomy loading', {
          path: loadingPath,
          contentType: 'image/png',
        });
      }
    });
  }

  test(`${renderer}: RTL, loading and icon transitions preserve anatomy and names`, async ({
    page,
  }) => {
    await page.goto('/_fixtures/button-anatomy.html');
    const host = page.getByTestId(`${renderer}-anatomy-m-full`);
    const button = nativeButton(host, renderer);
    await expect(button).toHaveAccessibleName('Button Description');
    const original = await bounds(button);
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
    });
    const start = await bounds(region(host, renderer, 'start'));
    const end = await bounds(region(host, renderer, 'end'));
    expect(start.x).toBeGreaterThan(end.x);
    for (const loading of [true, false]) {
      await page.getByTestId(`${renderer}-anatomy-loading`).setChecked(loading);
      if (loading) await expect(button).toBeDisabled();
      else await expect(button).toBeEnabled();
      await expect(button).toHaveAccessibleName('Button Description');
      const after = await bounds(button);
      expect(after.width).toBeCloseTo(original.width, 1);
      expect(after.height).toBeCloseTo(original.height, 1);
      if (loading) {
        expect(
          await host
            .getByText('Description', { exact: true })
            .evaluate((element) => getComputedStyle(element).color),
        ).toBe('rgba(0, 0, 0, 0)');
      }
    }
    await page.getByTestId(`${renderer}-anatomy-icon`).check();
    await expect(button).toHaveAccessibleName('Button Description');
    const iconBox = await bounds(button);
    expect(iconBox.width).toBe(48);
    expect(iconBox.height).toBe(48);
    await page.getByTestId(`${renderer}-anatomy-icon`).uncheck();
    expect((await bounds(button)).width).toBeCloseTo(original.width, 1);
  });
}

for (const renderer of ['lit', 'react'] as const) {
  test(`${renderer}: caller SVG title remains an icon button name`, async ({ page }) => {
    await page.goto('/_fixtures/button-anatomy.html');
    const host = page.getByTestId(`${renderer}-anatomy-title`);
    const button = nativeButton(host, renderer);
    await expect(button).toHaveAccessibleName('Add item');
    await page.getByTestId(`${renderer}-anatomy-loading`).check();
    await expect(button).toHaveAccessibleName('Add item');
    await expect(button).toBeDisabled();
  });
}

for (const rootPx of [16, 20]) {
  test(`SSR adapter: anatomy exists without JavaScript at root ${rootPx}`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto('/_fixtures/button-names.html');
      await page.evaluate(async (value) => {
        document.documentElement.style.fontSize = `${value}px`;
        await document.fonts.ready;
      }, rootPx);
      for (const expected of reference) {
        const full = page.getByTestId(`ssr-anatomy-${expected.size}-full`);
        await expect(full.locator('button')).toHaveAccessibleName('Button Description');
        await glyphInRegion(full, 'lit', 'start', (expected.region * rootPx) / 16);
        await glyphInRegion(full, 'lit', 'end', (expected.region * rootPx) / 16);
        const plain = await bounds(
          page.getByTestId(`ssr-anatomy-${expected.size}-plain`).locator('button'),
        );
        const empty = await bounds(
          page.getByTestId(`ssr-anatomy-${expected.size}-empty`).locator('button'),
        );
        const whitespace = await bounds(
          page.getByTestId(`ssr-anatomy-${expected.size}-whitespace`).locator('button'),
        );
        expect(empty.width).toBeCloseTo(plain.width, 1);
        expect(whitespace.width - plain.width).toBeCloseTo((expected.region * rootPx) / 16, 1);
      }
    } finally {
      await context.close();
    }
  });
}
