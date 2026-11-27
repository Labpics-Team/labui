import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';

const cap = (page: Page, renderer: string, size: string, count: number) =>
  page.getByTestId(`${renderer}-${size}-${count}`).locator('.lab-kbd-key');
const paint = (el: Element) => {
  const s = getComputedStyle(el);
  const rim = getComputedStyle(el, '::before');
  const edge = getComputedStyle(el, '::after');
  return {
    family: s.fontFamily,
    weight: s.fontWeight,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    gradient: s.backgroundImage,
    color: s.color,
    radius: s.borderRadius,
    shadow: s.boxShadow,
    border: rim.borderTopColor,
    stroke: rim.borderTopWidth,
    edge: edge.backgroundColor,
    depth: edge.bottom,
  };
};

test.beforeEach(async ({ page }) => {
  await page.goto('/kbd.html');
  await expect(page.getByTestId('react-s-1')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

test('single slots, nested chords and legacy size keep keyboard-input semantics', async ({
  page,
  request,
}) => {
  expect(await (await request.get('/kbd.html')).text()).toContain('<lab-kbd');
  for (const renderer of ['lit', 'react']) {
    const single = page.getByTestId(`${renderer}-slot`);
    const singleKey = renderer === 'lit' ? single.locator('kbd') : single;
    expect(await singleKey.evaluate((el) => el.tagName)).toBe('KBD');
    await expect(single).toHaveText('Esc');
    for (const size of ['s', 'l'])
      for (const count of [1, 2, 3, 4]) {
        const keys = cap(page, renderer, size, count);
        await expect(keys).toHaveCount(count);
        for (const key of await keys.all()) {
          expect(
            await key.evaluate((el) => el.tagName === 'KBD' && el.parentElement?.tagName === 'KBD'),
          ).toBe(true);
        }
      }
    const alias = page.getByTestId(`${renderer}-alias`);
    const key = renderer === 'lit' ? alias.locator('kbd') : alias;
    await expect(key).toHaveAttribute('data-size', 'l');
    expect(await key.evaluate((el) => (el as HTMLElement).tabIndex)).toBe(-1);
  }
});

test('the delivered SSR adapter preserves a chord across hydration and later updates', async ({
  browser,
  baseURL,
}) => {
  // A fresh process catches bootstrap ordering: an earlier SSR import in the
  // Playwright worker must not accidentally prepare the registry for this test.
  const module = new URL('../../../packages/vue/dist/ssr.js', import.meta.url).href;
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const {renderKbd} = await import(${JSON.stringify(module)}); process.stdout.write(renderKbd({keys:['Ctrl','Shift','P'],size:'l'}));`,
    ],
    { encoding: 'utf8' },
  );
  expect(output).toContain('shadowrootmode="open"');
  expect(output).toContain('keys=');
  const installer = new URL(
    '../../../packages/core/node_modules/@lit-labs/ssr/lib/dom-shim.js',
    import.meta.url,
  ).href;
  const preserved = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const {installWindowOnGlobal}=await import(${JSON.stringify(installer)}); installWindowOnGlobal(); const previous=customElements; previous.define('lab-kbd-sentinel',class extends HTMLElement{}); await import(${JSON.stringify(module)}); process.stdout.write(String(customElements===previous && !!customElements.get('lab-kbd-sentinel')));`,
    ],
    { encoding: 'utf8' },
  );
  expect(preserved).toBe('true');
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.route('**/kbd-ssr.html', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()).replace('<!-- SSR-KBD -->', output),
      });
    });
    await page.goto(`${baseURL}/_fixtures/kbd-ssr.html`);
    await page.evaluate(async () => {
      await customElements.whenDefined('lab-kbd');
      const key = document.querySelector('lab-kbd');
      if (!key) throw new Error('Missing server-rendered Kbd');
      await key.updateComplete;
      key.size = 's';
      await key.updateComplete;
    });
    await expect(page.locator('lab-kbd .lab-kbd-key')).toHaveText(['Ctrl', 'Shift', 'P']);
    expect(
      await page.locator('lab-kbd').evaluate((el) => (el as HTMLElementTagNameMap['lab-kbd']).keys),
    ).toEqual(['Ctrl', 'Shift', 'P']);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});

test('all eight author variants use Geist Medium and matching Lit React geometry', async ({
  page,
}) => {
  for (const size of ['s', 'l'])
    for (const count of [1, 2, 3, 4]) {
      const lit = cap(page, 'lit', size, count);
      const react = cap(page, 'react', size, count);
      const height = size === 's' ? 16 : 24;
      const width = height * count + 2 * (count - 1);
      for (const renderer of ['lit', 'react']) {
        const box = await page.getByTestId(`${renderer}-${size}-${count}`).boundingBox();
        expect(box?.width).toBe(width);
        expect(box?.height).toBe(height);
      }
      for (let i = 0; i < count; i++) {
        const actual = await react.nth(i).evaluate(paint);
        expect(actual).toEqual(await lit.nth(i).evaluate(paint));
        expect(actual.family).toContain('Geist');
        expect(actual.family).not.toContain('Mono');
        expect(actual.weight).toBe('500');
        expect(actual.fontSize).toBe(size === 's' ? '12px' : '16px');
        expect(actual.lineHeight).toBe(size === 's' ? '12px' : '24px');
        expect(actual.radius).toBe(size === 's' ? '4px' : '6px');
        expect(actual.depth).toBe(size === 's' ? '-1px' : '-2px');
        expect(actual.stroke).toBe('1px');
        expect(actual.shadow).toBe('none');
      }
      if (count > 1)
        expect((await react.nth(0).evaluate(paint)).gradient).not.toBe(
          (await react.nth(1).evaluate(paint)).gradient,
        );
    }
});

test('semantic paint roles affect both renderers and follow the theme', async ({ page }) => {
  const lit = cap(page, 'lit', 'l', 4).first();
  const react = cap(page, 'react', 'l', 4).first();
  const before = await lit.evaluate(paint);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect.poll(() => lit.evaluate((el) => getComputedStyle(el).color)).not.toBe(before.color);
  expect(await lit.evaluate(paint)).toEqual(await react.evaluate(paint));
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-fill-tertiary', 'rgb(1, 2, 3)');
    document.documentElement.style.setProperty('--lab-label-secondary', 'rgb(4, 5, 6)');
  });
  for (const el of [lit, react]) {
    expect((await el.evaluate(paint)).gradient).toContain('rgb(1, 2, 3)');
    expect((await el.evaluate(paint)).color).toBe('rgb(4, 5, 6)');
  }
});

test('long names and text scaling grow without clipping', async ({ page }) => {
  for (const scale of [1, 1.25, 2]) {
    await page.evaluate((scale) => {
      document.documentElement.style.fontSize = `${16 * scale}px`;
    }, scale);
    for (const renderer of ['lit', 'react']) {
      const keys = page.getByTestId(`${renderer}-long`).locator('.lab-kbd-key');
      for (const key of await keys.all()) {
        const bounds = await key.evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const text = range.getBoundingClientRect();
          const cap = el.getBoundingClientRect();
          return {
            width: cap.width,
            height: cap.height,
            textWidth: text.width,
            textHeight: text.height,
          };
        });
        expect(bounds.width).toBeGreaterThanOrEqual(bounds.textWidth + 8 * scale - 0.1);
        expect(bounds.height).toBe(24 * scale);
        expect(bounds.textHeight).toBeLessThanOrEqual(bounds.height);
      }
    }
  }
});

for (const theme of ['light', 'dark'])
  test(`eight variants render identically in ${theme}`, async ({ page }, testInfo) => {
    await page.evaluate(
      (theme) => document.documentElement.setAttribute('data-theme', theme),
      theme,
    );
    // Use the same physical origin: natural section positions have fractional
    // heading advances, which would compare two different text raster phases.
    const capture = async (renderer: string) => {
      const matrix = page.getByTestId(`${renderer}-renderer`);
      await matrix.evaluate((el) => {
        for (const other of document.querySelectorAll<HTMLElement>('.kbd-matrix'))
          other.style.visibility = 'hidden';
        (el as HTMLElement).style.cssText =
          'position:fixed;top:0;left:0;width:1000px;visibility:visible;background:var(--lab-bg-primary)';
      });
      return matrix.screenshot();
    };
    const lit = await capture('lit');
    const react = await capture('react');
    await testInfo.attach(`kbd-${theme}`, { body: lit, contentType: 'image/png' });
    expect(lit.equals(react), 'Lit and React must paint the same pixels').toBe(true);
  });

test('the cap surface and outside bottom edge follow the Figma SVG', async ({ page }, testInfo) => {
  const source = readFileSync(
    new URL('../../../native/compose/evidence/kbd-20261118/figma-small-key.svg', import.meta.url),
    'utf8',
  ).replace(/<path[^>]+fill="#3C3C43"[^>]*\/>/, '');
  await page.evaluate(() => {
    const properties = {
      'fill-tertiary': 'rgba(120,120,128,.12)',
      'fill-none': 'rgba(120,120,128,0)',
      'border-base': 'rgba(120,120,128,.16)',
      'border-soft': 'rgba(120,120,128,.08)',
    };
    for (const [role, paint] of Object.entries(properties))
      document.documentElement.style.setProperty(`--lab-${role}`, paint);
    const capture = document.createElement('div');
    capture.id = 'source-comparison';
    capture.style.cssText =
      'position:fixed;top:0;left:0;width:48px;height:51px;background:white;line-height:0';
    const kbd = document.createElement('lab-kbd');
    kbd.style.cssText = 'transform:scale(3);transform-origin:top left';
    capture.append(kbd);
    document.body.replaceChildren(capture);
  });
  const actual = await page.locator('#source-comparison').screenshot();
  const error = await page.evaluate(
    async ({ source, png }) => {
      const pixels = async (src: string) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 51;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas 2D is required for source comparison');
        context.fillStyle = 'white';
        context.fillRect(0, 0, 48, 51);
        context.drawImage(image, 0, 0, 48, 51);
        return context.getImageData(0, 0, 48, 51).data;
      };
      const expected = await pixels(`data:image/svg+xml,${encodeURIComponent(source)}`);
      const actual = await pixels(`data:image/png;base64,${png}`);
      let difference = 0;
      for (let i = 0; i < actual.length; i++)
        if (i % 4 !== 3) difference += Math.abs((actual[i] ?? 0) - (expected[i] ?? 0));
      return difference / (48 * 51 * 3);
    },
    { source, png: actual.toString('base64') },
  );
  await testInfo.attach('kbd-source-surface', { body: actual, contentType: 'image/png' });
  expect(error, 'Mean channel difference from the authored surface at 3x').toBeLessThan(1.25);
});
