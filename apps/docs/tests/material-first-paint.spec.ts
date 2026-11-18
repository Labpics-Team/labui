import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import type * as MaterialCssModule from '@labpics/ui-materials/css';
import { expect, test } from '@playwright/test';

// Read the built public entry; workspace TS paths intentionally point to its
// source declaration so unbuilt packages can be typechecked.
const require = createRequire(import.meta.url);
const packagePath = require.resolve('@labpics/ui-materials/package.json');
const cssEntry = JSON.parse(readFileSync(packagePath, 'utf8')).exports['./css'].require.default;
const { materialCss } = require(
  resolve(dirname(packagePath), cssEntry),
) as typeof MaterialCssModule;

const colorsCss = readFileSync(
  new URL('../../../packages/colors/contract.css', import.meta.url),
  'utf8',
);

test('document theme initializes declarative shadow materials before JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    for (const theme of ['light', 'dark']) {
      for (const mode of ['', 'solid', 'acrylic', 'glass']) {
        await page.setContent(`<!doctype html><html data-theme="${theme}" ${mode ? `data-material="${mode}"` : ''}>
          <head><style>${colorsCss}\n${materialCss}</style></head><body>
          <div id="plain" class="lab-material"></div>
          <div id="host"><template shadowrootmode="open"><style>${materialCss}</style>
            <div id="inherited" class="lab-material"></div>
            <div id="solid" class="lab-material" data-material="solid"></div>
          </template></div></body></html>`);
        const read = (selector: string) =>
          page.locator(selector).evaluate((el) => {
            const css = getComputedStyle(el);
            return { color: css.backgroundColor, filter: css.backdropFilter };
          });
        const plain = await read('#plain');
        expect(await read('#inherited'), `${theme}/${mode || 'default'}`).toEqual(plain);
        expect(plain.color).not.toBe('rgba(0, 0, 0, 0)');
        const solid = await read('#solid');
        expect(solid.filter).toBe('none');
        expect(solid.color).toBe(theme === 'light' ? 'rgb(247, 248, 250)' : 'rgb(16, 16, 18)');
        if (mode === 'glass') expect(plain.filter).toContain('blur(10px)');
        if (theme === 'light' && mode === 'acrylic')
          expect(plain.color).toBe('rgba(245, 245, 245, 0.937)');
      }
    }
  } finally {
    await context.close();
  }
});
