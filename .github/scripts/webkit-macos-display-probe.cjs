const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const runtime = createRequire(path.join(process.env.PW_PROBE_RUNTIME, 'package.json'));
const { webkit } = runtime('playwright');
const { PNG } = runtime('pngjs');
const { WIDTH, HEIGHT, SIZE, MARKERS, STATE, analyze } = require('./webkit-display-capture.cjs');
const evidence = process.env.PW_PROBE_EVIDENCE;
fs.mkdirSync(evidence, { recursive: true });
const result = {
  version: runtime('playwright/package.json').version,
  sourceSha: process.env.GITHUB_SHA,
  runId: process.env.GITHUB_RUN_ID,
  platform: process.platform,
  observations: [],
};
let captureUnavailable;

function inspect(file, filter) {
  const image = PNG.sync.read(fs.readFileSync(file));
  const analysis = analyze(image, filter);
  if (analysis.valid) {
    const { rect } = analysis;
    const cropped = new PNG({ width: rect.width, height: rect.height });
    for (let y = 0; y < rect.height; y++)
      image.data.copy(
        cropped.data,
        y * rect.width * 4,
        ((rect.y + y) * image.width + rect.x) * 4,
        ((rect.y + y) * image.width + rect.x + rect.width) * 4,
      );
    fs.writeFileSync(file.replace(/\.png$/, '-roi.png'), PNG.sync.write(cropped));
  }
  return { file: path.basename(file), ...analysis };
}

function displayCapture(file, filter) {
  if (captureUnavailable)
    return {
      valid: false,
      reason: 'Not retried after screencapture failed',
      error: captureUnavailable,
    };
  try {
    execFileSync('/usr/sbin/screencapture', ['-x', file], { timeout: 20000, stdio: 'pipe' });
    return inspect(file, filter);
  } catch (error) {
    captureUnavailable = {
      message: error.message,
      status: error.status,
      stderr: error.stderr?.toString(),
    };
    return { valid: false, reason: 'OS screencapture unavailable', error: captureUnavailable };
  }
}

(async () => {
  const browser = await webkit.launch({ headless: false });
  result.browserVersion = browser.version();
  try {
    for (const deviceScaleFactor of [1, 2]) {
      const context = await browser.newContext({
        viewport: { width: WIDTH, height: HEIGHT },
        deviceScaleFactor,
      });
      try {
        const page = await context.newPage();
        await page.setContent(
          `<!doctype html><style>body{margin:0}#background{position:fixed;inset:0;background:repeating-linear-gradient(90deg,rgb(216 40 100) 0 8px,rgb(24 180 212) 8px 16px)}#surface{position:absolute;left:96px;top:96px;width:384px;height:240px;background:rgb(255 255 255 / .2)}.marker{position:fixed;width:${SIZE}px;height:${SIZE}px;z-index:10}</style><div id="background"></div><div id="surface"></div>${MARKERS.map((marker) => `<div class="marker" style="left:${marker.x}px;top:${marker.y}px;background:rgb(${marker.rgb.join(' ')})"></div>`).join('')}<div id="state" class="marker" style="left:${STATE.x}px;top:${STATE.y}px"></div>`,
        );
        await page.bringToFront();
        const states = [];
        for (const filter of ['blur(48px)', 'none']) {
          await page.evaluate(
            ({ filter, color }) => {
              const element = document.getElementById('surface');
              element.style.setProperty('backdrop-filter', filter);
              element.style.setProperty('-webkit-backdrop-filter', filter);
              document.getElementById('state').style.backgroundColor = `rgb(${color.join(' ')})`;
            },
            { filter, color: filter === 'none' ? STATE.off : STATE.on },
          );
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
          const geometry = await page.evaluate(() => ({
            screenX,
            screenY,
            outerWidth,
            outerHeight,
            innerWidth,
            innerHeight,
            devicePixelRatio,
            screen: {
              width: screen.width,
              height: screen.height,
              availWidth: screen.availWidth,
              availHeight: screen.availHeight,
            },
            visibility: document.visibilityState,
            focused: document.hasFocus(),
            standard: getComputedStyle(document.getElementById('surface')).backdropFilter,
            prefixed: getComputedStyle(document.getElementById('surface')).getPropertyValue(
              '-webkit-backdrop-filter',
            ),
          }));
          const prefix = `dpr${deviceScaleFactor}-${filter === 'none' ? 'off' : 'on'}`;
          const before = displayCapture(path.join(evidence, `${prefix}-os-before.png`), filter);
          const pwFile = path.join(evidence, `${prefix}-playwright.png`);
          await page.screenshot({ path: pwFile });
          const playwright = inspect(pwFile, filter);
          const after = displayCapture(path.join(evidence, `${prefix}-os-after.png`), filter);
          states.push({ filter, geometry, before, playwright, after });
        }
        const [on, off] = states;
        const valid = states.every(
          (state) =>
            state.geometry.visibility === 'visible' &&
            state.before.valid &&
            state.playwright.valid &&
            state.after.valid,
        );
        const blur = (a, b) => a.signal < 3 && b.signal > 8 && a.signal < b.signal * 0.2;
        const osBlur = valid && blur(on.before, off.before) && blur(on.after, off.after);
        const pwBlur = valid && blur(on.playwright, off.playwright);
        const verdict = !valid
          ? 'invalid-capture'
          : osBlur
            ? pwBlur
              ? 'both-render-blur'
              : 'playwright-snapshot-gap'
            : pwBlur
              ? 'display-render-gap'
              : 'no-observed-compositor-blur';
        result.observations.push({ deviceScaleFactor, valid, osBlur, pwBlur, verdict, states });
        console.info(JSON.stringify({ deviceScaleFactor, valid, osBlur, pwBlur, verdict }));
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  if (result.observations.some((observation) => !observation.valid)) process.exitCode = 1;
})()
  .catch((error) => {
    result.error = error.stack ?? String(error);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.writeFileSync(path.join(evidence, 'display-result.json'), JSON.stringify(result, null, 2));
    console.info(JSON.stringify(result));
  });
