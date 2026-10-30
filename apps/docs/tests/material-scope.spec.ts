import { type Locator, type Page, expect, test } from '@playwright/test';

type Mode = 'solid' | 'glass' | 'acrylic';

async function tree(page: Page, modes: string[], surfaceScopes: number[] = []) {
  await page.evaluate(
    ({ values, surfaces }) => {
      document.documentElement.removeAttribute('data-material');
      const stage = document.querySelector('.stage');
      if (!stage) throw new Error('Нет контейнера материала');
      stage.replaceChildren();
      let parent: Element = stage;
      values.forEach((mode, index) => {
        const scope = document.createElement('section');
        scope.dataset.material = mode;
        scope.dataset.testid = `scope-${index}`;
        if (surfaces.includes(index)) scope.classList.add('lab-material', 'demo-panel');
        parent.appendChild(scope);
        parent = scope;
      });
      const surface = document.createElement('div');
      surface.className = 'lab-material demo-panel';
      surface.dataset.testid = 'scope-surface';
      surface.textContent = 'Материал ближайшей области';
      parent.appendChild(surface);
    },
    { values: modes, surfaces: surfaceScopes },
  );
  return page.getByTestId('scope-surface');
}

async function paint(surface: Locator) {
  return surface.evaluate((element) => {
    const css = getComputedStyle(element);
    return {
      blur: Number.parseFloat(css.getPropertyValue('--_blur')),
      transparent: css.getPropertyValue('--_base-paint').trim() === 'transparent',
      grain: css.backgroundImage.includes('data:image/png'),
      rim: getComputedStyle(element, '::before').backgroundImage !== 'none',
      lensed: element.classList.contains('lab-material--lensed'),
      acrylic: (element as HTMLElement).style.backdropFilter.includes('lab-acrylic'),
    };
  });
}

function expected(mode: Mode, engine: boolean, degraded = false) {
  const live = mode !== 'solid' && !degraded;
  return {
    blur: live ? (mode === 'glass' && engine ? 4 : 48) : 0,
    transparent: live,
    grain: live && mode === 'acrylic',
    rim: live,
    // Marker означает подключение движка; reduced-transparency снимает
    // его inline-фильтр, сохраняя само подключение.
    lensed: engine && mode === 'glass',
    acrylic: engine && mode === 'acrylic' && !degraded,
  };
}

for (const runtime of [false, true]) {
  test.describe(runtime ? 'nearest scope with runtime' : 'nearest scope CSS-only', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/_fixtures/materials-flag.html${runtime ? '?runtime' : ''}`);
    });

    for (const modes of [
      ['solid', 'glass'],
      ['acrylic', 'glass'],
      ['glass', 'solid', 'glass'],
    ]) {
      test(`${modes.join(' → ')} uses inner glass`, async ({ page, browserName }) => {
        const surface = await tree(page, modes, modes.length === 3 ? [1] : []);
        await expect
          .poll(() => paint(surface))
          .toEqual(expected('glass', runtime && browserName === 'chromium'));
      });
    }

    test('scope root itself is a surface, nested solid isolates it', async ({
      page,
      browserName,
    }) => {
      await tree(page, ['acrylic', 'solid'], [0, 1]);
      const engine = runtime && browserName === 'chromium';
      await expect
        .poll(() => paint(page.getByTestId('scope-0')))
        .toEqual(expected('acrylic', engine));
      await expect
        .poll(() => paint(page.getByTestId('scope-1')))
        .toEqual(expected('solid', engine));
      await expect
        .poll(() => paint(page.getByTestId('scope-surface')))
        .toEqual(expected('solid', engine));
    });

    test('mode changes and removals restore the nearest recipe', async ({ page, browserName }) => {
      const surface = await tree(page, ['acrylic', 'glass']);
      const inner = page.getByTestId('scope-1');
      const engine = runtime && browserName === 'chromium';
      for (const mode of ['glass', 'solid', 'acrylic', 'glass'] as const) {
        await inner.evaluate((el, value) => el.setAttribute('data-material', value), mode);
        await expect.poll(() => paint(surface)).toEqual(expected(mode, engine));
      }
      await inner.evaluate((el) => el.removeAttribute('data-material'));
      await expect.poll(() => paint(surface)).toEqual(expected('acrylic', engine));
      await page.getByTestId('scope-0').evaluate((el) => el.removeAttribute('data-material'));
      await expect.poll(() => paint(surface)).toEqual(expected('solid', engine));
    });

    test('empty and unknown scopes stop inherited live effects', async ({ page, browserName }) => {
      const surface = await tree(page, ['acrylic', 'unknown'], [0]);
      const inner = page.getByTestId('scope-1');
      for (const mode of ['unknown', '']) {
        await inner.evaluate((el, value) => el.setAttribute('data-material', value), mode);
        await expect
          .poll(() => paint(surface))
          .toEqual(expected('solid', runtime && browserName === 'chromium'));
      }
    });

    test('contrast overrides nested modes and restores them', async ({ page, browserName }) => {
      const surface = await tree(page, ['solid', 'glass']);
      const engine = runtime && browserName === 'chromium';
      await page.emulateMedia({ contrast: 'more' });
      await expect.poll(() => paint(surface)).toEqual(expected('glass', engine, true));
      await page
        .getByTestId('scope-1')
        .evaluate((el) => el.setAttribute('data-material', 'acrylic'));
      await expect.poll(() => paint(surface)).toEqual(expected('acrylic', engine, true));
      await page.emulateMedia({ contrast: 'no-preference' });
      await expect.poll(() => paint(surface)).toEqual(expected('acrylic', engine));
    });

    test('reduced transparency overrides nested modes in Chromium', async ({
      page,
      browserName,
    }) => {
      test.skip(
        browserName !== 'chromium',
        'Playwright WebKit не предоставляет эмуляцию reduced-transparency',
      );
      const surface = await tree(page, ['solid', 'glass']);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
      });
      expect(
        await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches),
      ).toBe(true);
      await expect.poll(() => paint(surface)).toEqual(expected('glass', runtime, true));
      await expect
        .poll(() => surface.evaluate((el) => (el as HTMLElement).style.backdropFilter))
        .toBe('');
      await cdp.send('Emulation.setEmulatedMedia', { features: [] });
      await expect.poll(() => paint(surface)).toEqual(expected('glass', runtime));
      await cdp.detach();
    });
  });
}
