import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/_fixtures/file-upload.html');
  await expect(page.locator('#react-form input[type=file]')).toHaveCount(1);
});
for (const renderer of ['lit', 'react'] as const) {
  const form = renderer === 'lit' ? '#lit' : '#react-form';
  test(`${renderer}: multiple limit one appends while single selection replaces same-metadata files`, async ({
    page,
  }) => {
    await page.evaluate((renderer) => {
      const props = { multiple: true, maxFiles: 1 };
      if (renderer === 'lit') Object.assign(window.fileUploadFixture.lit, props);
      else window.fileUploadFixture.updateReact(props);
    }, renderer);
    const scope = page.locator(form);
    const input = scope.locator('input[type=file]');
    await input.setInputFiles({
      name: 'first.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('first'),
    });
    await expect(scope.locator('.lab-upload-name')).toHaveText('first.txt');
    await input.setInputFiles({
      name: 'second.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('second'),
    });
    await expect(scope.getByRole('status').filter({ hasText: 'Too many files' })).toBeVisible();
    await expect(scope.locator('.lab-upload-name')).toHaveText('first.txt');
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.fileUploadFixture.lit.multiple = false;
      else window.fileUploadFixture.updateReact({ multiple: false });
    }, renderer);
    await input.setInputFiles({
      name: 'report.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('A'),
    });
    await expect(scope.locator('.lab-upload-name')).toHaveText('report.txt');
    const picker = page.waitForEvent('filechooser');
    await scope.getByRole('button', { name: 'Choose File: report.txt' }).click();
    await (await picker).setFiles({
      name: 'report.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('B'),
    });
    await expect
      .poll(() =>
        scope.evaluate(async (el) => {
          const file = new FormData(el as HTMLFormElement).get('files') as File;
          return [file.name, file.size, await file.text()];
        }),
      )
      .toEqual(['report.txt', 1, 'B']);
  });
  test(`${renderer}: real directory drop is rejected while an empty ordinary file is accepted`, async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(
      browserName !== 'chromium',
      'Real filesystem drag injection is a Chromium CDP facility.',
    );
    const directory = testInfo.outputPath('drop-assets');
    await mkdir(directory, { recursive: true });
    const emptyFile = join(directory, 'empty.txt');
    await writeFile(emptyFile, '');
    await page.evaluate((renderer) => {
      const props = { accept: '', multiple: true, view: 'dropzone' as const };
      if (renderer === 'lit') Object.assign(window.fileUploadFixture.lit, props);
      else window.fileUploadFixture.updateReact(props);
    }, renderer);
    const scope = page.locator(form);
    await scope
      .locator('input[type=file]')
      .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('notes') });
    await expect(scope.locator('.lab-upload-name')).toHaveText('notes.txt');
    const session = await page.context().newCDPSession(page);
    const surface = scope.locator('.lab-upload-surface');
    await surface.scrollIntoViewIfNeeded();
    const box = await surface.boundingBox();
    if (!box) throw new Error('Missing drop surface');
    const drop = async (file: string) => {
      for (const type of ['dragEnter', 'dragOver', 'drop'] as const)
        await session.send('Input.dispatchDragEvent', {
          type,
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
          data: { items: [], files: [file], dragOperationsMask: 1 },
        });
    };
    await drop(directory);
    await expect(
      scope.getByRole('status').filter({ hasText: 'Folders cannot be selected' }),
    ).toBeVisible();
    await expect(scope.locator('.lab-upload-name')).toHaveText('notes.txt');
    await drop(emptyFile);
    await expect(scope.locator('.lab-upload-name')).toHaveText(['notes.txt', 'empty.txt']);
    await expect
      .poll(() =>
        scope.evaluate((el) =>
          Array.from(new FormData(el as HTMLFormElement).getAll('files'), (file) => [
            (file as File).name,
            (file as File).size,
          ]),
        ),
      )
      .toEqual([
        ['notes.txt', 5],
        ['empty.txt', 0],
      ]);
    await session.detach();
  });
  test(`${renderer}: real picker, validation, removal and form reset`, async ({ page }) => {
    const scope = page.locator(form);
    const input = scope.locator('input[type=file]');
    if (renderer === 'lit') {
      await page.evaluate(() => {
        const field = window.fileUploadFixture.lit;
        field.addEventListener('file-change', () => {
          field.dataset.liveFiles = field.files.map((file) => file.name).join(',');
        });
      });
    }
    const chooserPromise = page.waitForEvent('filechooser');
    await scope.getByRole('button', { name: 'Choose File No file chosen' }).click();
    await (await chooserPromise).setFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    });
    await expect(scope.locator('.lab-upload-name')).toHaveText('notes.txt');
    if (renderer === 'lit')
      await expect(scope.locator('lab-file-upload')).toHaveAttribute(
        'data-live-files',
        'notes.txt',
      );
    const values = () =>
      scope.evaluate((el) =>
        Array.from(new FormData(el as HTMLFormElement).getAll('files'), (f) =>
          typeof f === 'string' ? f : [f.name, f.size],
        ),
      );
    await expect.poll(values).toEqual([['notes.txt', 5]]);
    await page.evaluate((renderer) => {
      const form = document.querySelector<HTMLFormElement>(
        renderer === 'lit' ? '#lit' : '#react-form',
      );
      if (!form) throw new Error('Missing form');
      const check = () => {
        form.dataset.rejectedSubmission = (new FormData(form).get('files') as File).name;
      };
      if (renderer === 'lit') window.fileUploadFixture.lit.addEventListener('file-reject', check);
      else window.fileUploadFixture.updateReact({ onFileReject: check });
    }, renderer);
    await input.setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('image'),
    });
    await expect(scope.getByRole('status').filter({ hasText: 'photo.png' })).toContainText(
      'File type is not accepted',
    );
    await expect.poll(values).toEqual([['notes.txt', 5]]);
    await expect(scope).toHaveAttribute('data-rejected-submission', 'notes.txt');
    await input.setInputFiles({
      name: 'large.txt',
      mimeType: 'text/plain',
      buffer: Buffer.alloc(1025),
    });
    await expect(scope.getByRole('status').filter({ hasText: 'large.txt' })).toContainText(
      'File is too large',
    );
    await expect.poll(values).toEqual([['notes.txt', 5]]);
    await scope.getByRole('button', { name: 'Remove notes.txt' }).focus();
    await scope.getByRole('button', { name: 'Remove notes.txt' }).press('Enter');
    await expect(scope.locator('.lab-upload-name')).toHaveCount(0);
    await expect(scope.getByRole('button', { name: 'Choose File No file chosen' })).toBeFocused();
    await input.setInputFiles({
      name: 'reset.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('reset'),
    });
    await page.evaluate(() =>
      document.addEventListener('reset', (event) => event.preventDefault(), { once: true }),
    );
    await scope.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(scope.locator('.lab-upload-name')).toHaveText('reset.txt');
    await scope.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(scope.locator('.lab-upload-name')).toHaveCount(0);
  });
  test(`${renderer}: controlled selection survives declined request and cancelled chooser`, async ({
    page,
  }) => {
    await page.evaluate((renderer) => {
      const acceptedFiles = [new File(['fixed'], 'fixed.txt', { type: 'text/plain' })];
      if (renderer === 'lit') window.fileUploadFixture.lit.acceptedFiles = acceptedFiles;
      else window.fileUploadFixture.updateReact({ acceptedFiles });
    }, renderer);
    const scope = page.locator(form);
    const input = scope.locator('input[type=file]');
    await expect(scope.locator('.lab-upload-name')).toHaveText('fixed.txt');
    await input.setInputFiles({
      name: 'new.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('new'),
    });
    await expect(scope.locator('.lab-upload-name')).toHaveText('fixed.txt');
    await input.dispatchEvent('click');
    await input.dispatchEvent('cancel');
    await expect
      .poll(() =>
        input.evaluate((el) => Array.from((el as HTMLInputElement).files ?? [], (f) => f.name)),
      )
      .toEqual(['fixed.txt']);
    await expect
      .poll(() =>
        scope.evaluate((el) =>
          Array.from(new FormData(el as HTMLFormElement).getAll('files'), (f) => (f as File).name),
        ),
      )
      .toEqual(['fixed.txt']);
  });
  test(`${renderer}: drag, duplicates, multiple limit and disabled fieldset`, async ({ page }) => {
    await page.evaluate((renderer) => {
      if (renderer === 'lit')
        Object.assign(window.fileUploadFixture.lit, {
          multiple: true,
          maxFiles: 2,
          view: 'dropzone',
        });
      else window.fileUploadFixture.updateReact({ multiple: true, maxFiles: 2, view: 'dropzone' });
    }, renderer);
    const scope = page.locator(form);
    const surface = scope.locator('.lab-upload-surface');
    const input = scope.locator('input[type=file]');
    await input.setInputFiles({
      name: 'one.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('one'),
    });
    await expect(scope.locator('.lab-upload-name')).toHaveText('one.txt');
    const duplicatePicker = page.waitForEvent('filechooser');
    await scope.getByRole('button', { name: 'Browse files' }).click();
    await (await duplicatePicker).setFiles({
      name: 'one.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('one'),
    });
    await expect(scope.getByRole('status').filter({ hasText: 'already selected' })).toBeVisible();
    const dt = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(['two'], 'two.txt', { type: 'text/plain' }));
      return dt;
    });
    await surface.dispatchEvent('dragover', { dataTransfer: dt });
    await expect(surface).toHaveAttribute('data-dragging', '');
    await surface.dispatchEvent('drop', { dataTransfer: dt });
    await expect(scope.locator('.lab-upload-name')).toHaveText(['one.txt', 'two.txt']);
    await input.setInputFiles({
      name: 'three.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('3'),
    });
    await expect(scope.getByRole('status').filter({ hasText: 'Too many files' })).toBeVisible();
    await scope.evaluate((el) => {
      const fieldset = document.createElement('fieldset');
      el.before(fieldset);
      fieldset.append(el);
      fieldset.disabled = true;
    });
    await expect(input).toBeDisabled();
    await expect
      .poll(() => scope.evaluate((el) => Array.from(new FormData(el as HTMLFormElement))))
      .toEqual([]);
    await surface.dispatchEvent('dragover', { dataTransfer: dt });
    await surface.dispatchEvent('drop', { dataTransfer: dt });
    await expect(scope.locator('.lab-upload-name')).toHaveText(['one.txt', 'two.txt']);
    await dt.dispose();
  });
  test(`${renderer}: external form, required validation and read-only submission`, async ({
    page,
  }) => {
    await page.evaluate((renderer) => {
      if (renderer === 'lit') {
        window.fileUploadFixture.lit.required = true;
        window.fileUploadFixture.lit.setAttribute('form', 'external');
      } else window.fileUploadFixture.updateReact({ required: true, form: 'external' });
    }, renderer);
    const scope = page.locator(form);
    const input = scope.locator('input[type=file]');
    await expect
      .poll(() =>
        page.locator('#external').evaluate((el) => (el as HTMLFormElement).checkValidity()),
      )
      .toBe(false);
    await expect(scope.getByRole('alert')).toHaveText('Choose a file.');
    await expect(scope.getByRole('button', { name: 'Choose File No file chosen' })).toBeFocused();
    await input.setInputFiles({
      name: 'required.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('required'),
    });
    await expect
      .poll(() =>
        page.locator('#external').evaluate((el) => (el as HTMLFormElement).checkValidity()),
      )
      .toBe(true);
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.fileUploadFixture.lit.readonly = true;
      else window.fileUploadFixture.updateReact({ readOnly: true });
    }, renderer);
    await expect(scope.getByRole('button', { name: 'Remove required.txt' })).toBeDisabled();
    await expect
      .poll(() =>
        page
          .locator('#external')
          .evaluate((el) =>
            Array.from(
              new FormData(el as HTMLFormElement).getAll('files'),
              (f) => (f as File).name,
            ),
          ),
      )
      .toEqual(['required.txt']);
    await page.locator('#external').evaluate((el) => (el as HTMLFormElement).reset());
    await expect(scope.locator('.lab-upload-name')).toHaveCount(0);
  });
  test(`${renderer}: area picker opens from its real keyboard button`, async ({ page }) => {
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.fileUploadFixture.lit.view = 'dropzone';
      else window.fileUploadFixture.updateReact({ view: 'dropzone' });
    }, renderer);
    const browse = page.locator(form).getByRole('button', { name: 'Browse files' });
    await browse.focus();
    const chooser = page.waitForEvent('filechooser');
    await browse.press('Enter');
    await (await chooser).setFiles({
      name: 'keyboard.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('key'),
    });
    await expect(page.locator(form).locator('.lab-upload-name')).toHaveText('keyboard.txt');
  });
}

test('accessible field semantics in both renderers and both themes', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const view of ['input', 'dropzone'] as const) {
      await page.evaluate((view) => {
        Object.assign(window.fileUploadFixture.lit, { view, helper: 'Text files up to 1 KB' });
        window.fileUploadFixture.updateReact({ view, helper: 'Text files up to 1 KB' });
      }, view);
      const results = await new AxeBuilder({ page })
        .include('lab-file-upload')
        .include('[data-lab-file-upload]')
        .analyze();
      expect(results.violations).toEqual([]);
    }
  }
});

test('authored geometry, keyboard and narrow width in both renderers', async ({ page }) => {
  for (const size of ['s', 'm', 'l'] as const) {
    await page.evaluate((size) => {
      window.fileUploadFixture.lit.size = size;
      window.fileUploadFixture.updateReact({ size });
    }, size);
    for (const form of ['#lit', '#react-form']) {
      const box = await page.locator(`${form} .lab-upload-surface`).boundingBox();
      expect(box?.height).toBe({ s: 40, m: 48, l: 56 }[size]);
    }
  }
  await page.evaluate(() => {
    window.fileUploadFixture.lit.view = 'dropzone';
    window.fileUploadFixture.updateReact({ view: 'dropzone' });
  });
  for (const form of ['#lit', '#react-form']) {
    await expect
      .poll(async () =>
        Math.round((await page.locator(`${form} .lab-upload-surface`).boundingBox())?.height ?? 0),
      )
      .toBe(381);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  for (const form of ['#lit', '#react-form']) {
    const surface = page.locator(`${form} .lab-upload-surface`);
    const artwork = surface.locator('.lab-upload-artwork');
    const dimensions = await artwork.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        width: box.width,
        height: box.height,
        bitmapHeight: Number.parseFloat(getComputedStyle(element, '::before').height),
      };
    });
    expect(dimensions.width / dimensions.height).toBeCloseTo(2, 2);
    expect(dimensions.bitmapHeight / dimensions.width).toBeCloseTo(146 / 256, 2);
    await surface.hover();
    const hover = await artwork.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element, '::before');
      return {
        height: box.height,
        width: box.width,
        bitmapHeight: Number.parseFloat(style.height),
        top: Number.parseFloat(style.top),
      };
    });
    expect(hover.bitmapHeight / hover.width).toBeCloseTo(180 / 256, 2);
    expect(hover.top / hover.height).toBeCloseTo(-8.4176025390625 / 128, 3);
  }
});
