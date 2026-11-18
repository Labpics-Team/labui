import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { __computeDisplacementField } from '../../../packages/materials/src/engine/liquid-glass.ts';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = (name) => fileURLToPath(new URL(name, import.meta.url));
const { chromium } = createRequire(`${root}apps/docs/package.json`)('@playwright/test');
const css =
  (await readFile(`${root}packages/colors/contract.css`, 'utf8')) +
  (await readFile(`${root}packages/materials/dist/material.css`, 'utf8'));
const runtime = await readFile(`${root}packages/materials/dist/index.js`, 'utf8');
const fields = [776, 540, 422, 270, 40].map((h) => {
  const field = __computeDisplacementField(375, h, [32, 32, 32, 32, 0, 0, 0, 0], 100, 2);
  return { w: 375, h, dpr: 2, unit: field.unit, data: Buffer.from(field.data).toString('base64') };
});
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage({ viewport: { width: 450, height: 880 }, deviceScaleFactor: 2 });
const report = [];
try {
  for (const mode of ['raw', 'painted'])
    for (const h of [776, 540, 422, 270, 40]) {
      await page.setContent(
        `<style>${css}body{margin:0;padding:20px;background:#f0f0f3}.scene{width:375px;height:${h}px;position:relative;overflow:hidden;border-radius:32px 32px 0 0;background:white;background-image:radial-gradient(circle,#101012 4px,transparent 4px);background-size:41px 41px;background-position:center}.lab-material{position:absolute;inset:0;border-radius:32px 32px 0 0;--_glass-rim:none}.raw .lab-material{--_surface-paint:transparent!important;--_material-paint-filter:opacity(1)!important}</style><div class="scene ${mode}" data-material=glass data-theme=dark><div class="lab-material lab-material--elevated"></div></div>`,
      );
      await page.evaluate(async (runtime) => {
        const api = await import(
          URL.createObjectURL(new Blob([runtime], { type: 'text/javascript' }))
        );
        api.mountMaterialRuntime();
      }, runtime);
      await page.waitForFunction(
        () => document.querySelectorAll('.lab-lg-defs feDisplacementMap').length === 3,
      );
      await page.waitForTimeout(150);
      const before = (await page.locator('.scene').screenshot()).toString('base64');
      const atlas = await page.evaluate(
        (f) => {
          const c = document.createElement('canvas');
          c.width = f.w * f.dpr;
          c.height = f.h * f.dpr;
          c.getContext('2d').putImageData(
            new ImageData(
              Uint8ClampedArray.from(atob(f.data), (c) => c.charCodeAt(0)),
              c.width,
              c.height,
            ),
            0,
            0,
          );
          return c.toDataURL();
        },
        fields.find((f) => f.h === h),
      );
      await page.evaluate(async (atlas) => {
        const im = new Image();
        im.src = atlas;
        await im.decode();
        const f = document.querySelector('.lab-lg-defs filter');
        const children = Array.from(f.children);
        const tail = children
          .slice(children.findIndex((x) => x.tagName === 'feDisplacementMap'))
          .map((x) => x.outerHTML)
          .join('');
        f.innerHTML = `<feImage href="${atlas}" width="${f.getAttribute('width')}" height="${f.getAttribute('height')}" preserveAspectRatio="none" result="map"/>${tail}`;
      }, atlas);
      await page.waitForTimeout(150);
      const after = (await page.locator('.scene').screenshot()).toString('base64');
      const diff = await page.evaluate(
        async ({ before, after }) => {
          const pixels = await Promise.all(
            [before, after].map(async (src) => {
              const im = new Image();
              im.src = `data:image/png;base64,${src}`;
              await im.decode();
              const c = document.createElement('canvas');
              c.width = im.width;
              c.height = im.height;
              c.getContext('2d').drawImage(im, 0, 0);
              return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            }),
          );
          let max = 0;
          let sum = 0;
          let changed = 0;
          for (let i = 0; i < pixels[0].length; i++) {
            const d = Math.abs(pixels[0][i] - pixels[1][i]);
            max = Math.max(max, d);
            sum += d;
            if (d) changed++;
          }
          return { max, mae: sum / pixels[0].length, changed };
        },
        { before, after },
      );
      report.push({ mode, h, ...diff });
      assert.equal(diff.max, 0, `preserved pixels: ${mode} ${h}`);
      if (h === 422) {
        await writeFile(output(`glass-atlas-${mode}-retained.png`), Buffer.from(before, 'base64'));
        await writeFile(output(`glass-atlas-${mode}-bounded.png`), Buffer.from(after, 'base64'));
      }
    }
  console.info(report);
  await writeFile(
    output('glass-atlas-pixels.json'),
    `${JSON.stringify(
      {
        kind: 'renderer-equivalence, not Figma calibration',
        browser: browser.version(),
        width: 375,
        dpr: 2,
        results: report,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await browser.close();
}
