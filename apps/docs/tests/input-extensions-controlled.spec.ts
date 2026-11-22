import { expect, test } from '@playwright/test';

for (const renderer of ['lit', 'react']) {
  test(`${renderer}: pending tag focus respects a later transfer to another control`, async ({
    page,
  }) => {
    await page.goto('/_fixtures/input-extensions.html');
    const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    const number = form.getByRole('spinbutton');
    const main = form.locator('[data-lab-tags-input] [data-part="input"]');
    await main.evaluate((input, renderer) => {
      const number =
        renderer === 'lit'
          ? window.inputExtensions.number.shadowRoot?.querySelector<HTMLInputElement>(
              '[role="spinbutton"]',
            )
          : document.querySelector<HTMLInputElement>('#react-form [role="spinbutton"]');
      if (!number) throw new Error('Missing Number editor');
      (input as HTMLInputElement).focus();
      number.focus();
    }, renderer);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await expect(number).toBeFocused();
    await form.locator('[data-lab-tags-input] [data-part="item-text"]').first().dblclick();
    const editor = form.locator('[data-part="item-input"]').first();
    await editor.focus();
    await editor.evaluate((input, renderer) => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
      );
      const number =
        renderer === 'lit'
          ? window.inputExtensions.number.shadowRoot?.querySelector<HTMLInputElement>(
              '[role="spinbutton"]',
            )
          : document.querySelector<HTMLInputElement>('#react-form [role="spinbutton"]');
      if (!number) throw new Error('Missing Number editor');
      number.focus();
    }, renderer);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await expect(number).toBeFocused();
    await expect(editor).toBeHidden();
  });

  test(`${renderer}: a blurred rename survives newer input and delayed acceptance`, async ({
    page,
  }) => {
    await page.goto('/_fixtures/input-extensions.html');
    const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    await expect(form.locator('[data-lab-tags-input]')).toBeVisible();
    await page.evaluate((renderer) => {
      window.inputExtensionRequests = [];
      if (renderer === 'lit') {
        window.inputExtensions.tags.value = ['accepted'];
        window.inputExtensions.tags.addEventListener('value-change', (event) => {
          window.inputExtensionRequests.push((event as CustomEvent).detail.value);
        });
      } else
        window.inputExtensions.updateReact({
          tags: {
            value: ['accepted'],
            onValueChange: (value) => window.inputExtensionRequests.push(value),
          },
        });
    }, renderer);
    await form.locator('[data-lab-tags-input] [data-part="item-text"]').first().dblclick();
    const editor = form.locator('[data-part="item-input"]').first();
    await editor.fill('renamed');
    await editor.press('Enter');
    const number = form.getByRole('spinbutton');
    await number.click();
    await expect(editor).toBeVisible();
    await expect(editor).toHaveValue('renamed');
    await editor.fill('newer');
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.inputExtensions.tags.value = ['renamed'];
      else
        window.inputExtensions.updateReact({
          tags: {
            value: ['renamed'],
            onValueChange: (value) => window.inputExtensionRequests.push(value),
          },
        });
    }, renderer);
    await expect(editor).toBeVisible();
    await expect(editor).toHaveValue('newer');
    await expect(editor).toBeFocused();
    await editor.press('Enter');
    expect(await page.evaluate(() => window.inputExtensionRequests.at(-1))).toEqual(['newer']);
    await number.click();
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.inputExtensions.tags.value = ['newer'];
      else window.inputExtensions.updateReact({ tags: { value: ['newer'] } });
    }, renderer);
    await expect(editor).toBeHidden();
    await expect(number).toBeFocused();
    expect(await form.evaluate((el) => new FormData(el as HTMLFormElement).getAll('tags'))).toEqual(
      ['newer'],
    );
  });

  test(`${renderer}: a suspended rename leaves the add editor usable`, async ({ page }) => {
    await page.goto('/_fixtures/input-extensions.html');
    const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    await expect(form.locator('[data-lab-tags-input]')).toBeVisible();
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.inputExtensions.tags.value = ['accepted'];
      else window.inputExtensions.updateReact({ tags: { value: ['accepted'] } });
    }, renderer);
    await form.locator('[data-lab-tags-input] [data-part="item-text"]').first().dblclick();
    const editor = form.locator('[data-part="item-input"]').first();
    await editor.fill('renamed');
    await editor.press('Enter');
    const input = form.locator('[data-lab-tags-input] [data-part="input"]');
    await input.fill('addition');
    await input.press('Enter');
    await expect(input).toHaveValue('addition');
    await expect(editor).toHaveValue('renamed');
    await editor.focus();
    await editor.press('Escape');
    await expect(editor).toBeHidden();
    await expect(input).toHaveValue('addition');
    await expect(input).toBeFocused();
  });

  test(`${renderer}: external replacement cannot redirect a rename to another tag`, async ({
    page,
  }) => {
    await page.goto('/_fixtures/input-extensions.html');
    const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    await expect(form.locator('[data-lab-tags-input]')).toBeVisible();
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.inputExtensions.tags.value = ['accepted', 'other'];
      else window.inputExtensions.updateReact({ tags: { value: ['accepted', 'other'] } });
    }, renderer);
    await form.locator('[data-lab-tags-input] [data-part="item-text"]').first().dblclick();
    const editor = form.locator('[data-part="item-input"]').first();
    await editor.fill('renamed');
    await editor.press('Enter');
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.inputExtensions.tags.value = ['other', 'accepted'];
      else window.inputExtensions.updateReact({ tags: { value: ['other', 'accepted'] } });
    }, renderer);
    await expect(editor).toBeHidden();
    await expect(form.locator('[data-lab-tags-input] [data-part="item-text"]')).toHaveText([
      'other',
      'accepted',
    ]);
    expect(await form.evaluate((el) => new FormData(el as HTMLFormElement).getAll('tags'))).toEqual(
      ['other', 'accepted'],
    );
  });

  test(`${renderer}: rejected tag rename remains editable until accepted`, async ({ page }) => {
    await page.goto('/_fixtures/input-extensions.html');
    const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    await expect(form.locator('[data-lab-tags-input]')).toBeVisible();
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.inputExtensions.tags.value = ['accepted'];
      else window.inputExtensions.updateReact({ tags: { value: ['accepted'] } });
    }, renderer);
    const tag = form.locator('[data-lab-tags-input] [data-part="item-text"]').first();
    await expect(tag).toHaveText('accepted');
    await tag.dblclick();
    const editor = form.locator('[data-lab-tags-input] [data-part="item-input"]').first();
    await editor.fill('renamed');
    await editor.press('Enter');
    await expect(editor).toBeVisible();
    await expect(editor).toHaveValue('renamed');
    expect(await form.evaluate((el) => new FormData(el as HTMLFormElement).getAll('tags'))).toEqual(
      ['accepted'],
    );
    const mainInput = form.locator('[data-lab-tags-input] [data-part="input"]');
    await mainInput.focus();
    await mainInput.press('ArrowLeft');
    await mainInput.press('Enter');
    await expect(editor).toBeFocused();
    await expect(editor).toHaveValue('renamed');
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.inputExtensions.tags.value = ['renamed'];
      else window.inputExtensions.updateReact({ tags: { value: ['renamed'] } });
    }, renderer);
    await expect(editor).toBeHidden();
    await expect(tag).toHaveText('renamed');
    await tag.dblclick();
    await editor.fill('cancelled');
    await editor.press('Escape');
    await expect(editor).toBeHidden();
    await expect(tag).toHaveText('renamed');
  });

  test(`${renderer}: rejected paste stays editable and acceptance consumes the pasted draft`, async ({
    page,
  }) => {
    await page.goto('/_fixtures/input-extensions.html');
    const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    const input = form.locator(
      renderer === 'lit' ? 'lab-tags-input .input' : '.lab-tags-input-input',
    );
    await expect(input).toBeVisible();
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.inputExtensions.tags.value = ['accepted'];
      else window.inputExtensions.updateReact({ tags: { value: ['accepted'] } });
    }, renderer);
    await input.focus();
    await input.evaluate((input) => {
      // Deliver the browser's completed paste edit without changing the user's
      // system clipboard. A synthetic paste event has no native default edit.
      (input as HTMLInputElement).value = 'first,second';
      input.dispatchEvent(
        new InputEvent('input', {
          inputType: 'insertFromPaste',
          data: 'first,second',
          bubbles: true,
          composed: true,
        }),
      );
    });
    await expect(input).toHaveValue('first,second');
    expect(await form.evaluate((el) => new FormData(el as HTMLFormElement).getAll('tags'))).toEqual(
      ['accepted'],
    );
    await page.evaluate((renderer) => {
      const value = ['accepted', 'first', 'second'];
      if (renderer === 'lit') window.inputExtensions.tags.value = value;
      else window.inputExtensions.updateReact({ tags: { value } });
    }, renderer);
    await expect(input).toHaveValue('');
  });

  test(`${renderer}: rejected and delayed tag requests keep the right draft`, async ({ page }) => {
    await page.goto('/_fixtures/input-extensions.html');
    const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    const input = form.locator(
      renderer === 'lit' ? 'lab-tags-input .input' : '.lab-tags-input-input',
    );
    await expect(input).toBeVisible();
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.inputExtensions.tags.value = ['accepted'];
      else window.inputExtensions.updateReact({ tags: { value: ['accepted'] } });
    }, renderer);
    await input.fill('unsaved');
    await input.press('Enter');
    await expect(input).toHaveValue('unsaved');
    expect(await form.evaluate((el) => new FormData(el as HTMLFormElement).getAll('tags'))).toEqual(
      ['accepted'],
    );
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.inputExtensions.tags.value = ['accepted', 'unsaved'];
      else window.inputExtensions.updateReact({ tags: { value: ['accepted', 'unsaved'] } });
    }, renderer);
    await expect(input).toHaveValue('');
    await input.fill('earlier');
    await input.press('Enter');
    await input.fill('newer');
    await page.evaluate((renderer) => {
      const value = ['accepted', 'unsaved', 'earlier'];
      if (renderer === 'lit') window.inputExtensions.tags.value = value;
      else window.inputExtensions.updateReact({ tags: { value } });
    }, renderer);
    await expect(input).toHaveValue('newer');
  });

  test(`${renderer}: combobox shows accepted single and multiple selections`, async ({ page }) => {
    await page.goto('/_fixtures/input-extensions.html');
    const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    const input = form.getByRole('combobox');
    await expect(input).toBeVisible();
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.inputExtensions.combo.value = ['a'];
      else window.inputExtensions.updateReact({ combobox: { value: ['a'] } });
    }, renderer);
    await input.fill('Брен');
    await input.press('ArrowDown');
    await input.press('Enter');
    await input.press('Tab');
    await expect(input).toHaveValue('Архитектура');
    expect(
      await form.evaluate((el) => new FormData(el as HTMLFormElement).getAll('specialty')),
    ).toEqual(['a']);
    await page.evaluate((renderer) => {
      if (renderer === 'lit') {
        window.inputExtensions.combo.multiple = true;
        window.inputExtensions.combo.value = ['a', 'd'];
      } else
        window.inputExtensions.updateReact({ combobox: { multiple: true, value: ['a', 'd'] } });
    }, renderer);
    await expect(input).toHaveValue('');
    const chips = form.locator('[data-lab-combobox] [data-lab-chip] .lab-chip-label');
    await expect(chips).toHaveText(['Архитектура', 'Разработка']);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    const chip = form.locator('[data-lab-combobox] [data-lab-chip]').first();
    const labelBounds = await chip.locator('.lab-chip-label').boundingBox();
    const removeBounds = await chip.getByRole('button').boundingBox();
    expect(labelBounds && removeBounds && removeBounds.x >= labelBounds.x + labelBounds.width).toBe(
      true,
    );
    await form.getByRole('button', { name: 'Удалить Архитектура', exact: true }).click();
    await expect(chips).toHaveText(['Архитектура', 'Разработка']);
    await expect(input).toBeFocused();
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.inputExtensions.combo.value = ['d'];
      else window.inputExtensions.updateReact({ combobox: { multiple: true, value: ['d'] } });
    }, renderer);
    await expect(chips).toHaveText(['Разработка']);
    expect(
      await form.evaluate((el) => new FormData(el as HTMLFormElement).getAll('specialty')),
    ).toEqual(['d']);
  });
}
