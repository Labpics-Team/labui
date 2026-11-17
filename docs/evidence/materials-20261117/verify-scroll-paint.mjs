import assert from 'node:assert/strict';
import { displayPixels } from './display-pixels.mjs';

/** Exercise the installed renderer without depending on snapshot backdrop
 * support: an opaque author paint must cover the scroller in every renderer.
 * A plain peer gives the independent layout and scroll-extent reference.
 */
export async function verifyScrollPaint(page, origin, browser, display) {
  const rows = [];
  const flows = {
    block: 'display:block',
    'flex-column': 'display:flex;flex-direction:column;gap:14px',
    'flex-row': 'display:flex;flex-direction:row;gap:14px',
    grid: 'display:grid;grid-template-columns:repeat(2,max-content);gap:14px',
    rtl: 'direction:rtl',
    'row-reverse': 'display:flex;flex-direction:row-reverse;gap:14px',
    'column-reverse': 'display:flex;flex-direction:column-reverse;gap:14px',
    'vertical-rl': 'writing-mode:vertical-rl',
    'vertical-lr': 'writing-mode:vertical-lr',
    'rtl-row-reverse': 'display:flex;direction:rtl;flex-direction:row-reverse',
    'vertical-rl-column-reverse':
      'display:flex;writing-mode:vertical-rl;flex-direction:column-reverse',
    'wrap-reverse': 'display:flex;flex-wrap:wrap-reverse',
  };
  for (const [layout, flow] of Object.entries(flows)) {
    await page.goto(origin);
    await page.evaluate(async (flow) => {
      const nativeResize = window.ResizeObserver;
      const nativeMutation = window.MutationObserver;
      const resizes = new Map();
      const mutations = new Map();
      window.ResizeObserver = class extends nativeResize {
        observe(target, options) {
          if (!resizes.has(this)) resizes.set(this, new Set());
          resizes.get(this).add(target);
          super.observe(target, options);
        }
        unobserve(target) {
          resizes.get(this)?.delete(target);
          super.unobserve(target);
        }
        disconnect() {
          resizes.delete(this);
          super.disconnect();
        }
      };
      window.MutationObserver = class extends nativeMutation {
        observe(target, options) {
          if (!mutations.has(this)) mutations.set(this, new Set());
          mutations.get(this).add(target);
          super.observe(target, options);
        }
        disconnect() {
          mutations.delete(this);
          super.disconnect();
        }
      };
      window.scrollPaintObservers = () => ({
        resize: [...resizes.values()].reduce((n, values) => n + values.size, 0),
        mutation: [...mutations.values()].reduce((n, values) => n + values.size, 0),
      });
      const style = document.createElement('style');
      style.textContent = `body{margin:0;background:rgb(0 40 160)}.host{position:relative;width:200px;height:120px;overflow:auto;border-radius:0;transform:translateZ(0);${flow};--_tint:rgb(255 255 255);--_blend:rgb(0 0 0 / 0);--_acrylic-noise:none;--_backdrop-blur:1px;--_rim:none}.content{width:300px;height:300px;flex:none}.peer{position:fixed;left:-1000px;top:0}.marker{position:fixed;left:16px;top:16px;width:8px;height:8px;background:rgb(7 251 137);z-index:2147483647;pointer-events:none}`;
      document.head.append(style);
      const host = document.createElement('div');
      host.id = 'scroll-host';
      host.className = 'host';
      host.innerHTML = '<div class="content"></div><div class="content"></div>';
      const peer = host.cloneNode(true);
      peer.id = 'scroll-peer';
      peer.classList.add('peer');
      document.body.append(host, peer);
      host.classList.add('lab-material', 'lab-material--soft');
      const marker = document.createElement('div');
      marker.className = 'marker';
      document.body.append(marker);
      const runtime = await import('/runtime.js');
      window.stopScrollPaint = runtime.mountMaterialRuntime(host);
    }, flow);
    const settle = async () => {
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      if (display) await page.waitForTimeout(150);
    };
    await settle();
    const measure = async (stage) => {
      const result = await page.evaluate(() => {
        const host = document.getElementById('scroll-host');
        const peer = document.getElementById('scroll-peer');
        const rect = host.getBoundingClientRect();
        const capture = host.querySelector('.lab-material__paint');
        const cap = capture?.getBoundingClientRect();
        const offsets = (node) => {
          const root = node.getBoundingClientRect();
          return Array.from(node.querySelectorAll(':scope > .content')).map((child) => {
            const r = child.getBoundingClientRect();
            return [r.x - root.x, r.y - root.y, r.width, r.height];
          });
        };
        return {
          actual: [host.scrollWidth, host.scrollHeight],
          expected: [peer.scrollWidth, peer.scrollHeight],
          contentLayout: offsets(host),
          peerLayout: offsets(peer),
          capture: cap
            ? [
                cap.x - rect.x - host.clientLeft,
                cap.y - rect.y - host.clientTop,
                cap.width,
                cap.height,
              ]
            : null,
          viewport: [host.clientWidth, host.clientHeight],
          scroll: [host.scrollLeft, host.scrollTop],
          peerScroll: [peer.scrollLeft, peer.scrollTop],
          runway: !!host.querySelector('.lab-material__paint-runway'),
          observers: window.scrollPaintObservers(),
        };
      });
      assert.deepEqual(
        result.actual,
        result.expected,
        `${browser}/${layout}/${stage}: scroll extent`,
      );
      assert.deepEqual(
        result.contentLayout,
        result.peerLayout,
        `${browser}/${layout}/${stage}: content placement and gaps`,
      );
      if (result.capture) {
        assert(
          Math.abs(result.capture[0]) < 1 && Math.abs(result.capture[1]) < 1,
          `${browser}/${layout}/${stage}: capture stays at viewport origin ${result.capture}`,
        );
        assert(result.capture[2] >= result.viewport[0] && result.capture[3] >= result.viewport[1]);
      }
      let pixels;
      if (display) pixels = await displayPixels(page, [50, 150]);
      else {
        const image = (await page.screenshot()).toString('base64');
        pixels = await page.evaluate(async (base64) => {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);
          return [50, 150].map((x) => Array.from(context.getImageData(x, 50, 1, 1).data));
        }, image);
      }
      for (const rgb of pixels)
        assert(
          rgb.slice(0, 3).every((c) => c >= 254),
          `${browser}/${layout}/${stage}: opaque paint remains visible ${rgb}`,
        );
      const row = { browser, layout, stage, ...result, pixels };
      rows.push(row);
      console.info(`MATERIAL_SCROLL_ROW=${JSON.stringify(row)}`);
    };
    await measure('before');
    const mutationCount = await page.evaluate(async () => {
      const host = document.getElementById('scroll-host');
      const peer = document.getElementById('scroll-peer');
      let count = 0;
      const watch = new MutationObserver((records) => {
        count += records.length;
      });
      for (const node of host.querySelectorAll('.lab-material__paint-runway,.lab-material__paint'))
        watch.observe(node, { attributes: true, childList: true, subtree: true });
      for (let i = 0; i < 20; i++) {
        host.scrollTo((i - 10) * 20, (i - 10) * 20);
        peer.scrollTo((i - 10) * 20, (i - 10) * 20);
        await new Promise(requestAnimationFrame);
      }
      host.scrollTo(200, 200);
      peer.scrollTo(200, 200);
      await new Promise(requestAnimationFrame);
      watch.disconnect();
      return count;
    });
    assert.equal(mutationCount, 0, `${browser}/${layout}: scrolling does not mutate captures`);
    await settle();
    await measure('scrolled-both-axes');
    for (const [stage, size] of [
      ['grown', 600],
      ['shrunk', 20],
      ['regrown', 450],
    ]) {
      await page.evaluate((size) => {
        for (const child of document.querySelectorAll('.content')) {
          child.style.width = `${size}px`;
          child.style.height = `${size}px`;
        }
      }, size);
      await settle();
      await measure(stage);
    }
    await page.evaluate(() => {
      for (const host of document.querySelectorAll('.host')) {
        host.style.boxSizing = 'border-box';
        host.style.width = '210px';
        host.style.height = '130px';
        host.style.padding = '7px 11px 13px 17px';
        host.style.border = '3px solid transparent';
        host.scrollTo(200, 200);
      }
    });
    await settle();
    await measure('padded-border-scrolled');
    await page.evaluate(() => {
      for (const host of document.querySelectorAll('.host')) host.scrollTo(1e6, 1e6);
    });
    await settle();
    await measure('padded-border-end');
    await page.evaluate(() => {
      for (const child of document.querySelectorAll('.content')) {
        child.style.width = '450px';
        child.style.height = '450px';
        child.style.setProperty('--scroll-probe', '1');
      }
    });
    await settle();
    await measure('restyled-at-end');
    await page.evaluate(() => {
      for (const host of document.querySelectorAll('.host')) host.scrollTo(-1e6, -1e6);
    });
    await settle();
    await measure('negative-end');
    await page.evaluate(() => window.stopScrollPaint());
    assert.equal(
      await page
        .locator('.lab-material__paint,.lab-material__paint-runway,.lab-material-paint-defs')
        .count(),
      0,
    );
    assert.deepEqual(
      await page.evaluate(() => window.scrollPaintObservers()),
      { resize: 0, mutation: 0 },
      `${browser}/${layout}: all observers released`,
    );
    const disposed = {
      browser,
      layout,
      stage: 'disposed',
      scrollMutations: mutationCount,
      observations: 0,
      nodes: 0,
    };
    rows.push(disposed);
    console.info(`MATERIAL_SCROLL_ROW=${JSON.stringify(disposed)}`);
  }
  return rows;
}
