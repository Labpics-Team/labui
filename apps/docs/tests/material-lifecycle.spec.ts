import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/material-lifecycle.html');
  await expect(page.locator('#ready')).toHaveText('ready');
});

test('nearest mode paints the same material across a shadow boundary and respects contrast', async ({
  page,
  browserName,
}, testInfo) => {
  const surface = page.locator('#surface');
  const shadow = page.locator('#shadow-surface');
  for (const el of [surface, shadow]) {
    await expect(el).toHaveAttribute('data-lab-material-mode', 'glass');
    await expect(el).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect
      .poll(() => el.evaluate((node) => getComputedStyle(node).backdropFilter))
      .toContain('blur(');
  }
  if (browserName !== 'chromium') {
    expect(await surface.evaluate((el) => el.style.backdropFilter)).toBe('');
    await expect(surface).not.toHaveClass(/lab-material--lensed/);
  }
  await surface.evaluate((el) => el.setAttribute('data-material', 'glass'));
  await page.locator('#scope').evaluate((el) => el.setAttribute('data-material', 'solid'));
  await expect(surface).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.screenshot({ path: testInfo.outputPath('materials.png') });
  await page.emulateMedia({ contrast: 'more' });
  // Firefox 141's dynamic emulation changes matchMedia() without dispatching
  // its change event or reevaluating CSS media rules (also in a bare HTML page).
  // Verify its startup preference; Chromium/WebKit exercise the live change.
  if (browserName === 'firefox') await page.reload();
  expect(await page.evaluate(() => matchMedia('(prefers-contrast: more)').matches)).toBe(true);
  for (const el of [surface, shadow]) {
    await expect(el).toHaveCSS('background-color', 'rgb(245, 245, 245)');
    await expect(el).toHaveCSS('--_blur', '0px');
  }
});

test('a scoped contrast change removes translucent effects', async ({ page }) => {
  const surface = page.locator('#surface');
  await expect(surface).toHaveAttribute('data-lab-material-mode', 'glass');
  await page.locator('#scope').evaluate((el) => el.setAttribute('data-contrast', 'more'));
  await expect(surface).toHaveAttribute('data-lab-material-mode', 'solid');
  await expect(surface).toHaveCSS('background-color', 'rgb(245, 245, 245)');
  await expect(surface).not.toHaveClass(/lab-material--lensed/);
  await expect(page.locator('body > .lab-lg-defs')).toHaveCount(0);
});

test('acrylic resolves the color at the surface, including scoped updates', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  const surface = page.locator('#surface');
  await surface.evaluate((el) => {
    el.setAttribute('data-material', 'acrylic');
    el.style.setProperty('--lab-bg-material-soft-01', 'rgb(24 60 96 / .3)');
  });
  const flood = page.locator('body > .lab-acrylic-defs feFlood');
  await expect(flood).toHaveCSS('flood-color', 'rgba(24, 60, 96, 0.3)');
  await surface.evaluate((el) =>
    el.style.setProperty('--lab-bg-material-soft-01', 'rgb(96 60 24 / .3)'),
  );
  await expect(flood).toHaveCSS('flood-color', 'rgba(96, 60, 24, 0.3)');
});

test('ShadowRoot inherits material mode and owns its filter, including ancestor changes', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'SVG backdrop renderer is Chromium-specific');
  const shadow = page.locator('#shadow-surface');
  await expect(shadow).toHaveClass(/lab-material--lensed/);
  expect(
    await shadow.evaluate((el) => {
      const id = el.getAttribute('style')?.match(/url\(#([^)]*)\)/)?.[1];
      return !!id && !!(el.getRootNode() as ShadowRoot).querySelector(`#${id}`);
    }),
  ).toBe(true);
  await page.locator('#shadow-host').evaluate((el) => el.setAttribute('data-material', 'solid'));
  await expect(shadow).not.toHaveClass(/lab-material--lensed/);
  expect(
    await shadow.evaluate(
      (el) => (el.getRootNode() as ShadowRoot).querySelectorAll('filter').length,
    ),
  ).toBe(0);
});

test('local DOM updates do not rediscover or refresh another surface', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  await expect(page.locator('#surface')).toHaveClass(/lab-material--lensed/);
  const result = await page.evaluate(async () => {
    const scope = document.querySelector('#scope');
    const surface = document.querySelector('#surface');
    const unrelated = document.querySelector('#unrelated');
    if (!scope || !surface || !unrelated) throw new Error('Missing fixture elements');
    const originalQuery = scope.querySelectorAll.bind(scope);
    const originalStyle = window.getComputedStyle;
    let scans = 0;
    let reads = 0;
    scope.querySelectorAll = (...args: Parameters<Element['querySelectorAll']>) => {
      scans++;
      return originalQuery(...args);
    };
    window.getComputedStyle = (...args) => {
      if (args[0] === surface) reads++;
      return originalStyle(...args);
    };
    try {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < 1000; i++) fragment.appendChild(document.createElement('span'));
      unrelated.appendChild(fragment);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      return { scans, reads };
    } finally {
      scope.querySelectorAll = originalQuery;
      window.getComputedStyle = originalStyle;
    }
  });
  expect(result).toEqual({ scans: 0, reads: 0 });
});

test('tier configuration refreshes the lens and scaling keeps local coordinates', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  const surface = page.locator('#surface');
  await expect(surface).toHaveClass(/lab-material--lensed/);
  const filter = page.locator('body > .lab-lg-defs filter');
  const image = filter.locator('feImage');
  await expect(image).toHaveAttribute('width', '240');
  const href = await image.getAttribute('href');
  if (!href) throw new Error('Lens image is not ready');
  await surface.evaluate((el) => {
    el.style.transform = 'scale(.5)';
  });
  await expect(image).toHaveAttribute('width', '240');
  await expect(image).toHaveAttribute('href', href);
  const oldScale = await filter.locator('feDisplacementMap').first().getAttribute('scale');
  await surface.evaluate((el) => el.style.setProperty('--_lg-refraction', '.5'));
  await expect
    .poll(() => filter.locator('feDisplacementMap').first().getAttribute('scale'))
    .not.toBe(oldScale);
});

test('overlapping mounts share an instance, removal and final disposal release it', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  const surface = page.locator('#surface');
  await expect(surface).toHaveClass(/lab-material--lensed/);
  await page.evaluate(() => window.materialFixture.overlap());
  await expect(page.locator('body > .lab-lg-defs filter')).toHaveCount(1);
  await page.evaluate(() => window.materialFixture.stopOverlap());
  await expect(surface).toHaveClass(/lab-material--lensed/);
  await surface.evaluate((el) => el.remove());
  await expect(page.locator('body > .lab-lg-defs')).toHaveCount(0);
  await page.evaluate(() => {
    window.materialFixture.stop();
    window.materialFixture.stopShadow();
  });
  expect(
    await page
      .locator('#shadow-host')
      .evaluate((el) => el.shadowRoot?.querySelectorAll('filter,.lab-lg-defs').length),
  ).toBe(0);
});

declare global {
  interface Window {
    materialFixture: { stop(): void; stopShadow(): void; overlap(): void; stopOverlap(): void };
  }
}
