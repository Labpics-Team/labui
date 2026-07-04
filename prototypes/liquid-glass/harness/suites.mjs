/*
 * lg-harness/suites — cache refcount/LRU, scratch lifecycle and the
 * pending-decode regression. See lg-harness.mjs (facade) for the contract.
 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { PROTO_DIR, TYPES, chromium, serveDir } from './common.mjs';

const CACHE_PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script type="module">
  import * as LG from '/liquid-glass.js';
  window.__LG = LG;
  window.__ready = true;
</script>
</body></html>`;

export async function runCacheSuite() {
  const root = PROTO_DIR;
  const server = createServer(async (req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      return res.end(CACHE_PAGE);
    }
    try {
      const full = resolve(root, `.${decodeURIComponent(url)}`);
      if (full !== root && !full.startsWith(root + sep)) return res.writeHead(403).end();
      const data = await readFile(full);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(full)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  const port = await new Promise((r) =>
    server.listen(0, '127.0.0.1', () => r(server.address().port)),
  );

  const browser = await chromium().launch({ headless: true });
  try {
    const page = await browser.newContext({ deviceScaleFactor: 2 }).then((c) => c.newPage());
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__ready && window.__LG?.attach);

    const cases = await page.evaluate(async () => {
      const { attach, __cacheStats } = window.__LG;
      const out = [];
      const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail });

      // Defer feImage decode until we flush — the exact "re-render before decode"
      // condition of the refcount-leak class.
      const RealImage = window.Image;
      let pending = [];
      window.Image = class {
        set src(v) {
          this._src = v;
          pending.push(this);
        }
        get src() {
          return this._src;
        }
      };
      const flush = () => {
        const p = pending;
        pending = [];
        for (const im of p) im.onload?.();
      };

      const mk = (w, h) => {
        const el = document.createElement('div');
        el.style.cssText = `position:absolute;width:${w}px;height:${h}px;border-radius:20px`;
        document.body.appendChild(el);
        return el;
      };

      // CASE 1: refcount-leak class — same-geometry re-render while decoding.
      {
        const el = mk(320, 200);
        const g = attach(el); // acquire (decode DEFERRED)
        g.update({}); // 2nd synchronous render, same geometry, decode pending
        g.update({}); // 3rd — must NOT re-acquire
        const mid = __cacheStats();
        flush();
        g.destroy();
        const after = __cacheStats();
        ok(
          'refcount-leak: live==0 after destroy',
          after.live === 0,
          `mid=${JSON.stringify(mid)} after=${JSON.stringify(after)}`,
        );
        el.remove();
      }

      // CASE 2: cache-HIT class — two instances same geometry share ONE entry.
      {
        const a = mk(512, 384);
        const b = mk(512, 384);
        const ga = attach(a);
        flush();
        const s1 = __cacheStats().size;
        const gb = attach(b);
        flush(); // same geoKey → HIT branch (refs 1->2)
        const s2 = __cacheStats().size;
        ok(
          'cache-hit: size does NOT grow for 2nd same-geo instance',
          s2 === s1,
          `size ${s1} -> ${s2}`,
        );
        ga.destroy();
        flush();
        const liveAfterOne = __cacheStats().live;
        ok(
          'cache-hit: shared entry stays live while 2nd ref held',
          liveAfterOne >= 1,
          `live=${liveAfterOne}`,
        );
        gb.destroy();
        flush();
        a.remove();
        b.remove();
      }

      // CASE 3 + 5: eviction caps zombies at ZOMBIE_CAP; size stays bounded.
      {
        const cap = __cacheStats().zombieCap;
        let maxSize = 0;
        for (let i = 0; i < 40; i++) {
          const el = mk(700 + i * 3, 600 + i * 3); // distinct geoKey each
          const g = attach(el);
          flush();
          g.destroy();
          flush();
          maxSize = Math.max(maxSize, __cacheStats().size);
          el.remove();
        }
        const st = __cacheStats();
        ok(
          'eviction: zombies <= ZOMBIE_CAP',
          st.zombies <= cap,
          `zombies=${st.zombies} cap=${cap}`,
        );
        ok('eviction: no live leaked', st.live === 0, `live=${st.live}`);
        ok(
          'memory-bounded: size stays <= cap + small live set',
          maxSize <= cap + 4,
          `maxSize=${maxSize} cap=${cap}`,
        );
      }

      // CASE 4: LRU revival — resize back to a parked size, zero rebuild.
      {
        const el = mk(901, 803);
        const g = attach(el);
        flush();
        g.destroy();
        flush(); // parks 901x803 as a zombie
        const before = __cacheStats();
        const el2 = mk(901, 803);
        const g2 = attach(el2);
        flush(); // SAME parked geometry → revive, no new entry
        const after = __cacheStats();
        ok(
          'lru-revival: parked geo reused without growing size',
          after.size === before.size,
          `size ${before.size} -> ${after.size}`,
        );
        ok('lru-revival: revived entry is live', after.live === 1, `live=${after.live}`);
        g2.destroy();
        flush();
        el.remove();
        el2.remove();
      }

      window.Image = RealImage;
      return out;
    });

    const pass = cases.every((c) => c.pass);
    return { pass, cases };
  } finally {
    await browser.close();
    server.close();
  }
}

/* ════════════════════════════════════════════════════════════════════════════
 * #1 — pending-decode re-stamp regression (Class B + fault injection).
 *   THE CRITICAL BUG (fixed): render() bumps state.gen each call. A 2nd
 *   same-geometry render fired WHILE the 1st render's displacement map is still
 *   DECODING used to fall into the cheap-restamp branch and `return` with
 *   nothing scheduled; the 1st render's im.onload was then dropped by the
 *   gen-guard → the lens NEVER landed (frost-only until the next geometry
 *   change). The fix added state.pendingMap and RE-ARMS a stamp for the current
 *   gen against the in-flight map in the pending branch.
 *
 *   We reproduce it deterministically with the same deferred-decode window.Image
 *   mock + manual flush the cache suite uses: attach (decode deferred), fire a
 *   2nd update({}) at the SAME geometry BEFORE flushing, THEN flush the decode,
 *   and assert the lens stamped — backdrop-filter ends with url(#id) AND the
 *   filter holds a feImage with a real (settled) href. With the re-arm reverted
 *   to the old `return`, neither is true → RED.
 * ════════════════════════════════════════════════════════════════════════════ */
export async function runPendingDecodeRegression() {
  const root = PROTO_DIR;
  const server = createServer(async (req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      return res.end(CACHE_PAGE);
    }
    try {
      const full = resolve(root, `.${decodeURIComponent(url)}`);
      if (full !== root && !full.startsWith(root + sep)) return res.writeHead(403).end();
      const data = await readFile(full);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(full)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  const port = await new Promise((r) =>
    server.listen(0, '127.0.0.1', () => r(server.address().port)),
  );

  const browser = await chromium().launch({ headless: true });
  try {
    const page = await browser.newContext({ deviceScaleFactor: 2 }).then((c) => c.newPage());
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__ready && window.__LG?.attach);

    return await page.evaluate(async () => {
      const { attach, supportsRefraction } = window.__LG;
      // Chromium-only behaviour: under a non-refracting engine the lens is never
      // expected, so the regression is vacuous — report it as not-applicable.
      if (!supportsRefraction()) {
        return { applicable: false, lensStamped: true, detail: 'no refraction on this engine' };
      }

      // Deferred-decode mock: src is recorded, onload fires only on manual flush —
      // the exact "re-render before decode" window the bug lived in.
      const RealImage = window.Image;
      let pending = [];
      window.Image = class {
        set src(v) {
          this._src = v;
          pending.push(this);
        }
        get src() {
          return this._src;
        }
      };
      const flush = () => {
        const p = pending;
        pending = [];
        for (const im of p) im.onload?.();
      };

      const el = document.createElement('div');
      el.id = 'lg-pending-probe';
      el.style.cssText = 'position:absolute;width:320px;height:200px;border-radius:20px';
      document.body.appendChild(el);

      let g;
      let lensStamped = false;
      let detail = '';
      try {
        g = attach(el); // 1st render → acquire map, decode DEFERRED (gen 1)
        // 2nd render at the SAME geometry BEFORE the 1st decode flushes. This
        // bumps gen → 2, invalidating the 1st render's pending onload. Without the
        // pending-branch re-arm, NOTHING is scheduled for gen 2 → lens never lands.
        g.update({});
        // Flush-and-poll: the map's PNG now encodes off-thread (toBlob), so the
        // engine arms its Image a tick AFTER update() — a fixed pair of flushes
        // would race it. We flush every frame until the lens lands or the budget
        // runs out. RED-proof intact: with the re-arm reverted, nothing is EVER
        // armed for gen 2, so this loop exhausts its budget and stays red.
        const check = () => {
          const bf =
            getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter || '';
          const m = bf.match(/url\(["']?#([^"')]+)/);
          const hasUrl = !!m;
          let hasFeImageHref = false;
          if (m) {
            const f = document.getElementById(m[1]);
            const img = f?.querySelector('feImage');
            const href =
              img &&
              (img.getAttribute('href') ||
                img.getAttributeNS('http://www.w3.org/1999/xlink', 'href'));
            hasFeImageHref = !!href && (href.length > 80 || href.startsWith('blob:'));
          }
          detail = `backdrop-filter=${JSON.stringify(bf.slice(0, 120))} hasUrl=${hasUrl} hasFeImageHref=${hasFeImageHref}`;
          return hasUrl && hasFeImageHref;
        };
        for (let i = 0; i < 120 && !lensStamped; i++) {
          flush();
          await new Promise((r) => requestAnimationFrame(r));
          lensStamped = check();
        }
      } finally {
        g?.destroy();
        el.remove();
        window.Image = RealImage;
      }
      return { applicable: true, lensStamped, detail };
    });
  } finally {
    await browser.close();
    server.close();
  }
}

/* ════════════════════════════════════════════════════════════════════════════
 * #5 — scratch lifecycle: grow-on-demand + idle release; cache bounded under a
 *   40-distinct-size storm; warm resize-back still hits. Port of lg-memstress.mjs
 *   serving the real prototype (index.html) so the engine module loads natively.
 * ════════════════════════════════════════════════════════════════════════════ */
export async function runScratchSuite() {
  const { server, port } = await serveDir(PROTO_DIR);
  const browser = await chromium().launch({ headless: true });
  try {
    const page = await browser
      .newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 })
      .then((c) => c.newPage());
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    const result = await page.evaluate(async () => {
      const mod = await import('./liquid-glass.js');
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const flush = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      // First-paint determinism: immediately after attach (a single decode tick,
      // not a worker round-trip) the lens filter is present.
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;left:9px;top:9px;width:217px;height:151px;border-radius:24px';
      document.body.appendChild(probe);
      const gp = mod.attach(probe);
      for (let t = 0; t < 60; t++) {
        const bf =
          getComputedStyle(probe).backdropFilter ||
          getComputedStyle(probe).webkitBackdropFilter ||
          '';
        if (/url\(["']?#/.test(bf)) break;
        await flush();
      }
      const bf0 =
        getComputedStyle(probe).backdropFilter ||
        getComputedStyle(probe).webkitBackdropFilter ||
        '';
      const firstPaintSync = mod.supportsRefraction() ? /url\(["']?#/.test(bf0) : true;
      gp.destroy();
      probe.remove();

      const host = document.createElement('div');
      host.style.cssText =
        'position:fixed;left:40px;top:40px;width:200px;height:160px;border-radius:24px';
      document.body.appendChild(host);
      const g = mod.attach(host);

      // 1. March through 40 distinct sizes (each a fresh geoKey).
      const sizes = [];
      let peak = 0;
      for (let i = 0; i < 40; i++) {
        const w = 180 + i * 7;
        const h = 140 + i * 5;
        host.style.width = `${w}px`;
        host.style.height = `${h}px`;
        g.refresh();
        await flush();
        sizes.push([w, h]);
        const s = mod.__cacheStats();
        if (s.size > peak) peak = s.size;
      }
      const afterMarch = mod.__cacheStats();

      // 2. Resize BACK to a recent size → warm zombie hit, no growth.
      const back = sizes[sizes.length - 5];
      host.style.width = `${back[0]}px`;
      host.style.height = `${back[1]}px`;
      const sizeBeforeBack = mod.__cacheStats().size;
      g.refresh();
      await flush();
      const afterBack = mod.__cacheStats();
      const warmHit = afterBack.size <= sizeBeforeBack;

      // 3. Scratch allocated right after a build.
      const scratchAfterBuild = mod.__cacheStats().scratchAllocated;

      // 4. Past the idle window → scratch released.
      await sleep(2400);
      const scratchAfterIdle = mod.__cacheStats().scratchAllocated;

      g.destroy();
      host.remove();
      const afterDestroy = mod.__cacheStats();

      return {
        distinctSizesBuilt: sizes.length,
        peakCacheSize: peak,
        afterMarch,
        warmHit,
        scratchAfterBuild,
        scratchAfterIdle,
        afterDestroy,
        firstPaintSync,
      };
    });

    const cap = result.afterMarch.zombieCap;
    const checks = {
      scratchAfterBuild: result.scratchAfterBuild === true,
      firstPaintSynchronous: result.firstPaintSync === true,
      cacheBounded: result.peakCacheSize <= result.afterMarch.live + cap + 1,
      zombiesCapped: result.afterMarch.zombies <= cap,
      warmResizeStillHits: result.warmHit,
      scratchNotRetainedAtSteadyState: result.scratchAfterIdle === false,
    };
    const memoryBounded = Object.values(checks).every(Boolean);
    return { memoryBounded, checks, detail: result };
  } finally {
    await browser.close();
    server.close();
  }
}
