import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(new URL('../../../apps/docs/package.json', import.meta.url))(
  '@playwright/test',
);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const evidence = fileURLToPath(new URL('./', import.meta.url));
const prefix = process.env.GLASS_CALIBRATION_PREFIX ?? '';
const css = `${await readFile(`${root}packages/colors/contract.css`, 'utf8')}\n${await readFile(`${root}packages/materials/dist/material.css`, 'utf8')}`;
const runtime = await readFile(`${root}packages/materials/dist/index.js`, 'utf8');
const ref = (
  await readFile(`${root}docs/evidence/materials-20261117/figma-glass-effects.png`)
).toString('base64');
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const page = await browser.newPage({
  viewport: { width: 1552, height: 520 },
  deviceScaleFactor: 1,
});
await page.setContent(
  `<style>${css}*{box-sizing:border-box}body{margin:0;background:white;display:flex;padding:100px;gap:24px}.scene{flex-shrink:0;position:relative;width:320px;height:320px;border:1px solid #eee;border-radius:32px;background-image:radial-gradient(circle,#101012 4.1px,transparent 4.1px);background-size:41px 41px;background-position:center}.scene:nth-child(n+3){background-size:61.828px 61.828px}.lab-material{position:absolute;left:31px;top:31px;width:256px;height:256px;border-radius:128px;--_tint:rgb(0 0 0 / 0);--_blend:rgb(0 0 0 / 0)}</style>${['subtle', 'soft', 'base', 'elevated'].map((x) => `<div class="scene" data-material="glass"><div class="lab-material lab-material--${x}"></div></div>`).join('')}`,
);
await page.evaluate(async (runtime) => {
  const api = await import(URL.createObjectURL(new Blob([runtime], { type: 'text/javascript' })));
  api.mountMaterialRuntime();
}, runtime);
await page.waitForFunction(
  () => document.querySelectorAll('.lab-lg-defs feDisplacementMap').length === 12,
);
const results = [];
for (const factor of [0.25, 0.5, 0.75, 1])
  for (const refract of (process.env.GLASS_REFRACTION_SCALES ?? '0.5,1,1.5,2')
    .split(',')
    .map(Number)) {
    await page.locator('.lab-material').evaluateAll(
      (els, { factor, refract }) =>
        els.forEach((el, i) => {
          el.style.setProperty('--_glass-frost', `${[12, 12, 20, 25][i] * factor}px`);
          el.style.setProperty('--_lg-refraction', `${[1, 0.8, 0.8, 1][i] * refract}`);
        }),
      { factor, refract },
    );
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const actual = await page.screenshot();
    const error = await page.evaluate(
      async ({ actual, ref }) => {
        const load = async (b) => {
          const i = new Image();
          i.src = `data:image/png;base64,${b}`;
          await i.decode();
          const c = document.createElement('canvas');
          c.width = i.width;
          c.height = i.height;
          const x = c.getContext('2d');
          x.drawImage(i, 0, 0);
          return x.getImageData(0, 0, i.width, i.height).data;
        };
        const [a, b] = await Promise.all([load(actual), load(ref)]);
        const result = [];
        for (let j = 0; j < 4; j++) {
          const cx = 260 + 344 * j;
          const cy = 260;
          let sum = 0;
          let n = 0;
          for (let y = 133; y < 387; y++)
            for (let x = cx - 127; x < cx + 127; x++) {
              if (
                (x - cx) ** 2 + (y - cy) ** 2 > 125 ** 2 ||
                (Math.abs(x - cx) < 65 && Math.abs(y - cy) < 24)
              )
                continue;
              for (let ch = 0; ch < 3; ch++) {
                sum += Math.abs(a[(y * 1552 + x) * 4 + ch] - b[(y * 1552 + x) * 4 + ch]);
                n++;
              }
            }
          result.push(sum / n);
        }
        return result;
      },
      { actual: actual.toString('base64'), ref },
    );
    results.push({ factor, refract, error });
    console.info({ factor, refract, error });
    if (refract === 1 && (factor === 0.5 || factor === 1))
      await writeFile(`${evidence}${prefix}web-glass-frost-${factor}.png`, actual);
  }
await writeFile(`${evidence}${prefix}glass-calibration.json`, JSON.stringify(results, null, 2));
await browser.close();
