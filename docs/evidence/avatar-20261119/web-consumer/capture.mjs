import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

// Run in the external packed consumer after bundling and starting its HTTP server:
// node capture.mjs http://127.0.0.1:4390/ <evidence-directory>
const [url, output] = process.argv.slice(2);
assert.ok(url && output, 'Supply the installed consumer URL and evidence directory');
mkdirSync(output, { recursive: true });
const result = [];
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const density of name === 'chromium' ? [1, 2] : [1]) {
      const page = await browser.newPage({
        viewport: { width: 800, height: 400 },
        deviceScaleFactor: density,
      });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const requests = new Set();
      page.on('request', (request) => {
        if (request.url().endsWith('.webp')) requests.add(request.url());
      });
      await page.goto(`${url}?matrix`);
      await page.locator('.react .lab-avatar-texture').last().waitFor();
      for (const theme of ['light', 'dark'])
        for (const contrast of ['normal', 'more']) {
          await page.evaluate(
            ({ theme, contrast }) => {
              Object.assign(document.documentElement.dataset, { theme, contrast });
            },
            { theme, contrast },
          );
          const materials = await page.evaluate(async () => {
            await document.fonts.ready;
            const elements = [
              ...document.querySelectorAll('.lab-avatar-texture'),
              ...[...document.querySelectorAll('lab-avatar')].flatMap((host) => [
                ...host.shadowRoot.querySelectorAll('.lab-avatar-texture'),
              ]),
            ];
            return Promise.all(
              elements.map(async (el) => {
                const background = getComputedStyle(el).backgroundImage;
                const url = background.match(/^url\("(.+)"\)$/)?.[1];
                if (!url) throw new Error(`Missing background URL: ${background}`);
                const image = new Image();
                image.src = url;
                // Loading the page or fonts does not wait for new CSS theme images.
                await image.decode();
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 48;
                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0, 48, 48);
                const pixels = context.getImageData(12, 12, 24, 24).data;
                const distinct = new Set();
                for (let i = 0; i < pixels.length; i += 4)
                  distinct.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
                const box = el.getBoundingClientRect();
                return {
                  url,
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                  distinct: distinct.size,
                  box: { x: box.x, y: box.y, width: box.width, height: box.height },
                };
              }),
            );
          });
          assert.equal(materials.length, 40);
          assert.equal(new Set(materials.map((material) => material.url)).size, 10);
          for (const material of materials) {
            assert.ok(new URL(material.url).pathname.startsWith('/dist/assets/'), material.url);
            assert.ok(material.url.includes(`-${theme}-${contrast}-`), material.url);
            assert.equal(material.width, 256);
            assert.equal(material.height, 256);
            assert.ok(material.distinct > 250, `${material.url}: flat material`);
          }
          // Let the already decoded theme resources paint before recording pixels.
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
          const file = `installed-${name}-${theme}-${contrast}-${density * 100}.png`;
          await page.screenshot({ path: join(output, file) });
          result.push({
            browser: name,
            version: browser.version(),
            theme,
            contrast,
            density,
            file,
            materials,
          });
        }
      assert.equal(requests.size, 40);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
writeFileSync(join(output, 'installed-materials.json'), `${JSON.stringify(result, null, 2)}\n`);
console.info(
  'Installed material capture passed: four modes, 40 resources, decoded before each screenshot.',
);
