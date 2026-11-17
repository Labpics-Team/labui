import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(new URL('../../../apps/docs/package.json', import.meta.url))(
  '@playwright/test',
);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const noise = (await readFile(`${root}packages/materials/dist/veil-noise.png`)).toString('base64');
const css = (await readFile(`${root}packages/materials/dist/material.css`, 'utf8')).replace(
  'url("./veil-noise.png")',
  `url("data:image/png;base64,${noise}")`,
);
const runtime = await readFile(`${root}packages/materials/dist/index.js`, 'utf8');
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const page = await browser.newPage({
  viewport: { width: 1552, height: 520 },
  deviceScaleFactor: 1,
});
await page.setContent(
  `<style>${css}*{box-sizing:border-box}body{margin:0;background:white;display:flex;padding:100px 99.5px;gap:24px}.scene{flex-shrink:0;position:relative;width:435px;height:320px;border:1px solid #eee;border-radius:32px;overflow:hidden}.pattern{background-image:linear-gradient(transparent 10px,#101012 10px,#101012 11px,transparent 11px);background-size:21px 21px;background-position:center}.veil{position:absolute;inset:0}</style>${['ghost', 'soft', 'strong'].map((x) => `<div class="scene ${x === 'strong' ? '' : 'pattern'}"><div class="veil" data-veil="top" data-veil-profile="${x}">${x === 'strong' ? '<div data-veil-paint class="pattern"></div>' : ''}</div></div>`).join('')}`,
);
await page.evaluate(async (runtime) => {
  const api = await import(URL.createObjectURL(new Blob([runtime], { type: 'text/javascript' })));
  api.mountMaterialRuntime();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}, runtime);
await page.screenshot({
  path: `${root}docs/evidence/materials-20261117/web-progressive-ordered.png`,
});
console.info(
  await page.locator('.veil').evaluateAll((els) =>
    els.map((el) => ({
      profile: el.dataset.veilProfile,
      strips: el.querySelectorAll('.lab-veil__strip').length,
      noise: el.querySelectorAll('.lab-veil__noise').length,
    })),
  ),
);
await browser.close();
