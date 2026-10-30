import { type Locator, type Page, expect, test } from '@playwright/test';

// Эталон: docs/reference/design-baseline.md, Switch при Unit 100%.
// Числа независимы от генератора токенов: совпадение Lit и React само по себе
// не обнаруживает одинаковую ошибку геометрии в двух рендерах.
const sizes = [
  { size: 's', width: 28, height: 16, thumb: 12 },
  { size: 'm', width: 36, height: 20, thumb: 16 },
  { size: 'l', width: 44, height: 24, thumb: 20 },
] as const;

async function expectLoadedGeist(page: Page) {
  // fonts.ready и fonts.check проходят даже без @font-face. Нужен настоящий
  // загруженный face, иначе те же CSS-метрики могут измеряться на fallback.
  const loadedFamilies = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded')
      .map((face) => face.family.replace(/["']/g, ''));
  });
  expect(loadedFamilies, 'Switch demo должен загрузить настоящий FontFace Geist').toContain(
    'Geist',
  );
}

async function geometry(row: Locator, track: Locator, thumb: Locator) {
  const [r, t, k] = await Promise.all([
    row.boundingBox(),
    track.boundingBox(),
    thumb.boundingBox(),
  ]);
  if (!r || !t || !k) throw new Error('Switch должен быть виден для измерения');
  return {
    rowHeight: r.height,
    trackWidth: t.width,
    trackHeight: t.height,
    thumbWidth: k.width,
    thumbHeight: k.height,
    topInset: k.y - t.y,
    bottomInset: t.y + t.height - k.y - k.height,
    leftInset: k.x - t.x,
    rightInset: t.x + t.width - k.x - k.width,
  };
}

for (const renderer of ['lit', 'react'] as const) {
  for (const rootPx of [16, 20]) {
    for (const viewportWidth of [320, 1280]) {
      test(`${renderer}: Switch label metrics at root ${rootPx}, viewport ${viewportWidth}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewportWidth, height: 1000 });
        await page.goto('/switch.html');
        await page.evaluate(async (fontSize) => {
          document.documentElement.style.fontSize = `${fontSize}px`;
          await document.fonts.ready;
        }, rootPx);
        await expectLoadedGeist(page);
        const scale = rootPx / 16;

        for (const { size } of sizes) {
          const specimen = page.getByTestId(`${renderer}-size-${size}`);
          const row = specimen.locator(renderer === 'lit' ? '.root' : '[data-lab-switch]');
          const track = specimen.locator(renderer === 'lit' ? '.control' : '.lab-switch-control');
          const label = specimen.locator(renderer === 'lit' ? '.label' : '.lab-switch-label');
          await expect(row).toBeVisible();
          const metrics = await label.evaluate((el) => {
            const style = getComputedStyle(el);
            return {
              family: style.fontFamily.split(',')[0]?.trim().replace(/["']/g, ''),
              font: Number.parseFloat(style.fontSize),
              line: Number.parseFloat(style.lineHeight),
              tracking: Number.parseFloat(style.letterSpacing),
              weight: Number.parseFloat(style.fontWeight),
            };
          });
          const [trackBox, labelBox] = await Promise.all([
            track.boundingBox(),
            label.boundingBox(),
          ]);
          if (!trackBox || !labelBox) throw new Error('Switch и подпись должны быть видны');
          const large = size === 'l';
          expect(metrics.family, `${size} font family`).toBe('Geist');
          expect.soft(metrics.font, `${size} font`).toBeCloseTo((large ? 20 : 16) * scale, 2);
          expect.soft(metrics.line, `${size} line`).toBeCloseTo((large ? 20 : 24) * scale, 2);
          expect
            .soft(metrics.tracking, `${size} tracking`)
            .toBeCloseTo((large ? -0.33 : -0.25) * scale, 2);
          expect.soft(metrics.weight, `${size} weight`).toBe(large ? 500 : 400);
          expect
            .soft(labelBox.x - trackBox.x - trackBox.width, `${size} gap`)
            .toBeCloseTo((large ? 12 : 8) * scale, 2);
        }
      });
    }

    test(`${renderer}: Switch geometry at ${rootPx}px root`, async ({ page }) => {
      await page.goto('/switch.html');
      await page.evaluate(async (fontSize) => {
        document.documentElement.style.fontSize = `${fontSize}px`;
        await document.fonts.ready;
      }, rootPx);
      await expectLoadedGeist(page);
      const scale = rootPx / 16;

      for (const { size, width, height, thumb: diameter } of sizes) {
        const specimen = page.getByTestId(`${renderer}-size-${size}`);
        const row = specimen.locator(renderer === 'lit' ? '.root' : '[data-lab-switch]');
        const track = specimen.locator(renderer === 'lit' ? '.control' : '.lab-switch-control');
        const thumb = specimen.locator(renderer === 'lit' ? '.thumb' : '.lab-switch-thumb');
        await expect(row).toBeVisible();
        await expect(row.locator('input')).not.toBeChecked();

        const off = await geometry(row, track, thumb);
        const expected = {
          rowHeight: 24,
          trackWidth: width,
          trackHeight: height,
          thumbWidth: diameter,
          thumbHeight: diameter,
          topInset: 2,
          bottomInset: 2,
          leftInset: 2,
          rightInset: width - diameter - 2,
        };
        for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
          expect.soft(off[key], `${size} OFF ${key}`).toBeCloseTo(expected[key] * scale, 1);
        }

        await track.click();
        await expect(row.locator('input')).toBeChecked();
        // Ждём конечной геометрии настоящего перехода, не меняя checked вручную.
        await expect
          .poll(async () => (await geometry(row, track, thumb)).rightInset)
          .toBeCloseTo(2 * scale, 1);
        const on = await geometry(row, track, thumb);
        expect(on.leftInset - off.leftInset, `${size} checked travel`).toBeCloseTo(
          (width - diameter - 4) * scale,
          1,
        );
        expect(on.topInset).toBeCloseTo(2 * scale, 1);
        expect(on.bottomInset).toBeCloseTo(2 * scale, 1);
      }
    });
  }

  test(`${renderer}: Switch row grows for enlarged labels`, async ({ page }) => {
    await page.goto('/switch.html');
    const specimen = page.getByTestId(`${renderer}-size-l`);
    const row = specimen.locator(renderer === 'lit' ? '.root' : '[data-lab-switch]');
    await expect(row).toBeVisible();
    await specimen.evaluate((element) => {
      (element as HTMLElement).style.setProperty('--lab-font-size-switch-label-l', '3rem');
    });
    await expect.poll(async () => (await row.boundingBox())?.height ?? 0).toBeGreaterThan(24);
    const label = specimen.locator(renderer === 'lit' ? '.label' : '.lab-switch-label');
    expect((await label.boundingBox())?.height).toBeLessThanOrEqual(
      (await row.boundingBox())?.height ?? 0,
    );
  });

  for (const rootPx of [16, 20]) {
    test(`${renderer}: Combobox keeps its trigger space at ${rootPx}px root`, async ({ page }) => {
      await page.goto('/combobox.html');
      const specimen = page.getByTestId(`${renderer}-combobox`);
      const trigger = specimen.locator(renderer === 'lit' ? '.trigger' : '.lab-combobox-trigger');
      const input = specimen.locator(renderer === 'lit' ? '.input' : '.lab-combobox-input');
      await expect(trigger).toBeVisible();
      await page.evaluate((fontSize) => {
        document.documentElement.style.fontSize = `${fontSize}px`;
        // Размер другого компонента не должен менять отступ текста Combobox.
        document.documentElement.style.setProperty('--lab-size-switch-track-s', '6rem');
      }, rootPx);
      const expected = 36 * (rootPx / 16);
      expect((await trigger.boundingBox())?.width).toBeCloseTo(expected, 1);
      expect(
        await input.evaluate((el) => Number.parseFloat(getComputedStyle(el).paddingRight)),
      ).toBeCloseTo(expected, 1);
    });
  }
}
