import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from '@playwright/test';

const output = new URL('../../../docs/evidence/alert-20261119/', import.meta.url);
await mkdir(output, { recursive: true });
const records = [];
for (const [engine, launcher] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const browser = await launcher.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 540, height: 750 } });
    await page.goto(
      `${process.env.LABUI_DOCS_URL ?? 'http://127.0.0.1:5377'}/_fixtures/alert-material.html`,
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    for (const placement of ['wrapper', 'surface']) {
      await page.locator('lab-alert').evaluate((host, placement) => {
        for (const layer of host.shadowRoot.querySelectorAll('.lab-alert-layer')) {
          const opacity = getComputedStyle(layer).getPropertyValue('--_alert-layer-opacity');
          layer.style.opacity = placement === 'wrapper' ? opacity : '1';
          layer.querySelector('.lab-material').style.opacity =
            placement === 'surface' ? opacity : '1';
        }
      }, placement);
      for (const shift of [0, 100]) {
        await page.evaluate((x) => window.moveBackdrop(x), shift);
        await page.waitForTimeout(100);
        for (const row of ['shared', 'alert', 'raw'])
          await page.locator(`#${row}`).screenshot({
            path: new URL(
              `capture-${engine}-${placement}-${row}-${shift}.png`,
              output,
            ).pathname.replace(/^\/(\w:)/, '$1'),
          });
        records.push({
          engine,
          placement,
          shift,
          surfaces: await page.locator('lab-alert').evaluate((host) =>
            [...host.shadowRoot.querySelectorAll('.lab-material')].map((el) => ({
              renderer: el.dataset.labMaterialPaintRenderer,
              opacity: getComputedStyle(el).opacity,
              parentOpacity: getComputedStyle(el.parentElement).opacity,
              filter: getComputedStyle(el).backdropFilter,
              children: el.querySelectorAll('.lab-material__paint').length,
            })),
          ),
        });
      }
    }
  } finally {
    await browser.close();
  }
}
await writeFile(new URL('capture.json', output), `${JSON.stringify(records, null, 2)}\n`);
