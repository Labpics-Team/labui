import type { LabSelect } from '@labpics/ui-core/select';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/select.html');
});

test('FACE submits accepted chips, preserves an empty key, validates, resets and follows fieldset', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await customElements.whenDefined('lab-select');
    const form = document.createElement('form');
    form.id = 'face-select';
    const fieldset = document.createElement('fieldset');
    const select = document.createElement('lab-select');
    select.name = 'team';
    select.label = 'Team';
    select.multiple = true;
    select.required = true;
    select.items = [
      { value: '', label: 'Empty key' },
      { value: 'b', label: 'B' },
      { value: 'c', label: 'C' },
    ];
    select.defaultValue = ['', 'b'];
    fieldset.append(select);
    form.append(fieldset);
    document.body.append(form);
    await select.updateComplete;
  });
  const host = page.locator('#face-select lab-select');
  const data = () =>
    page
      .locator('#face-select')
      .evaluate((form) => [...new FormData(form as HTMLFormElement).entries()]);
  await expect.poll(data).toEqual([
    ['team', ''],
    ['team', 'b'],
  ]);
  await expect(host.getByRole('button', { name: 'Remove Empty key' })).toBeVisible();
  await host.getByRole('button', { name: 'Remove Empty key' }).click();
  await expect.poll(data).toEqual([['team', 'b']]);
  await expect(host.getByRole('combobox')).toBeFocused();
  await host.getByRole('button', { name: 'Remove B', exact: true }).click();
  await expect.poll(() => host.evaluate((node) => (node as LabSelect).checkValidity())).toBe(false);
  await page.locator('#face-select').evaluate((form) => (form as HTMLFormElement).reset());
  await expect.poll(data).toEqual([
    ['team', ''],
    ['team', 'b'],
  ]);
  await page
    .locator('#face-select fieldset')
    .first()
    .evaluate((field) => {
      (field as HTMLFieldSetElement).disabled = true;
    });
  await expect(host.getByRole('combobox')).toBeDisabled();
  await expect.poll(data).toEqual([]);
  await page
    .locator('#face-select fieldset')
    .first()
    .evaluate((field) => {
      (field as HTMLFieldSetElement).disabled = false;
    });
  await expect.poll(data).toEqual([
    ['team', ''],
    ['team', 'b'],
  ]);
  await host.evaluate((node) => {
    const select = node as LabSelect;
    select.value = ['', 'b'];
    select.showLabel = false;
  });
  await host.getByRole('button', { name: 'Remove Empty key' }).click();
  await expect.poll(data).toEqual([
    ['team', ''],
    ['team', 'b'],
  ]);
  await expect(host.getByRole('combobox')).toHaveAccessibleName(/Team/);
  await expect(host.locator('.lab-chip-label')).toHaveText(['Empty key', 'B']);
  await host.evaluate((node) => {
    (node as LabSelect).value = ['b'];
  });
  await expect.poll(data).toEqual([['team', 'b']]);
  await page.locator('#face-select').evaluate((form) => (form as HTMLFormElement).reset());
  await expect.poll(data).toEqual([['team', 'b']]);
  await host.evaluate((node) => {
    (node as LabSelect).items = [];
  });
  await expect.poll(data).toEqual([]);
  await expect
    .poll(() => host.evaluate((node) => [...(node as LabSelect).selectedValues]))
    .toEqual(['b']);
  await expect(host.getByRole('button', { name: 'Remove b', exact: true })).toBeVisible();
});

test('React chips request removal, delay acceptance and preserve native form reset/disabled', async ({
  page,
}) => {
  const form = page.getByTestId('react-select-form');
  const team = form.locator('[data-lab-select]').first();
  const initial = form.locator('[data-lab-select]').nth(1);
  const data = () => form.evaluate((form) => [...new FormData(form as HTMLFormElement).entries()]);
  await expect.poll(data).toEqual([
    ['team', ''],
    ['team', 'banana'],
    ['initial', 'banana'],
  ]);
  await team.getByRole('button', { name: 'Remove Empty key' }).click();
  await expect(page.getByTestId('select-request')).toHaveText('["banana"]');
  await expect(team.locator('.lab-chip-label')).toHaveText(['Empty key', 'Banana']);
  await expect(team.getByRole('combobox')).toBeFocused();
  await form.getByRole('button', { name: 'Apply request' }).click();
  await expect(team.locator('.lab-chip-label')).toHaveText(['Banana']);
  await initial.getByRole('button', { name: 'Remove Banana' }).click();
  await expect.poll(data).toEqual([['team', 'banana']]);
  await form.getByRole('button', { name: 'Reset' }).click();
  await expect.poll(data).toEqual([
    ['team', 'banana'],
    ['initial', 'banana'],
  ]);
  await form
    .locator('fieldset')
    .first()
    .evaluate((field) => {
      (field as HTMLFieldSetElement).disabled = true;
    });
  await expect(team.getByRole('combobox')).toBeDisabled();
  await expect.poll(data).toEqual([]);
});

test('authored dimensions, independent chip actions and RTL keyboard survive both themes and text scales', async ({
  page,
}) => {
  for (const theme of ['light', 'dark'])
    for (const scale of [1, 1.25, 2]) {
      await page.evaluate(
        ({ theme, scale }) => {
          document.documentElement.dataset.theme = theme;
          document.documentElement.style.fontSize = `${scale * 16}px`;
        },
        { theme, scale },
      );
      const host = page.getByTestId('lit-select');
      for (const [size, height] of [
        ['s', 32],
        ['m', 48],
        ['l', 56],
      ] as const) {
        await host.evaluate((node, size) => {
          (node as LabSelect).size = size;
        }, size);
        await expect
          .poll(() =>
            host.getByRole('combobox').evaluate((node) => node.getBoundingClientRect().height),
          )
          .toBe(height * scale);
      }
      const multi = page.getByTestId('react-select-form').locator('[data-lab-select]').first();
      await expect(multi.locator('button button')).toHaveCount(0);
      await expect(multi.getByRole('button', { name: 'Remove Empty key' })).toBeVisible();
      await host.evaluate((node) => {
        node.setAttribute('dir', 'rtl');
        (node as LabSelect).requestUpdate();
      });
      await host.getByRole('combobox').focus();
      await page.keyboard.press('ArrowDown');
      await expect(host.getByRole('listbox')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(host.getByRole('combobox')).toBeFocused();
    }
});
