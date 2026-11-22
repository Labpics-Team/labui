import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Capture the ordinary cold entrance and exit, without screenshot() in their
 * hot path. An in-frame marker ties each compositor image to its actual pose. */
export async function liveDialogOptics(browser, url, output) {
  const results = [];
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({
      viewport: { width: 960, height: 600 },
      deviceScaleFactor: dpr,
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => {
        document.documentElement.dataset.material = 'glass';
        document.documentElement.dataset.theme = 'dark';
        document.body.style.background =
          'repeating-conic-gradient(#020408 0 25%,#305a84 0 50%) 0 0 / 180px 180px';
        const dialog = document.getElementById('lit-dialog');
        dialog.modal = false;
        for (const element of document.body.children)
          if (!element.contains(dialog)) element.style.visibility = 'hidden';
        for (const element of dialog.parentElement.children)
          if (element !== dialog) element.style.visibility = 'hidden';
        // Preserve final layout, isolate optical pixels from the text.
        dialog.shadowRoot.querySelector('.lab-dialog-content').style.visibility = 'hidden';
        const material = dialog.shadowRoot.querySelector('.lab-dialog-material');
        const plane = dialog.shadowRoot.querySelector('dialog');
        const marker = document.createElement('div');
        marker.style.cssText =
          'position:fixed;left:0;top:0;width:20px;height:20px;z-index:999999;pointer-events:none;background:rgb(0 0 199)';
        document.body.append(marker);
        const observer = new ResizeObserver(() => {
          const progress = Number.parseFloat(
            getComputedStyle(plane).getPropertyValue('--_lab-dialog-reveal'),
          );
          const n = Math.round(progress * 65535);
          marker.style.background = `rgb(${n >> 8} ${n & 255} ${plane.dataset.motion === 'closing' ? 198 : 199})`;
        });
        observer.observe(material);
        window.stopLiveDialogMarker = () => {
          observer.disconnect();
          marker.remove();
        };
      });
      const cdp = await page.context().newCDPSession(page);
      const frames = [];
      const pendingAcks = [];
      cdp.on('Page.screencastFrame', (event) => {
        frames.push(event.data);
        pendingAcks.push(cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }));
      });
      await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
      await page.evaluate(() => {
        document.getElementById('lit-dialog').open = true;
      });
      const panel = page.locator('#lit-dialog .lab-dialog-plane').first();
      await page.waitForTimeout(450);
      const full = await panel.locator('.lab-dialog-material').first().boundingBox();
      await page.evaluate(() => {
        document.getElementById('lit-dialog').open = false;
      });
      await panel.waitFor({ state: 'hidden' });
      await cdp.send('Page.stopScreencast');
      await Promise.all(pendingAcks);
      await cdp.detach();
      await page.evaluate(() => window.stopLiveDialogMarker());
      assert.equal(await panel.locator('filter').count(), 0, 'closing releases material filters');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.evaluate(() => {
        document.getElementById('lit-dialog').open = true;
      });
      await panel.waitFor({ state: 'visible' });
      const comparisons = [];
      for (const [index, encoded] of frames.entries()) {
        const pose = await page.evaluate(async (data) => {
          const image = new Image();
          image.src = `data:image/png;base64,${data}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);
          const marker = context.getImageData(10, 10, 1, 1).data;
          return { progress: (marker[0] * 256 + marker[1]) / 65535, phase: marker[2] };
        }, encoded);
        if (pose.progress < 0.025 || pose.progress > 0.995 || ![198, 199].includes(pose.phase))
          continue;
        await panel.evaluate((plane, progress) => {
          plane.dataset.motion = 'opening';
          plane.style.setProperty('--_lab-dialog-reveal', String(progress));
        }, pose.progress);
        // The reference must finish publication even under the old async renderer.
        await page.waitForTimeout(80);
        const reference = (await page.screenshot({ scale: 'css' })).toString('base64');
        const comparison = await compareRim(page, encoded, reference, full, pose.progress);
        comparisons.push({ frame: index, ...pose, ...comparison });
        if (comparison.max > 2 || comparisons.length === 1) {
          await writeFile(
            resolve(output, `glass-live-${dpr}-${index}.png`),
            Buffer.from(encoded, 'base64'),
          );
          await writeFile(
            resolve(output, `glass-reference-${dpr}-${index}.png`),
            Buffer.from(reference, 'base64'),
          );
        }
      }
      const report = { dpr, frames: frames.length, comparisons };
      await writeFile(
        resolve(output, `glass-live-${dpr}.json`),
        `${JSON.stringify(report, null, 2)}\n`,
      );
      assert.ok(
        comparisons.some((frame) => frame.phase === 199 && frame.progress < 0.8),
        'cold opening supplies early optical frames',
      );
      assert.ok(
        comparisons.some((frame) => frame.phase === 198),
        'ordinary exit supplies optical frames',
      );
      assert.ok(
        comparisons.every((frame) => frame.count > 0 && frame.max <= 2),
        `live Glass matches its current shape at DPR ${dpr}: ${JSON.stringify(comparisons)}`,
      );
      assert.deepEqual(errors, []);
      results.push({
        engine: 'chromium',
        dpr,
        liveGlass: 'qualified',
        comparedFrames: comparisons.length,
        maxError: Math.max(...comparisons.map((frame) => frame.max)),
      });
    } finally {
      await page.close();
    }
  }
  return results;
}

async function compareRim(page, actual, reference, full, progress) {
  return page.evaluate(
    async ({ actual, reference, full, progress }) => {
      const load = async (data) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return context;
      };
      const a = await load(actual);
      const b = await load(reference);
      const height = full.height * progress;
      const radius = Math.min(24, height / 2);
      let max = 0;
      let count = 0;
      for (let y = 3; y < Math.min(52, height - 3); y++)
        for (let x = 3; x < 52; x++) {
          const cx = Math.max(radius - x, 0);
          const cy = Math.max(radius - y, y - (height - radius), 0);
          if (cx * cx + cy * cy > (radius - 2) ** 2) continue;
          // Both captures use CSS-pixel output at the same device-pixel density.
          const sample = (context) =>
            context.getImageData(
              Math.round(((full.x + x) * context.canvas.width) / 960),
              Math.round(((full.y + y) * context.canvas.width) / 960),
              1,
              1,
            ).data;
          const one = sample(a);
          const two = sample(b);
          for (let channel = 0; channel < 3; channel++) {
            max = Math.max(max, Math.abs(one[channel] - two[channel]));
            count++;
          }
        }
      return { max, count };
    },
    { actual, reference, full, progress },
  );
}
