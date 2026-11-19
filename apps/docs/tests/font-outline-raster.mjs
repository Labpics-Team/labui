import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

if (!process.argv[2] || !process.argv[3])
  throw new Error('Usage: font-outline-raster.mjs input.json output-directory');
const rows = JSON.parse(await readFile(process.argv[2], 'utf8'));
const output = resolve(process.argv[3]);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 42 + rows.length * 72 } });
  for (const row of rows) {
    const masks = await page.evaluate(
      async (svgs) => {
        const canvas = document.createElement('canvas');
        canvas.width = 5760;
        canvas.height = 480;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const masks = [];
        for (const svg of svgs) {
          const image = new Image();
          image.src = `data:image/svg+xml;base64,${btoa(svg)}`;
          await image.decode();
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const mask = new Uint8Array(data.length / 4);
          for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] >= 128 ? 1 : 0;
          masks.push(mask);
        }
        return masks.slice(1).map((mask) => {
          let intersection = 0;
          let union = 0;
          for (let i = 0; i < mask.length; i++) {
            intersection += mask[i] & masks[0][i];
            union += mask[i] | masks[0][i];
          }
          return intersection / union;
        });
      },
      [
        row.source,
        row.source,
        row.source.replace('<path ', '<path transform="translate(1,0)" '),
        ...Object.values(row.models).map((model) => model.svg),
      ],
    );
    const { source, models, ...metrics } = row;
    results.push({
      ...metrics,
      calibration: { identityIoU: masks[0], onePixelShiftIoU: masks[1] },
      models: Object.fromEntries(
        Object.entries(models).map(([name, { svg, ...model }], index) => [
          name,
          { ...model, filledOutlineIoU: masks[index + 2] },
        ]),
      ),
    });
  }
  await writeFile(resolve(output, 'font-choice.json'), `${JSON.stringify(results, null, 2)}\n`);
  await page.setContent(
    `<style>body{margin:0;background:white;font:12px Arial}header,.row{display:grid;grid-template-columns:repeat(3,360px)}header{height:42px}header div{padding:10px 8px}.row>div{height:72px}.label{height:24px;padding:0 8px;color:#777}svg{display:block;width:360px;height:30px}</style><header><div>Figma pinned contours</div><div>Geist 1.400 contours</div><div>Geist 1.800 contours</div></header>${rows.map((row) => `<div class="row">${[row.source, row.models['1.400-variable'].svg, row.models['1.800-variable'].svg].map((svg) => `<div><div class="label">${row.id}</div>${svg}</div>`).join('')}</div>`).join('')}`,
  );
  await page.screenshot({ path: resolve(output, 'font-choice-comparison.png') });
} finally {
  await browser.close();
}
