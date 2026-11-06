import { type Locator, type Page, expect, test } from '@playwright/test';

declare global {
  interface Window {
    switchLabelNodes?: HTMLElement[];
  }
}

const fixture = '/_fixtures/switch-labels.html';
const cases = [
  ['both', 'Left Right', 2],
  ['start', 'Left', 1],
  ['end', 'Right', 1],
  ['neither', 'Wi-Fi', 0],
] as const;

function control(page: Page, renderer: 'lit' | 'react', id: string): Locator {
  return page.getByTestId(`${renderer}-${id}`).locator('input');
}

async function labelGeometry(input: Locator) {
  return input.evaluate((node) => {
    const root = node.parentElement;
    if (!root) throw new Error('Нет Switch root');
    const labels = [
      ...root.querySelectorAll<HTMLElement>('.label-start, .label-end, .lab-switch-label'),
    ];
    const visible = labels.filter((label) => label.getBoundingClientRect().width > 0);
    const track = root.querySelector<HTMLElement>('.control, .lab-switch-control');
    if (!track) throw new Error('Нет Switch control');
    const ids = visible.map((label) => label.id);
    return {
      labels: visible.length,
      references: node.getAttribute('aria-labelledby'),
      fallback: node.getAttribute('aria-label'),
      ids: ids.join(' '),
      unique: new Set(ids).size,
      width: root.getBoundingClientRect().width,
      content:
        track.getBoundingClientRect().width +
        visible.reduce((sum, label) => sum + label.getBoundingClientRect().width, 0),
      gap: Number.parseFloat(getComputedStyle(root).columnGap),
      order: [...root.children]
        .filter((child) => child !== node && child.getBoundingClientRect().width > 0)
        .map((child) =>
          child === track
            ? 'control'
            : child.classList.contains('label-start') ||
                child.classList.contains('lab-switch-label-start')
              ? 'start'
              : 'end',
        ),
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto(fixture);
});

test('Core SSR имеет имя и geometry для всех четырёх комбинаций до JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(fixture);
  for (const [id, name, count] of cases) {
    const input = control(page, 'lit', id);
    await expect(input).toHaveAccessibleName(name);
    const geometry = await labelGeometry(input);
    expect(geometry.labels).toBe(count);
    expect(geometry.references).toBe(geometry.ids || null);
    expect(geometry.width).toBeCloseTo(geometry.content + geometry.gap * count, 2);
  }
  for (const id of ['empty', 'empty-wrapper', 'whitespace', 'icons']) {
    await expect(control(page, 'lit', id)).toHaveAccessibleName('Wi-Fi');
    expect((await labelGeometry(control(page, 'lit', id))).labels).toBe(0);
  }
  await context.close();
});

test('SSR naming: class/style captions и native SVG title сохраняют имя до JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(fixture);
    for (const renderer of ['lit', 'react'] as const) {
      for (const id of ['class-caption', 'style-caption']) {
        await expect(control(page, renderer, id)).toHaveAccessibleName('Leading Trailing');
      }
      for (const id of [
        'svg-idref',
        'svg-hidden-target',
        'svg-conflicting-title',
        'svg-fragment',
      ]) {
        await expect(control(page, renderer, id)).toHaveAccessibleName('Leading Network');
      }
      for (const id of [
        'svg-dangling',
        'svg-blank',
        'svg-hidden-caption',
        'svg-external',
        'svg-cyclic',
        'svg-opaque',
        'inline-hidden',
      ]) {
        await expect(control(page, renderer, id)).toHaveAccessibleName('Wi-Fi');
        await expect(control(page, renderer, id)).not.toHaveAttribute('aria-labelledby');
      }
      await expect(control(page, renderer, 'opacity-caption')).toHaveAccessibleName('Trailing');
    }
  } finally {
    await context.close();
  }
});

for (const renderer of ['lit', 'react'] as const) {
  test(`SSR wrapper naming: ${renderer} CSS literals и реальные caption text`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto(fixture);
      for (const id of [
        'css-quoted',
        'css-font',
        'css-comment',
        'css-escaped-string',
        'css-nested',
        'css-line-lf',
        'css-line-crlf',
        'css-line-cr',
        'css-line-ff',
        'css-empty-var',
        'css-empty-env',
        'css-empty-attr',
        'css-empty-if',
        'css-hex-lf',
        'css-hex-crlf',
        'css-hex-cr',
        'css-hex-ff',
        'css-nested-invalid-var',
        'css-invalid-env-index',
        'css-invalid-attr-name',
        'css-invalid-if-condition',
        'css-nested-invalid-function',
        'css-url-token',
        'css-dimension-token',
        'css-hash-token',
        'css-at-token',
        'css-invalid-attr-type',
        'css-invalid-attr-url',
        'css-invalid-braces',
        'css-all-display',
        'css-all-visibility',
        'css-all-content-visibility',
        'idref-text',
        'role-text',
      ]) {
        await expect(control(page, renderer, id)).toHaveAccessibleName('Leading Trailing');
      }
      for (const id of [
        'css-calc-substitution',
        'css-opaque-substitution',
        'css-eof-substitution',
        'css-percent-substitution',
        'css-attr-substitution',
      ]) {
        const input = control(page, renderer, id);
        await expect(input).toHaveAccessibleName('Wi-Fi');
        await expect(input).not.toHaveAttribute('aria-labelledby');
        expect((await labelGeometry(input)).labels).toBe(1);
      }
      if (renderer === 'lit')
        await expect(control(page, renderer, 'css-at-rule')).toHaveAccessibleName(
          'Leading Trailing',
        );
      await expect(control(page, renderer, 'css-escaped-hidden')).toHaveAccessibleName('Wi-Fi');
      await expect(control(page, renderer, 'css-escaped-hidden')).not.toHaveAttribute(
        'aria-labelledby',
      );
      await expect(control(page, renderer, 'css-vendor')).toHaveAccessibleName('Wi-Fi');
      await expect(control(page, renderer, 'css-vendor')).not.toHaveAttribute('aria-labelledby');
    } finally {
      await context.close();
    }
  });

  test(`DOM wrapper naming: ${renderer} IDREF и role не подавляют caption text`, async ({
    page,
  }) => {
    for (const id of [
      'css-quoted',
      'css-font',
      'css-comment',
      'css-escaped-string',
      'css-nested',
      'css-line-lf',
      'css-line-crlf',
      'css-line-cr',
      'css-line-ff',
      'css-empty-var',
      'css-empty-env',
      'css-empty-attr',
      'css-empty-if',
      'css-hex-lf',
      'css-hex-crlf',
      'css-hex-cr',
      'css-hex-ff',
      'css-nested-invalid-var',
      'css-invalid-env-index',
      'css-invalid-attr-name',
      'css-invalid-if-condition',
      'css-nested-invalid-function',
      'css-url-token',
      'css-dimension-token',
      'css-hash-token',
      'css-at-token',
      'css-invalid-attr-type',
      'css-invalid-attr-url',
      'css-invalid-braces',
      'css-all-display',
      'css-all-visibility',
      'css-all-content-visibility',
      'idref-text',
      'role-text',
    ]) {
      await expect(control(page, renderer, id)).toHaveAccessibleName('Leading Trailing');
    }
    for (const id of [
      'css-calc-substitution',
      'css-opaque-substitution',
      'css-eof-substitution',
      'css-percent-substitution',
      'css-attr-substitution',
    ]) {
      await expect(control(page, renderer, id)).toHaveAccessibleName('Trailing');
    }
    if (renderer === 'lit')
      await expect(control(page, renderer, 'css-at-rule')).toHaveAccessibleName('Leading Trailing');
    await expect(control(page, renderer, 'css-escaped-hidden')).toHaveAccessibleName('Wi-Fi');
    await expect(control(page, renderer, 'css-escaped-hidden')).not.toHaveAttribute(
      'aria-labelledby',
    );
    await expect(control(page, renderer, 'css-vendor')).toHaveAccessibleName('Trailing');
  });

  test(`DOM naming: ${renderer} сохраняет SVG title и guards соседних IDREF`, async ({ page }) => {
    for (const id of ['svg-idref', 'svg-hidden-target', 'svg-conflicting-title', 'svg-fragment']) {
      await expect(control(page, renderer, id)).toHaveAccessibleName('Leading Network');
    }
    for (const id of [
      'svg-dangling',
      'svg-blank',
      'svg-hidden-caption',
      'svg-external',
      'svg-cyclic',
      'svg-opaque',
    ]) {
      await expect(control(page, renderer, id)).toHaveAccessibleName('Wi-Fi');
      await expect(control(page, renderer, id)).not.toHaveAttribute('aria-labelledby');
    }
    const input = control(page, renderer, 'svg-idref');
    const title = page.getByTestId(`${renderer}-svg-idref`).locator('title');
    await title.evaluate((node) => {
      node.textContent = ' \t ';
    });
    await expect(input).toHaveAccessibleName('Leading');
    await title.evaluate((node) => {
      node.textContent = 'Restored';
    });
    await expect(input).toHaveAccessibleName('Leading Restored');
  });

  test(`DOM naming: ${renderer} CSS visibility меняет имя без пустого IDREF`, async ({ page }) => {
    const input = control(page, renderer, 'visibility');
    const caption = page.getByTestId(`${renderer}-visibility`).locator('[data-caption]');
    await expect(input).toHaveAccessibleName('Trailing');
    for (const declaration of [
      'display:none',
      'visibility:hidden',
      'visibility:collapse',
      'content-visibility:hidden',
    ]) {
      await caption.evaluate((node, style) => node.setAttribute('style', style), declaration);
      await expect(input).toHaveAccessibleName('Wi-Fi');
      await expect(input).not.toHaveAttribute('aria-labelledby');
      await caption.evaluate((node) => node.removeAttribute('style'));
      await expect(input).toHaveAccessibleName('Trailing');
    }
    await caption.evaluate((node) => node.setAttribute('style', 'opacity:0'));
    await expect(input).toHaveAccessibleName('Trailing');
    await page.addStyleTag({ content: '.caption-hidden { display: none }' });
    await caption.evaluate((node) => node.classList.add('caption-hidden'));
    await expect(input).toHaveAccessibleName('Wi-Fi');
    await expect(input).not.toHaveAttribute('aria-labelledby');
    await caption.evaluate((node) => node.classList.remove('caption-hidden'));
    await expect(input).toHaveAccessibleName('Trailing');
  });
}

for (const renderer of ['lit', 'react'] as const) {
  test(`${renderer}: показанные подписи задают имя и не оставляют лишний gap`, async ({
    page,
  }, testInfo) => {
    for (const [id, name, count] of cases) {
      const input = control(page, renderer, id);
      await expect(input).toHaveAccessibleName(name);
      const geometry = await labelGeometry(input);
      expect(geometry.labels).toBe(count);
      expect(geometry.unique).toBe(count);
      expect(geometry.references).toBe(geometry.ids || null);
      expect(geometry.fallback).toBe(count ? null : 'Wi-Fi');
      expect(geometry.width).toBeCloseTo(geometry.content + geometry.gap * count, 2);
      expect(geometry.order).toEqual(
        id === 'both'
          ? ['start', 'control', 'end']
          : id === 'start'
            ? ['start', 'control']
            : id === 'end'
              ? ['control', 'end']
              : ['control'],
      );
    }
    for (const id of ['empty', 'empty-wrapper', 'whitespace', 'icons']) {
      await expect(control(page, renderer, id)).toHaveAccessibleName('Wi-Fi');
      expect((await labelGeometry(control(page, renderer, id))).labels).toBe(0);
    }
    await expect(control(page, renderer, 'legacy')).toHaveAccessibleName('Legacy');
    await expect(control(page, renderer, 'rich')).toHaveAccessibleName('Legacy label');
    await expect(control(page, renderer, 'image')).toHaveAccessibleName('Network');
    await expect(control(page, renderer, 'unknown')).toHaveAccessibleName('Wi-Fi');
    await expect(control(page, renderer, 'unknown')).not.toHaveAttribute('aria-labelledby');
    await expect(control(page, renderer, 'escaped')).toHaveAccessibleName('<b>Left & right</b>');
    const ids = await page
      .locator(`#${renderer === 'lit' ? 'lit' : 'react'}-labels input`)
      .evaluateAll((inputs) => inputs.map((input) => input.id));
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    await page
      .getByTestId(`${renderer}-both`)
      .locator(renderer === 'lit' ? '.root' : '[data-lab-switch]')
      .screenshot({ path: testInfo.outputPath(`switch-labels-${renderer}.png`) });
  });
}

test('React false, empty fragments и массивы не создают label box; 0 остаётся текстом', async ({
  page,
}) => {
  for (const id of ['false', 'fragment', 'array']) {
    await expect(control(page, 'react', id)).toHaveAccessibleName('Wi-Fi');
    expect((await labelGeometry(control(page, 'react', id))).labels).toBe(0);
  }
  await expect(control(page, 'react', 'zero')).toHaveAccessibleName('0');
  expect((await labelGeometry(control(page, 'react', 'zero'))).labels).toBe(1);
  await expect(control(page, 'react', 'opaque')).toHaveAccessibleName('Component label');
});

test('Core замечает изменение текста внутри назначенной обёртки и reconnect', async ({ page }) => {
  const host = page.getByTestId('lit-mutable-wrapper').locator('lab-switch');
  const wrapper = host.locator('[data-wrapper]');
  const input = control(page, 'lit', 'mutable-wrapper');
  await expect(input).toHaveAccessibleName('Wi-Fi');
  expect((await labelGeometry(input)).labels).toBe(0);
  await wrapper.evaluate((node) => {
    node.textContent = 'Mutable';
  });
  await expect(input).toHaveAccessibleName('Mutable');
  await wrapper.evaluate((node) => {
    if (!node.firstChild) throw new Error('Нет изменяемого текста обёртки');
    node.firstChild.textContent = ' \t ';
  });
  await expect(input).toHaveAccessibleName('Wi-Fi');
  await expect(input).not.toHaveAttribute('aria-labelledby');
  expect((await labelGeometry(input)).labels).toBe(0);
  await wrapper.evaluate((node) => {
    node.innerHTML = '<strong>Restored</strong>';
  });
  await expect(input).toHaveAccessibleName('Restored');
  await host.evaluate((node) => {
    const parent = node.parentNode;
    if (!parent) throw new Error('Нет родителя Switch');
    node.remove();
    parent.appendChild(node);
  });
  await wrapper.evaluate((node) => {
    node.textContent = 'After reconnect';
  });
  await expect(input).toHaveAccessibleName('After reconnect');
  await wrapper.evaluate((node) => {
    node.textContent = '';
  });
  await expect(input).toHaveAccessibleName('Wi-Fi');
  expect((await labelGeometry(input)).labels).toBe(0);
});

test('DOM: React Caption меняет подпись без render родителя', async ({ page }) => {
  const input = control(page, 'react', 'caption');
  const caption = page.getByTestId('react-caption-content');
  const renders = await page.locator('#react-switch-form').getAttribute('data-parent-renders');
  await expect(input).toHaveAccessibleName('Wi-Fi');
  expect((await labelGeometry(input)).labels).toBe(0);
  await caption.evaluate((node) => {
    node.dataset.captionText = 'Changed caption';
    node.dispatchEvent(new Event('caption-text'));
  });
  await expect(input).toHaveAccessibleName('Changed caption');
  expect((await labelGeometry(input)).labels).toBe(1);
  await caption.evaluate((node) => {
    node.dataset.captionText = '';
    node.dispatchEvent(new Event('caption-text'));
  });
  await expect(input).toHaveAccessibleName('Wi-Fi');
  expect((await labelGeometry(input)).labels).toBe(0);
  await expect(caption).toBeAttached();
  expect(await page.locator('#react-switch-form').getAttribute('data-parent-renders')).toBe(
    renders,
  );
});

test('DOM: Core projected slot замечает внешний текст и переназначение', async ({ page }) => {
  const input = control(page, 'lit', 'projected');
  const projection = page.getByTestId('lit-projected').locator('switch-label-projection');
  const caption = projection.locator('[data-projected-caption]');
  await expect(input).toHaveAccessibleName('Wi-Fi');
  expect((await labelGeometry(input)).labels).toBe(0);
  await caption.evaluate((node) => {
    node.textContent = 'Projected caption';
  });
  await expect(input).toHaveAccessibleName('Projected caption');
  await caption.evaluate((node) => {
    if (!node.firstChild) throw new Error('Нет текста projected caption');
    node.firstChild.textContent = ' \t ';
  });
  await expect(input).toHaveAccessibleName('Wi-Fi');
  await caption.evaluate((node) => {
    node.textContent = 'Retargeted';
    node.setAttribute('slot', 'other');
  });
  await expect(input).toHaveAccessibleName('Wi-Fi');
  await projection.evaluate((node) =>
    node.shadowRoot?.querySelector('slot')?.setAttribute('name', 'other'),
  );
  await expect(input).toHaveAccessibleName('Retargeted');
});

test('DOM: unknown closed content использует fallback, публичное имя и open DOM уточняются', async ({
  page,
}) => {
  for (const renderer of ['lit', 'react'] as const) {
    await expect(control(page, renderer, 'closed')).toHaveAccessibleName('Wi-Fi');
    await expect(control(page, renderer, 'closed')).not.toHaveAttribute('aria-labelledby');
    await expect(control(page, renderer, 'closed-named')).toHaveAccessibleName('Public name');
    await expect(control(page, renderer, 'open')).toHaveAccessibleName('Open label');
    await page
      .getByTestId(`${renderer}-open`)
      .locator('open-switch-caption')
      .evaluate((node) => {
        const caption = node.shadowRoot?.querySelector('span');
        if (!caption) throw new Error('Нет open caption');
        caption.textContent = '';
      });
    await expect(control(page, renderer, 'open')).toHaveAccessibleName('Wi-Fi');
    expect((await labelGeometry(control(page, renderer, 'open'))).labels).toBe(0);
  }
});

test('Core реагирует на textContent, изменение текста и slot assignment', async ({ page }) => {
  const host = page.getByTestId('lit-mutable').locator('lab-switch');
  const input = control(page, 'lit', 'mutable');
  await expect(input).toHaveAccessibleName('Wi-Fi');
  await host.evaluate((node) => {
    node.setAttribute('label-start', 'Leading');
    node.textContent = 'Mutable';
  });
  await expect(host.locator('.label-start')).toHaveText('Leading');
  await expect(input).toHaveAccessibleName('Leading Mutable');
  await expect(input).not.toHaveAttribute('aria-label');
  await host.evaluate((node) => node.setAttribute('hide-label-start', ''));
  await expect(input).toHaveAccessibleName('Mutable');
  await host.evaluate((node) => node.removeAttribute('hide-label-start'));
  await expect(input).toHaveAccessibleName('Leading Mutable');
  await host.evaluate((node) => {
    if (!node.firstChild) throw new Error('Нет изменяемого текста');
    node.firstChild.textContent = ' \t ';
  });
  await expect(input).toHaveAccessibleName('Leading');
  expect((await labelGeometry(input)).labels).toBe(1);
  await host.evaluate((node) => {
    node.removeAttribute('label-start');
    node.innerHTML = '<span slot="icon-on">Icon</span>';
  });
  await expect(input).toHaveAccessibleName('Wi-Fi');
  expect((await labelGeometry(input)).labels).toBe(0);
  await host.locator('[slot]').evaluate((node) => node.setAttribute('slot', ''));
  await expect(input).toHaveAccessibleName('Icon');
  expect((await labelGeometry(input)).labels).toBe(1);
  await host.evaluate((node) => {
    node.setAttribute('hide-label-end', '');
    node.setAttribute('aria-label', 'Network');
  });
  await expect(input).toHaveAccessibleName('Network');
  await expect(input).not.toHaveAttribute('aria-labelledby');
  await host.evaluate((node) => node.removeAttribute('aria-label'));
  await expect(input).not.toHaveAttribute('aria-label');
  await expect(input).toHaveAccessibleName('');
});

test('React обновляет children и независимую visibility без потери fallback', async ({ page }) => {
  const input = control(page, 'react', 'mutable');
  await expect(input).toHaveAccessibleName('Leading Mutable');
  await page.getByTestId('react-empty-label').click();
  await expect(input).toHaveAccessibleName('Leading');
  await page.getByTestId('react-hide-labels').click();
  await expect(input).toHaveAccessibleName('Wi-Fi');
  await page.getByTestId('react-update-label').click();
  await expect(input).toHaveAccessibleName('Wi-Fi');
  await page.getByTestId('react-hide-labels').click();
  await expect(input).toHaveAccessibleName('Leading Changed');
});

test('подписи сохраняют keyboard, disabled и React native form submission', async ({ page }) => {
  for (const renderer of ['lit', 'react'] as const) {
    const input = control(page, renderer, 'both');
    await input.focus();
    await input.press('Space');
    await expect(input).toBeChecked();
    await input.press('Space');
    await expect(input).not.toBeChecked();
    await page
      .getByTestId(`${renderer}-both`)
      .locator('.label-start, .lab-switch-label-start')
      .click();
    await expect(input).toBeChecked();
    await page.getByTestId(`${renderer}-both`).locator('.label-end, .lab-switch-label-end').click();
    await expect(input).not.toBeChecked();
    await expect(input).toHaveAccessibleName('Left Right');
    await expect(control(page, renderer, 'disabled')).toBeDisabled();
    const before = await control(page, renderer, 'disabled').isChecked();
    await page
      .getByTestId(`${renderer}-disabled`)
      .locator('.label-start, .lab-switch-label-start')
      .click({ force: true });
    expect(await control(page, renderer, 'disabled').isChecked()).toBe(before);
  }
  const formData = () =>
    page
      .locator('#react-switch-form')
      .evaluate((node) => [...new FormData(node as HTMLFormElement).entries()]);
  expect(await formData()).toEqual([['feature', 'on']]);
  await control(page, 'react', 'form').focus();
  await control(page, 'react', 'form').press('Space');
  await expect(control(page, 'react', 'form')).not.toBeChecked();
  expect(await formData()).toEqual([]);
  await expect(control(page, 'lit', 'both')).toHaveAttribute('name', 'core-both');
});

test('hydration сохраняет label nodes, unique IDs и доступные имена', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route(`**${fixture}`, async (route) => {
    const response = await route.fetch();
    const markup = await response.text();
    await route.fulfill({
      response,
      body: markup.replace(
        '</main>',
        `</main><script>
      window.switchLabelNodes = [...document.querySelectorAll('#react-labels .lab-switch-label')];
      for (const host of document.querySelectorAll('#lit-labels lab-switch')) {
        window.switchLabelNodes.push(...host.shadowRoot.querySelectorAll('.label-start, .label-end'));
      }
    </script>`,
      ),
    });
  });
  await page.reload();
  for (const renderer of ['lit', 'react'] as const) {
    await expect(control(page, renderer, 'both')).toHaveAccessibleName('Left Right');
    expect((await labelGeometry(control(page, renderer, 'both'))).labels).toBe(2);
  }
  expect(
    await page.evaluate(() => {
      const nodes = window.switchLabelNodes;
      return Boolean(nodes?.length && nodes.every((node) => node.isConnected));
    }),
  ).toBe(true);
  expect(errors).toEqual([]);
});
