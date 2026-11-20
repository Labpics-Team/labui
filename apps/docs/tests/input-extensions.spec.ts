import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/input-extensions.html');
  await expect(page.locator('#react-form input[role="combobox"]')).toBeVisible();
});
for (const renderer of ['lit', 'react'] as const) {
  const form = renderer === 'lit' ? '#lit' : '#react-form';
  const combo = `${form} [role="combobox"]`;
  const number = `${form} [role="spinbutton"]`;
  const tags =
    renderer === 'lit' ? `${form} lab-tags-input .input` : `${form} .lab-tags-input-input`;
  test(`${renderer}: submitted values, reset, cancellation and disabled fieldset`, async ({
    page,
  }) => {
    await expect(page.locator(combo)).toHaveValue('Архитектура');
    await expect
      .poll(() => page.locator(form).evaluate((el) => [...new FormData(el as HTMLFormElement)]))
      .toEqual([
        ['specialty', 'a'],
        ['quantity', '2'],
        ['tags', 'Дизайн'],
        ['tags', 'Системы'],
      ]);
    await page.locator(number).fill('4');
    await page.locator(number).press('Tab');
    await page.locator(tags).fill('Анимация');
    await page.locator(tags).press('Enter');
    await expect
      .poll(() =>
        page.locator(form).evaluate((el) => new FormData(el as HTMLFormElement).getAll('tags')),
      )
      .toEqual(['Дизайн', 'Системы', 'Анимация']);
    await page.evaluate(() =>
      document.addEventListener('reset', (e) => e.preventDefault(), { once: true }),
    );
    await page.locator(form).getByRole('button', { name: 'Сбросить' }).click();
    await expect(page.locator(number)).toHaveValue('4');
    await page.locator(form).getByRole('button', { name: 'Сбросить' }).click();
    await expect(page.locator(number)).toHaveValue('2');
    await expect
      .poll(() =>
        page.locator(form).evaluate((el) => new FormData(el as HTMLFormElement).getAll('tags')),
      )
      .toEqual(['Дизайн', 'Системы']);
    await page.locator(form).evaluate((el) => {
      const f = document.createElement('fieldset');
      el.before(f);
      f.append(el);
      f.disabled = true;
    });
    await expect(page.locator(number)).toBeDisabled();
    await expect(page.locator(combo)).toBeDisabled();
    await expect(page.locator(tags)).toBeDisabled();
    await expect
      .poll(() => page.locator(form).evaluate((el) => [...new FormData(el as HTMLFormElement)]))
      .toEqual([]);
  });
  test(`${renderer}: filter, keyboard, disabled rows and selection`, async ({ page }) => {
    const input = page.locator(combo);
    await input.click();
    await input.fill('Раз');
    await expect(page.getByRole('option')).toHaveCount(1);
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(input).toHaveValue('Разработка');
    await expect
      .poll(() =>
        page
          .locator(form)
          .evaluate((el) => new FormData(el as HTMLFormElement).getAll('specialty')),
      )
      .toEqual(['d']);
    await input.click();
    await expect(page.getByRole('option')).toHaveCount(4);
    await input.press('Escape');
    await expect(input).toBeFocused();
  });
  test(`${renderer}: opening preserves the editor selection`, async ({ page }) => {
    const input = page.locator(combo);
    await input.evaluate((el) => {
      const editor = el as HTMLInputElement;
      editor.focus();
      editor.click();
      editor.select();
    });
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(
      await input.evaluate((el) => {
        const editor = el as HTMLInputElement;
        return [editor.selectionStart, editor.selectionEnd];
      }),
    ).toEqual([0, 'Архитектура'.length]);
  });
  test(`${renderer}: IME Enter does not select or add; ordinary Enter resumes`, async ({
    page,
  }) => {
    const input = page.locator(tags);
    await input.fill('日本語');
    await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
    await expect
      .poll(() =>
        page.locator(form).evaluate((el) => new FormData(el as HTMLFormElement).getAll('tags')),
      )
      .toEqual(['Дизайн', 'Системы']);
    await input.press('Enter');
    await expect
      .poll(() =>
        page.locator(form).evaluate((el) => new FormData(el as HTMLFormElement).getAll('tags')),
      )
      .toEqual(['Дизайн', 'Системы', '日本語']);
    const search = page.locator(combo);
    await search.fill('Брен');
    await search.press('ArrowDown');
    await search.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
    await expect(search).toHaveAttribute('aria-expanded', 'true');
    await search.press('Enter');
    await expect(search).toHaveValue('Брендинг');
  });
  test(`${renderer}: combobox escapes transformed clipping and stays in viewport at 200%`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    await page.locator(combo).evaluate((input) => {
      let host: HTMLElement = input as HTMLElement;
      if (input.getRootNode() instanceof ShadowRoot)
        host = (input.getRootNode() as ShadowRoot).host as HTMLElement;
      else host = input.closest('[data-lab-combobox]') as HTMLElement;
      const clip = document.createElement('div');
      clip.style.cssText = 'transform:translateZ(0);overflow:hidden;height:80px';
      host.before(clip);
      clip.append(host);
    });
    await page.locator(combo).click();
    const list = page.getByRole('listbox');
    await expect(list).toBeVisible();
    await expect
      .poll(async () => {
        const b = await list.boundingBox();
        return !!b && b.x >= 16 && b.x + b.width <= 374 && b.y + b.height <= 828;
      })
      .toBe(true);
  });
}
test('Lit controlled properties reject mutations; accepted changes and disconnected cleanup remain coherent', async ({
  page,
}) => {
  await page.evaluate(() => {
    const w = window;
    w.inputExtensions.number.value = '5';
    w.inputExtensions.tags.value = ['Fixed'];
    w.inputExtensions.combo.value = ['b'];
  });
  const n = page.locator('#lit [role="spinbutton"]');
  await expect(n).toHaveValue('5');
  await n.press('ArrowUp');
  await expect(n).toHaveValue('5');
  const tags = page.locator('#lit lab-tags-input');
  await tags.locator('.input').fill('Reject');
  await tags.locator('.input').press('Enter');
  await expect(tags.locator('.item-text')).toHaveText(['Fixed']);
  const result = await page.evaluate(async () => {
    const h = window.inputExtensions.tags;
    for (let i = 0; i < 1000; i++) {
      h.helper = String(i);
      await h.updateComplete;
    }
    const resources = (h as unknown as { machineCtl: { spreadCleanups: Map<Element, () => void> } })
      .machineCtl.spreadCleanups;
    const retained = resources.size;
    const live = h.shadowRoot?.querySelectorAll('*').length ?? 0;
    h.remove();
    return { retained, live, after: resources.size };
  });
  expect(result.retained).toBeLessThanOrEqual(result.live);
  expect(result.after).toBe(0);
});

test('Number Input preserves composition until completion in both renderers', async ({ page }) => {
  for (const form of ['#lit', '#react-form']) {
    const input = page.locator(`${form} [role="spinbutton"]`);
    await input.focus();
    const allowed = await input.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, composed: true }));
      return el.dispatchEvent(
        new InputEvent('beforeinput', {
          data: '１２',
          inputType: 'insertCompositionText',
          isComposing: true,
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
    });
    expect(allowed).toBe(true);
    await input.evaluate((el) => {
      (el as HTMLInputElement).value = '１２';
      el.dispatchEvent(
        new InputEvent('input', {
          data: '１２',
          inputType: 'insertCompositionText',
          isComposing: true,
          bubbles: true,
          composed: true,
        }),
      );
    });
    await expect(input).toHaveValue('１２');
    await input.evaluate((el) => {
      (el as HTMLInputElement).value = '3.5';
      el.dispatchEvent(
        new CompositionEvent('compositionend', { data: '3.5', bubbles: true, composed: true }),
      );
    });
    await expect(input).toHaveValue('3.5');
    await input.press('ArrowUp');
    await expect(input).toHaveValue('3.6');
  }
});
test('Escape after another combobox closes is immediate and composition-safe', async ({ page }) => {
  for (const form of ['#lit', '#react-form']) {
    const input = page.locator(`${form} [role="combobox"]`);
    await input.click();
    await input.dispatchEvent('keydown', { key: 'Escape', isComposing: true });
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await input.press('Escape');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
  }
});

test('controlled React fields request changes and preserve the accepted values', async ({
  page,
}) => {
  await page.evaluate(() => {
    const w = window;
    w.inputExtensionRequests = [];
    w.inputExtensions.updateReact({
      combobox: {
        value: ['b'],
        onValueChange: (value: string[]) => w.inputExtensionRequests.push(value),
      },
      number: {
        value: '5',
        onValueChange: (value: string) => w.inputExtensionRequests.push(value),
      },
      tags: {
        value: ['Fixed'],
        onValueChange: (value: string[]) => w.inputExtensionRequests.push(value),
      },
    });
  });
  const form = page.locator('#react-form');
  const number = form.getByRole('spinbutton');
  await expect(number).toHaveValue('5');
  await number.press('ArrowUp');
  await expect(number).toHaveValue('5');
  const tags = form.locator('.lab-tags-input-input');
  await tags.fill('Reject');
  await tags.press('Enter');
  const combo = form.getByRole('combobox');
  await combo.click();
  await form.getByRole('option', { name: 'Разработка' }).click();
  await expect
    .poll(() => form.evaluate((el) => [...new FormData(el as HTMLFormElement)]))
    .toEqual([
      ['specialty', 'b'],
      ['quantity', '5'],
      ['tags', 'Fixed'],
    ]);
  expect(await page.evaluate(() => window.inputExtensionRequests)).toEqual([
    '5.1',
    ['Fixed', 'Reject'],
    ['d'],
  ]);
});

test('selection cannot steal focus back from the next field', async ({ page }) => {
  for (const form of ['#lit', '#react-form']) {
    const combo = page.locator(`${form} [role="combobox"]`);
    await combo.fill('Брен');
    await combo.press('ArrowDown');
    await combo.evaluate((input, form) => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
      );
      const root = document.querySelector(form);
      const number =
        form === '#lit'
          ? root
              ?.querySelector('lab-number-input')
              ?.shadowRoot?.querySelector<HTMLInputElement>('input')
          : root?.querySelector<HTMLInputElement>('[role="spinbutton"]');
      number?.focus();
    }, form);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await expect(page.locator(`${form} [role="spinbutton"]`)).toBeFocused();
  }
});

test('replacing a filtered collection keeps option identities and excludes disabled rows', async ({
  page,
}) => {
  for (const renderer of ['lit', 'react']) {
    const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    const combo = form.getByRole('combobox');
    await combo.fill('Новая');
    await page.evaluate((renderer) => {
      const fixture = window.inputExtensions;
      const items = [
        { value: 'a', label: 'Архитектура' },
        { value: 'x', label: 'Новая недоступная', disabled: true },
        { value: 'y', label: 'Новая профессия' },
      ];
      if (renderer === 'lit') fixture.combo.items = items;
      else fixture.updateReact({ combobox: { items } });
    }, renderer);
    await expect(form.getByRole('option')).toHaveCount(2);
    await combo.press('ArrowDown');
    await combo.press('Enter');
    await expect(combo).toHaveValue('Новая профессия');
    await expect
      .poll(() => form.evaluate((el) => new FormData(el as HTMLFormElement).getAll('specialty')))
      .toEqual(['y']);
  }
});
