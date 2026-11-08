const { createRequire } = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const runtime = createRequire(path.join(process.env.PW_PROBE_RUNTIME, 'package.json'));
const { webkit } = runtime('playwright');
const evidence = process.env.PW_PROBE_EVIDENCE;
fs.mkdirSync(evidence, { recursive: true });
const result = {
  version: runtime('playwright/package.json').version,
  sourceSha: process.env.GITHUB_SHA,
  runId: process.env.GITHUB_RUN_ID,
  platform: process.platform,
  architecture: process.arch,
  cpus: os.cpus().length,
  memoryBytes: os.totalmem(),
  node: process.version,
  observations: [],
};

// Same HTML, pixel signal, DPRs and frame observation as the Linux 1.64/1.65 probe.
async function signal(page, png) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let value = 0;
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width - 8; x++)
        for (let c = 0; c < 3; c++)
          value += Math.abs(
            pixels[(y * image.width + x) * 4 + c] - pixels[(y * image.width + x + 8) * 4 + c],
          );
    return value / ((image.width - 8) * image.height * 3);
  }, png.toString('base64'));
}

(async () => {
  const browser = await webkit.launch({ headless: true });
  result.browserVersion = browser.version();
  try {
    for (const deviceScaleFactor of [1, 2]) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor,
      });
      const page = await context.newPage();
      await page.setContent(
        '<style>body{margin:0;background:repeating-linear-gradient(90deg,rgb(216 40 100) 0 8px,rgb(24 180 212) 8px 16px)}#surface{position:absolute;left:96px;top:96px;width:384px;height:240px;background:rgb(255 255 255 / .2)}</style><div id="surface"></div>',
      );
      for (const filter of ['blur(48px)', 'none']) {
        await page.locator('#surface').evaluate((element, value) => {
          element.style.backdropFilter = value;
          element.style.webkitBackdropFilter = value;
        }, filter);
        const png = await page.screenshot({
          clip: { x: 224, y: 184, width: 128, height: 64 },
          scale: 'css',
        });
        const file = `plain-dpr-${deviceScaleFactor}-${filter === 'none' ? 'off' : 'on'}.png`;
        fs.writeFileSync(path.join(evidence, file), png);
        result.observations.push({
          test: 'plain',
          deviceScaleFactor,
          filter,
          signal: await signal(page, png),
          file,
        });
      }
      for (const blur of [false, true]) {
        await page.setContent(
          `<style>body{margin:0;background:#070a12 radial-gradient(1100px 620px at 12% -12%,rgba(79,139,255,.2),transparent 62%)}.card{margin:16px;height:120px;border-radius:12px;background:rgba(13,17,27,.8)}.blur{backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)}</style>${`<div class="card${blur ? ' blur' : ''}">card</div>`.repeat(12)}`,
        );
        const frames = await page.evaluate(
          () =>
            new Promise((resolve) => {
              let count = 0;
              let done = false;
              const tick = () => {
                count++;
                if (!done) requestAnimationFrame(tick);
              };
              requestAnimationFrame(tick);
              setTimeout(() => {
                done = true;
                resolve(count);
              }, 3000);
            }),
        );
        result.observations.push({ test: 'upstream-12-cards', deviceScaleFactor, blur, frames });
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  result.blurPassed = [1, 2].every((deviceScaleFactor) => {
    const pair = result.observations.filter(
      (sample) => sample.test === 'plain' && sample.deviceScaleFactor === deviceScaleFactor,
    );
    const on = pair.find((sample) => sample.filter !== 'none').signal;
    const off = pair.find((sample) => sample.filter === 'none').signal;
    return off > 8 && on < 3 && on < off * 0.2;
  });
  if (!result.blurPassed) process.exitCode = 1;
})()
  .catch((error) => {
    result.error = error.stack ?? String(error);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify(result, null, 2));
    console.info(JSON.stringify(result));
  });
