import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { platform } from 'node:os';
import { displayPixels } from './display-pixels.mjs';

const engines = createRequire(new URL('../../../apps/docs/package.json', import.meta.url))(
  '@playwright/test',
);
const results = [];
const compositions = [];
const display = process.env.MATERIAL_CAPTURE === 'display';
const swatches = [
  [20, 30, 40],
  [90, 100, 110],
  [120, 128, 140],
  [170, 190, 210],
  [240, 230, 220],
];
const normal = [20, 40, 60];
const normalAlpha = 0.3;
const recipes = [
  { mode: 'overlay', source: 0.95, alpha: 0.8, filter: 'brightness(2) opacity(.72)' },
  {
    mode: 'overlay',
    source: 0.1,
    alpha: 0.6,
    filter: 'invert(1) brightness(2) invert(1) opacity(.48)',
  },
  { mode: 'color-dodge', source: 0.7, alpha: 0.4, filter: `brightness(${1 / 0.3}) opacity(.4)` },
  {
    mode: 'overlay',
    source: 0.95,
    alpha: 0.8,
    filter: 'brightness(2) invert(1) invert(1) opacity(.72)',
  },
  {
    mode: 'color-dodge',
    source: 0.7,
    alpha: 0.4,
    filter: `brightness(${1 / 0.3}) invert(1) invert(1) opacity(.4)`,
  },
  { mode: 'overlay', source: 0.95, alpha: 0.8, mix: true },
  { mode: 'overlay', source: 0.1, alpha: 0.6, mix: true },
  { mode: 'color-dodge', source: 0.7, alpha: 0.4, mix: true },
  {
    mode: 'overlay',
    source: 0.95,
    alpha: 0.8,
    filter: 'brightness(2) blur(.01px) opacity(.72)',
  },
  {
    mode: 'overlay',
    source: 0.95,
    alpha: 0.8,
    filter: 'brightness(2)',
    elementOpacity: 0.72,
  },
];

async function pixelsAt(page, xs) {
  if (display) return displayPixels(page, xs);
  const png = await page.screenshot();
  return page.evaluate(
    async ({ base64, xs }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      return xs.map((x) => Array.from(ctx.getImageData(x, 50, 1, 1).data));
    },
    { base64: png.toString('base64'), xs },
  );
}

async function settle(page) {
  if (display) {
    await page.evaluate(() => {
      const marker = document.createElement('div');
      marker.style.cssText =
        'position:fixed;left:16px;top:16px;width:8px;height:8px;background:rgb(7 251 137);z-index:2147483647;pointer-events:none';
      document.body.append(marker);
    });
    // XWD has no compositor fence; bounded settling is specific to this diagnostic.
    await page.waitForTimeout(250);
  }
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

for (const name of ['chromium', 'firefox', 'webkit']) {
  const browser = await engines[name].launch({
    headless: !display,
    ...(name === 'chromium' ? { channel: 'chromium' } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 300 } });
  if (display) await page.bringToFront();
  try {
    for (const filter of ['blur(10px)', 'brightness(2)', 'invert(1)', 'contrast(2)']) {
      await page.setContent(
        `<!doctype html><style>body{margin:0;background:#404040}#source{position:fixed;inset:0;background:linear-gradient(90deg,#404040 0 50px,#b0b0b0 50px)}#probe{position:absolute;inset:10px;-webkit-backdrop-filter:${filter};backdrop-filter:${filter};background:rgb(255 255 255 / .001)}</style><div id=source></div><div id=probe></div>`,
      );
      await settle(page);
      results.push({
        browser: name,
        version: browser.version(),
        filter,
        computed: await page
          .locator('#probe')
          .evaluate((el) => getComputedStyle(el).backdropFilter),
        pixels: await pixelsAt(page, [20, 45, 49, 50, 55, 80]),
      });
    }
    const background = swatches
      .map((rgb, i) => `rgb(${rgb.join(' ')}) ${i * 30}px ${(i + 1) * 30}px`)
      .join(',');
    for (const recipe of recipes) {
      const expected = swatches.map((rgb) =>
        rgb.map((channel, i) => {
          const backdrop = (channel * (1 - normalAlpha) + normal[i] * normalAlpha) / 255;
          const blend =
            recipe.mode === 'color-dodge'
              ? Math.min(1, backdrop / (1 - recipe.source))
              : backdrop <= 0.5
                ? 2 * backdrop * recipe.source
                : 1 - 2 * (1 - backdrop) * (1 - recipe.source);
          return Math.round(255 * (backdrop * (1 - recipe.alpha) + blend * recipe.alpha));
        }),
      );
      for (const isolation of ['isolate', 'auto']) {
        const blendStyle = recipe.mix
          ? `background:rgb(${Array(3)
              .fill(recipe.source * 255)
              .join(' ')} / ${recipe.alpha});mix-blend-mode:${recipe.mode}`
          : `-webkit-backdrop-filter:${recipe.filter};backdrop-filter:${recipe.filter};opacity:${recipe.elementOpacity ?? 1}`;
        await page.setContent(
          `<!doctype html><style>body{margin:0}#source{position:fixed;inset:0;background:linear-gradient(90deg,${background})}.host{position:relative;isolation:${isolation};width:150px;height:100px}.capture,.blend{position:absolute;inset:0}.capture{-webkit-backdrop-filter:blur(1px);backdrop-filter:blur(1px);background:rgb(${normal.join(' ')} / ${normalAlpha})}.blend{${blendStyle}}</style><div id=source></div><div class=host><div class=capture></div><div class=blend></div></div>`,
        );
        await settle(page);
        const pixels = await pixelsAt(page, [15, 45, 75, 105, 135]);
        const maxError = Math.max(
          ...pixels.flatMap((rgb, i) =>
            rgb.slice(0, 3).map((c, k) => Math.abs(c - expected[i][k])),
          ),
        );
        compositions.push({ browser: name, isolation, recipe, expected, pixels, maxError });
      }
    }
  } finally {
    await browser.close();
  }
  console.info(
    `MATERIAL_BROWSER_PIXELS_REPORT=${JSON.stringify({ browser: name, capture: display ? 'display' : 'snapshot', results: results.filter((row) => row.browser === name), compositions: compositions.filter((row) => row.browser === name) })}`,
  );
}
const report = {
  date: new Date().toISOString(),
  platform: platform(),
  capture: display ? 'display' : 'snapshot',
  results,
  compositions,
};
await writeFile(
  new URL(`backdrop-${display ? 'display' : 'support'}-${platform()}.json`, import.meta.url),
  JSON.stringify(report, null, 2),
);
// Numeric evidence stays available in the job log without depending on artifact storage.
console.info(`MATERIAL_PIXEL_REPORT=${JSON.stringify(report)}`);
