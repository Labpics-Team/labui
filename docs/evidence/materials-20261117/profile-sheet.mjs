import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(new URL('../../../apps/docs/package.json', import.meta.url))(
  '@playwright/test',
);
const output = (name) => fileURLToPath(new URL(name, import.meta.url));
const mode = process.argv[2] ?? 'acrylic';
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage({
  viewport: { width: 1000, height: 812 },
  deviceScaleFactor: 2,
});
const browserSession = await browser.newBrowserCDPSession();
const system = await browserSession.send('SystemInfo.getInfo');
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(process.env.MATERIAL_SCENE_URL ?? 'http://127.0.0.1:4327/experience.html');
  if (process.env.MATERIAL_SCOPE_MOTION)
    await page.addStyleTag({ content: '.lab-sheet-surface{--_sheet-top:initial}' });
  await page.evaluate((mode) => document.documentElement.setAttribute('data-material', mode), mode);
  await page.getByRole('button', { name: 'Изменить настройки' }).click();
  const handle = page.locator('.lab-sheet-handle');
  await handle.waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  const before = await page.locator('.lab-sheet-surface').evaluate((el) => ({
    mode: el.getAttribute('data-lab-material-mode'),
    filter: getComputedStyle(el).backdropFilter,
    width: el.offsetWidth,
    height: el.offsetHeight,
    strips: document.querySelectorAll('.lab-veil__strip').length,
  }));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Tracing.start', {
    categories: process.env.MATERIAL_TRACE_ALL
      ? 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,cc,gpu'
      : 'devtools.timeline,disabled-by-default-devtools.timeline.frame',
    transferMode: 'ReturnAsStream',
  });
  await page.evaluate(() => {
    const info = { frames: [], resizes: 0, svgMutations: 0, veilMutations: 0, active: true };
    window.sheetMeasure = info;
    const raf = (t) => {
      if (!info.active) return;
      info.frames.push(t);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    const resize = new ResizeObserver((entries) => {
      info.resizes += entries.length;
    });
    for (const el of document.querySelectorAll('.lab-sheet-surface,.lab-sheet-ghost'))
      resize.observe(el);
    const mutation = new MutationObserver((records) => {
      for (const r of records) {
        if (r.target instanceof SVGElement) info.svgMutations++;
        if (
          r.target instanceof Element &&
          (r.target.matches('[data-veil]') || r.target.closest('[data-veil]'))
        )
          info.veilMutations++;
      }
    });
    mutation.observe(document.body, { childList: true, subtree: true, attributes: true });
    info.stop = () => {
      info.active = false;
      resize.disconnect();
      mutation.disconnect();
    };
  });
  for (const key of ['Home', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp']) {
    await handle.press(key);
    await page.waitForTimeout(480);
  }
  const rect = await handle.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2 + i * 4);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  }
  await page.mouse.up();
  await page.waitForTimeout(550);
  const measurements = await page.evaluate(() => {
    const info = window.sheetMeasure;
    info.stop();
    info.stop = undefined;
    return info;
  });
  const complete = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  const { stream } = await complete;
  let raw = '';
  while (true) {
    const part = await cdp.send('IO.read', { handle: stream });
    raw += part.data;
    if (part.eof) break;
  }
  await cdp.send('IO.close', { handle: stream });
  const trace = JSON.parse(raw);
  const quantile = (xs, q) => {
    const sorted = [...xs].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  };
  const durations = measurements.frames.slice(1).map((t, i) => t - measurements.frames[i]);
  const phases = Object.fromEntries(
    ['Layout', 'UpdateLayoutTree', 'Paint', 'RasterTask', 'CompositeLayers'].map((name) => {
      const ds = trace.traceEvents
        .filter((e) => e.name === name && e.ph === 'X')
        .map((e) => e.dur / 1000);
      return [
        name,
        {
          count: ds.length,
          sumMs: ds.reduce((a, b) => a + b, 0),
          p95Ms: quantile(ds, 0.95),
          maxMs: Math.max(0, ...ds),
        },
      ];
    }),
  );
  const report = {
    date: new Date().toISOString(),
    mode,
    before,
    browser: browser.version(),
    viewport: '1000x812@2',
    path: 'live dev scene, 5 detents and a20frame drag',
    scopeMotion: !!process.env.MATERIAL_SCOPE_MOTION,
    detailedTrace: !!process.env.MATERIAL_TRACE_ALL,
    gpu: system.gpu.devices.map((d) => d.deviceString),
    gpuFeatures: system.gpu.featureStatus,
    errors,
    frames: {
      count: durations.length,
      medianMs: quantile(durations, 0.5),
      p95Ms: quantile(durations, 0.95),
      maxMs: Math.max(...durations),
      over25ms: durations.filter((t) => t > 25).length,
    },
    resizes: measurements.resizes,
    svgMutations: measurements.svgMutations,
    veilMutations: measurements.veilMutations,
    phases,
  };
  await page.screenshot({ path: output(`sheet-live-${mode}.png`) });
  await writeFile(output(`sheet-live-${mode}.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.info(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
