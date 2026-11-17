import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../../../apps/docs/package.json', import.meta.url))(
  '@playwright/test',
);
const asset = (path) => readFile(new URL(`../../../packages/materials/${path}`, import.meta.url));
const css = (await asset('dist/material.css')).toString();
const runtime = (await asset('dist/index.js')).toString();
const noise = (await asset('dist/veil-noise.png')).toString('base64');
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const results = [];
try {
  await page.setContent(
    `<style>${css}body{margin:0;background:#fafafa;background-image:radial-gradient(circle,#304050 2px,transparent 2px);background-size:17px 17px}#veil{position:absolute;left:40px;top:40px;--_veil-noise:url("data:image/png;base64,${noise}")}</style><div id="veil" data-veil="bottom" data-veil-profile="overlay-ghost"></div>`,
  );
  await page.evaluate(async (runtime) => {
    const api = await import(URL.createObjectURL(new Blob([runtime], { type: 'text/javascript' })));
    api.mountMaterialRuntime(document);
  }, runtime);
  const tick = () =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  for (const edge of ['top', 'bottom', 'left', 'right']) {
    for (const length of [68, 422, 804]) {
      const horizontal = edge === 'left' || edge === 'right';
      const width = horizontal ? length : 180;
      const height = horizontal ? 180 : length;
      await page.locator('#veil').evaluate(
        (el, { edge, width, height }) => {
          el.setAttribute('data-veil', edge);
          el.style.width = `${width}px`;
          el.style.height = `${height}px`;
          el.style.removeProperty('--lab-veil-axis-length');
        },
        { edge, width, height },
      );
      await tick();
      const clip = { x: 40, y: 40, width, height };
      const before = await page.screenshot({ clip });
      await page
        .locator('#veil')
        .evaluate(
          (el, length) => el.style.setProperty('--lab-veil-axis-length', `${length}px`),
          length,
        );
      await tick();
      const after = await page.screenshot({ clip });
      const difference = await page.evaluate(
        async ({ before, after }) => {
          const decode = async (src) => {
            const image = new Image();
            image.src = `data:image/png;base64,${src}`;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            return ctx.getImageData(0, 0, image.width, image.height).data;
          };
          const [a, b] = await Promise.all([decode(before), decode(after)]);
          let max = 0;
          let sum = 0;
          let over2 = 0;
          for (let i = 0; i < a.length; i++)
            if (i % 4 !== 3) {
              const error = Math.abs(a[i] - b[i]);
              sum += error;
              max = Math.max(max, error);
              if (error > 2) over2++;
            }
          return { max, mae: sum / (a.length * 0.75), over2 };
        },
        { before: before.toString('base64'), after: after.toString('base64') },
      );
      results.push({ edge, length, ...difference });
      if (edge === 'bottom' && length === 422) {
        await writeFile(new URL('fluid-veil-before.png', import.meta.url), before);
        await writeFile(new URL('fluid-veil-after.png', import.meta.url), after);
      }
    }
  }
  const report = { date: new Date().toISOString(), browser: browser.version(), results };
  await writeFile(
    new URL('fluid-veil-pixels.json', import.meta.url),
    JSON.stringify(report, null, 2),
  );
  console.info(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
