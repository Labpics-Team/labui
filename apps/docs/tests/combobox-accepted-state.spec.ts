import { type Page, expect, test } from '@playwright/test';

type Renderer = 'lit' | 'react';
const items = [
  { value: 'a', label: 'Архитектура' },
  { value: 'b', label: 'Брендинг' },
  { value: 'd', label: 'Разработка' },
];

async function update(
  page: Page,
  renderer: Renderer,
  props: { value?: string[]; multiple?: boolean; items?: typeof items },
) {
  await page.evaluate(
    ({ renderer, props }) => {
      if (renderer === 'lit') Object.assign(window.inputExtensions.combo, props);
      else window.inputExtensions.updateReact({ combobox: props });
    },
    { renderer, props },
  );
  await settle(page);
}

async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

for (const renderer of ['lit', 'react'] as const) {
  test.describe(renderer, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/_fixtures/input-extensions.html');
      await expect(
        page.locator(renderer === 'lit' ? '#lit' : '#react-form').getByRole('combobox'),
      ).toBeVisible();
    });

    test(`${renderer}: rejected selection displays the accepted value and can be accepted later`, async ({
      page,
    }) => {
      const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
      const input = form.getByRole('combobox');
      await update(page, renderer, { value: ['a'] });
      await input.fill('Брен');
      await input.press('ArrowDown');
      await input.press('Enter');
      await settle(page);
      await expect(input).toHaveValue('Архитектура');
      expect(
        await form.evaluate((form) => new FormData(form as HTMLFormElement).getAll('specialty')),
      ).toEqual(['a']);
      await update(page, renderer, { value: ['b'] });
      await expect(input).toHaveValue('Брендинг');
      expect(
        await form.evaluate((form) => new FormData(form as HTMLFormElement).getAll('specialty')),
      ).toEqual(['b']);
    });

    test(`${renderer}: late acceptance preserves newer typing and blur restores its accepted label`, async ({
      page,
    }) => {
      const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
      const input = form.getByRole('combobox');
      await update(page, renderer, { value: ['a'] });
      await input.fill('Брен');
      await input.press('ArrowDown');
      await input.press('Enter');
      await input.fill('Раз');
      await settle(page);
      await update(page, renderer, { value: ['b'] });
      await expect(input).toHaveValue('Раз');
      await expect(form.getByRole('option').locator('.lab-select-item-text')).toHaveText([
        'Разработка',
      ]);
      expect(
        await form.evaluate((form) => new FormData(form as HTMLFormElement).getAll('specialty')),
      ).toEqual(['b']);
      await input.press('Tab');
      await settle(page);
      await expect(input).toHaveValue('Брендинг');
      await expect(input).toHaveAttribute('aria-expanded', 'false');
      await expect(input).not.toBeFocused();
      await input.fill('');
      await update(page, renderer, { value: ['d'] });
      await expect(input).toHaveValue('');
      await input.press('Tab');
      await expect(input).toHaveValue('Разработка');
    });

    test(`${renderer}: source replacement updates accepted labels without consuming the live query`, async ({
      page,
    }) => {
      const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
      const input = form.getByRole('combobox');
      await update(page, renderer, { value: ['b'], items });
      await input.fill('Раз');
      const replacement = [
        { value: 'b', label: 'Идентичность' },
        { value: 'd', label: 'Разработка' },
      ];
      await update(page, renderer, { value: ['b'], items: replacement });
      await expect(input).toHaveValue('Раз');
      await expect(form.getByRole('option').locator('.lab-select-item-text')).toHaveText([
        'Разработка',
      ]);
      await input.press('Escape');
      await input.press('Tab');
      await settle(page);
      await expect(input).toHaveValue('Идентичность');
      await update(page, renderer, { value: ['b'], items: [] });
      await expect(input).toHaveValue('b');
      await update(page, renderer, { value: ['b'], items });
      await expect(input).toHaveValue('Брендинг');
    });

    test(`${renderer}: mode changes reconcile the editor and accepted chips`, async ({ page }) => {
      const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
      const input = form.getByRole('combobox');
      await update(page, renderer, { value: ['a'] });
      await input.fill('Раз');
      await update(page, renderer, { multiple: true, value: ['a', 'b'] });
      await expect(input).toHaveValue('');
      const chips = form.locator('[data-lab-combobox] .lab-chip-label');
      await expect(chips).toHaveText(['Архитектура', 'Брендинг']);
      await input.fill('Раз');
      await update(page, renderer, { multiple: false, value: ['b'] });
      await expect(chips).toHaveCount(0);
      await expect(input).toHaveValue('Брендинг');
    });

    test(`${renderer}: synchronous acceptance displays the accepted selection`, async ({
      page,
    }) => {
      const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
      const input = form.getByRole('combobox');
      await page.evaluate((renderer) => {
        if (renderer === 'lit') {
          const combo = window.inputExtensions.combo;
          combo.value = ['a'];
          combo.addEventListener('value-change', (event) => {
            combo.value = (event as CustomEvent<{ value: string[] }>).detail.value;
          });
        } else {
          const accept = (value: string[]) =>
            window.inputExtensions.updateReact({ combobox: { value, onValueChange: accept } });
          accept(['a']);
        }
      }, renderer);
      await input.fill('Брен');
      await form.getByRole('option', { name: 'Брендинг' }).click();
      await settle(page);
      await expect(input).toHaveValue('Брендинг');
      expect(
        await form.evaluate((form) => new FormData(form as HTMLFormElement).getAll('specialty')),
      ).toEqual(['b']);
    });

    test(`${renderer}: uncontrolled reset discards the query even when the accepted value is unchanged`, async ({
      page,
    }) => {
      const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
      const input = form.getByRole('combobox');
      await input.fill('Раз');
      await form.evaluate((form) => (form as HTMLFormElement).reset());
      await settle(page);
      await expect(input).toHaveValue('Архитектура');
      expect(
        await form.evaluate((form) => new FormData(form as HTMLFormElement).getAll('specialty')),
      ).toEqual(['a']);
    });

    test(`${renderer}: multiple delayed acceptance updates chips without consuming newer typing`, async ({
      page,
    }) => {
      const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
      const input = form.getByRole('combobox');
      const chips = form.locator('[data-lab-combobox] .lab-chip-label');
      await update(page, renderer, { multiple: true, value: ['a'] });
      await input.fill('Брен');
      await input.press('ArrowDown');
      await input.press('Enter');
      await settle(page);
      await expect(input).toHaveValue('');
      await expect(chips).toHaveText(['Архитектура']);
      await input.fill('Раз');
      await update(page, renderer, { multiple: true, value: ['a', 'b'] });
      await expect(input).toHaveValue('Раз');
      await expect(chips).toHaveText(['Архитектура', 'Брендинг']);
      await input.press('Tab');
      await settle(page);
      await expect(input).toHaveValue('');
      expect(
        await form.evaluate((form) => new FormData(form as HTMLFormElement).getAll('specialty')),
      ).toEqual(['a', 'b']);
    });

    test(`${renderer}: cancelled reset preserves the query and controlled reset restores accepted text`, async ({
      page,
    }) => {
      const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
      const input = form.getByRole('combobox');
      await update(page, renderer, { value: ['b'] });
      await input.fill('Раз');
      await form.evaluate((form) => {
        form.addEventListener('reset', (event) => event.preventDefault(), { once: true });
        (form as HTMLFormElement).reset();
      });
      await settle(page);
      await expect(input).toHaveValue('Раз');
      await form.evaluate((form) => (form as HTMLFormElement).reset());
      await settle(page);
      await expect(input).toHaveValue('Брендинг');
      expect(
        await form.evaluate((form) => new FormData(form as HTMLFormElement).getAll('specialty')),
      ).toEqual(['b']);
    });
  });
}
