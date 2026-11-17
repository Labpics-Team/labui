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
    if (browserName === 'chromium')
      await expect(el).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect
      .poll(() => el.evaluate((node) => getComputedStyle(node).backdropFilter))
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
    materialFixture: {
      stop(): void;
      stopShadow(): void;
      overlap(): void;
      stopOverlap(): void;
      mount(root: Document | Element | ShadowRoot): () => void;
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
  await expect(panel).toHaveCSS('background-color', 'rgba(245, 245, 245, 0.2)');
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
  await expect(page.locator('body > .lab-lg-defs feImage')).toHaveAttribute('href', /.+/);
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
