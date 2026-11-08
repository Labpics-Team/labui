import { type Page, expect, test } from '@playwright/test';

const surface = (page: Page) => page.locator('[data-portal-for="sheet"] .surface');
const blur = (page: Page) => surface(page).locator('.lab-sheet-defs feGaussianBlur');

async function open(page: Page, theme = 'light', contrast = 'normal', material = 'acrylic') {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/_fixtures/sheet.html?theme=${theme}&contrast=${contrast}&material=${material}`);
  await expect(page.locator('html')).toHaveAttribute('data-sheet-fixture-ready', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    document.body.style.background =
      'repeating-linear-gradient(90deg,black 0 16px,white 16px 32px)';
    document.body.style.minHeight = '100vh';
  });
  await page.locator('[data-testid="sheet"] .trigger').click();
  await expect(surface(page)).toBeVisible();
}

async function raster(page: Page): Promise<number[]> {
  const png = await page.screenshot();
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Missing pixel readback');
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(64, 650, 247, 96).data);
  }, png.toString('base64'));
}

const mean = (pixels: number[]) =>
  pixels.reduce((sum, value, index) => sum + (index % 4 === 3 ? 0 : value), 0) /
  (pixels.length * 0.75);
const difference = (a: number[], b: number[]) =>
  a.reduce((sum, value, index) => sum + Math.abs(value - (b[index] ?? 0)), 0) / a.length;

function contrast(a: number[], b: number[]): number {
  const luminance = (rgb: number[]) =>
    rgb.reduce((sum, value, index) => {
      const channel = value / 255;
      const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      return sum + linear * ([0.2126, 0.7152, 0.0722][index] ?? 0);
    }, 0);
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

for (const theme of ['light', 'dark']) {
  test(`Sheet ${theme}: Solid and more use grouped secondary after all layers`, async ({
    page,
  }) => {
    await open(page, theme, 'normal', 'solid');
    const solid = await raster(page);
    await expect(blur(page)).toHaveCount(0);
    await page.locator('html').evaluate((el) => {
      el.setAttribute('data-contrast', 'more');
      el.setAttribute('data-material', 'acrylic');
    });
    await expect(blur(page)).toHaveCount(0);
    const more = await raster(page);
    // Existing Colors role, independently specified for this source snapshot.
    expect(mean(solid)).toBeCloseTo(theme === 'light' ? 255 : 28 + 2 / 3, 0);
    expect(mean(more)).toBeCloseTo(theme === 'light' ? 255 : 13, 0);
  });
}

test.describe('Sheet ordered SVG body', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Ordered SVG backdrop is a Chromium capability');
  });

  for (const theme of ['light', 'dark']) {
    test(`${theme}: actual portal distinguishes paint-before-blur from the old recipe`, async ({
      page,
    }) => {
      await open(page, theme);
      await expect(blur(page)).toHaveAttribute('stdDeviation', '64');
      await expect(surface(page).locator('feBlend')).toHaveAttribute(
        'mode',
        theme === 'light' ? 'color-dodge' : 'overlay',
      );
      const correct = await raster(page);
      // Equal black/white stripes average the independently composed endpoints.
      // The remaining byte covers raster rounding and the finite blur region.
      expect(Math.abs(mean(correct) - (theme === 'light' ? 247.5 : 52))).toBeLessThan(1);

      // Same DOM, paints and sigma; change only the order. A flat CSS color or
      // a no-op filter would make this discriminator vacuous.
      await surface(page).evaluate((el) => {
        const filter = el.querySelector('filter');
        const gaussian = el.querySelector('feGaussianBlur');
        const tint = el.querySelector('feComposite');
        if (!filter || !gaussian || !tint) throw new Error('Missing actual Sheet pipeline');
        gaussian.setAttribute('in', 'SourceGraphic');
        tint.setAttribute('in2', 'sheet-blur');
        filter.prepend(gaussian);
      });
      const wrong = await raster(page);
      expect(difference(correct, wrong)).toBeGreaterThan(theme === 'light' ? 3 : 8);
      await surface(page).evaluate((el) =>
        el.style.setProperty('--lab-size-sheet-body-blur', '0px'),
      );
      await expect(blur(page)).toHaveAttribute('stdDeviation', '0');
      const wrongZero = await raster(page);
      await surface(page).evaluate((el) => {
        const filter = el.querySelector('filter');
        const gaussian = el.querySelector('feGaussianBlur');
        const tint = el.querySelector('feComposite');
        if (!filter || !gaussian || !tint) throw new Error('Missing actual Sheet pipeline');
        gaussian.setAttribute('in', 'sheet-blend');
        tint.setAttribute('in2', 'SourceGraphic');
        filter.append(gaussian);
      });
      expect(
        difference(wrongZero, await raster(page)),
        'sigma zero makes both orders identical',
      ).toBe(0);
    });
  }

  for (const theme of ['light', 'dark']) {
    test(`${theme}: contrast reads actual label paint over the final material`, async ({
      page,
    }, info) => {
      await open(page, theme);
      await expect(blur(page)).toHaveAttribute('stdDeviation', '64');
      await surface(page).evaluate((el) => {
        for (const [selector, left] of [
          ['.description', 64],
          ['.heading', 96],
        ] as const) {
          const patch = document.createElement('span');
          patch.style.cssText = `position:absolute;top:280px;left:${left}px;width:16px;height:16px;background:currentColor;pointer-events:none`;
          el.querySelector(selector)?.appendChild(patch);
        }
      });
      const observations = [];
      for (const mode of ['normal', 'more'])
        for (const background of ['black', 'white']) {
          await page
            .locator('html')
            .evaluate((el, mode) => el.setAttribute('data-contrast', mode), mode);
          await expect(blur(page)).toHaveCount(mode === 'more' ? 0 : 1);
          await page.evaluate((background) => {
            document.body.style.background = background;
          }, background);
          const pixels = await raster(page);
          const pixel = (x: number, y: number) =>
            pixels.slice((y * 247 + x) * 4, (y * 247 + x) * 4 + 3);
          const backdrop = pixel(80, 28);
          const primary = contrast(pixel(40, 28), backdrop);
          const secondary = contrast(pixel(8, 28), backdrop);
          observations.push({ mode, background, primary, secondary });
          expect(primary).toBeGreaterThanOrEqual(4.5);
          if (mode === 'more') expect(secondary).toBeGreaterThanOrEqual(4.5);
        }
      await info.attach(`sheet-${theme}-contrast`, {
        body: JSON.stringify(observations, null, 2),
        contentType: 'application/json',
      });
    });
  }

  test('nearest theme, inherited rem, contrast restoration and portal disposal', async ({
    page,
  }) => {
    await open(page);
    await expect(blur(page)).toHaveAttribute('stdDeviation', '64');
    await page.locator('#local-context').evaluate((el) => el.setAttribute('data-theme', 'dark'));
    await expect(surface(page).locator('feBlend')).toHaveAttribute('mode', 'overlay');
    await page
      .locator('[data-testid="sheet"]')
      .evaluate((el) => el.setAttribute('data-theme', 'light'));
    await expect(surface(page).locator('feBlend')).toHaveAttribute('mode', 'color-dodge');
    await page.locator('html').evaluate((el) => {
      el.style.fontSize = '20px';
    });
    await expect(blur(page)).toHaveAttribute('stdDeviation', '80');
    await page
      .locator('[data-testid="sheet"]')
      .evaluate((el) => el.setAttribute('data-contrast', 'more'));
    await expect(blur(page)).toHaveCount(0);
    await page
      .locator('[data-testid="sheet"]')
      .evaluate((el) => el.setAttribute('data-contrast', 'normal'));
    await expect(blur(page)).toHaveAttribute('stdDeviation', '80');
    await page.keyboard.press('Escape');
    await expect(surface(page)).toBeHidden();
    await page.locator('[data-testid="sheet"] .trigger').click();
    await expect(blur(page)).toHaveAttribute('stdDeviation', '80');
    await expect(surface(page).locator('.lab-sheet-defs')).toHaveCount(1);
    await page.locator('[data-testid="sheet"]').evaluate((el) => el.remove());
    await expect(page.locator('[data-portal-for="sheet"]')).toHaveCount(0);
  });

  test('Glass retains the existing refraction capability', async ({ page }) => {
    await open(page, 'light', 'normal', 'glass');
    await expect(surface(page)).toHaveClass(/lab-material--lensed/);
    await expect(blur(page)).toHaveCount(0);
    await expect
      .poll(() => surface(page).evaluate((el) => getComputedStyle(el).backdropFilter))
      .toContain('url(');
  });

  for (const failure of ['observer', 'length-styles'] as const) {
    test(`${failure}: failed initial attach releases resources and permits recovery`, async ({
      page,
    }) => {
      await page.goto('/_fixtures/material-context.html?scope=light&mode=acrylic');
      await page.waitForFunction(() => !!window.__materialContext);
      const result = await page.evaluate((failure) => {
        document.documentElement.setAttribute('data-theme', 'light');
        const surfaces = [...document.querySelectorAll<HTMLElement>('.lab-material')];
        for (const el of surfaces) {
          el.classList.add('lab-material--sheet');
          el.style.setProperty('--lab-size-sheet-body-blur', '128px');
        }
        const baseline = surfaces.map((el) => el.getAttribute('style'));
        const NativeObserver = window.ResizeObserver;
        const append = Node.prototype.appendChild;
        if (failure === 'observer')
          window.ResizeObserver = class extends NativeObserver {
            constructor(callback: ResizeObserverCallback) {
              super(callback);
              throw new Error('observer-denied');
            }
          };
        else
          Node.prototype.appendChild = function <T extends Node>(child: T): T {
            if (
              child instanceof HTMLStyleElement &&
              child.className === 'lab-material__length-types'
            )
              throw new Error('styles-denied');
            return append.call(this, child) as T;
          };
        let error = '';
        try {
          window.__materialContext.mount();
        } catch (caught) {
          error = String(caught);
        } finally {
          window.ResizeObserver = NativeObserver;
          Node.prototype.appendChild = append;
        }
        const residue = document.querySelectorAll(
          '.lab-sheet-defs,.lab-material__length,.lab-material__length-types',
        ).length;
        const styles = surfaces.map((el) => el.getAttribute('style'));
        window.__materialContext.mount();
        return { error, residue, styles, baseline };
      }, failure);
      expect(result.error).toContain(failure === 'observer' ? 'observer-denied' : 'styles-denied');
      expect(result.residue).toBe(0);
      expect(result.styles).toEqual(result.baseline);
      await expect(page.locator('.lab-sheet-defs')).toHaveCount(2);
      await page.evaluate(() => {
        window.__materialContext.dispose(0);
        window.__materialContext.dispose(1);
      });
      await expect(
        page.locator('.lab-sheet-defs,.lab-material__length,.lab-material__length-types'),
      ).toHaveCount(0);
    });
  }
});
