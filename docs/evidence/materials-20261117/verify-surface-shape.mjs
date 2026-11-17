import assert from 'node:assert/strict';
import { decodePng } from '../../../packages/colors/test/fx-render/fx-render.mjs';

/** The public component port is independent of material mode or global mounting. */
export async function verifySurfaceShape(page, origin, browser) {
  await page.goto(origin);
  await page.evaluate(async () => {
    const NativeResize = ResizeObserver;
    const active = new Set();
    window.ResizeObserver = class extends NativeResize {
      observe(el, options) {
        active.add(this);
        super.observe(el, options);
      }
      disconnect() {
        active.delete(this);
        super.disconnect();
      }
    };
    window.shapeObservers = () => active.size;
    const style = document.createElement('style');
    style.textContent =
      'body{margin:0;background:white}#card{margin:20px 40px;width:240px;height:180px;border-radius:32px;--lab-material-shadow:0 8px 16px rgb(0 0 0 / .2);--lab-surface-stroke-width:1px;--lab-surface-stroke-color:red}#image{position:absolute;inset:0;background:rgb(20 100 200);clip-path:var(--lab-contour-clip);z-index:-2}#solid{position:absolute;inset:auto 0 0;height:80px;background:white;z-index:1}#button{position:absolute;left:-20px;top:50px;width:60px;height:30px;background:white}';
    document.head.append(style);
    document.body.innerHTML =
      '<div id="card"><div id="image"></div><div id="solid"></div><button id="button">Open</button></div>';
    const api = await import('/runtime.js');
    window.shapeHandle = api.mountSurfaceShape(document.querySelector('#card'), { smoothing: 0.6 });
  });
  const settle = () =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await settle();
  const initial = await page.evaluate(() => {
    const el = document.querySelector('#card');
    const css = getComputedStyle(el);
    const path = document.querySelector('clipPath path');
    window.originalShapePath = path;
    return {
      material: el.classList.contains('lab-material'),
      clip: css.clipPath,
      mask: css.maskImage,
      filter: css.filter,
      opacity: css.opacity,
      imageClip: getComputedStyle(document.querySelector('#image')).clipPath,
      path: path.getAttribute('d'),
      shadowPaths: Array.from(el.querySelectorAll('svg path')).map((n) => n.getAttribute('d')),
      hit: document.elementFromPoint(30, 80)?.id,
      observers: window.shapeObservers(),
    };
  });
  assert.equal(initial.material, false);
  for (const field of ['clip', 'mask', 'filter'])
    assert.equal(initial[field], 'none', `${browser}: host ${field}`);
  assert.equal(initial.opacity, '1');
  assert.match(initial.imageClip, /url\(/);
  assert(
    initial.shadowPaths.every((p) => p === initial.path),
    `${browser}: shadow uses the shared path`,
  );
  assert.equal(initial.hit, 'button', `${browser}: overflow content remains interactive`);
  assert.equal(initial.observers, 1);
  const png = decodePng(await page.screenshot());
  const bottom = [...png.rgb.slice((199 * png.width + 160) * 3, (199 * png.width + 160) * 3 + 3)];
  assert.deepEqual(bottom, [255, 0, 0], `${browser}: the inside stroke stays above opaque content`);
  await page.evaluate(() => {
    const card = document.querySelector('#card');
    card.style.width = '400px';
    card.style.height = '220px';
    card.style.borderRadius = '0 0 16px 16px';
    card.style.setProperty(
      '--lab-material-shadow',
      '0 10px 20px rgb(100 0 0 / .3), 0 2px 3px rgb(0 0 0 / .2)',
    );
    window.shapeHandle.refresh();
  });
  await settle();
  const resized = await page.evaluate(() => {
    const path = document.querySelector('clipPath path');
    return {
      retained: path === window.originalShapePath,
      path: path.getAttribute('d'),
      shadows: document.querySelectorAll(
        '.lab-material__contour-shadow:not(.lab-material__contour-shadow--inset) feFlood',
      ).length,
      hostClip: getComputedStyle(document.querySelector('#card')).clipPath,
    };
  });
  assert.equal(resized.retained, true);
  assert.notEqual(resized.path, initial.path);
  assert.equal(resized.shadows, 2);
  assert.equal(resized.hostClip, 'none');
  const relative = await page.evaluate(() => {
    const card = document.querySelector('#card');
    card.style.setProperty('--lab-material-shadow', '0 .5rem 1rem currentColor');
    card.style.setProperty('--lab-surface-stroke-color', 'currentColor');
    card.style.color = 'rgb(0, 128, 0)';
    document.documentElement.style.fontSize = '24px';
    window.shapeHandle.refresh();
    return {
      dy: document.querySelector('.lab-material__contour-shadow feOffset').getAttribute('dy'),
      sigma: document
        .querySelector('.lab-material__contour-shadow feGaussianBlur')
        .getAttribute('stdDeviation'),
      stroke: document.querySelector('.lab-material__contour-stroke path').getAttribute('stroke'),
    };
  });
  assert.deepEqual(relative, { dy: '12', sigma: '12', stroke: 'rgb(0, 128, 0)' });
  await page.evaluate(() => window.shapeHandle.destroy());
  await settle();
  const disposed = await page.evaluate(() => ({
    observers: window.shapeObservers(),
    defs: document.querySelectorAll('.lab-material-contour-defs,.lab-material__contour').length,
    position: document.querySelector('#card').style.position,
    clip: document.querySelector('#card').style.getPropertyValue('--lab-contour-clip'),
  }));
  assert.deepEqual(disposed, { observers: 0, defs: 0, position: '', clip: '' });
  const result = {
    browser,
    retained: true,
    hostUnclipped: true,
    overflowInteractive: true,
    foregroundStroke: bottom,
    shadowStack: 2,
    disposed,
  };
  console.info(`MATERIAL_SHAPE_ROW=${JSON.stringify(result)}`);
  return result;
}
