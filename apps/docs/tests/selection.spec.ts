import { type Locator, expect, test } from '@playwright/test';
import components from '../../../packages/tokens/src/components.js';

const values = (form: Locator) =>
  form.evaluate((node) => Array.from(new FormData(node as HTMLFormElement).entries()));
const activate = (input: Locator) => input.locator('..').click();
test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/selection.html');
  await expect(page.getByTestId('react-form')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

for (const renderer of ['lit', 'react'])
  for (const scale of [1, 2]) {
    test(`${renderer}: authored description preserves whole-string metrics at ${scale * 100}%`, async ({
      page,
    }, testInfo) => {
      await page.evaluate((scale) => {
        document.documentElement.style.fontSize = `${16 * scale}px`;
      }, scale);
      const rich = page.getByTestId(`${renderer}-rich`);
      const description = rich.locator('.lab-selection-description');
      await expect(description).toBeVisible();
      const result = await description.evaluate((element, scale) => {
        const text =
          'Shared access to original materials and project history for every member of the workspace. '.repeat(
            3,
          );
        const computed = getComputedStyle(element);
        const actual = document.createElement('span');
        actual.textContent = text;
        actual.style.cssText =
          'position:absolute;display:inline-block;white-space:pre;inline-size:max-content;';
        for (const property of [
          'font-family',
          'font-size',
          'font-weight',
          'font-feature-settings',
          'letter-spacing',
          'line-height',
        ])
          actual.style.setProperty(property, computed.getPropertyValue(property));
        const reference = actual.cloneNode(true) as HTMLSpanElement;
        // Independent source Text/M-Common, not values read from implementation tokens.
        Object.assign(reference.style, {
          fontFamily: 'Geist',
          fontSize: `${16 * scale}px`,
          fontWeight: '400',
          letterSpacing: `${-0.25 * scale}px`,
          lineHeight: `${24 * scale}px`,
        });
        const former = reference.cloneNode(true) as HTMLSpanElement;
        former.style.letterSpacing = `${-0.1328 * scale}px`;
        document.body.append(actual, reference, former);
        const result = {
          actual: actual.getBoundingClientRect().width,
          reference: reference.getBoundingClientRect().width,
          former: former.getBoundingClientRect().width,
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          lineHeight: computed.lineHeight,
          letterSpacing: computed.letterSpacing,
          family: computed.fontFamily,
        };
        actual.remove();
        reference.remove();
        former.remove();
        return result;
      }, scale);
      expect(result.fontSize).toBe(`${16 * scale}px`);
      expect(result.fontWeight).toBe('400');
      expect(result.lineHeight).toBe(`${24 * scale}px`);
      expect(result.letterSpacing).toBe(`${-0.25 * scale}px`);
      expect(result.family).toContain('Geist');
      expect(Math.abs(result.actual - result.reference)).toBeLessThan(0.05);
      expect(Math.abs(result.former - result.reference)).toBeGreaterThan(30 * scale);
      await testInfo.attach('whole-string-metrics', {
        body: JSON.stringify(result, null, 2),
        contentType: 'application/json',
      });
      await testInfo.attach('choicebox', {
        body: await rich.screenshot(),
        contentType: 'image/png',
      });
    });
  }

for (const renderer of ['lit', 'react']) {
  test(`${renderer}: choicebox label follows its complete resolved text profile`, async ({
    page,
  }) => {
    const label = page
      .getByTestId(`${renderer}-form`)
      .locator('[data-variant="card"] .lab-selection-label')
      .first();
    await expect(label).toBeVisible();
    const actual = await label.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing === 'normal' ? '0px' : style.letterSpacing,
      };
    });
    const expected = components.selection.choicebox;
    expect(actual).toEqual({
      fontSize: `${expected.fontSize}px`,
      lineHeight: `${expected.lineHeight}px`,
      fontWeight: `${expected.fontWeight}`,
      letterSpacing: `${expected.letterSpacing}px`,
    });
  });

  test(`${renderer}: native form values, mixed, required, reset and fieldset`, async ({ page }) => {
    const form = page.getByTestId(`${renderer}-form`);
    const check = form.getByRole('checkbox', { name: 'Условия', exact: true });
    await expect
      .poll(() => values(form))
      .toEqual([
        ['check', 'yes'],
        ['radio', 'a'],
        ['single', 'a'],
        ['multi', 'a'],
      ]);
    await expect(form.getByRole('checkbox', { name: 'Часть', exact: true })).toHaveJSProperty(
      'indeterminate',
      true,
    );
    await activate(check);
    expect(await form.evaluate((node) => (node as HTMLFormElement).checkValidity())).toBe(false);
    await activate(form.getByRole('radio', { name: 'Срочная', exact: true }));
    await activate(form.getByRole('radio', { name: 'Командный', exact: true }));
    await activate(form.getByRole('checkbox', { name: 'Архив', exact: true }));
    await expect
      .poll(() => values(form))
      .toEqual([
        ['radio', 'c'],
        ['single', 'b'],
        ['multi', 'a'],
        ['multi', 'b'],
      ]);
    await form.getByRole('button', { name: 'Сбросить' }).click();
    await expect
      .poll(() => values(form))
      .toEqual([
        ['check', 'yes'],
        ['radio', 'a'],
        ['single', 'a'],
        ['multi', 'a'],
      ]);
    await expect(form.getByRole('checkbox', { name: 'Часть', exact: true })).toHaveJSProperty(
      'indeterminate',
      true,
    );
    expect(await form.evaluate((node) => (node as HTMLFormElement).checkValidity())).toBe(true);
  });
  test(`${renderer}: cancelled reset and controlled rejection preserve values`, async ({
    page,
  }) => {
    const form = page.getByTestId(`${renderer}-form`);
    await activate(form.getByRole('checkbox', { name: 'Условия', exact: true }));
    await form.evaluate((node) =>
      node.addEventListener('reset', (event) => event.preventDefault(), { once: true }),
    );
    await form.getByRole('button', { name: 'Сбросить' }).click();
    await expect(form.getByRole('checkbox', { name: 'Условия', exact: true })).not.toBeChecked();
    const controlled = page.getByTestId(`${renderer}-controlled`).getByRole('checkbox');
    await activate(controlled);
    await expect(controlled).toBeChecked();
    const radio = page.getByTestId(`${renderer}-controlled-radio`);
    await activate(radio.getByRole('radio', { name: 'Второй' }));
    await expect(radio.getByRole('radio', { name: 'Первый' })).toBeChecked();
    await expect(radio.getByRole('radio', { name: 'Второй' })).not.toBeChecked();
  });
  test(`${renderer}: arrows Home End skip disabled and preserve one radio tab stop`, async ({
    page,
  }) => {
    const form = page.getByTestId(`${renderer}-form`);
    const first = form.getByRole('radio', { name: 'Обычная', exact: true });
    const last = form.getByRole('radio', { name: 'Срочная', exact: true });
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(last).toBeFocused();
    await expect(last).toBeChecked();
    await page.keyboard.press('Home');
    await expect(first).toBeFocused();
    await expect(first).toBeChecked();
    await page.keyboard.press('End');
    await expect(last).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(form.getByRole('radio', { name: 'Личный', exact: true })).toBeFocused();
  });
  test(`${renderer}: rich content, 200% text and RTL stay inside a narrow container`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 1200 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
      document.documentElement.dir = 'rtl';
    });
    const rich = page.getByTestId(`${renderer}-rich`);
    await expect(
      rich.getByRole('radio', { name: 'Совместная обработка изображений' }),
    ).toBeChecked();
    expect(await rich.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    const label = rich.locator('.lab-selection-label');
    expect((await label.boundingBox())?.width).toBeGreaterThan(200);
    const words = await rich
      .getByText('Совместная обработка изображений', { exact: true })
      .evaluate(
        (node, available) => {
          const text = node.firstChild;
          if (!text || text.nodeType !== Node.TEXT_NODE) throw new Error('Expected title text');
          const style = getComputedStyle(node);
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Expected text measurement context');
          context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          return Array.from((text.textContent ?? '').matchAll(/\S+/g), (word) => {
            const range = document.createRange();
            range.setStart(text, word.index);
            range.setEnd(text, word.index + word[0].length);
            return {
              fits: context.measureText(word[0]).width <= available + 1,
              fragments: range.getClientRects().length,
            };
          });
        },
        (await label.boundingBox())?.width ?? 0,
      );
    expect(words.filter((word) => word.fits).every((word) => word.fragments === 1)).toBe(true);
    expect(words.some((word) => word.fits)).toBe(true);
    const long = page.getByTestId(`${renderer}-long`);
    expect(await long.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    const action = rich.getByRole('radio');
    await action.focus();
    await expect(action).toBeFocused();
    await page.screenshot({
      path: test.info().outputPath(`${renderer}-rtl-200.png`),
      fullPage: true,
    });
  });
}

test('Lit single Choicebox submits only its visible first value and supports rich slots without text fallbacks', async ({
  page,
}) => {
  await page.evaluate(() => {
    const box = document.querySelector('lab-choicebox[name="single"]');
    if (!box) throw new Error('Missing choicebox');
    (box as HTMLElement & { value: string[] }).value = ['b', 'a'];
    box.insertAdjacentHTML(
      'beforeend',
      '<span slot="description-b">Подробности командного плана</span>',
    );
  });
  const form = page.getByTestId('lit-form');
  await expect(form.getByRole('radio', { name: 'Командный', exact: true })).toBeChecked();
  await expect
    .poll(async () => (await values(form)).filter(([name]) => name === 'single'))
    .toEqual([['single', 'b']]);
  await expect(form.getByText('Подробности командного плана')).toBeVisible();
});

test('authored sizes, glyph shapes and neutral contrast survive themes', async ({ page }) => {
  for (const [size, expected] of [
    ['tiny', 16],
    ['s', 12],
    ['m', 16],
    ['l', 20],
  ] as const) {
    const control = page.locator(
      `[data-specimen="checkbox-accent-${size}"] .lab-selection-control`,
    );
    expect((await control.boundingBox())?.width).toBe(expected);
  }
  const selected = page.locator('[data-specimen="radio-group-accent-s"] .lab-selection-control');
  expect(await selected.evaluate((node) => getComputedStyle(node).borderTopWidth)).toBe('3px');
  expect(await selected.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)',
  );
  for (const theme of ['light', 'dark']) {
    await page.evaluate(
      (theme) => document.documentElement.setAttribute('data-theme', theme),
      theme,
    );
    const check = page.locator('[data-specimen="checkbox-neutral-m"] .lab-selection-control');
    const colors = await check.evaluate((node) => ({
      fill: getComputedStyle(node).backgroundColor,
      mark: getComputedStyle(node.querySelector('.lab-selection-mark') as Element).backgroundColor,
    }));
    expect(colors.mark).not.toBe(colors.fill);
    await page
      .locator('#matrix')
      .screenshot({ path: test.info().outputPath(`selection-${theme}-100.png`) });
  }
});

test('SSR delivers checked controls and React hydration retains its server value', async ({
  page,
  request,
}) => {
  const output = await (await request.get('/_fixtures/selection.html')).text();
  expect(output).toContain('shadowrootmode="open"');
  expect(output).toContain('data-variant="card"');
  expect(output).toContain('aria-checked="mixed"');
  await expect(page.locator('#react-hydrate').getByRole('checkbox')).toBeChecked();
  await activate(page.locator('#react-hydrate').getByRole('checkbox'));
  await expect(page.locator('#react-hydrate').getByRole('checkbox')).not.toBeChecked();
});

test('Lit mixed overrides checked for native required validity and submission', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const box = document.querySelector('lab-checkbox[name="check"]') as HTMLElement & {
      checked: boolean;
      indeterminate: boolean;
      controlled: boolean;
      updateComplete: Promise<unknown>;
    };
    box.controlled = true;
    box.checked = true;
    box.indeterminate = true;
    await box.updateComplete;
  });
  const form = page.getByTestId('lit-form');
  const input = form.getByRole('checkbox', { name: 'Условия', exact: true });
  await expect(input).toHaveJSProperty('indeterminate', true);
  await expect(input).toHaveJSProperty('checked', false);
  expect(await form.evaluate((node) => (node as HTMLFormElement).checkValidity())).toBe(false);
  expect((await values(form)).some(([name]) => name === 'check')).toBe(false);
});

test('property-based SSR keeps Choicebox items, value and rich content after hydration', async ({
  page,
}) => {
  const form = page.getByTestId('adapter-ssr');
  await expect(form.getByRole('radio', { name: 'Выбор сервера' })).toBeChecked();
  expect(await values(form)).toEqual([['adapter', 'b']]);
  await activate(form.getByRole('radio', { name: 'Первый' }));
  expect(await values(form)).toEqual([['adapter', 'a']]);
  await form.getByRole('button', { name: 'Сбросить' }).click();
  await expect(form.getByRole('radio', { name: 'Выбор сервера' })).toBeChecked();
});

test('first paint exposes authored controls with JavaScript disabled', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/_fixtures/selection.html');
    const lit = page.getByTestId('lit-form');
    await expect(lit.getByRole('checkbox', { name: 'Условия', exact: true })).toBeChecked();
    await expect(lit.getByRole('radio', { name: 'Личный', exact: true })).toBeChecked();
    expect(
      (await lit.locator('lab-checkbox').first().locator('.lab-selection-control').boundingBox())
        ?.width,
    ).toBe(16);
    await expect(page.locator('#react-hydrate').getByRole('checkbox')).toBeChecked();
  } finally {
    await context.close();
  }
});
