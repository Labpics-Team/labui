import { type Locator, type Page, expect, test } from '@playwright/test';

function litHost(page: Page, testid: string): Locator {
  return page.getByTestId(testid);
}
function reactRoot(page: Page, testid: string): Locator {
  return page.getByTestId(testid).locator('[data-lab-radio-group]');
}

function litItem(page: Page, testid: string, label: string): Locator {
  return litHost(page, testid).locator('.item', { hasText: label });
}
function reactItem(page: Page, testid: string, label: string): Locator {
  return reactRoot(page, testid).locator('.lab-radio-item', { hasText: label });
}

function litCheckedControl(page: Page, testid: string): Locator {
  return litHost(page, testid).locator('.control[data-state="checked"]');
}
function reactCheckedControl(page: Page, testid: string): Locator {
  return reactRoot(page, testid).locator('.lab-radio-control[data-state="checked"]');
}

const borderColor = (el: HTMLElement) => getComputedStyle(el).borderTopColor;
const bg = (el: HTMLElement) => getComputedStyle(el).backgroundColor;
const flexDirection = (el: HTMLElement) => getComputedStyle(el).flexDirection;

test.beforeEach(async ({ page }) => {
  await page.goto('/radio-group.html');
});

test('delivered HTML carries the Lit element (React island mounts client-side)', async ({
  request,
}) => {
  const body = await (await request.get('/radio-group.html')).text();
  expect(body).toMatch(/<lab-radio-group/i);
  expect(body).toContain('id="react-root"');
});

test('render: both renderers expose a role=radiogroup with a checked item', async ({ page }) => {
  await expect(litHost(page, 'lit-accent').locator('[role="radiogroup"]')).toBeVisible();
  await expect(reactRoot(page, 'react-accent')).toHaveAttribute('role', 'radiogroup');
  await expect(litCheckedControl(page, 'lit-accent')).toBeVisible();
  await expect(reactCheckedControl(page, 'react-accent')).toBeVisible();
});

test('native selection: clicking an item selects it on both renderers', async ({ page }) => {
  const lit = litHost(page, 'lit-accent');
  await expect(lit).toHaveAttribute('value', 'express');
  await litItem(page, 'lit-accent', 'Standard').click();
  await expect(lit).toHaveAttribute('value', 'standard');
  await reactItem(page, 'react-accent', 'Standard').click();
  await expect(
    reactItem(page, 'react-accent', 'Standard').locator('.lab-radio-control'),
  ).toHaveAttribute('data-state', 'checked');
  await expect(
    reactItem(page, 'react-accent', 'Express').locator('.lab-radio-control'),
  ).toHaveAttribute('data-state', 'unchecked');
});

test('roving keyboard: Arrow keys move selection, skipping the disabled item', async ({ page }) => {
  await litItem(page, 'lit-accent', 'Express').click();
  await page.keyboard.press('ArrowRight');
  await expect(litHost(page, 'lit-accent')).toHaveAttribute('value', 'standard');
  await reactItem(page, 'react-accent', 'Express').click();
  await page.keyboard.press('ArrowRight');
  await expect(
    reactItem(page, 'react-accent', 'Standard').locator('.lab-radio-control'),
  ).toHaveAttribute('data-state', 'checked');
});

test('disabled item: native input blocks selecting it on both renderers', async ({ page }) => {
  const litOvernightInput = litItem(page, 'lit-accent', 'Overnight').locator('input');
  expect(await litOvernightInput.evaluate((el) => (el as HTMLInputElement).disabled)).toBe(true);
  await litItem(page, 'lit-accent', 'Overnight').click({ force: true });
  await expect(litHost(page, 'lit-accent')).toHaveAttribute('value', 'express');

  await expect(
    reactItem(page, 'react-accent', 'Overnight').locator('.lab-radio-control'),
  ).toHaveAttribute('data-disabled', '');
});

test('disabled group: every input is disabled on both renderers', async ({ page }) => {
  const litInputs = litHost(page, 'lit-disabled').locator('input');
  const count = await litInputs.count();
  expect(count).toBe(3);
  for (let i = 0; i < count; i++) {
    expect(await litInputs.nth(i).evaluate((el) => (el as HTMLInputElement).disabled)).toBe(true);
  }
  await expect(reactRoot(page, 'react-disabled')).toHaveAttribute('data-disabled', '');
});

test('a11y: the group exposes a native radio per item, checked state correct, on both renderers', async ({
  page,
}) => {
  for (const [host, testid] of [
    [litHost(page, 'lit-accent'), 'lit'],
    [reactRoot(page, 'react-accent'), 'react'],
  ] as const) {
    const radios = host.getByRole('radio');
    await expect(radios, `${testid}: three radios`).toHaveCount(3);
    await expect(
      host.getByRole('radio', { name: 'Express' }),
      `${testid}: Express checked`,
    ).toBeChecked();
    await expect(
      host.getByRole('radio', { name: 'Standard' }),
      `${testid}: Standard not checked`,
    ).not.toBeChecked();
  }
});

test('a11y: roving focus follows selection; tabbing in lands on the checked radio (all browsers)', async ({
  page,
}) => {
  const host = litHost(page, 'lit-accent');
  const express = host.getByRole('radio', { name: 'Express' });
  const standard = host.getByRole('radio', { name: 'Standard' });
  await page.locator('body').click({ position: { x: 0, y: 0 } });
  await express.focus();
  await expect(express, 'entry focus is the checked radio').toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(standard, 'focus moved to the next enabled radio').toBeFocused();
  await expect(standard, 'selection followed the roving focus').toBeChecked();
  await expect(litHost(page, 'lit-accent')).toHaveAttribute('value', 'standard');
  await expect(host.getByRole('radio', { name: 'Overnight' })).not.toBeFocused();
});

test('single-select reset on Lit: choosing another radio unchecks the prior control', async ({
  page,
}) => {
  const lit = litHost(page, 'lit-accent');
  await expect(
    litItem(page, 'lit-accent', 'Express').locator('.control'),
    'Express starts checked',
  ).toHaveAttribute('data-state', 'checked');

  await litItem(page, 'lit-accent', 'Standard').click();

  await expect(
    litItem(page, 'lit-accent', 'Standard').locator('.control'),
    'Standard becomes checked',
  ).toHaveAttribute('data-state', 'checked');
  await expect(
    litItem(page, 'lit-accent', 'Express').locator('.control'),
    'Express resets to unchecked',
  ).toHaveAttribute('data-state', 'unchecked');
  await expect(
    lit.locator('.control[data-state="checked"]'),
    'exactly one checked control',
  ).toHaveCount(1);
});

test('orientation: vertical lays the list out as a column on both renderers', async ({ page }) => {
  expect(await litHost(page, 'lit-vertical').locator('.root').evaluate(flexDirection)).toBe(
    'column',
  );
  expect(await reactRoot(page, 'react-vertical').evaluate(flexDirection)).toBe('column');
});

test('event contract: selecting an item fires the public value-change with the new value (both renderers)', async ({
  page,
}) => {
  const litDetail = page.evaluate(
    () =>
      new Promise<string | null>((resolve) => {
        const host = document.querySelector('[data-testid="lit-accent"]');
        host?.addEventListener(
          'value-change',
          (e) => resolve((e as CustomEvent<{ value: string | null }>).detail.value),
          { once: true },
        );
      }),
  );
  await litItem(page, 'lit-accent', 'Standard').click();
  expect(await litDetail).toBe('standard');
  const readout = page.getByTestId('react-event-value');
  await expect(readout).toBeEmpty();
  await reactItem(page, 'react-event', 'Standard').click();
  await expect(readout).toHaveText('standard');
});

test('visual parity: Lit and React resolve the same checked ring + dot per type', async ({
  page,
}) => {
  await expect(reactCheckedControl(page, 'react-accent')).toBeVisible();

  for (const variant of ['accent', 'neutral', 'danger'] as const) {
    const litRing = await litCheckedControl(page, `lit-${variant}`).evaluate(borderColor);
    const reactRing = await reactCheckedControl(page, `react-${variant}`).evaluate(borderColor);
    expect(reactRing, `${variant}: checked ring border parity`).toBe(litRing);

    const litDot = await litCheckedControl(page, `lit-${variant}`).locator('.dot').evaluate(bg);
    const reactDot = await reactCheckedControl(page, `react-${variant}`)
      .locator('.lab-radio-dot')
      .evaluate(bg);
    expect(reactDot, `${variant}: checked dot parity`).toBe(litDot);
  }
});

test('tokens: re-pointing --lab-fill-accent re-skins both authored selected rings', async ({
  page,
}) => {
  const litRing = litCheckedControl(page, 'lit-accent');
  const reactRing = reactCheckedControl(page, 'react-accent');
  await expect(reactRing).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-fill-accent', 'rgb(1, 2, 3)');
  });
  await expect.poll(() => litRing.evaluate(borderColor)).toBe('rgb(1, 2, 3)');
  await expect.poll(() => reactRing.evaluate(borderColor)).toBe('rgb(1, 2, 3)');
});

test('theme: flipping [data-theme] re-skins both renderers with zero edits', async ({ page }) => {
  const litRing = litCheckedControl(page, 'lit-neutral');
  const reactRing = reactCheckedControl(page, 'react-neutral');
  await expect(reactRing).toBeVisible();

  const litDark = await litRing.evaluate(borderColor);
  const reactDark = await reactRing.evaluate(borderColor);
  expect(reactDark, 'neutral ring parity in dark theme').toBe(litDark);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await expect
    .poll(
      async () => {
        const litLight = await litRing.evaluate(borderColor);
        const reactLight = await reactRing.evaluate(borderColor);
        return {
          litChanged: litLight !== litDark,
          reactChanged: reactLight !== reactDark,
          parity: reactLight === litLight,
        };
      },
      { message: 'neutral ring re-skins BOTH renderers to the same light colour' },
    )
    .toEqual({ litChanged: true, reactChanged: true, parity: true });
});
