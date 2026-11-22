import { readFileSync } from 'node:fs';
import {
  MATERIAL_TIERS,
  type MaterialRuntimeOptions,
  type Rgba,
  compileMaterialTheme,
  materialRoles,
} from '@labpics/ui-materials';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/material-lifecycle.html');
  await expect(page.locator('#ready')).toHaveText('ready');
});

test('local border boxes include classic scrollbars without rounding fractional geometry', async ({
  browser,
  browserName,
  baseURL,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Classic Chromium scrollbars exercise the CSSOM content-box difference',
  );
  const visibleScrollbars = await browser
    .browserType()
    .launch({ headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  try {
    const page = await visibleScrollbars.newPage({ baseURL });
    await page.goto('/_fixtures/material-lifecycle.html');
    await expect(page.locator('#ready')).toHaveText('ready');
    const rows = await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = '#scrollbar-box::-webkit-scrollbar{width:15px;height:15px}';
      document.head.append(style);
      const el = document.createElement('div');
      el.id = 'scrollbar-box';
      el.style.cssText =
        'width:200.5px;height:100.25px;padding:10px;border:2px solid;overflow:scroll;position:fixed;left:0;top:0';
      el.innerHTML = '<div style="width:400px;height:400px"></div>';
      document.body.append(el);
      const rows = [];
      for (const sizing of ['content-box', 'border-box']) {
        el.style.boxSizing = sizing;
        const expected = el.getBoundingClientRect();
        el.style.transform = 'translate(17px,11px) rotate(14deg) scale(.7)';
        const actual = window.materialFixture.borderBox(el, getComputedStyle(el));
        rows.push({
          sizing,
          actual: [actual.width, actual.height],
          expected: [expected.width, expected.height],
          scrollbar: el.offsetWidth - el.clientWidth - 4,
        });
        el.style.transform = '';
      }
      el.remove();
      style.remove();
      return rows;
    });
    for (const row of rows) {
      expect(row.scrollbar).toBe(15);
      expect(row.actual, row.sizing).toEqual(row.expected);
    }
  } finally {
    await visibleScrollbars.close();
  }
});

test('Glass retains all four optical edges across Sheet detents and restores the Flex field', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Only Chromium renders SVG backdrop refraction');
  await page.evaluate(() => {
    window.materialFixture.stopShadow();
    const el = document.querySelector<HTMLElement>('#surface');
    if (!el) throw new Error('Missing surface');
    el.className = 'lab-material lab-material--elevated';
    el.style.cssText = 'width:375px;height:422px;padding:0;border-radius:32px 32px 0 0';
  });
  const images = page.locator('body > .lab-lg-defs feImage');
  await expect(page.locator('body > .lab-lg-defs filter')).toHaveAttribute('height', '422');
  await expect(images).toHaveCount(8);
  const hrefs = await images.evaluateAll((nodes) =>
    nodes.map((node) => {
      node.setAttribute('data-retained', '');
      return node.getAttribute('href');
    }),
  );
  for (const height of [776, 540, 422, 270, 422]) {
    await page.locator('#surface').evaluate((el, h) => {
      el.style.height = `${h}px`;
    }, height);
    await expect(page.locator('body > .lab-lg-defs filter')).toHaveAttribute('height', `${height}`);
    await expect(page.locator('body > .lab-lg-defs feImage[data-retained]')).toHaveCount(8);
    expect(
      await images.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href'))),
    ).toEqual(hrefs);
    // Last tile is the bottom-right corner, anchored to the actual Body bottom.
    expect(
      await images
        .last()
        .evaluate((node) => Number(node.getAttribute('y')) + Number(node.getAttribute('height'))),
    ).toBe(height);
  }
  await page.locator('#surface').evaluate((el) => {
    el.style.height = '40px';
  });
  await expect(images).toHaveCount(1);
  await expect(page.locator('body > .lab-lg-defs filter')).toHaveAttribute('height', '40');
  await page.locator('#surface').evaluate((el) => {
    el.style.height = '422px';
  });
  await expect(images).toHaveCount(8);
  await page.evaluate(() => window.materialFixture.stop());
  await expect(page.locator('body > .lab-lg-defs')).toHaveCount(0);
});

test('nearest mode paints the same material across a shadow boundary and respects contrast', async ({
  page,
  browserName,
}, testInfo) => {
  const surface = page.locator('#surface');
  const shadow = page.locator('#shadow-surface');
  for (const el of [surface, shadow]) {
    await expect(el).toHaveAttribute('data-lab-material-mode', 'glass');
    if (browserName === 'chromium')
      await expect(el).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect
      .poll(() =>
        el.evaluate(
          (node) =>
            getComputedStyle(node.querySelector('.lab-material__capture') ?? node).backdropFilter,
        ),
      )
      .toContain('blur(');
  }
  if (browserName !== 'chromium') {
    expect(await surface.evaluate((el) => getComputedStyle(el).backdropFilter)).not.toContain(
      'url(',
    );
    await expect(surface).not.toHaveClass(/lab-material--lensed/);
  }
  await surface.evaluate((el) => el.setAttribute('data-material', 'glass'));
  await page.locator('#scope').evaluate((el) => el.setAttribute('data-material', 'solid'));
  if (browserName === 'chromium')
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

test('nearest material mode resolves before runtime, at any nesting depth and through a shadow', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.materialFixture.stop();
    window.materialFixture.stopShadow();
    const main = document.createElement('main');
    main.id = 'nested-first-frame';
    for (const outer of ['solid', 'glass', 'acrylic']) {
      for (const inner of ['solid', 'glass', 'acrylic']) {
        const scope = document.createElement('section');
        scope.dataset.material = outer;
        scope.innerHTML = `<div data-material="${inner}"><div class="lab-material lab-material--soft" data-expected="${inner}"></div></div>`;
        main.append(scope);
      }
    }
    const shadowScope = document.createElement('section');
    shadowScope.dataset.material = 'solid';
    shadowScope.innerHTML = '<div data-material="glass"><span id="first-shadow-host"></span></div>';
    main.append(shadowScope);
    document.body.append(main);
    const host = document.querySelector('#first-shadow-host');
    if (!host) throw new Error('Missing shadow host');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = Array.from(document.querySelectorAll('style'))
      .map((x) => x.textContent)
      .join('\n');
    shadow.append(style);
    const surface = document.createElement('div');
    surface.className = 'lab-material lab-material--soft';
    surface.dataset.expected = 'glass';
    shadow.append(surface);
  });
  const read = () =>
    page.evaluate(() => {
      const shadowSurface = document
        .querySelector('#first-shadow-host')
        ?.shadowRoot?.querySelector('.lab-material');
      if (!shadowSurface) throw new Error('Missing shadow surface');
      const nodes = [
        ...document.querySelectorAll('#nested-first-frame .lab-material'),
        shadowSurface,
      ];
      return nodes.map((el) => {
        const css = getComputedStyle(el);
        return {
          mode: el.getAttribute('data-expected'),
          color: css.backgroundColor,
          filter: css.backdropFilter,
          blur: css.getPropertyValue('--_blur').trim(),
        };
      });
    });
  const before = await read();
  for (const state of before) {
    expect(Number.parseFloat(state.blur)).toBe(
      state.mode === 'glass' ? 6 : state.mode === 'acrylic' ? 12 : 0,
    );
    if (state.mode === 'solid') {
      expect(state.filter).toBe('none');
      expect(state.color).toBe('rgb(245, 245, 245)');
    } else expect(state.filter).toContain(`blur(${state.mode === 'glass' ? 6 : 12}px)`);
  }
  await page.evaluate(() => {
    const scene = document.querySelector('#nested-first-frame');
    const shadow = document.querySelector('#first-shadow-host')?.shadowRoot;
    if (!scene || !shadow) throw new Error('Missing first-frame scene');
    window.materialFixture.mount(scene);
    window.materialFixture.mount(shadow);
  });
  const after = await read();
  expect(after.map((x) => x.blur)).toEqual(before.map((x) => x.blur));
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
  const channel = page.locator('body > .lab-material-paint-defs feFuncR');
  await expect(channel).toHaveAttribute('tableValues', /.+/);
  const old = await channel.getAttribute('tableValues');
  await surface.evaluate((el) =>
    el.style.setProperty('--lab-bg-material-soft-01', 'rgb(96 60 24 / .3)'),
  );
  await expect(channel).not.toHaveAttribute('tableValues', old ?? '');
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
    // Finish the initial ResizeObserver delivery and its scheduled lens update
    // before measuring the cost of an unrelated DOM mutation.
    await new Promise<void>((resolve) => {
      const observer = new ResizeObserver(() => {
        observer.disconnect();
        requestAnimationFrame(() => resolve());
      });
      observer.observe(surface);
    });
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
  await expect(filter).toHaveAttribute('width', '240');
  await expect(image.first()).toHaveAttribute('href', /.+/);
  const hrefs = await image.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  await surface.evaluate((el) => {
    el.style.transform = 'scale(.5)';
  });
  await expect(filter).toHaveAttribute('width', '240');
  expect(
    await image.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href'))),
  ).toEqual(hrefs);
  const oldScale = await filter.locator('feDisplacementMap').first().getAttribute('scale');
  await surface.evaluate((el) => el.style.setProperty('--_lg-refraction', '.5'));
  await expect
    .poll(() => filter.locator('feDisplacementMap').first().getAttribute('scale'))
    .not.toBe(oldScale);
});

test('the lens follows all four elliptical CSS corners, including percentage radii', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  const surface = page.locator('#surface');
  const image = page.locator('body > .lab-lg-defs feImage');
  await expect(image.first()).toHaveAttribute('href', /.+/);
  const signature = () =>
    image.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')).join('\n'));
  const original = await signature();
  await surface.evaluate((el) => {
    el.style.borderRadius = '24px 40% 48px 0 / 24px 30% 16px 0';
  });
  await expect.poll(signature).not.toBe(original);
  const asymmetric = await signature();
  await surface.evaluate((el) => {
    el.style.borderBottomLeftRadius = '12px 32px';
  });
  await expect.poll(signature).not.toBe(asymmetric);
  await surface.evaluate((el) => {
    el.style.borderRadius = '24px';
  });
  await expect.poll(signature).toBe(original);
});

test('CSS comparison radii use the same lens as their resolved pixel geometry', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  const surface = page.locator('#surface');
  const image = page.locator('body > .lab-lg-defs feImage');
  await surface.evaluate((el) => {
    el.style.width = '200px';
    el.style.height = '100px';
    el.style.borderRadius = '0px';
  });
  await expect(page.locator('body > .lab-lg-defs filter')).toHaveAttribute('width', '200');
  await expect(image).toHaveCount(1);
  for (const [math, pixels] of [
    ['min(10%, 30px)', '20px 10px'],
    ['max(10%, 30px)', '30px'],
    ['clamp(10px, 10%, 30px)', '20px 10px'],
    ['calc(min(10%, 30px) + 4px) max(5%, 12px)', '24px 12px'],
  ] as const) {
    await surface.evaluate((el, value) => {
      el.style.borderTopLeftRadius = value;
    }, pixels);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    const expected = await image.getAttribute('href');
    await surface.evaluate((el, value) => {
      el.style.borderTopLeftRadius = value;
    }, math);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    expect(await image.getAttribute('href')).toBe(expected);
  }
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
    materialFixture: {
      borderBox: typeof import('../../../packages/materials/src/engine/border-box').readBorderBox;
      stop(): void;
      stopShadow(): void;
      overlap(): void;
      stopOverlap(): void;
      mount(root: Document | Element | ShadowRoot, options?: MaterialRuntimeOptions): () => void;
    };
  }
}

test('CSS without a runtime still degrades to opaque Solid', async ({ page, browserName }) => {
  test.skip(
    browserName === 'firefox',
    'Firefox dynamic contrast emulation does not reevaluate CSS',
  );
  await page.evaluate(() => {
    const panel = document.createElement('div');
    panel.id = 'unmanaged';
    panel.className = 'lab-material lab-material--soft';
    panel.dataset.material = 'glass';
    document.body.appendChild(panel);
  });
  const panel = page.locator('#unmanaged');
  await expect(panel).not.toHaveAttribute('data-lab-material-mode');
  await expect(panel).not.toHaveCSS('background-color', 'rgb(245, 245, 245)');
  await expect
    .poll(() => panel.evaluate((el) => getComputedStyle(el).backdropFilter))
    .toContain('blur(6px)');
  await page.emulateMedia({ contrast: 'more' });
  await expect(panel).toHaveCSS('background-color', 'rgb(245, 245, 245)');
  await expect(panel).toHaveCSS('--_blur', '0px');
});

test('overlapping mounts keep the new effect when the previous one retires', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  await page.evaluate(() => window.materialFixture.overlap());
  const surface = page.locator('#surface');
  await surface.evaluate((el) => el.setAttribute('data-material', 'acrylic'));
  await expect
    .poll(() => surface.evaluate((el) => getComputedStyle(el).backdropFilter))
    .toContain('lab-material-paint-');
  await surface.evaluate((el) => el.setAttribute('data-material', 'glass'));
  await expect
    .poll(() => surface.evaluate((el) => getComputedStyle(el).backdropFilter))
    .toContain('lab-lg-');
  await surface.evaluate((el) => el.setAttribute('data-material', 'acrylic'));
  await expect
    .poll(() => surface.evaluate((el) => getComputedStyle(el).backdropFilter))
    .toContain('lab-material-paint-');
  await expect(page.locator('body > .lab-lg-defs')).toHaveCount(0);
});

test('moving a shared surface recreates its filter in the destination tree', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  await page.evaluate(() => {
    window.materialFixture.overlap();
    const surface = document.querySelector('#surface');
    const shadow = document.querySelector('#shadow-host')?.shadowRoot;
    if (!surface || !shadow) throw new Error('Missing material fixture');
    shadow.appendChild(surface);
  });
  const surface = page.locator('#surface');
  await expect
    .poll(() =>
      surface.evaluate((el) => {
        const id = getComputedStyle(el).backdropFilter.match(/url\(["']?#([^"')]+)["']?\)/)?.[1];
        return !!id && !!(el.getRootNode() as ShadowRoot).querySelector(`[id="${id}"]`);
      }),
    )
    .toBe(true);
  await expect(page.locator('body > .lab-lg-defs')).toHaveCount(0);
});

test('a relocated shadow host follows its new ancestors', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  await page.evaluate(() => {
    const host = document.querySelector('#shadow-host');
    if (!host) throw new Error('Missing shadow host');
    host.removeAttribute('data-material');
    const parent = document.createElement('section');
    parent.id = 'new-parent';
    parent.dataset.material = 'acrylic';
    document.body.appendChild(parent);
    parent.appendChild(host);
  });
  const shadow = page.locator('#shadow-surface');
  await expect(shadow).toHaveAttribute('data-lab-material-mode', 'acrylic');
  await expect
    .poll(() => shadow.evaluate((el) => getComputedStyle(el).backdropFilter))
    .toContain('lab-material-paint-');
  await page.locator('#new-parent').evaluate((el) => el.setAttribute('data-material', 'glass'));
  await expect(shadow).toHaveClass(/lab-material--lensed/);
  await expect
    .poll(() => shadow.evaluate((el) => getComputedStyle(el).backdropFilter))
    .toContain('lab-lg-');
});

test('shadow and light DOM use the same author light parameters, independent of theme', async ({
  page,
}) => {
  const light = page.locator('#surface');
  const shadow = page.locator('#shadow-surface');
  const rim = await light.evaluate((el) => getComputedStyle(el).getPropertyValue('--_glass-rim'));
  await page.locator('html').evaluate((el) => el.setAttribute('data-theme', 'dark'));
  await expect(shadow).toHaveAttribute('data-lab-material-theme', 'dark');
  expect(await shadow.evaluate((el) => getComputedStyle(el).getPropertyValue('--_glass-rim'))).toBe(
    rim,
  );
  await page.locator('#shadow-host').evaluate((el) => el.setAttribute('data-theme', 'light'));
  await expect(shadow).toHaveAttribute('data-lab-material-theme', 'light');
  expect(await shadow.evaluate((el) => getComputedStyle(el).getPropertyValue('--_glass-rim'))).toBe(
    rim,
  );
});

test('a same-origin iframe Document registers its own HTML elements', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'material-frame';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Missing iframe document');
    doc.body.innerHTML =
      '<div data-material="glass"><div id="frame-surface" class="lab-material" style="width:180px;height:120px;border-radius:20px">Frame</div></div>';
    window.materialFixture.mount(doc);
  });
  const surface = page.frameLocator('#material-frame').locator('#frame-surface');
  await expect(surface).toHaveClass(/lab-material--lensed/);
  await expect
    .poll(() =>
      surface.evaluate((el) => {
        const id = el.style
          .getPropertyValue('--_material-lens-filter')
          .match(/url\(["']?#([^"')]+)["']?\)/)?.[1];
        return !!id && !!el.ownerDocument.getElementById(id);
      }),
    )
    .toBe(true);
});

test('an Element scope observes its actual ShadowRoot parent when moved', async ({ page }) => {
  await page.evaluate(() => {
    window.materialFixture.stopShadow();
    const root = document.querySelector('#shadow-host')?.shadowRoot;
    const surface = root?.querySelector('#shadow-surface');
    if (!root || !surface) throw new Error('Missing shadow fixture');
    const target = document.createElement('div');
    target.id = 'shadow-solid';
    target.dataset.material = 'solid';
    root.appendChild(target);
    window.materialFixture.mount(surface);
  });
  const surface = page.locator('#shadow-surface');
  await expect(surface).toHaveAttribute('data-lab-material-mode', 'glass');
  await page.evaluate(() => {
    const root = document.querySelector('#shadow-host')?.shadowRoot;
    const surface = root?.querySelector('#shadow-surface');
    if (surface) root?.querySelector('#shadow-solid')?.appendChild(surface);
  });
  await expect(surface).toHaveAttribute('data-lab-material-mode', 'solid');
});

test('slot reassignment rebuilds the composed scope and observes its new ancestors', async ({
  page,
}) => {
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'slotted-host';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<div data-material="glass"><slot name="glass"></slot></div><div id="acrylic-slot-parent" data-material="acrylic"><slot name="acrylic"></slot></div>';
    const surface = document.createElement('div');
    surface.id = 'slotted-surface';
    surface.className = 'lab-material lab-material--soft';
    surface.slot = 'glass';
    host.appendChild(surface);
    document.body.appendChild(host);
    window.materialFixture.mount(surface);
  });
  const surface = page.locator('#slotted-surface');
  await expect(surface).toHaveAttribute('data-lab-material-mode', 'glass');
  await surface.evaluate((el) => {
    el.slot = 'acrylic';
  });
  await expect(surface).toHaveAttribute('data-lab-material-mode', 'acrylic');
  await page
    .locator('#acrylic-slot-parent')
    .evaluate((el) => el.setAttribute('data-material', 'solid'));
  await expect(surface).toHaveAttribute('data-lab-material-mode', 'solid');
});

test('a detached shadow host reconnects in a later frame and follows its new scope', async ({
  page,
}) => {
  await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('#shadow-host');
    if (!host) throw new Error('Missing shadow host');
    host.removeAttribute('data-material');
    const target = document.createElement('div');
    target.id = 'reconnect-target';
    target.dataset.material = 'acrylic';
    document.body.appendChild(target);
    Object.assign(window, { detachedMaterialHost: host });
    host.remove();
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const host = (window as unknown as { detachedMaterialHost: HTMLElement })
          .detachedMaterialHost;
        return host.shadowRoot
          ?.querySelector('#shadow-surface')
          ?.getAttribute('data-lab-material-mode');
      }),
    )
    .toBeNull();
  await page.evaluate(() => {
    const host = (window as unknown as { detachedMaterialHost: HTMLElement }).detachedMaterialHost;
    document.querySelector('#reconnect-target')?.appendChild(host);
  });
  const surface = page.locator('#shadow-surface');
  await expect(surface).toHaveAttribute('data-lab-material-mode', 'acrylic');
  await page
    .locator('#reconnect-target')
    .evaluate((el) => el.setAttribute('data-material', 'solid'));
  await expect(surface).toHaveAttribute('data-lab-material-mode', 'solid');
});

test('runtime themes match first paint for automatic and unrecognized values', async ({ page }) => {
  const surfaces = [page.locator('#surface'), page.locator('#shadow-surface')];
  for (const colorScheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.reload();
    await expect(page.locator('#ready')).toHaveText('ready');
    for (const theme of [null, '', 'auto', 'custom', 'light', 'dark']) {
      await page.locator('html').evaluate((el, theme) => {
        if (theme === null) el.removeAttribute('data-theme');
        else el.setAttribute('data-theme', theme);
      }, theme);
      const expected = theme === 'light' || theme === 'dark' ? theme : colorScheme;
      for (const surface of surfaces) {
        await expect(surface).toHaveAttribute('data-lab-material-theme', expected);
        await expect(surface).toHaveCSS(
          '--_material-paint-blend-mode',
          expected === 'dark' ? 'overlay' : 'color-dodge',
        );
      }
    }
  }
  // Unknown nested values inherit the nearest explicit boundary, as CSS does.
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
    for (const el of document.querySelectorAll<HTMLElement>('#scope, #shadow-host'))
      el.dataset.theme = 'dark';
  });
  for (const surface of surfaces) {
    await surface.evaluate((el) => el.setAttribute('data-theme', 'auto'));
    await expect(surface).toHaveAttribute('data-lab-material-theme', 'dark');
  }
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('#scope, #shadow-host'))
      el.dataset.theme = 'custom';
  });
  for (const surface of surfaces) {
    await expect(surface).toHaveAttribute('data-lab-material-theme', 'light');
  }
});

test('author paints follow the operating system palette without an explicit theme', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  await page.locator('html').evaluate((el) => el.removeAttribute('data-theme'));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addStyleTag({
    content: `:root { --lab-bg-material-soft-01:rgb(96 112 128 / .3) }
    @media (prefers-color-scheme:dark) { :root { --lab-bg-material-soft-01:rgb(24 40 56 / .3) } }`,
  });
  const surface = page.locator('#surface');
  await surface.evaluate((el) => el.setAttribute('data-material', 'acrylic'));
  const channel = page.locator('body > .lab-material-paint-defs feFuncR');
  await expect(channel).toHaveAttribute('tableValues', /.+/);
  const light = await channel.getAttribute('tableValues');
  await expect(surface).toHaveAttribute('data-lab-material-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(surface).toHaveAttribute('data-lab-material-theme', 'dark');
  await expect(channel).not.toHaveAttribute('tableValues', light ?? '');
});

test('compositor motion keeps author filters without profile reads or SVG writes', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  await expect(page.locator('body > .lab-lg-defs feImage').first()).toHaveAttribute('href', /.+/);
  const activity = await page.evaluate(async () => {
    const surface = document.querySelector<HTMLElement>('#surface');
    if (!surface) throw new Error('Missing surface');
    // Finish initial sizing/decode delivery before measuring movement.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const originalStyle = window.getComputedStyle;
    let reads = 0;
    let writes = 0;
    window.getComputedStyle = (...args) => {
      if (args[0] === surface) reads++;
      return originalStyle(...args);
    };
    const observer = new MutationObserver((records) => {
      writes += records.length;
    });
    for (const defs of document.querySelectorAll(
      'body > .lab-lg-defs, body > .lab-material-paint-defs',
    )) {
      observer.observe(defs, { attributes: true, childList: true, subtree: true });
    }
    try {
      for (let frame = 0; frame < 20; frame++) {
        surface.style.transform = `translateX(${frame}px)`;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      return { reads, writes };
    } finally {
      window.getComputedStyle = originalStyle;
      observer.disconnect();
    }
  });
  expect(activity).toEqual({ reads: 0, writes: 0 });
});

test('the first late slot assignment brings its composed material scope into observation', async ({
  page,
}) => {
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'late-slot-host';
    host.dataset.material = 'solid';
    host.attachShadow({ mode: 'open' });
    const surface = document.createElement('div');
    surface.id = 'late-slot-surface';
    surface.className = 'lab-material lab-material--soft';
    surface.slot = 'panel';
    host.append(surface);
    document.body.append(host);
    window.materialFixture.mount(surface);
  });
  const surface = page.locator('#late-slot-surface');
  await expect(surface).toHaveAttribute('data-lab-material-mode', 'solid');
  await page.locator('#late-slot-host').evaluate((host) => {
    if (!host.shadowRoot) throw new Error('Missing shadow root');
    host.shadowRoot.innerHTML =
      '<div id="late-slot-parent" data-material="acrylic"><slot name="panel"></slot></div>';
  });
  await expect(surface).toHaveAttribute('data-lab-material-mode', 'acrylic');
  await page
    .locator('#late-slot-parent')
    .evaluate((el) => el.setAttribute('data-material', 'glass'));
  await expect(surface).toHaveAttribute('data-lab-material-mode', 'glass');
});

test('identical paints share one filter across sizes and release it after their last consumer', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  const result = await page.evaluate(async () => {
    const scope = document.createElement('div');
    scope.dataset.material = 'acrylic';
    scope.style.cssText =
      '--lab-bg-material-soft-01:rgb(10 20 30/.6);--lab-bg-material-soft-02:rgb(70 80 90);';
    for (let i = 0; i < 100; i++) {
      const surface = document.createElement('div');
      surface.className = 'lab-material lab-material--soft';
      surface.style.width = `${100 + i}px`;
      scope.append(surface);
    }
    document.body.append(scope);
    const stop = window.materialFixture.mount(scope);
    const elements = Array.from(scope.children) as HTMLElement[];
    const refs = () => elements.map((el) => el.style.getPropertyValue('--_material-paint-filter'));
    const before = refs();
    const filterId = before[0]?.match(/#([^)]*)/)?.[1];
    const filter = filterId ? document.getElementById(filterId) : null;
    const bytes = filter?.outerHTML.length ?? 0;
    elements[0]?.style.setProperty('--lab-bg-material-soft-01', 'rgb(20 30 40/.6)');
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const changed = refs();
    stop();
    stop();
    scope.remove();
    return { before, changed, bytes, remaining: filter?.isConnected };
  });
  expect(new Set(result.before).size).toBe(1);
  expect(result.changed[0]).not.toBe(result.before[0]);
  expect(result.changed.slice(1)).toEqual(result.before.slice(1));
  expect(result.bytes).toBeLessThan(30_000);
  expect(result.remaining).toBe(false);
});

for (const variant of ['standard', 'custom'] as const) {
  test(`the ${variant} CSS paints survive runtime hydration over coloured content`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium');
    await page.setViewportSize({ width: 800, height: 500 });
    await page.addStyleTag({
      content: readFileSync(
        new URL('../../../packages/colors/contract.css', import.meta.url),
        'utf8',
      ),
    });
    const customStyles: Record<string, Record<string, string>> = {};
    if (variant === 'custom') {
      for (const theme of ['light', 'dark'] as const) {
        const roles: Record<string, Rgba> = {};
        for (const [index, tier] of MATERIAL_TIERS.entries()) {
          const names = materialRoles(tier);
          roles[names.normal] = { r: 32 + index * 20, g: 75, b: 150, a: 0.15 + index * 0.08 };
          roles[names.blend] = { r: 220, g: 50 + index * 30, b: 120, a: 0.35 };
        }
        customStyles[theme] = {
          ...Object.fromEntries(
            Object.entries(roles).map(([key, c]) => [
              `--lab-${key}`,
              `rgb(${c.r} ${c.g} ${c.b} / ${c.a})`,
            ]),
          ),
          ...compileMaterialTheme(theme, roles),
        };
      }
    }
    await page.evaluate((customStyles) => {
      window.materialFixture.stop();
      window.materialFixture.stopShadow();
      const main = document.createElement('main');
      main.id = 'first-frame';
      main.style.cssText = 'position:fixed;inset:0;z-index:999';
      for (const theme of ['light', 'dark']) {
        const scene = document.createElement('section');
        scene.dataset.theme = theme;
        scene.dataset.material = 'acrylic';
        scene.style.cssText =
          'height:250px;display:flex;gap:8px;padding:16px;box-sizing:border-box;background:linear-gradient(105deg,#000,#0900ba,#d20025,#eab318,#118042,#09bcfe,#fff)';
        for (const [key, value] of Object.entries(customStyles[theme] ?? {}))
          scene.style.setProperty(key, value);
        for (const tier of ['subtle', 'soft', 'muted', 'base', 'elevated']) {
          const surface = document.createElement('div');
          surface.className = `lab-material lab-material--${tier}`;
          surface.style.cssText =
            'width:144px;height:218px;flex-shrink:0;margin:0;padding:0;border-radius:32px;transform:translateZ(0);--_noise:none;--_acrylic-noise:none';
          scene.append(surface);
        }
        main.append(scene);
      }
      document.body.append(main);
    }, customStyles);
    const before = await page.screenshot();
    await page.evaluate(() => {
      const scope = document.querySelector('#first-frame');
      if (!scope) throw new Error('Missing first-frame scene');
      window.materialFixture.mount(scope);
    });
    const after = await page.screenshot();
    const errors = await page.evaluate(
      async ({ before, after }) => {
        const pixels = async (base64: string) => {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Missing canvas');
          ctx.drawImage(image, 0, 0);
          return ctx.getImageData(0, 0, image.width, image.height).data;
        };
        const [a, b] = await Promise.all([pixels(before), pixels(after)]);
        return Array.from(document.querySelectorAll('#first-frame .lab-material')).map((el) => {
          const rect = el.getBoundingClientRect();
          let maximum = 0;
          for (let y = Math.ceil(rect.top + 34); y < Math.floor(rect.bottom - 34); y++)
            for (let x = Math.ceil(rect.left + 34); x < Math.floor(rect.right - 34); x++)
              for (let channel = 0; channel < 3; channel++) {
                const i = (y * 800 + x) * 4 + channel;
                maximum = Math.max(maximum, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
              }
          return maximum;
        });
      },
      { before: before.toString('base64'), after: after.toString('base64') },
    );
    expect(errors).toHaveLength(10);
    // CSS normal alpha and SVG sRGB quantise at different composition stages.
    for (const error of errors) expect(error).toBeLessThanOrEqual(2);
  });
}

test('native affine paint follows custom roles instead of keeping baked defaults', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'webkit');
  const surface = page.locator('#surface');
  await page.locator('#backdrop').evaluate((el) => {
    el.style.background = 'rgb(80 120 160)';
  });
  const colourError = async (expected: number[]) => {
    const png = await surface.screenshot();
    return page.evaluate(
      async ({ base64, expected }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Missing canvas');
        ctx.drawImage(image, 0, 0);
        const pixel = ctx.getImageData(
          Math.floor(image.width / 2),
          Math.floor(image.height / 2),
          1,
          1,
        ).data;
        return Math.max(...expected.map((channel, i) => Math.abs(channel - (pixel[i] ?? 0))));
      },
      { base64: png.toString('base64'), expected },
    );
  };
  await surface.evaluate((el) => {
    el.setAttribute('data-material', 'acrylic');
    el.style.setProperty('--_tint', 'rgb(0 0 0 / .5)');
    el.style.setProperty('--_blend', 'rgb(0 0 0 / 0)');
  });
  await expect.poll(() => colourError([40, 60, 80])).toBeLessThanOrEqual(1);
  await expect(page.locator('body > .lab-material-paint-defs')).toHaveCount(0);
  await surface.evaluate((el) => el.style.setProperty('--_tint', 'rgb(255 255 255 / .25)'));
  await expect.poll(() => colourError([123.75, 153.75, 183.75])).toBeLessThanOrEqual(1);
});

test('a veil retains authored paint between its own and nested backdrop passes', async ({
  page,
}) => {
  await page.evaluate(() => {
    const veil = document.createElement('div');
    veil.id = 'ordered-veil';
    veil.dataset.veil = 'top';
    veil.dataset.veilProfile = 'strong';
    veil.style.cssText = 'width:320px;height:220px';
    veil.innerHTML = '<div data-veil-paint style="background:linear-gradient(blue,red)"></div>';
    document.body.append(veil);
    window.materialFixture.mount(veil);
  });
  const veil = page.locator('#ordered-veil');
  const order = () =>
    veil.evaluate((el) =>
      Array.from(el.children).map((child) =>
        child.hasAttribute('data-veil-paint') ? 'paint' : child.className,
      ),
    );
  const strong = [
    ...Array(5).fill('lab-veil__strip'),
    'lab-veil__noise',
    'paint',
    ...Array(5).fill('lab-veil__strip'),
    'lab-veil__noise',
  ];
  await expect.poll(order).toEqual(strong);
  // Replacing a declarative fill changes source order even with identical geometry.
  await veil.evaluate((el) => {
    const paint = el.querySelector('[data-veil-paint]');
    if (!paint) throw new Error('Missing paint');
    const replacement = paint.cloneNode(true);
    paint.remove();
    el.append(replacement);
  });
  await expect.poll(order).toEqual(strong);
  await veil.evaluate((el) => {
    el.style.width = '360px';
  });
  await expect.poll(order).toEqual(strong);
  await veil.evaluate((el) => el.setAttribute('data-veil-profile', 'overlay-ghost'));
  await expect
    .poll(order)
    .toEqual([...Array(5).fill('lab-veil__strip'), 'lab-veil__noise', 'paint']);
  await page.evaluate(() => document.documentElement.setAttribute('data-contrast', 'more'));
  await expect(veil.locator('.lab-veil__strip,.lab-veil__noise')).toHaveCount(0);
  await expect(veil.locator('[data-veil-paint]')).toHaveCount(1);
});

test('authored veil profiles retain the two Strong passes and one Overlay Ghost pass', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  await page.evaluate(() => {
    const veil = document.createElement('div');
    veil.id = 'authored-veil';
    veil.dataset.veil = 'top';
    veil.dataset.veilProfile = 'strong';
    veil.style.cssText = 'width:320px;height:220px';
    document.body.append(veil);
    window.materialFixture.mount(veil);
  });
  const veil = page.locator('#authored-veil');
  await expect(veil.locator('.lab-veil__noise')).toHaveCount(2);
  const strong = await veil
    .locator('.lab-veil__strip')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).backdropFilter));
  await veil.evaluate((el) => el.setAttribute('data-veil-profile', 'overlay-ghost'));
  await expect(veil.locator('.lab-veil__noise')).toHaveCount(1);
  const ghost = await veil
    .locator('.lab-veil__strip')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).backdropFilter));
  expect(strong).toEqual([...ghost, ...ghost]);
  const sigmaSquared = ghost.reduce((sum, value) => {
    const sigma = Number.parseFloat(value.replace('blur(', ''));
    return sum + sigma * sigma;
  }, 0);
  expect(Math.sqrt(sigmaSquared)).toBeCloseTo(12, 1);
  const noise = await veil.locator('.lab-veil__noise').evaluate(async (el) => {
    const src = getComputedStyle(el).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
    if (!src) throw new Error('Missing noise asset');
    const image = new Image();
    image.src = src;
    await image.decode();
    return [image.width, image.height];
  });
  expect(noise).toEqual([48, 48]);
  const stripStyles = () =>
    veil
      .locator('.lab-veil__strip')
      .evaluateAll((els) => els.map((el) => (el as HTMLElement).style.cssText));
  const top = await stripStyles();
  await veil.evaluate((el) => el.setAttribute('data-veil', 'bottom'));
  await expect.poll(stripStyles).not.toEqual(top);
  const bottom = await stripStyles();
  await veil.evaluate((el) => {
    el.setAttribute('class', 'lab-material-ghost--sheet');
    el.setAttribute('data-veil', '');
    el.removeAttribute('data-veil-profile');
  });
  await expect(veil.locator('.lab-veil__noise')).toHaveCount(1);
  await expect.poll(stripStyles).toEqual(bottom);
  await expect(veil).toHaveCSS('--lab-sheet-ghost-overlap', '32px');
  await page.emulateMedia({ contrast: 'more' });
  await expect(veil.locator('.lab-veil__strip,.lab-veil__noise')).toHaveCount(0);
});

test('fluid edge bands match the pixel renderer while retaining their nodes across sizes', async ({
  page,
}) => {
  const comparisons = await page.evaluate(async () => {
    const tick = () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const results: {
      edge: string;
      length: number;
      count: number;
      fluidCount: number;
      error: number;
      sameNodes: boolean;
      sameBlur: boolean;
    }[] = [];
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const horizontal = edge === 'left' || edge === 'right';
      const fluid = document.createElement('div');
      const pixel = document.createElement('div');
      for (const el of [fluid, pixel]) {
        el.dataset.veil = edge;
        el.dataset.veilProfile = 'overlay-ghost';
        el.style.cssText = `position:fixed;left:0;top:0;${horizontal ? 'height' : 'width'}:180px`;
        document.body.append(el);
      }
      const dimension = horizontal ? 'width' : 'height';
      fluid.style.setProperty('--lab-veil-axis-length', '68px');
      fluid.style.setProperty(dimension, 'var(--lab-veil-axis-length)');
      pixel.style.setProperty(dimension, '68px');
      const stopFluid = window.materialFixture.mount(fluid, {
        motionProperties: ['--lab-veil-axis-length'],
      });
      const stopPixel = window.materialFixture.mount(pixel);
      await tick();
      const nodes = Array.from(fluid.querySelectorAll('.lab-veil__strip'));
      for (const length of [68, 422, 804, 68]) {
        fluid.style.setProperty('--lab-veil-axis-length', `${length}px`);
        pixel.style.setProperty(dimension, `${length}px`);
        await tick();
        const reference = Array.from(pixel.querySelectorAll('.lab-veil__strip'));
        let error = 0;
        for (const [i, node] of nodes.entries()) {
          const a = node.getBoundingClientRect();
          const b = reference[i]?.getBoundingClientRect();
          if (!b) {
            error = Number.POSITIVE_INFINITY;
            break;
          }
          for (const key of ['x', 'y', 'width', 'height'] as const)
            error = Math.max(error, Math.abs(a[key] - b[key]));
        }
        results.push({
          edge,
          length,
          count: reference.length,
          fluidCount: fluid.querySelectorAll('.lab-veil__strip').length,
          error,
          sameNodes: nodes.every(
            (node, i) => fluid.querySelectorAll('.lab-veil__strip')[i] === node,
          ),
          sameBlur: nodes.every(
            (node, i) =>
              getComputedStyle(node).backdropFilter ===
              getComputedStyle(reference[i] as Element).backdropFilter,
          ),
        });
      }
      stopFluid();
      stopPixel();
      fluid.remove();
      pixel.remove();
    }
    return results;
  });
  for (const result of comparisons) {
    expect(result.count).toBe(5);
    expect(result.fluidCount).toBe(5);
    expect(result.error, `${result.edge}/${result.length}`).toBeLessThan(0.05);
    expect(result.sameNodes).toBe(true);
    expect(result.sameBlur).toBe(true);
  }
});

test('declared motion scalars do not read material profiles or rebuild a fluid veil', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const tick = () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const scope = document.createElement('div');
    scope.dataset.material = 'acrylic';
    scope.style.cssText = '--position:68px;position:fixed;left:0;top:0;width:180px';
    scope.innerHTML =
      '<div data-veil="bottom" data-veil-profile="overlay-ghost" style="--lab-veil-axis-length:var(--position);height:var(--lab-veil-axis-length)"></div><div class="lab-material" style="height:100px;transform:translateY(var(--position))"></div>';
    document.body.append(scope);
    const stop = window.materialFixture.mount(scope, { motionProperties: ['--position'] });
    await tick();
    const original = window.getComputedStyle;
    let reads = 0;
    let writes = 0;
    const veil = scope.querySelector('[data-veil]') as HTMLElement;
    const surface = scope.querySelector('.lab-material') as HTMLElement;
    const nodes = Array.from(veil.children);
    window.getComputedStyle = (...args) => {
      if (args[0] === veil || args[0] === surface) reads++;
      return original(...args);
    };
    const observer = new MutationObserver((records) => {
      writes += records.length;
    });
    observer.observe(veil, { subtree: true, childList: true, attributes: true });
    try {
      for (let i = 0; i < 20; i++) {
        scope.style.setProperty('--position', `${68 + i * 8}px`);
        await tick();
      }
      const movement = {
        reads,
        writes,
        sameNodes: nodes.every((node, i) => veil.children[i] === node),
      };
      scope.style.setProperty('--lab-bg-material-base-01', 'rgb(70 80 90 / .5)');
      await tick();
      return { movement, roleRefresh: reads > movement.reads };
    } finally {
      window.getComputedStyle = original;
      observer.disconnect();
      stop();
      scope.remove();
    }
  });
  expect(result.movement).toEqual({ reads: 0, writes: 0, sameNodes: true });
  expect(result.roleRefresh).toBe(true);
});
