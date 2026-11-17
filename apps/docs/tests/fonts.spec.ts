import { type Page, expect, test } from '@playwright/test';

async function renderedFonts(page: Page, selector: string) {
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    return fonts.filter((font) => font.glyphCount > 0);
  } finally {
    await cdp.detach();
  }
}

test('documentation and components render the bundled Geist, including Cyrillic', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Actual platform font inspection uses Chromium CDP.');
  for (const path of [
    'index.html',
    'card.html',
    'button.html',
    'colors.html',
    'components.html',
    'experience.html',
  ]) {
    await page.goto(`/${path}`);
    const selector =
      path === 'button.html' ? 'label' : path === 'components.html' ? '.doc-summary' : 'h1';
    const fonts = await renderedFonts(page, selector);
    expect(fonts.length, path).toBeGreaterThan(0);
    for (const font of fonts) {
      // Chromium on Linux identifies its Fontations backend in the reported
      // family. Keep the accepted family exact; Geist Mono/fallbacks still fail.
      expect(['Geist', 'Geist (Fontations)'], path).toContain(font.familyName);
      expect(font.isCustomFont, path).toBe(true);
    }
  }
});

test('font inspection detects a missing asset even when CSS still names Geist', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Actual platform font inspection uses Chromium CDP.');
  await page.route('**/*.woff2', (route) => route.abort());
  await page.goto('/card.html');
  const selector = 'h1';
  await expect(page.locator(selector)).toHaveCSS('font-family', /^Geist,/);
  const fonts = await renderedFonts(page, selector);
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.every((font) => !font.isCustomFont)).toBe(true);
});
