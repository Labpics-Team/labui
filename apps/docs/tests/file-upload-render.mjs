import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const output = new URL('../../../docs/evidence/file-upload-20261123/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1248, height: 1200 },
  deviceScaleFactor: 1,
});
const records = [];
try {
  for (const theme of ['light', 'dark']) {
    for (const state of [
      'default',
      'hover',
      'drag',
      'selected',
      'disabled',
      'input-s',
      'input-m',
      'input-l',
    ]) {
      await page.goto(
        `${process.env.PW_BASE_URL ?? 'http://127.0.0.1:4392'}/_fixtures/file-upload.html`,
      );
      await page.locator('#react-form input').waitFor();
      await page.mouse.move(0, 0);
      await page.evaluate(
        ({ theme, state }) => {
          document.documentElement.dataset.theme = theme;
          const props = {
            view: state.startsWith('input') ? 'input' : 'dropzone',
            size: state.startsWith('input') ? state.slice(-1) : 'm',
            disabled: state === 'disabled',
          };
          Object.assign(window.fileUploadFixture.lit, props);
          window.fileUploadFixture.updateReact(props);
        },
        { theme, state },
      );
      await page.evaluate(() => document.fonts.ready);
      for (const renderer of ['lit', 'react']) {
        const scope = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
        const surface = scope.locator('.lab-upload-surface');
        if (state === 'selected')
          await scope.locator('input[type=file]').setInputFiles({
            name: 'Very important file.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('selected'),
          });
        if (state === 'hover') await surface.hover();
        if (state === 'drag') {
          const dataTransfer = await page.evaluateHandle(() => {
            const transfer = new DataTransfer();
            transfer.items.add(new File(['text'], 'notes.txt', { type: 'text/plain' }));
            return transfer;
          });
          await surface.dispatchEvent('dragover', { dataTransfer });
          await expect(surface).toHaveAttribute('data-dragging', '');
          await dataTransfer.dispose();
        }
        await surface.screenshot({
          path: fileURLToPath(new URL(`${renderer}-${theme}-${state}.png`, output)),
        });
        records.push(
          await surface.evaluate(
            (element, detail) => {
              const surface = element.getBoundingClientRect();
              const text = element.querySelector('.lab-upload-title, .lab-upload-input-row');
              const style = getComputedStyle(text ?? element);
              return {
                ...detail,
                width: surface.width,
                height: surface.height,
                fontFamily: style.fontFamily,
                fontSize: style.fontSize,
                lineHeight: style.lineHeight,
                fontWeight: style.fontWeight,
                letterSpacing: style.letterSpacing,
              };
            },
            { renderer, theme, state },
          ),
        );
        await page.mouse.move(0, 0);
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
    Object.assign(window.fileUploadFixture.lit, { view: 'dropzone', disabled: false });
    window.fileUploadFixture.updateReact({ view: 'dropzone', disabled: false });
  });
  for (const renderer of ['lit', 'react']) {
    const scope = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    await scope
      .locator('.lab-upload-surface')
      .screenshot({ path: fileURLToPath(new URL(`${renderer}-dark-narrow-200.png`, output)) });
  }
  await writeFile(
    new URL('render.generated.json', output),
    `${JSON.stringify(records, null, 2)}\n`,
  );
} finally {
  await browser.close();
}
