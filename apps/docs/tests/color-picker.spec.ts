import type { LabColorPicker, LabColorValue } from '@labpics/ui-core/color-picker';
type ColorHost = LabColorPicker & { ends: number };
declare global {
  interface Window {
    copied?: string;
    sampleSignal: AbortSignal;
    resolveSample: (value: { sRGBHex: string }) => void;
    resolveCustom: (value: LabColorValue | null) => void;
    EyeDropper: unknown;
  }
}
import { expect, test } from '@playwright/test';
const initial = { space: 'srgb', coords: [1, 2 / 3, 0], alpha: 1 };
test.beforeEach(async ({ page }) => {
  await page.goto('/color-picker.html');
  await page.locator('#lit').getByRole('combobox').waitFor();
});
for (const renderer of ['lit', 'react']) {
  const form = `#${renderer}-form`;
  test(`${renderer}: all fifteen authored views preserve raw form value`, async ({ page }) => {
    const field = page.locator(form);
    for (const model of ['hex', 'hsb', 'hsl', 'rgb', 'lch']) {
      await field.getByRole('combobox', { name: 'Color model' }).selectOption(model);
      for (const variant of ['Grid', 'Spectrum', 'Sliders']) {
        await field.getByRole('radio', { name: variant, exact: true }).check();
        const value = await field.evaluate((f: HTMLFormElement) =>
          JSON.parse(new FormData(f).get('color') as string),
        );
        expect(value).toEqual(initial);
        await expect(field.locator('[data-lab-color-picker]')).toHaveAttribute(
          'data-variant',
          variant.toLowerCase(),
        );
      }
    }
  });
  test(`${renderer}: precise text, alpha, reset and cancellation reach FormData`, async ({
    page,
  }) => {
    const field = page.locator(form);
    const alpha = field.getByRole('textbox', { name: 'Opacity value', exact: true });
    await alpha.fill('50.19607843137255%');
    await alpha.press('Enter');
    expect(
      await field.evaluate(
        (f: HTMLFormElement) => JSON.parse(new FormData(f).get('color') as string).alpha,
      ),
    ).toBe(0.5019607843137255);
    const hex = field.getByRole('textbox', { name: 'HEX color' });
    await hex.fill('#12345678');
    await hex.press('Escape');
    await expect(hex).toHaveValue('#FFAA00');
    await field
      .getByRole('button', { name: `Reset ${renderer === 'lit' ? 'Lit' : 'React'}` })
      .click();
    await expect(alpha).toHaveValue('100%');
  });
  test(`${renderer}: IME draft is not committed before composition ends`, async ({ page }) => {
    const field = page.locator(form);
    const hex = field.getByRole('textbox', { name: 'HEX color' });
    await hex.focus();
    await hex.dispatchEvent('compositionstart');
    await hex.fill('#00FF00');
    await hex.press('Enter');
    expect(
      await field.evaluate((f: HTMLFormElement) =>
        JSON.parse(new FormData(f).get('color') as string),
      ),
    ).toEqual(initial);
    await hex.dispatchEvent('compositionend');
    await hex.press('Enter');
    expect(
      await field.evaluate(
        (f: HTMLFormElement) => JSON.parse(new FormData(f).get('color') as string).coords,
      ),
    ).toEqual([0, 1, 0]);
  });
  test(`${renderer}: spectrum pointer cancel restores the accepted start`, async ({ page }) => {
    const field = page.locator(form);
    const plane = field.locator('[data-plane=spectrum]');
    const rect = await plane.boundingBox();
    if (!rect) throw new Error('Missing plane bounds');
    await page.mouse.move(rect.x + rect.width * 0.4, rect.y + rect.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * 0.6, rect.y + rect.height * 0.6);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(
      await field.evaluate((f: HTMLFormElement) =>
        JSON.parse(new FormData(f).get('color') as string),
      ),
    ).toEqual(initial);
  });
}
test('controlled rejected requests restore visible controls and emit no accepted end', async ({
  page,
}) => {
  const field = page.locator('#rejected-form');
  const before = await field.evaluate((f: HTMLFormElement) => new FormData(f).get('color'));
  const alpha = field.getByRole('textbox', { name: 'Opacity value', exact: true });
  await alpha.fill('12.3%');
  await alpha.press('Enter');
  await alpha.blur();
  await expect(alpha).toHaveValue('50.2%');
  await expect(page.locator('#rejected-ended')).toBeEmpty();
  expect(await field.evaluate((f: HTMLFormElement) => new FormData(f).get('color'))).toBe(before);
});
test('LCH graph selection changes both axes; alpha does not invalidate cached images', async ({
  page,
}) => {
  const field = page.locator('#lit');
  await field.evaluate((host: ColorHost) => {
    host.value = undefined;
    host.model = 'lch';
    host.variant = 'sliders';
  });
  await expect(field.locator('canvas')).toHaveCount(3);
  await expect
    .poll(() =>
      field
        .locator('canvas')
        .evaluateAll((cs) => cs.every((c) => Number(c.dataset.paintCount) > 0)),
    )
    .toBe(true);
  const before = await field
    .locator('canvas')
    .evaluateAll((cs) => cs.map((c) => c.dataset.paintCount));
  const alpha = field.getByRole('textbox', { name: 'Opacity value', exact: true });
  await alpha.fill('37%');
  await alpha.press('Enter');
  await page.waitForTimeout(80);
  expect(
    await field.locator('canvas').evaluateAll((cs) => cs.map((c) => c.dataset.paintCount)),
  ).toEqual(before);
  const plane = field.locator('[data-plane=h]');
  await plane.click({ position: { x: 100, y: 40 } });
  const value = await field.evaluate((host: ColorHost) => host.selectedValue);
  expect(value?.space).toBe('lch');
  expect(value?.alpha).toBe(0.37);
  expect(value?.coords[0]).not.toBe(72.09);
});
test('capability picker and clipboard return actual values through supported APIs', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.EyeDropper = class {
      async open() {
        return { sRGBHex: '#123456' };
      }
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          window.copied = text;
        },
      },
    });
  });
  await page.reload();
  const field = page.locator('#lit');
  await field.getByRole('button', { name: 'Pick a color' }).click();
  await expect(field.getByRole('textbox', { name: 'HEX color' })).toHaveValue('#123456');
  await field.getByRole('button', { name: 'Copy color' }).click();
  await expect.poll(() => page.evaluate(() => window.copied)).toBe('#123456');
});

for (const renderer of ['lit', 'react']) {
  test(`${renderer}: alpha syntax and focused LCH edits retain exact untouched values`, async ({
    page,
  }) => {
    const form = page.locator(`#${renderer}-form`);
    const value = () =>
      form.evaluate((f: HTMLFormElement) => JSON.parse(new FormData(f).get('color') as string));
    const text = form.locator('[data-color-text]');
    for (const [syntax, alpha] of [
      ['rgba(255,0,0,0.25)', 0.25],
      ['hsla(120,100%,50%,0.3)', 0.3],
      ['transparent', 0],
    ] as const) {
      await text.fill(syntax);
      await text.press('Enter');
      expect((await value()).alpha).toBe(alpha);
    }
    const source = {
      space: 'lch',
      coords: [72.09123456789, 84.86123456789, 65.34123456789],
      alpha: 0.5019607843137255,
    };
    await text.fill(JSON.stringify(source));
    await text.press('Enter');
    await form.getByRole('combobox').selectOption('lch');
    await text.focus();
    expect(await text.inputValue()).toContain('84.86123456789');
    await text.fill((await text.inputValue()).replace('72.09123456789', '50'));
    await text.press('Enter');
    expect(await value()).toEqual({ ...source, coords: [50, source.coords[1], source.coords[2]] });
    await text.fill((await text.inputValue()).replace('50 ', '51 '));
    await text.press('Enter');
    expect(await value()).toEqual({ ...source, coords: [51, source.coords[1], source.coords[2]] });
    await text.blur();
    await text.focus();
    await text.blur();
    expect(await value()).toEqual({ ...source, coords: [51, source.coords[1], source.coords[2]] });
  });
  test(`${renderer}: pending screen sample is cancelled by reset and manual edits`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.EyeDropper = class {
        open({ signal }: { signal: AbortSignal }) {
          window.sampleSignal = signal;
          return new Promise<{ sRGBHex: string }>((resolve) => {
            window.resolveSample = resolve;
          });
        }
      };
    });
    await page.reload();
    const form = page.locator(`#${renderer}-form`);
    const picker = form.getByRole('button', { name: 'Pick a color' });
    const value = () =>
      form.evaluate((f: HTMLFormElement) => JSON.parse(new FormData(f).get('color') as string));
    await picker.click();
    await form
      .getByRole('button', { name: `Reset ${renderer === 'lit' ? 'Lit' : 'React'}` })
      .click();
    expect(await page.evaluate(() => window.sampleSignal.aborted)).toBe(true);
    await page.evaluate(() => window.resolveSample({ sRGBHex: '#0000ff' }));
    expect(await value()).toEqual(initial);
    await picker.click();
    const text = form.locator('[data-color-text]');
    await text.fill('#00ff00');
    await text.press('Enter');
    expect(await page.evaluate(() => window.sampleSignal.aborted)).toBe(true);
    const ended = renderer === 'react' ? await page.locator('#react-ended').textContent() : null;
    await page.evaluate(() => window.resolveSample({ sRGBHex: '#ff0000' }));
    expect((await value()).coords).toEqual([0, 1, 0]);
    if (renderer === 'react') expect(await page.locator('#react-ended').textContent()).toBe(ended);
  });
}
test('empty, required, readonly, disabled and external forms use the accepted color', async ({
  page,
}) => {
  const host = page.locator('#lit');
  await host.evaluate((h: ColorHost) => {
    h.value = null;
    h.required = true;
  });
  expect(await page.locator('#lit-form').evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(
    false,
  );
  await host.evaluate((h: ColorHost) => {
    h.readonly = true;
  });
  expect(await page.locator('#lit-form').evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(
    true,
  );
  await host.evaluate((h: ColorHost) => {
    h.value = { space: 'lch', coords: [60, 170, 30], alpha: 0.123456789 };
    h.readonly = false;
    h.form = 'react-form';
  });
  expect(
    await page
      .locator('#react-form')
      .evaluate((f: HTMLFormElement) => new FormData(f).getAll('color').length),
  ).toBe(2);
  await host.evaluate((h: ColorHost) => {
    h.disabled = true;
  });
  expect(
    await page
      .locator('#react-form')
      .evaluate((f: HTMLFormElement) => new FormData(f).getAll('color').length),
  ).toBe(1);
});
test('screen sample null, synchronous failure and external updates cannot emit a stray end', async ({
  page,
}) => {
  const host = page.locator('#lit');
  await host.evaluate((h: ColorHost) => {
    h.ends = 0;
    h.addEventListener('value-change-end', () => h.ends++);
    h.pickScreenColor = () =>
      new Promise<LabColorValue | null>((resolve) => {
        window.resolveCustom = resolve;
      });
  });
  await host.getByRole('button', { name: 'Pick a color' }).click();
  await page.evaluate(() => window.resolveCustom(null));
  expect(await host.evaluate((h: ColorHost) => h.ends)).toBe(0);
  await host.getByRole('button', { name: 'Pick a color' }).click();
  await host.evaluate((h: ColorHost) => {
    h.value = { space: 'srgb', coords: [0, 1, 0], alpha: 0.37 };
  });
  await page.evaluate(() => window.resolveCustom({ space: 'srgb', coords: [0, 0, 1], alpha: 1 }));
  expect(await host.evaluate((h: ColorHost) => h.selectedValue)).toEqual({
    space: 'srgb',
    coords: [0, 1, 0],
    alpha: 0.37,
  });
  expect(await host.evaluate((h: ColorHost) => h.ends)).toBe(0);
  await host.evaluate((h: ColorHost) => {
    h.pickScreenColor = () => {
      throw new Error('host picker unavailable');
    };
  });
  await host.getByRole('button', { name: 'Pick a color' }).click();
  expect(await host.evaluate((h: ColorHost) => h.ends)).toBe(0);
});

test('CPU graph fallback cancels stale paints and retains full CSS-pixel resolution', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      return kind === 'webgl2' ? null : Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  });
  await page.reload();
  await page.locator('#lit').getByRole('combobox').waitFor();
  await page.locator('#lit').evaluate(async (h: ColorHost) => {
    h.value = { space: 'lch', coords: [50, 30, 20], alpha: 1 };
    h.model = 'lch';
    h.variant = 'sliders';
    await h.updateComplete;
  });
  await page.waitForTimeout(20);
  await page.locator('#lit').evaluate((h: ColorHost) => {
    h.value = { space: 'lch', coords: [72.09, 84.86, 65.34], alpha: 1 };
    const baseline = document.createElement('lab-color-picker');
    baseline.id = 'cpu-baseline';
    baseline.setAttribute('default-value', JSON.stringify(h.value));
    baseline.model = 'lch';
    baseline.variant = 'sliders';
    document.body.append(baseline);
  });
  await expect
    .poll(() =>
      page
        .locator('#lit canvas,#cpu-baseline canvas')
        .evaluateAll((cs) => cs.length === 6 && cs.every((c) => c.dataset.renderer === 'cpu')),
    )
    .toBe(true);
  const pixels = (selector: string) =>
    page.locator(selector).evaluateAll((cs) => cs.map((c) => (c as HTMLCanvasElement).toDataURL()));
  expect(await pixels('#lit canvas')).toEqual(await pixels('#cpu-baseline canvas'));
  expect(
    await page
      .locator('#lit canvas')
      .evaluateAll((cs) =>
        cs.every(
          (c) =>
            (c as HTMLCanvasElement).width === c.clientWidth &&
            (c as HTMLCanvasElement).height === c.clientHeight,
        ),
      ),
  ).toBe(true);
});

for (const renderer of ['lit', 'react'])
  test(`${renderer}: dragging visible handles preserves the grab point`, async ({ page }) => {
    const form = page.locator(`#${renderer}-form`);
    const value = () =>
      form.evaluate((f: HTMLFormElement) => JSON.parse(new FormData(f).get('color') as string));
    for (const percent of [0, 50, 100]) {
      const alpha = form.getByRole('textbox', { name: 'Opacity value', exact: true });
      await alpha.fill(String(percent));
      await alpha.press('Enter');
      await alpha.blur();
      const before = await value();
      const thumb = form.locator('.lab-color-channel-thumb').last();
      const box = await thumb.boundingBox();
      if (!box) throw new Error('Missing thumb bounds');
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      expect(await value()).toEqual(before);
    }
    const marker = form.locator('[data-plane=spectrum] .lab-color-marker');
    const box = await marker.boundingBox();
    if (!box) throw new Error('Missing marker bounds');
    const before = await value();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    expect(await value()).toEqual(before);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 10, box.y + box.height / 2 + 10);
    await page.mouse.up();
    const after = await value();
    expect(after.space).toBe('hsv');
    expect(after.coords[1]).toBeGreaterThan(95);
    expect(after.coords[2]).toBeGreaterThan(95);
  });

for (const renderer of ['lit', 'react'])
  test(`${renderer}: author HEX channels and separate grid matrices`, async ({ page }) => {
    const form = page.locator(`#${renderer}-form`);
    await form.getByRole('radio', { name: 'Sliders', exact: true }).check();
    await expect(form.getByRole('textbox', { name: 'Red value', exact: true })).toHaveValue('FF');
    const blue = form.getByRole('textbox', { name: 'Blue value', exact: true });
    await blue.fill('95');
    await blue.press('Enter');
    expect(
      await form.evaluate(
        (f: HTMLFormElement) => JSON.parse(new FormData(f).get('color') as string).coords[2],
      ),
    ).toBe(149 / 255);
    await form.getByRole('radio', { name: 'Grid', exact: true }).check();
    await expect(form.locator('[data-swatch]')).toHaveCount(120);
    expect(
      await form
        .locator('.lab-color-grid')
        .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length),
    ).toBe(12);
    await form.getByRole('combobox').selectOption('lch');
    await expect(form.locator('[data-swatch]')).toHaveCount(100);
    expect(
      await form
        .locator('.lab-color-grid')
        .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length),
    ).toBe(10);
  });
