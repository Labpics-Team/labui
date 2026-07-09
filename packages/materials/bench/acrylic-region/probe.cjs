const { pathToFileURL } = require('node:url');
const { join } = require('node:path');
const { createRequire } = require('node:module');

const docsRequire = createRequire(join(__dirname, '../../../../apps/docs/package.json'));
const { chromium } = docsRequire('@playwright/test');
const HTML = pathToFileURL(join(__dirname, 'bench.html')).href;

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.argv[2],
    args: ['--window-size=1680,960', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
  });
  const page = await browser.newPage({
    viewport: { width: 1680, height: 940 },
    deviceScaleFactor: 1,
  });
  await page.goto(HTML);
  await page.waitForFunction(() => window.__benchReady === true, { timeout: 15000 });

  // baseline: moving backdrop, ZERO filters.
  const base = await page.evaluate(() =>
    window.runBench({ sizes: [], M: 96, frames: 120, warm: 30 }),
  );
  console.log(
    'baseline (0 filters)      median',
    base.pct.median.toFixed(2),
    'mean',
    base.pct.mean.toFixed(2),
  );

  // heavy: 24 big surfaces @ dpr forced high — try to saturate.
  const heavy = await page.evaluate(() =>
    window.runBench({ sizes: [{ w: 760, h: 520, n: 24 }], M: 96, frames: 120, warm: 30 }),
  );
  console.log(
    'heavy 24x760x520  pct median',
    heavy.pct.median.toFixed(2),
    'p90',
    heavy.pct.p90.toFixed(2),
    'mean',
    heavy.pct.mean.toFixed(2),
  );
  console.log(
    'heavy 24x760x520  abs median',
    heavy.abs.median.toFixed(2),
    'p90',
    heavy.abs.p90.toFixed(2),
    'mean',
    heavy.abs.mean.toFixed(2),
  );
  console.log('heavy area ratio abs/pct', (heavy.area.abs / heavy.area.pct).toFixed(3));

  await browser.close();
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
