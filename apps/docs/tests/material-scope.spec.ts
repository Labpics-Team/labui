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
    const backdrop = css.backdropFilter;
    const filterId = backdrop.match(/url\(["']?[^"')]*#([^"')]+)["']?\)/)?.[1];
    const root = element.getRootNode() as Document | ShadowRoot;
    const filter = filterId ? root.getElementById(filterId) : null;
    // CSS-only и Glass вычисляют blur в backdrop-filter; Acrylic применяет
    // feGaussianBlur из реально подключённого SVG. Сырое --_blur содержит calc().
    const blur =
      backdrop.match(/blur\(([\d.]+)px\)/)?.[1] ??
      filter?.querySelector('feGaussianBlur')?.getAttribute('stdDeviation');
    const rim = getComputedStyle(element, '::before');
    return {
      blur: backdrop === 'none' ? 0 : Number.parseFloat(blur ?? ''),
      transparent: css.backgroundColor === 'rgba(0, 0, 0, 0)',
      grain: css.backgroundImage.includes('data:image/png'),
      rim: Number(rim.opacity) > 0 && rim.backgroundImage !== 'none',
      lensed: backdrop.includes('lab-lg-'),
      acrylic: backdrop.includes('lab-acrylic-'),
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
    // Деградация снимает эффект; проверяем применённый фильтр, а не marker.
    lensed: engine && mode === 'glass' && !degraded,
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

// Материалы работают через наследуемый CSS-контекст. Скрытие CSSScopeRule
// проверяет, что runtime больше не вводит отсутствующую зависимость от @scope.
test('missing @scope capability preserves glass/acrylic engines and Veil', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'SVG backdrop engines are Chromium-only');
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'CSSScopeRule', { value: undefined, configurable: true });
  });
  await page.goto('/_fixtures/materials-flag.html?runtime');
  expect(
    await page.evaluate(() => typeof (globalThis as { CSSScopeRule?: unknown }).CSSScopeRule),
  ).toBe('undefined');

  for (const mode of ['glass', 'acrylic'] as const) {
    const surface = await tree(page, ['solid', mode]);
    await expect.poll(() => paint(surface)).toEqual(expected(mode, true));
  }

  await page.evaluate(() => {
    const veil = document.createElement('div');
    veil.dataset.veil = 'top';
    veil.style.cssText = 'position:relative;width:320px;height:160px';
    document.querySelector('.stage')?.appendChild(veil);
  });
  await expect.poll(() => page.locator('[data-veil] .lab-veil__strip').count()).toBeGreaterThan(0);
});

const compositionScopes = ['light', 'shadow', 'slot'] as const;

for (const runtime of [false, true]) {
  test(`contrast and material compose through shadow and slots (${runtime ? 'runtime' : 'CSS-only'})`, async ({
    page,
    browserName,
  }) => {
    await page.emulateMedia({ contrast: 'no-preference' });
    await page.goto(`/_fixtures/materials-flag.html?composition${runtime ? '&runtime' : ''}`);
    const materials = page.locator('[data-composition-material]');
    const contrasts = page.locator('[data-composition-contrast]');
    const outer = page.getByTestId('composition-outer');
    const engine = runtime && browserName === 'chromium';
    await expect(materials).toHaveCount(compositionScopes.length);
    await expect(contrasts).toHaveCount(compositionScopes.length);

    async function expectSurfaces(inherited: Mode, restored: Mode, liveEngine = engine) {
      await expect
        .poll(() =>
          Promise.all(
            compositionScopes.flatMap((scope) =>
              ['inherited', 'restored', 'solid'].map((name) =>
                paint(page.getByTestId(`${scope}-${name}`)),
              ),
            ),
          ),
        )
        .toEqual(
          compositionScopes.flatMap(() => [
            expected(inherited, liveEngine),
            expected(restored, liveEngine),
            expected('solid', liveEngine),
          ]),
        );
    }

    // More гасит материал предка, normal восстанавливает именно локальный
    // Acrylic. Постоянный Solid и живой Acrylic исключают пустой PASS.
    await expectSurfaces('solid', 'acrylic');
    await materials.evaluateAll((elements) => {
      for (const element of elements) element.setAttribute('data-material', 'glass');
    });
    await expectSurfaces('solid', 'glass');

    await contrasts.evaluateAll((elements) => {
      for (const element of elements) element.removeAttribute('data-contrast');
    });
    await expectSurfaces('solid', 'solid');
    await outer.evaluate((element) => element.setAttribute('data-contrast', 'normal'));
    await expectSurfaces('glass', 'glass');

    await page.emulateMedia({ contrast: 'more' });
    await expectSurfaces('glass', 'glass');
    await outer.evaluate((element) => element.removeAttribute('data-contrast'));
    await expectSurfaces('solid', 'solid');
    await contrasts.evaluateAll((elements) => {
      for (const element of elements) element.setAttribute('data-contrast', 'normal');
    });
    await expectSurfaces('solid', 'glass');

    await materials.evaluateAll((elements) => {
      for (const element of elements) element.setAttribute('data-material', 'acrylic');
    });
    await expectSurfaces('solid', 'acrylic');
    await materials.evaluateAll((elements) => {
      for (const element of elements) element.removeAttribute('data-material');
    });
    await expectSurfaces('solid', 'glass');

    // Переназначение меняет composed tree, хотя обычные DOM-предки те же.
    const slotted = page.getByTestId('slot-restored-content');
    await slotted.evaluate((element) => element.setAttribute('slot', 'inherited'));
    await expect
      .poll(() => paint(page.getByTestId('slot-restored')))
      .toEqual(expected('solid', engine));
    await slotted.evaluate((element) => element.setAttribute('slot', 'restored'));
    await expectSurfaces('solid', 'glass');

    if (runtime) {
      // MutationObserver уже получил смену, но его следующий rAF ещё не прошёл.
      // Dispose должен убрать SVG и запретить позднее повторное монтирование.
      await outer.evaluate(async (element) => {
        element.setAttribute('data-material', 'acrylic');
        await Promise.resolve();
        window.__materialComposition.dispose();
        element.setAttribute('data-contrast', 'normal');
        for (let frame = 0; frame < 3; frame++) await new Promise(requestAnimationFrame);
      });
      await expectSurfaces('acrylic', 'acrylic', false);
      await expect(
        page.locator(
          '[data-testid$="-inherited"] svg, [data-testid$="-restored"] svg, [data-testid$="-solid"] svg',
        ),
      ).toHaveCount(0);
    }
  });
}
