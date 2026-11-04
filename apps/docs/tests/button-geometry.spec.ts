import { type Locator, expect, test } from '@playwright/test';

// Независимые числа read-only эталона: docs/reference/design-baseline.md.
// Паритет двух рендереров не обнаруживает общую ошибку их размерной шкалы.
const reference = [
  { size: 's', height: 36, insetX: 12, insetY: 8, content: 20, font: 14, line: 12 },
  { size: 'm', height: 48, insetX: 12, insetY: 12, content: 24, font: 16, line: 24 },
  { size: 'l', height: 56, insetX: 16, insetY: 16, content: 24, font: 16, line: 24 },
] as const;

async function box(element: Locator) {
  const result = await element.boundingBox();
  if (!result) throw new Error('Button и его содержимое должны участвовать в layout');
  return result;
}

for (const renderer of ['lit', 'react'] as const) {
  test(`${renderer}: supplied name survives icon, label and loading transitions`, async ({
    page,
  }) => {
    await page.goto('/button.html');
    if (renderer === 'lit') {
      await page.evaluate(async () => {
        await customElements.whenDefined('lab-button');
        for (const name of ['explicit-default', 'default', 'explicit']) {
          const button = document.createElement('lab-button');
          button.setAttribute('icon', '');
          button.dataset.testid = `lit-name-${name}`;
          if (name !== 'default') button.setAttribute('aria-label', 'Add item');
          button.innerHTML =
            '<svg slot="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" /></svg>';
          if (name !== 'explicit') {
            const label = document.createElement('span');
            label.textContent = 'Add';
            button.append(label);
          }
          document.querySelector('#lit-button-names')?.append(button);
        }
      });
    }
    for (const [icon, loading] of [
      [true, false],
      [true, true],
      [false, true],
      [false, false],
      [true, false],
    ] as const) {
      if (renderer === 'react') {
        await page.getByTestId('names-icon').setChecked(icon);
        await page.getByTestId('names-loading').setChecked(loading);
      } else {
        await page.locator('lab-button[data-testid^="lit-name-"]').evaluateAll(
          (elements, state) => {
            for (const element of elements) {
              element.toggleAttribute('icon', state.icon);
              element.toggleAttribute('loading', state.loading);
            }
          },
          { icon, loading },
        );
      }
      for (const name of ['explicit-default', 'default', 'explicit']) {
        const specimen = page.getByTestId(`${renderer}-name-${name}`);
        const button = renderer === 'lit' ? specimen.locator('button') : specimen;
        await expect
          .soft(button, `${name}, icon=${icon}, loading=${loading}`)
          .toHaveAccessibleName(name === 'default' ? 'Add' : 'Add item');
        if (loading) await expect(button).toBeDisabled();
        else await expect(button).toBeEnabled();
        if (icon) {
          const bounds = await box(button);
          expect(bounds.width).toBeCloseTo(48, 1);
          expect(bounds.height).toBeCloseTo(48, 1);
        }
      }
    }
  });

  for (const rootPx of [16, 20]) {
    for (const viewportWidth of [320, 1280]) {
      test(`${renderer}: Button geometry at root ${rootPx}, viewport ${viewportWidth}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width: viewportWidth, height: 1100 });
        await page.goto('/button.html');
        await page.evaluate(async (fontSize) => {
          document.documentElement.style.fontSize = `${fontSize}px`;
          await document.fonts.ready;
        }, rootPx);
        await expect(page.getByTestId('react-geometry-s-text')).toBeVisible();
        const faces = await page.evaluate(() =>
          [...document.fonts]
            .filter((face) => face.status === 'loaded')
            .map((face) => face.family.replace(/["']/g, '')),
        );
        expect(faces, 'Измеряем настоящий загруженный Geist, не системный fallback').toContain(
          'Geist',
        );
        const scale = rootPx / 16;

        for (const expected of reference) {
          for (const mode of ['text', 'leading', 'icon'] as const) {
            const id = `${renderer}-geometry-${expected.size}-${mode}`;
            const specimen = page.getByTestId(id);
            const normal = renderer === 'lit' ? specimen.locator('button') : specimen;
            const loadingSpecimen = page.getByTestId(`${id}-loading`);
            const loading =
              renderer === 'lit' ? loadingSpecimen.locator('button') : loadingSpecimen;
            await expect(normal).toHaveAccessibleName(mode === 'icon' ? 'Add item' : 'Button');
            const before = await box(normal);
            const initialLoading = await box(loading);
            expect.soft(before.height, `${id} height`).toBeCloseTo(expected.height * scale, 1);
            expect.soft(initialLoading.width, `${id} loading width`).toBeCloseTo(before.width, 1);
            expect
              .soft(initialLoading.height, `${id} loading height`)
              .toBeCloseTo(before.height, 1);
            const radius = await normal.evaluate((el) =>
              Number.parseFloat(getComputedStyle(el).borderTopLeftRadius),
            );
            if (expected.size === 's') {
              expect.soft(radius, `${id} capsule`).toBeGreaterThanOrEqual(before.height / 2);
            } else {
              expect.soft(radius, `${id} radius`).toBeCloseTo(16 * scale, 1);
            }

            if (mode !== 'text') {
              const icon = await box(
                specimen.locator(
                  renderer === 'lit'
                    ? 'slot[name="icon"]'
                    : '.lab-button-icon[data-position="start"]',
                ),
              );
              const glyph = await box(specimen.locator('svg'));
              expect.soft(glyph.width, `${id} caller glyph width`).toBe(16);
              expect.soft(glyph.height, `${id} caller glyph height`).toBe(16);
              expect
                .soft(glyph.x - icon.x, `${id} glyph center x`)
                .toBeCloseTo((icon.width - glyph.width) / 2, 1);
              expect
                .soft(glyph.y - icon.y, `${id} glyph center y`)
                .toBeCloseTo((icon.height - glyph.height) / 2, 1);
              expect.soft(icon.width, `${id} icon width`).toBeCloseTo(expected.content * scale, 1);
              expect
                .soft(icon.height, `${id} icon height`)
                .toBeCloseTo(expected.content * scale, 1);
              expect
                .soft(icon.y - before.y, `${id} icon vertical inset`)
                .toBeCloseTo(expected.insetY * scale, 1);
              if (mode === 'icon') {
                expect.soft(before.width, `${id} square`).toBeCloseTo(before.height, 1);
                expect
                  .soft(icon.x - before.x, `${id} centered icon`)
                  .toBeCloseTo((before.width - icon.width) / 2, 1);
              } else {
                expect
                  .soft(icon.x - before.x, `${id} icon horizontal inset`)
                  .toBeCloseTo(expected.insetX * scale, 1);
              }
            }

            if (mode !== 'icon') {
              const label = specimen.locator(renderer === 'lit' ? '.label' : '.lab-button-label');
              const labelBox = await box(label);
              const text = specimen.locator('[data-fixture-label]');
              const textBox = await box(text);
              const metrics = await text.evaluate((el) => {
                const style = getComputedStyle(el);
                return {
                  font: Number.parseFloat(style.fontSize),
                  line: Number.parseFloat(style.lineHeight),
                  weight: Number.parseFloat(style.fontWeight),
                  family: style.fontFamily.split(',')[0]?.trim().replace(/["']/g, ''),
                };
              });
              expect(metrics.family).toBe('Geist');
              expect.soft(metrics.font, `${id} font`).toBeCloseTo(expected.font * scale, 1);
              expect.soft(metrics.line, `${id} line`).toBeCloseTo(expected.line * scale, 1);
              expect.soft(metrics.weight, `${id} weight`).toBe(500);
              expect
                .soft(labelBox.height, `${id} label box`)
                .toBeCloseTo(expected.content * scale, 1);
              expect
                .soft(textBox.x - labelBox.x, `${id} label inset left`)
                .toBeCloseTo(8 * scale, 1);
              expect
                .soft(
                  labelBox.x + labelBox.width - textBox.x - textBox.width,
                  `${id} label inset right`,
                )
                .toBeCloseTo(8 * scale, 1);
              expect
                .soft(textBox.x - before.x, `${id} text position`)
                .toBeCloseTo(
                  (expected.insetX + 8 + (mode === 'leading' ? expected.content : 0)) * scale,
                  1,
                );
              expect
                .soft(before.x + before.width - textBox.x - textBox.width, `${id} trailing inset`)
                .toBeCloseTo((expected.insetX + 8) * scale, 1);
            }

            // Настоящая клавиатурная активация меняет loading через публичный API.
            await normal.focus();
            await expect(normal).toBeFocused();
            await normal.press('Space');
            await expect(normal).toBeDisabled();
            await expect(normal).toHaveAttribute('aria-busy', 'true');
            await expect(normal).toHaveAccessibleName(mode === 'icon' ? 'Add item' : 'Button');
            const after = await box(normal);
            expect(after.width, `${id} transition width`).toBeCloseTo(before.width, 1);
            expect(after.height, `${id} transition height`).toBeCloseTo(before.height, 1);
          }
        }
        if (viewportWidth === 1280 && renderer === 'lit') {
          await page.reload();
          await page.evaluate(async (fontSize) => {
            document.documentElement.style.fontSize = `${fontSize}px`;
            await document.fonts.ready;
          }, rootPx);
          await expect(page.getByTestId('react-geometry-s-text')).toBeVisible();
          const path = testInfo.outputPath('button-geometry.png');
          await page.getByTestId('geometry').screenshot({ path });
          await testInfo.attach('Button geometry', { path, contentType: 'image/png' });
        }
      });
    }
  }

  test(`${renderer}: Button grows for enlarged label`, async ({ page }) => {
    await page.goto('/button.html');
    const specimen = page.getByTestId(`${renderer}-geometry-m-text`);
    const button = renderer === 'lit' ? specimen.locator('button') : specimen;
    await expect(button).toBeVisible();
    await specimen.evaluate((el) => {
      (el as HTMLElement).style.setProperty('--lab-font-size-button-label', '3rem');
    });
    const label = await box(specimen.locator('[data-fixture-label]'));
    const control = await box(button);
    expect(control.height).toBeGreaterThan(48);
    expect(label.y).toBeGreaterThanOrEqual(control.y);
    expect(label.y + label.height).toBeLessThanOrEqual(control.y + control.height);
  });

  test(`${renderer}: border paint follows native state without moving content`, async ({
    page,
  }) => {
    await page.goto('/button.html');
    const specimen = page.getByTestId(`${renderer}-danger-border`);
    const button = renderer === 'lit' ? specimen.locator('button') : specimen;
    await expect(button).toBeVisible();
    const before = await box(button);
    for (const theme of ['light', 'dark']) {
      await page.getByTestId('theme-select').selectOption(theme);
      await button.hover();
      await button.focus();
      await expect(button).toBeFocused();
      const paint = await button.evaluate((el) => {
        const carrier = getComputedStyle(el);
        const border = getComputedStyle(el, '::before');
        return {
          color: border.borderTopColor,
          stateColor: carrier.borderTopColor,
          width: Number.parseFloat(border.borderTopWidth),
          style: border.borderTopStyle,
          pointerEvents: border.pointerEvents,
          focusWidth: Number.parseFloat(carrier.outlineWidth),
        };
      });
      expect(paint.color).toBe(paint.stateColor);
      expect(paint.color).not.toBe('rgba(0, 0, 0, 0)');
      expect(paint.width).toBeGreaterThan(0);
      expect(paint.style).toBe('solid');
      expect(paint.pointerEvents).toBe('none');
      expect(paint.focusWidth).toBeGreaterThan(0);
      const after = await box(button);
      expect(after.width).toBeCloseTo(before.width, 1);
      expect(after.height).toBeCloseTo(before.height, 1);
    }
  });

  test(`${renderer}: forced colors retain boundary and keyboard focus`, async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(browserName !== 'chromium', 'Эмуляция forced-colors проверяется в Chromium');
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/button.html');
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    for (const variant of ['accent-fill', 'neutral-tinted', 'danger-border', 'neutral-ghost']) {
      const specimen = page.getByTestId(`${renderer}-${variant}`);
      const button = renderer === 'lit' ? specimen.locator('button') : specimen;
      await expect(button).toBeVisible();
      await page.keyboard.press('Tab');
      await button.focus();
      await expect(button).toBeFocused();
      const paint = await button.evaluate((el) => {
        const style = getComputedStyle(el);
        const border = getComputedStyle(el, '::before');
        return {
          borderWidth: Number.parseFloat(border.borderTopWidth),
          borderColor: border.borderTopColor,
          background: style.backgroundColor,
          outlineWidth: Number.parseFloat(style.outlineWidth),
          outlineColor: style.outlineColor,
        };
      });
      expect(paint.borderWidth, `${variant} boundary`).toBeGreaterThan(0);
      expect(paint.borderColor, `${variant} boundary color`).not.toBe(paint.background);
      expect(paint.outlineWidth, `${variant} focus`).toBeGreaterThan(0);
      expect(paint.outlineColor, `${variant} focus color`).not.toBe(paint.background);
    }
    const path = testInfo.outputPath('button-forced-colors.png');
    await page.getByTestId(`${renderer}-renderer`).screenshot({ path });
    await testInfo.attach('Button forced colors', { path, contentType: 'image/png' });
  });
}

test('SSR: supplied Button name exists without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('/_fixtures/button-names.html');
    for (const name of ['explicit-default', 'default', 'explicit', 'loading', 'visible']) {
      const button = page.getByTestId(`ssr-${name}`).locator('button');
      await expect.soft(button, name).toHaveAccessibleName(name === 'default' ? 'Add' : 'Add item');
      if (name === 'loading') await expect(button).toBeDisabled();
    }
  } finally {
    await context.close();
  }
});
