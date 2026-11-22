import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from '@playwright/test';
import { build } from 'vite';
import { displayPixels } from '../../../docs/evidence/materials-20261117/display-pixels.mjs';
import { liveDialogOptics } from './dialog-motion-live.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const display = process.env.MATERIAL_CAPTURE === 'display';
if (display && !process.env.CI) throw new Error('Display capture runs only in isolated CI');
const output = process.env.MATERIAL_OUTPUT
  ? resolve(process.env.MATERIAL_OUTPUT, 'dialog-motion', display ? 'display' : 'snapshot')
  : resolve(root, 'docs/evidence/dialog-motion-20261120');
await mkdir(output, { recursive: true });
const built = await build({
  configFile: false,
  root: resolve(root, 'apps/docs/src'),
  logLevel: 'error',
  build: {
    write: false,
    rollupOptions: { input: resolve(root, 'apps/docs/src/_fixtures/dialog-family.html') },
  },
});
const assets = new Map(
  built.output.map((f) => [`/${f.fileName}`, f.type === 'chunk' ? f.code : f.source]),
);
const html = [...assets.keys()].find((p) => p.endsWith('.html'));
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const asset = assets.get(path === '/' ? html : path);
  if (asset === undefined) return res.writeHead(404).end();
  res.setHeader(
    'content-type',
    path.endsWith('.js')
      ? 'text/javascript'
      : path.endsWith('.css')
        ? 'text/css'
        : path.endsWith('.woff2')
          ? 'font/woff2'
          : 'text/html',
  );
  res.end(asset);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}`;
const rows = [];
const delta = (a, b) =>
  Math.max(...a.flatMap((rgb, i) => rgb.map((v, c) => Math.abs(v - b[i][c]))));
async function paint(page) {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  if (display) await page.waitForTimeout(250);
}
async function pixels(page, png, points) {
  if (display) return (await displayPixels(page, points)).map((rgb) => rgb.slice(0, 3));
  return page.evaluate(
    async ({ base64, points }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return points.map(({ x, y }) =>
        Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3),
      );
    },
    { base64: png.toString('base64'), points },
  );
}
async function progress(panel, value) {
  await panel.evaluate((el, value) => {
    el.dataset.motion = 'opening';
    el.style.setProperty('--_lab-dialog-reveal', String(value));
  }, value);
}
async function staticMaterialReference(page, panel, points) {
  await panel.evaluate((plane) => {
    const material = plane.querySelector('.lab-dialog-material');
    const box = material.getBoundingClientRect();
    const reference = material.cloneNode(true);
    reference.id = 'dialog-motion-reference';
    reference.setAttribute('popover', 'manual');
    Object.assign(reference.style, {
      position: 'fixed',
      inset: 'auto',
      left: `${box.x}px`,
      top: `${box.y}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      margin: '0',
      padding: '0',
      border: '0',
      maxWidth: 'none',
      maxHeight: 'none',
      overflow: 'visible',
      boxSizing: 'border-box',
    });
    plane.parentNode.append(reference);
    plane.style.visibility = 'hidden';
    reference.showPopover();
  });
  await paint(page);
  const result = await pixels(page, await page.screenshot(), points);
  await panel.evaluate((plane) => {
    plane.parentNode.querySelector('#dialog-motion-reference').remove();
    plane.style.removeProperty('visibility');
  });
  await paint(page);
  return result;
}
async function nestedReactMotion(page, engine) {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lab-motion-entrance-duration', '600ms');
  });
  await page.getByRole('button', { name: 'React dialog', exact: true }).click();
  const outer = page.locator('#react > .lab-dialog-plane').filter({
    has: page.getByLabel('React dialog draft'),
  });
  await outer.evaluate(
    (plane) =>
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('React dialog did not settle')), 3000);
        const frame = () => {
          if (plane.dataset.motion !== 'settled') return requestAnimationFrame(frame);
          clearTimeout(timeout);
          resolve();
        };
        frame();
      }),
  );
  await page.getByRole('button', { name: 'React nested popover', exact: true }).click();
  const nested = outer.locator('.lab-dialog-plane').filter({
    has: page.getByLabel('React nested draft'),
  });
  const result = await nested.evaluate(
    (plane) =>
      new Promise((resolve, reject) => {
        const positioner = plane.querySelector(':scope > .lab-popover-positioner');
        const stage = positioner.querySelector(':scope > .lab-dialog-stage');
        const material = stage.querySelector(':scope > .lab-dialog-material');
        const reveal = stage.querySelector(':scope > .lab-dialog-reveal');
        const content = reveal.querySelector(':scope > .lab-dialog-content');
        const outer = plane.parentElement.closest('.lab-dialog-plane');
        const frames = [];
        const timeout = setTimeout(
          () => reject(new Error('Nested React popover did not settle')),
          3000,
        );
        const frame = () => {
          const value = Number.parseFloat(
            getComputedStyle(plane).getPropertyValue('--_lab-dialog-reveal'),
          );
          if (value > 0.15 && value < 0.85) {
            const side = positioner.dataset.side;
            const box = content.getBoundingClientRect();
            const clip = reveal.getBoundingClientRect();
            const visible = material.getBoundingClientRect();
            const horizontal = side === 'left' || side === 'right';
            // Probe the middle of the unrevealed area, safely away from rounded edges.
            const x = horizontal
              ? side === 'left'
                ? (box.left + visible.left) / 2
                : (visible.right + box.right) / 2
              : box.left + box.width / 2;
            const y = horizontal
              ? box.top + box.height / 2
              : side === 'top'
                ? (box.top + visible.top) / 2
                : (visible.bottom + box.bottom) / 2;
            frames.push({
              value,
              side,
              outerMotion: outer.dataset.motion,
              motion: plane.dataset.motion,
              overflow: getComputedStyle(reveal).overflow,
              revealTransform: getComputedStyle(reveal).transform,
              contentTransform: getComputedStyle(content).transform,
              content: { x: box.x, y: box.y, width: box.width, height: box.height },
              clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height },
              material: {
                x: visible.x,
                y: visible.y,
                width: visible.width,
                height: visible.height,
              },
              hitsUnrevealedContent: content.contains(document.elementFromPoint(x, y)),
              hitsRevealedContent: content.contains(
                document.elementFromPoint(
                  visible.left + visible.width / 2,
                  visible.top + visible.height / 2,
                ),
              ),
            });
          }
          if (plane.dataset.motion !== 'settled') return requestAnimationFrame(frame);
          clearTimeout(timeout);
          const box = content.getBoundingClientRect();
          resolve({ frames, full: { x: box.x, y: box.y, width: box.width, height: box.height } });
        };
        frame();
      }),
  );
  assert.ok(result.frames.length > 1, `${engine}: nested React opening has intermediate frames`);
  for (const frame of result.frames) {
    const context = `${engine}: nested React opening at ${frame.value}`;
    assert.equal(frame.outerMotion, 'settled', context);
    assert.equal(frame.motion, 'opening', context);
    assert.equal(
      frame.overflow,
      'clip',
      `${context}: the settled parent preserves nested clipping`,
    );
    assert.notEqual(frame.revealTransform, 'none', `${context}: nested reveal is active`);
    assert.notEqual(
      frame.contentTransform,
      'none',
      `${context}: nested content counter-transform is active`,
    );
    for (const key of ['x', 'y', 'width', 'height']) {
      assert.ok(
        Math.abs(frame.clip[key] - frame.material[key]) < 0.15,
        `${context}: the content clip follows the material ${key}`,
      );
      assert.ok(
        Math.abs(frame.content[key] - result.full[key]) < 0.15,
        `${context}: content remains full-size at ${key}`,
      );
    }
    assert.equal(
      frame.hitsUnrevealedContent,
      false,
      `${context}: content is clipped outside the material`,
    );
    assert.equal(
      frame.hitsRevealedContent,
      true,
      `${context}: revealed content remains interactive`,
    );
  }
  assert.equal(await page.getByLabel('React nested draft').inputValue(), 'Nested');
  return { engine, nestedReact: 'clipped', intermediateFrames: result.frames.length };
}
async function nestedPlacementScope(page, engine) {
  const measurements = await page.evaluate(() => {
    // A small layout fixture isolates inherited placement selectors from runtime
    // positioning. Every inner stage must follow its own side, including Dialog.
    const fixture = document.createElement('div');
    fixture.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none';
    fixture.innerHTML =
      '<div class="lab-popover-positioner" style="position:relative;width:240px">' +
      '<div class="lab-dialog-stage" style="width:240px">' +
      '<div class="lab-dialog-plane" open style="position:relative;width:200px;height:120px;--_lab-dialog-reveal:.5">' +
      '<div style="position:relative;display:block;inset:auto;padding:0;width:200px;height:120px">' +
      '<div class="lab-dialog-stage" style="width:200px;height:120px">' +
      '<div class="lab-dialog-material"></div></div></div></div></div></div>';
    document.body.append(fixture);
    const outer = fixture.firstElementChild;
    const inner = fixture.querySelector('.lab-dialog-plane').firstElementChild;
    const stage = inner.firstElementChild;
    const material = stage.firstElementChild;
    const measurements = [];
    try {
      for (const outerSide of ['top', 'right', 'bottom', 'left'])
        for (const innerSide of ['top', 'right', 'bottom', 'left', 'dialog']) {
          outer.dataset.side = outerSide;
          inner.className =
            innerSide === 'dialog' ? 'lab-dialog-positioner' : 'lab-popover-positioner';
          if (innerSide === 'dialog') delete inner.dataset.side;
          else inner.dataset.side = innerSide;
          const full = stage.getBoundingClientRect();
          const half = material.getBoundingClientRect();
          measurements.push({
            outerSide,
            innerSide,
            x: half.x - full.x,
            y: half.y - full.y,
            width: half.width,
            height: half.height,
          });
        }
      return measurements;
    } finally {
      fixture.remove();
    }
  });
  for (const sample of measurements) {
    const horizontal = sample.innerSide === 'left' || sample.innerSide === 'right';
    const expected = {
      x: sample.innerSide === 'left' ? 100 : 0,
      y: sample.innerSide === 'top' ? 60 : 0,
      width: horizontal ? 100 : 200,
      height: horizontal ? 120 : 60,
    };
    for (const key of Object.keys(expected))
      assert.ok(
        Math.abs(sample[key] - expected[key]) < 0.1,
        `${engine}: ${sample.outerSide} parent must preserve ${sample.innerSide} child ${key}: ${sample[key]} != ${expected[key]}`,
      );
  }
  return { engine, nestedPlacement: 'isolated', combinations: measurements.length };
}
try {
  for (const engine of (
    process.env.MATERIAL_BROWSERS ?? (display ? 'chromium,firefox,webkit' : 'chromium,webkit')
  ).split(',')) {
    const launcher = { chromium, firefox, webkit }[engine];
    const browser = await launcher.launch({
      headless: !display,
      ...(engine === 'chromium' ? { channel: 'chromium' } : {}),
    });
    try {
      for (const theme of ['light', 'dark'])
        for (const material of ['acrylic', 'glass']) {
          const page = await browser.newPage({
            viewport: { width: 960, height: 600 },
            reducedMotion: 'reduce',
          });
          const errors = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await page.goto(url);
          await page.evaluate(() => document.fonts.ready);
          await page.evaluate(
            ({ theme, material }) => {
              document.documentElement.dataset.theme = theme;
              document.documentElement.dataset.material = material;
              document.body.style.background =
                'repeating-linear-gradient(90deg,#101010 0 8px,#eeeeee 8px 16px)';
              const dialog = document.getElementById('lit-dialog');
              dialog.modal = false;
              dialog.open = true;
              // Keep the oracle's scene controlled: unrelated opaque fixture controls
              // could saturate Elevated's light color-dodge on both backgrounds.
              for (const element of document.body.children)
                if (!element.contains(dialog)) element.style.visibility = 'hidden';
              for (const element of dialog.parentElement.children)
                if (element !== dialog) element.style.visibility = 'hidden';
            },
            { theme, material },
          );
          const panel = page.locator('#lit-dialog .lab-dialog-plane').first();
          const surface = panel.locator('.lab-dialog-content').first();
          await panel.waitFor({ state: 'visible' });
          await paint(page);
          const full = await surface.boundingBox();
          assert.ok((await panel.locator('.lab-dialog-stage').count()) >= 1);
          const points = Array.from({ length: 12 }, (_, i) => ({
            x: Math.round(full.x + 16),
            y: Math.round(full.y + 18 + i),
          }));
          const samples = {};
          for (const value of [1, 0.75, 0.5, 0.25, 0]) {
            await progress(panel, value);
            await paint(page);
            const bounds = await surface.boundingBox();
            const materialBounds = await panel
              .locator('.lab-dialog-material')
              .first()
              .boundingBox();
            if (value > 0)
              assert.ok(
                points.every(
                  ({ x, y }) =>
                    x > materialBounds.x + 1 &&
                    x < materialBounds.x + materialBounds.width - 1 &&
                    y > materialBounds.y + 1 &&
                    y < materialBounds.y + materialBounds.height - 1,
                ),
                `sample points are inside the current material at ${value}`,
              );
            if (value > 0)
              for (const key of ['x', 'y', 'width', 'height'])
                assert.ok(
                  Math.abs(bounds[key] - full[key]) < 0.1,
                  `full-size content ${key} at ${value}`,
                );
            const png = await page.screenshot();
            await writeFile(resolve(output, `${engine}-${theme}-${material}-${value}.png`), png);
            samples[value] = await pixels(page, png, points);
            if (value > 0) {
              const reference = await staticMaterialReference(page, panel, points);
              assert.ok(
                delta(reference, samples[value]) <= 2,
                `${engine} ${theme} ${material}: revealed material differs from static reference at ${value}: ${delta(reference, samples[value])}`,
              );
            }
          }
          assert.ok(delta(samples[1], samples[0]) > 5, 'zero pose is the unobstructed scene');
          for (const value of [0.25, 0.5, 0.75])
            assert.ok(
              delta(samples[value], samples[0]) > 5,
              `the ${value} pose actually paints material at the sampled points`,
            );
          await progress(panel, 0.5);
          await page.evaluate(() => {
            document.body.style.background =
              'repeating-linear-gradient(90deg,#020408 0 8px,#091218 8px 16px)';
          });
          await paint(page);
          const changed = await pixels(page, await page.screenshot(), points);
          await writeFile(
            resolve(output, `${engine}-${theme}-${material}-changed-half.png`),
            await page.screenshot(),
          );
          const changedFull = await staticMaterialReference(page, panel, points);
          assert.ok(
            delta(changedFull, changed) <= 2,
            `intermediate pose samples the current scene ${engine} ${theme} ${material}: ${delta(changedFull, changed)}`,
          );
          // WebKit's screenshot readback does not capture the display compositor's
          // backdrop; actual display qualification is separate from these geometry checks.
          if (display || engine === 'chromium')
            assert.ok(
              delta(changed, samples[0.5]) > 2,
              `scene changes remain visible through the material: ${engine} ${theme} ${material} delta=${delta(changed, samples[0.5])}`,
            );
          assert.deepEqual(errors, []);
          rows.push({
            engine,
            theme,
            material,
            geometry: full,
            optics: display || engine === 'chromium' ? 'qualified' : 'requires-display-compositor',
            liveSceneMaxError: delta(changedFull, changed),
          });
          await page.close();
        }
      const page = await browser.newPage({ viewport: { width: 1000, height: 750 } });
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      const trigger = page.getByRole('button', { name: 'Lit dialog', exact: true });
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--lab-motion-entrance-duration', '600ms');
        document.documentElement.style.setProperty('--lab-motion-exit-duration', '400ms');
      });
      await trigger.click();
      await page.waitForTimeout(48);
      const panel = page.locator('#lit-dialog .lab-dialog-plane').first();
      const read = () =>
        panel.evaluate((el) =>
          Number.parseFloat(getComputedStyle(el).getPropertyValue('--_lab-dialog-reveal')),
        );
      const entering = await read();
      assert.ok(entering > 0 && entering < 1, 'normal entrance has real intermediate frames');
      const closing = await page.evaluate(async () => {
        const dialog = document.getElementById('lit-dialog');
        const plane = dialog.shadowRoot.querySelector('.lab-dialog-plane');
        const before = Number.parseFloat(
          getComputedStyle(plane).getPropertyValue('--_lab-dialog-reveal'),
        );
        dialog.open = false;
        await dialog.updateComplete;
        return {
          before,
          after: Number.parseFloat(
            getComputedStyle(plane).getPropertyValue('--_lab-dialog-reveal'),
          ),
        };
      });
      await page.waitForTimeout(24);
      const exiting = await read();
      assert.ok(
        Math.abs(closing.before - closing.after) < 0.01,
        `exit starts from the visible entrance pose: ${JSON.stringify(closing)}`,
      );
      assert.ok(
        exiting > 0 && exiting < closing.after,
        `exit progresses: ${exiting} from ${closing.after}`,
      );
      const reopen = await page.evaluate(async () => {
        const dialog = document.getElementById('lit-dialog');
        const plane = dialog.shadowRoot.querySelector('.lab-dialog-plane');
        const before = Number.parseFloat(
          getComputedStyle(plane).getPropertyValue('--_lab-dialog-reveal'),
        );
        dialog.open = true;
        await dialog.updateComplete;
        return {
          before,
          after: Number.parseFloat(
            getComputedStyle(plane).getPropertyValue('--_lab-dialog-reveal'),
          ),
        };
      });
      assert.ok(
        Math.abs(reopen.before - reopen.after) < 0.01,
        `reopen never jumps back to the first frame ${JSON.stringify(reopen)}`,
      );
      await page.waitForFunction(
        () =>
          document.getElementById('lit-dialog').shadowRoot.querySelector('.lab-dialog-plane')
            .dataset.motion === 'settled',
      );
      assert.equal(await read(), 1);
      assert.equal(await panel.getAttribute('data-motion'), 'settled');
      assert.equal(await page.getByLabel('Lit dialog draft').inputValue(), 'Draft');
      await page.evaluate(() => {
        document.getElementById('lit-dialog').open = false;
      });
      await page.waitForTimeout(24);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await paint(page);
      assert.equal(
        await panel.evaluate((el) => el.open),
        false,
        'live reduced motion completes exit and releases modality',
      );
      assert.equal(await trigger.evaluate((el) => el.matches(':focus')), true);
      rows.push({ engine, entering, exiting, interruption: 'preserved', reducedMotion: 'settled' });
      for (const side of ['top', 'right', 'bottom', 'left']) {
        await page.evaluate((side) => {
          const local = document.getElementById('local');
          local.style.transform = 'none';
          local.style.overflow = 'visible';
          const popover = document.getElementById('lit-popover');
          const trigger = popover.querySelector('lab-button');
          Object.assign(trigger.style, { position: 'fixed', left: '450px', top: '300px' });
          popover.placement = side;
          popover.open = true;
        }, side);
        const popover = page.locator('#lit-popover .lab-dialog-plane');
        await popover.waitFor({ state: 'visible' });
        await paint(page);
        assert.equal(
          await popover.locator('.lab-popover-positioner').getAttribute('data-side'),
          side,
        );
        const full = await popover.locator('.lab-dialog-material').boundingBox();
        await progress(popover, 0.5);
        await paint(page);
        const half = await popover.locator('.lab-dialog-material').boundingBox();
        const near = (a, b) => assert.ok(Math.abs(a - b) <= 0.1, `${side}: ${a} != ${b}`);
        if (side === 'top' || side === 'bottom') {
          near(half.height, full.height / 2);
          near(half.width, full.width);
          near(half.y, full.y + (side === 'top' ? full.height / 2 : 0));
        } else {
          near(half.width, full.width / 2);
          near(half.height, full.height);
          near(half.x, full.x + (side === 'left' ? full.width / 2 : 0));
        }
        await page.evaluate(() => {
          document.getElementById('lit-popover').open = false;
        });
        await popover.waitFor({ state: 'hidden' });
        rows.push({ engine, side, anchored: 'preserved', full, half });
      }
      await page.close();
      const nestedPage = await browser.newPage({ viewport: { width: 1000, height: 750 } });
      try {
        rows.push(await nestedReactMotion(nestedPage, engine));
        rows.push(await nestedPlacementScope(nestedPage, engine));
      } finally {
        await nestedPage.close();
      }
      if (engine === 'chromium' && !display) {
        rows.push(...(await liveDialogOptics(browser, url, output)));
        for (const material of ['acrylic', 'glass']) {
          const scene = await browser.newPage({
            viewport: { width: 960, height: 600 },
            recordVideo: { dir: output, size: { width: 960, height: 600 } },
          });
          await scene.goto(url);
          await scene.evaluate(() => document.fonts.ready);
          await scene.evaluate((material) => {
            document.documentElement.dataset.material = material;
            document.body.style.background = 'linear-gradient(115deg,#132338,#486589 55%,#c89976)';
            const alert = document.getElementById('lit-alert');
            const content = alert.shadowRoot.querySelector('.lab-dialog-content');
            const samples = [];
            const extents = [];
            const resize = new ResizeObserver((entries) => {
              for (const entry of entries)
                extents.push([entry.contentRect.width, entry.contentRect.height]);
            });
            resize.observe(content);
            let recording = true;
            const sample = (time) => {
              samples.push({ time, filters: alert.shadowRoot.querySelectorAll('filter').length });
              if (recording) requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
            window.finishDialogMeasurement = () => {
              recording = false;
              resize.disconnect();
              return { samples, extents };
            };
          }, material);
          await scene.waitForTimeout(150);
          const beforeOpen = await scene.screenshot();
          await scene.getByRole('button', { name: 'Lit alert', exact: true }).click();
          await scene.waitForTimeout(450);
          await scene.getByRole('button', { name: 'Cancel', exact: true }).click();
          await scene.locator('#lit-alert .lab-dialog-plane').waitFor({ state: 'hidden' });
          await scene.waitForTimeout(100);
          const afterClose = await scene.screenshot();
          const emptyPoints = [320, 480, 640].map((x) => ({ x, y: 400 }));
          assert.deepEqual(
            await pixels(scene, afterClose, emptyPoints),
            await pixels(scene, beforeOpen, emptyPoints),
            'closing returns the panel area to its original scene',
          );
          await writeFile(resolve(output, `dialog-${material}-closed.png`), afterClose);
          // Let the video recorder include the verified final compositor frame.
          await scene.waitForTimeout(100);
          const measured = await scene.evaluate(() => window.finishDialogMeasurement());
          const visibleExtents = measured.extents.filter(
            ([width, height]) => width > 0 && height > 0,
          );
          assert.ok(
            visibleExtents.every(
              ([width, height]) =>
                Math.abs(width - visibleExtents[0][0]) < 0.1 &&
                Math.abs(height - visibleExtents[0][1]) < 0.1,
            ),
            'motion never relays out the text',
          );
          const intervals = measured.samples
            .slice(1)
            .map((s, i) => s.time - measured.samples[i].time)
            .sort((a, b) => a - b);
          rows.push({
            engine,
            material,
            performance: {
              frameCount: measured.samples.length,
              p95FrameMs: intervals[Math.floor(intervals.length * 0.95)],
              peakFilters: Math.max(...measured.samples.map((s) => s.filters)),
              contentExtents: visibleExtents,
            },
          });
          const video = scene.video();
          await scene.close();
          await video.saveAs(resolve(output, `dialog-${material}-normal-speed.webm`));
          await video.delete();
        }
      }
    } finally {
      await browser.close();
    }
  }
  await writeFile(resolve(output, 'web.json'), `${JSON.stringify(rows, null, 2)}\n`);
  console.info(
    'Dialog motion: intermediate optics, live scene, interruption, reduced motion and nested scope PASS',
    rows,
  );
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
