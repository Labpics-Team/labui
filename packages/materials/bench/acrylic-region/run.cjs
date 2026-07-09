const { pathToFileURL } = require('node:url');
const { join } = require('node:path');
const { createRequire } = require('node:module');

// Резолвим chromium из @playwright/test (devDependency apps/docs) — тот же
// repo-portable паттерн, что у prototypes/liquid-glass/harness. Ad-hoc
// инструмент: `node packages/materials/bench/acrylic-region/run.cjs <chrome> [M]`.
const docsRequire = createRequire(join(__dirname, '../../../../apps/docs/package.json'));
const { chromium } = docsRequire('@playwright/test');

const HTML = pathToFileURL(join(__dirname, 'bench.html')).href;
const EXE = process.argv[2];
const M = Number(process.argv[3] || 96);

// Realistic acrylic placements + a saturation stress. Each entry is a surface
// mix; median frame time is measured under a continuously moving backdrop.
const MIXES = {
  'big-square 1500x850': [{ w: 1500, h: 850, n: 1 }],
  'navbar 1500x72': [{ w: 1500, h: 72, n: 1 }],
  'sidebar 300x850': [{ w: 300, h: 850, n: 1 }],
  'palette 640x420': [{ w: 640, h: 420, n: 1 }],
  'realistic mix': [
    { w: 1500, h: 72, n: 1 },
    { w: 300, h: 760, n: 1 },
    { w: 640, h: 420, n: 1 },
    { w: 420, h: 520, n: 1 },
  ],
  'stress 4x big': [{ w: 720, h: 420, n: 4 }],
};

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: EXE,
    args: ['--window-size=1680,960', '--window-position=0,0'],
  });
  const page = await browser.newPage({
    viewport: { width: 1680, height: 940 },
    deviceScaleFactor: 1,
  });
  await page.goto(HTML);
  await page.waitForFunction(() => window.__benchReady === true, { timeout: 15000 });

  console.log(`M(reach)=${M}px  BLUR σ=48  variant costs: median frame ms (lower=faster)`);
  console.log(
    'mix'.padEnd(22),
    'pct'.padStart(8),
    'abs'.padStart(8),
    'speedup'.padStart(9),
    'areaΔ'.padStart(8),
  );
  const rows = [];
  for (const [name, sizes] of Object.entries(MIXES)) {
    const r = await page.evaluate((args) => window.runBench(args), {
      sizes,
      M,
      frames: 160,
      warm: 40,
    });
    const pct = r.pct.median;
    const abs = r.abs.median;
    const speedup = pct / abs;
    const areaRatio = r.area.abs / r.area.pct;
    rows.push({ name, pct, abs, p90p: r.pct.p90, p90a: r.abs.p90, speedup, areaRatio });
    console.log(
      name.padEnd(22),
      pct.toFixed(2).padStart(8),
      abs.toFixed(2).padStart(8),
      `${speedup.toFixed(2)}x`.padStart(9),
      `${(areaRatio * 100).toFixed(0)}%`.padStart(8),
    );
  }
  console.log('\nJSON', JSON.stringify(rows));
  await browser.close();
})().catch((e) => {
  console.error('BENCH_FAIL', e.message);
  process.exit(1);
});
