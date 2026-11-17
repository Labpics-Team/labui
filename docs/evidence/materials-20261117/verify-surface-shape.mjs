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
      'body{margin:0;background:white}#card{margin:20px 40px;width:240px;height:180px;border-radius:32px;--lab-material-shadow:0 8px 16px rgb(0 0 0 / .2);--lab-surface-stroke-width:1px;--lab-surface-stroke-color:red}#image{position:absolute;inset:var(--lab-contour-inset);background:rgb(20 100 200);clip-path:var(--lab-contour-clip);z-index:-2}#solid{position:absolute;inset:auto 0 0;height:80px;background:white;z-index:1}#button{position:absolute;left:-20px;top:50px;width:60px;height:30px;background:white}';
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
  await page.evaluate(() => {
    const card = document.querySelector('#card');
    card.style.width = '200.25px';
    card.style.height = '160.25px';
    card.style.border = '10px solid transparent';
    card.style.transform = 'translate(7px, 9px) scale(1.25)';
    window.shapeHandle.refresh();
  });
  await settle();
  const borderBox = await page.evaluate(() => {
    const card = document.querySelector('#card').getBoundingClientRect();
    const rect = (selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return [r.x - card.x, r.y - card.y, r.width, r.height];
    };
    const svg = document.querySelector('.lab-material__contour-stroke svg');
    return {
      host: [card.width, card.height],
      contour: rect('.lab-material__contour'),
      stroke: rect('.lab-material__contour-stroke'),
      image: rect('#image'),
      localSvg: [Number(svg.getAttribute('width')), Number(svg.getAttribute('height'))],
    };
  });
  assert.deepEqual(borderBox.localSvg, [220.25, 180.25]);
  for (const kind of ['contour', 'stroke', 'image'])
    assert.deepEqual(borderBox[kind], [0, 0, ...borderBox.host], `${browser}: ${kind} border box`);
  // A stylesheet can resize the border box while the content box is unchanged.
  // There is no API refresh or mutation on the component to rescue a wrong RO box.
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '#card { border-width:20px !important }';
    document.head.append(style);
  });
  await page.waitForFunction(
    () =>
      document.querySelector('.lab-material__contour-stroke svg').getAttribute('width') ===
      '240.25',
  );
  await page.evaluate(() => {
    const card = document.querySelector('#card');
    card.style.setProperty('--lab-surface-stroke-width', 'initial');
    card.style.setProperty('--lab-surface-stroke-color', 'initial');
    window.shapeHandle.refresh();
  });
  assert.equal(
    await page.locator('.lab-material__contour-stroke').count(),
    0,
    `${browser}: an omitted stroke stays absent`,
  );
  await page.evaluate(() => window.shapeHandle.destroy());
  await settle();
  const disposed = await page.evaluate(() => ({
    observers: window.shapeObservers(),
    defs: document.querySelectorAll('.lab-material-contour-defs,.lab-material__contour').length,
    position: document.querySelector('#card').style.position,
    clip: document.querySelector('#card').style.getPropertyValue('--lab-contour-clip'),
  }));
  assert.deepEqual(disposed, { observers: 0, defs: 0, position: '', clip: '' });
  const shadowPixels = await verifyShadowPixels(page, origin, browser);
  const result = {
    browser,
    retained: true,
    hostUnclipped: true,
    overflowInteractive: true,
    foregroundStroke: bottom,
    shadowStack: 2,
    borderBox,
    borderOnlyResize: true,
    shadowPixels,
    disposed,
  };
  console.info(`MATERIAL_SHAPE_ROW=${JSON.stringify(result)}`);
  return result;
}

/** The zero-smoothing limit has an independent native CSS reference. Compare
 * flat 3×3 interiors so engine-specific edge antialiasing is not a false failure. */
async function verifyShadowPixels(page, origin, browser) {
  const cases = [
    ['outer-spread', '0 0 0 10px red', '0'],
    ['outer-negative-offset', '20px 10px 0 -10px red', '0'],
    ['inner-spread', 'inset 0 0 0 10px red', '0'],
    ['inner-negative-offset', 'inset 30px 20px 0 -10px red', '0'],
    ['inner-border', 'inset 10px 8px 0 5px red', '4px 8px 12px 16px'],
    ['parallel-layers', '0 0 0 10px red, 8px 12px 0 16px blue', '0'],
    ['asymmetric-inner-spread', 'inset 20px 10px 0 20px red', '0', true],
    ['asymmetric-inner-contract', 'inset 0 0 0 40px red', '0', true],
  ];
  const results = [];
  for (const [name, shadow, borders, asymmetric] of cases) {
    await page.goto(origin);
    await page.evaluate(
      ({ shadow, borders, asymmetric }) => {
        document.body.innerHTML = '<div id="subject"></div>';
        const style = document.createElement('style');
        style.textContent = `body{margin:0;background:white}#subject{position:absolute;left:50px;top:50px;width:200px;height:160px;border-radius:40px;border-style:solid;border-color:transparent;border-width:${borders};box-shadow:${shadow};--lab-material-shadow:${shadow}}`;
        if (asymmetric)
          style.textContent += '#subject{width:100px;height:140px;border-radius:0 100px 0 0}';
        document.head.append(style);
      },
      { shadow, borders, asymmetric },
    );
    const reference = decodePng(await page.screenshot());
    await page.evaluate(async () => {
      const api = await import('/runtime.js');
      window.testShadow = api.mountSurfaceShape(document.querySelector('#subject'), {
        smoothing: 0.000001,
      });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    const actual = decodePng(await page.screenshot());
    let checked = 0;
    let painted = 0;
    let mismatches = 0;
    let first;
    for (let y = 1; y < reference.height - 1; y++)
      for (let x = 1; x < reference.width - 1; x++) {
        const at = (y * reference.width + x) * 3;
        let flat = true;
        for (let dy = -1; dy <= 1 && flat; dy++)
          for (let dx = -1; dx <= 1 && flat; dx++)
            for (let channel = 0; channel < 3; channel++)
              if (
                reference.rgb[at + channel] !==
                reference.rgb[((y + dy) * reference.width + x + dx) * 3 + channel]
              )
                flat = false;
        if (!flat) continue;
        checked++;
        if (
          reference.rgb[at] !== 255 ||
          reference.rgb[at + 1] !== 255 ||
          reference.rgb[at + 2] !== 255
        )
          painted++;
        if ([0, 1, 2].some((c) => Math.abs(reference.rgb[at + c] - actual.rgb[at + c]) > 5)) {
          mismatches++;
          first ??= [x, y];
        }
      }
    assert(painted > 50, `${browser}/${name}: native reference contains a visible shadow`);
    assert.equal(mismatches, 0, `${browser}/${name}: stable shadow pixels differ, first=${first}`);
    results.push({ name, checked, painted, mismatches });
    await page.evaluate(() => window.testShadow.destroy());
  }
  return results;
}
