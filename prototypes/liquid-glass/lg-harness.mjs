import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
/*
 * lab-liquid-glass — repo-resident, path-portable test harness.
 *
 * The reference QA scripts (C:/Users/Daniel/lg-cache-test.mjs, lg-memstress.mjs,
 * lg-qadiff2.mjs, lg-mutate-test.mjs) proved the engine's memory discipline and
 * pixel output, but hardcoded external Windows paths and a foreign @playwright
 * resolution. This module is their committed port:
 *
 *   · serves prototypes/liquid-glass/ from a REPO-RELATIVE http server,
 *   · resolves @playwright/test from THIS repo (apps/docs devDependency),
 *
 * and exports the async entry points the test files invoke:
 *   runCacheSuite()        → { pass, cases }              (cache refcount/LRU/leak)
 *   runScratchSuite()      → { memoryBounded, checks }    (scratch lifecycle)
 *   runVisualGate({mode,dir,ref}) → baseline: { ok, froze }   (freeze a reference)
 *                                   diff: { pass, threshold, results } (pixel gate)
 *   runHermeticGate({base,runs})  → { base, runs, pass }  (freeze base engine ON
 *                                    THIS machine, diff HEAD engine against it)
 *   runMutationHarness()   → { <dim>: caught, allCaught } (Class-D bite-proof)
 *
 * HERMETIC BASELINES — never committed, always frozen on the machine that
 * diffs them. Screenshot pixels are font/raster-coupled to the OS (Playwright:
 * "run tests in the same environment where the baseline screenshots were
 * generated"); a committed PNG set frozen on one OS moves EVERY row on another
 * and the gate turns into noise (the exact class that kept CI red). Instead the
 * gate freezes its reference from the BASE git ref (PR base in CI, @{upstream}
 * locally) in a throwaway worktree and diffs the working engine against it on
 * the same machine — deterministic everywhere, zero binary artifacts in git.
 *
 * Self-contained: it owns its http server + Chromium lifecycle. No external
 * preview server, no Astro/Vite — it serves the static prototype directly.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // prototypes/liquid-glass
const REPO_ROOT = resolve(HERE, '../../'); // repo root
const PROTO_DIR = HERE; // the engine + playground we serve

// Resolve @playwright/test from THIS repo (apps/docs holds it as a devDependency)
// — never a foreign absolute path. createRequire anchored at apps/docs/package.json
// walks the repo's own pnpm store.
const PW_ANCHOR = pathToFileURL(resolve(REPO_ROOT, 'apps/docs/package.json')).href;
const require = createRequire(PW_ANCHOR);
function chromium() {
  const pw = require('@playwright/test');
  return pw.chromium ?? pw.default?.chromium;
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

// Serve a static directory (path-traversal guarded). Returns { server, port }.
async function serveDir(dir) {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const full = resolve(root, `.${p}`);
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
  return { server, port };
}

/* ════════════════════════════════════════════════════════════════════════════
 * #3 + #4 — cache refcount / hit-sharing / zombie-LRU bound / refcount-leak.
 *   Port of lg-cache-test.mjs. Serves a minimal page that imports the engine and
 *   exposes it on window; drives attach/destroy with feImage decode DEFERRED to
 *   reproduce the "re-render before decode" refcount-leak class.
 * ════════════════════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════════════════════
 * #6 / #9 — deterministic pane+panel visual gate. Port of lg-qadiff2.mjs. Serves
 *   the prototype dir; freezes (mode:'baseline') or diffs (mode:'diff') BOTH
 *   #pane and #panel across the state matrix at meanDelta<1 OR maxDelta<8 OR
 *   pctChanged<1. Takes an optional `dir` so the mutation harness can point it at
 *   a patched engine copy (and a `ref` so it always diffs the committed baseline).
 * ════════════════════════════════════════════════════════════════════════════ */
const ELEMENTS = ['#pane', '#panel'];

// Per-state `elements`: the ONLY element(s) a state actually perturbs. A state
// that perturbs only #pane (e.g. a pane param / drag / resize) leaves #panel
// byte-identical to dark-rest's #panel — capturing+diffing that #panel row is
// pure duplication that diffs nothing (the C1 finding: ~30% of committed PNGs
// were byte-identical). We capture+diff ONLY the perturbed element(s), so every
// committed baseline PNG is a distinct picture and every diffed row can move.
//   · pane params / drag / resize / refraction=0     → ['#pane']
//   · panelParams only                                → ['#panel']
//   · global (theme/bg/reduced) or BOTH params        → ['#pane', '#panel']
const BOTH = ['#pane', '#panel'];
const STATES = [
  // Global references both elements depend on (theme + bg) → diff both.
  { name: 'dark-rest', theme: 'dark', bg: 1, elements: BOTH },
  { name: 'light-rest', theme: 'light', bg: 1, elements: BOTH },
  // Drag moves only the pane.
  { name: 'drag', theme: 'dark', bg: 1, move: [240, -140], elements: ['#pane'] },
  // Dispersion is applied to BOTH the pane and the panel → diff both.
  {
    name: 'dispersion',
    theme: 'dark',
    bg: 1,
    params: { '--lg-dispersion': 0.9 },
    panelParams: {
      '--lg-dispersion': 0.9,
      '--lg-radius': '1px',
      '--lg-tint-opacity': 0.02,
      '--lg-refraction': 2,
    },
    elements: BOTH,
  },
  {
    name: 'big-corner',
    theme: 'light',
    bg: 1,
    params: { '--lg-corner': '60px', '--lg-depth': 70 },
    elements: ['#pane'],
  },
  { name: 'distinct-geo', theme: 'dark', bg: 1, size: [360, 300], elements: ['#pane'] },
  {
    name: 'panel-strength',
    theme: 'dark',
    bg: 1,
    panelParams: { '--lg-refraction': 2, '--lg-radius': '1px', '--lg-tint-opacity': 0.02 },
    elements: ['#panel'],
  },
  {
    name: 'panel-blur',
    theme: 'dark',
    bg: 1,
    panelParams: { '--lg-radius': '18px' },
    elements: ['#panel'],
  },
  {
    // Distinct GEOMETRY for the panel lens: a big corner reshapes the
    // displacement map (unlike panel-strength, whose depth:90 clamps out on the
    // tall panel and produced a byte-identical map → the C1 duplicate). A large
    // --lg-corner changes the rounded-rect SDF, so the lens visibly differs.
    name: 'panel-geo',
    theme: 'dark',
    bg: 1,
    panelParams: {
      '--lg-corner': '64px',
      '--lg-depth': 90,
      '--lg-refraction': 2,
      '--lg-radius': '1px',
      '--lg-tint-opacity': 0.02,
    },
    elements: ['#panel'],
  },
  {
    name: 'refraction-0',
    theme: 'dark',
    bg: 1,
    params: { '--lg-refraction': 0 },
    elements: ['#pane'],
  },
  { name: 'reduced-transparency', theme: 'dark', bg: 1, reduced: true, elements: BOTH },
  {
    name: 'depth-default',
    theme: 'dark',
    bg: 2,
    params: {
      '--lg-radius': '0.5px',
      '--lg-tint-opacity': 0.02,
      '--lg-refraction': 2,
      '--lg-dispersion': 0,
    },
    elements: ['#pane'],
  },
  {
    name: 'body-tail',
    theme: 'dark',
    bg: 2,
    params: { '--lg-radius': '0.5px', '--lg-tint-opacity': 0.02 },
    elements: ['#pane'],
  },
];

// The element(s) a state perturbs (defaults to BOTH for safety if unset).
const stateElements = (s) => s.elements || ELEMENTS;

const elTag = (el) => el.replace('#', '');
const THRESHOLD = { meanDelta: 1.0, maxDelta: 8, pctChanged: 1.0 };

async function withGatePage(server, port, reduced, fn) {
  const browser = await chromium().launch({ headless: true });
  try {
    const ctx = { viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 };
    if (reduced) ctx.reducedMotion = 'reduce';
    const page = await browser.newContext(ctx).then((c) => c.newPage());
    if (reduced) {
      try {
        const session = await page.context().newCDPSession(page);
        await session.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
        });
      } catch {
        // best-effort: not all builds accept the feature key
      }
    }
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    return await fn(page);
  } finally {
    await browser.close();
  }
}

async function settle(page, expectLens) {
  // Returns null on success, or a diagnostic string when a lens-EXPECTED element
  // timed out WITHOUT a settled feImage href. A lens-expected timeout used to
  // just screenshot a frost-only (broken) render and let the gate pass on a
  // coincidental near-match — silent green. We surface it so the caller can THROW
  // (H1): a broken render must go RED, never a quiet pass.
  const diag = await page.evaluate(async (expectLens) => {
    const ids = ['pane', 'panel'];
    // The settled feImage href for an element, or null if not yet lensed.
    const lensHref = (id) => {
      const el = document.getElementById(id);
      if (!el) return 'absent';
      const bf =
        getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter || '';
      const m = bf.match(/url\(["']?#([^"')]+)/);
      if (!m) return null;
      const f = document.getElementById(m[1]);
      const img = f?.querySelector('feImage');
      const href =
        img &&
        (img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href'));
      // A settled href is either a multi-KB data-URI or a blob: URL (the
      // engine encodes the map off-thread via toBlob when available).
      return !!href && (href.length > 80 || href.startsWith('blob:')) ? href : null;
    };
    const settledOne = (id) => {
      const h = lensHref(id);
      if (h === 'absent') return true; // element not on the page → nothing to settle
      if (h === null) return !expectLens; // not lensed → only OK when lens is NOT expected
      return true; // settled href present
    };
    const settled = () => ids.every(settledOne);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let t = 0; t < 200 && !settled(); t++) await sleep(15);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (!expectLens) return null;
    // Lens expected: any present element that never produced a settled href is a
    // broken (frost-only) render — report it instead of screenshotting silently.
    const broken = ids.filter((id) => {
      const h = lensHref(id);
      return h !== 'absent' && h === null;
    });
    return broken.length ? `lens-expected but unsettled: #${broken.join(', #')}` : null;
  }, expectLens);
  await page.waitForTimeout(300);
  if (diag) {
    // H1: throw, do NOT screenshot a no-lens render and let the gate pass on it.
    throw new Error(`settle(): ${diag} — a lens-expected render timed out without a feImage href`);
  }
}

async function shoot(page, s) {
  await page.evaluate((j) => {
    document.documentElement.setAttribute('data-theme', j.theme || 'dark');
    const sw = document.querySelectorAll('#bgs .swatch');
    if (j.bg != null && sw[j.bg]) sw[j.bg].click();
    const pane = document.getElementById('pane');
    pane.style.transform = 'none';
    pane.style.left = '';
    pane.style.top = '';
    pane.style.width = '';
    pane.style.height = '';
    if (j.size) {
      pane.style.width = `${j.size[0]}px`;
      pane.style.height = `${j.size[1]}px`;
    }
    for (const [k, v] of Object.entries(j.params || {})) pane.style.setProperty(k, String(v));
    window.__paneGlass.update({});
    const panel = document.getElementById('panel');
    if (panel) {
      for (const [k, v] of Object.entries(j.panelParams || {}))
        panel.style.setProperty(k, String(v));
    }
    if (window.__panelGlass) window.__panelGlass.refresh();
    if (j.move) {
      const r = pane.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const fire = (t, x, y) =>
        pane.dispatchEvent(
          new PointerEvent(t, {
            pointerId: 1,
            pointerType: 'mouse',
            clientX: x,
            clientY: y,
            bubbles: true,
          }),
        );
      fire('pointerdown', cx, cy);
      fire('pointermove', cx + j.move[0], cy + j.move[1]);
      fire('pointerup', cx + j.move[0], cy + j.move[1]);
    }
  }, s);
  const expectLens = !s.reduced && !(s.params && Number(s.params['--lg-refraction']) === 0);
  await settle(page, expectLens);
  const out = {};
  // Capture ONLY the element(s) this state perturbs (C1): an unperturbed element
  // is byte-identical to dark-rest and contributes a duplicate baseline that
  // diffs nothing.
  for (const el of stateElements(s)) out[el] = await page.locator(el).screenshot();
  await page.evaluate((j) => {
    const pane = document.getElementById('pane');
    for (const k of Object.keys(j.params || {})) pane.style.removeProperty(k);
    pane.style.width = '';
    pane.style.height = '';
    window.__paneGlass.update({});
    const panel = document.getElementById('panel');
    if (panel) {
      for (const k of Object.keys(j.panelParams || {})) panel.style.removeProperty(k);
      if (window.__panelGlass) window.__panelGlass.refresh();
    }
  }, s);
  return out;
}

async function diffPng(page, candB64, refB64) {
  return page.evaluate(
    async ({ a, b }) => {
      const load = (u) =>
        new Promise((res) => {
          const im = new Image();
          im.onload = () => res(im);
          im.src = u;
        });
      const [ia, ib] = await Promise.all([
        load(`data:image/png;base64,${a}`),
        load(`data:image/png;base64,${b}`),
      ]);
      const w = Math.min(ia.width, ib.width);
      const h = Math.min(ia.height, ib.height);
      const mk = (im) => {
        const c = new OffscreenCanvas(w, h);
        const x = c.getContext('2d');
        x.drawImage(im, 0, 0);
        return x.getImageData(0, 0, w, h).data;
      };
      const A = mk(ia);
      const B = mk(ib);
      let sum = 0;
      let max = 0;
      let changed = 0;
      const n = w * h;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        const dr = Math.abs(A[o] - B[o]);
        const dg = Math.abs(A[o + 1] - B[o + 1]);
        const db = Math.abs(A[o + 2] - B[o + 2]);
        const dmax = Math.max(dr, dg, db);
        sum += (dr + dg + db) / 3;
        if (dmax > max) max = dmax;
        if (dmax > 4) changed++;
      }
      return {
        meanDelta: +(sum / n).toFixed(3),
        maxDelta: max,
        pctChanged: +((changed / n) * 100).toFixed(3),
        wh: `${w}x${h}`,
      };
    },
    { a: candB64, b: refB64 },
  );
}

export async function runVisualGate({ mode = 'diff', dir, ref } = {}) {
  if (!ref) {
    // No committed baseline exists BY DESIGN (test artifacts do not live in the
    // repo; committed PNGs are machine-coupled anyway). A reference must be
    // frozen on THIS machine — use runHermeticGate() or pass ref explicitly.
    throw new Error('runVisualGate: `ref` is required — freeze a reference on this machine first');
  }
  const serveRoot = dir ? resolve(dir) : PROTO_DIR;
  const refDir = resolve(ref);
  const { server, port } = await serveDir(serveRoot);
  const normalStates = STATES.filter((s) => !s.reduced);
  const reducedStates = STATES.filter((s) => s.reduced);
  try {
    if (mode === 'baseline') {
      await mkdir(refDir, { recursive: true });
      // Clear stale PNGs so a re-freeze that DROPS now-duplicate rows leaves no
      // orphan baselines behind (a removed element must not keep diffing).
      await rm(refDir, { recursive: true, force: true });
      await mkdir(refDir, { recursive: true });
      const frozen = []; // { name, md5 } per committed PNG → uniqueness assertion
      const commit = async (s, bufs) => {
        for (const el of stateElements(s)) {
          const name = `${s.name}__${elTag(el)}`;
          await writeFile(`${refDir}/${name}.png`, bufs[el]);
          frozen.push({ name, md5: createHash('md5').update(bufs[el]).digest('hex') });
        }
      };
      await withGatePage(server, port, false, async (page) => {
        // Warm-up: a cold Chromium's first composites are nondeterministic.
        await shoot(page, normalStates[0]);
        await shoot(
          page,
          STATES.find((s) => s.name === 'distinct-geo'),
        );
        await shoot(page, normalStates[0]);
        for (const s of normalStates) await commit(s, await shoot(page, s));
      });
      if (reducedStates.length) {
        await withGatePage(server, port, true, async (page) => {
          await shoot(page, reducedStates[0]);
          for (const s of reducedStates) await commit(s, await shoot(page, s));
        });
      }
      // C1 freeze-time guard: NO two committed baseline PNGs may be byte-identical.
      // A duplicate means a state's diffed row would diff nothing — test theater.
      const byMd5 = new Map();
      for (const f of frozen) (byMd5.get(f.md5) || byMd5.set(f.md5, []).get(f.md5)).push(f.name);
      const dups = [...byMd5.values()].filter((g) => g.length > 1);
      if (dups.length) {
        throw new Error(
          `baseline freeze: byte-identical PNGs (each diffs NOTHING): ${dups
            .map((g) => g.join('=='))
            .join(' | ')}`,
        );
      }
      return { ok: true, froze: frozen.map((f) => f.name) };
    }

    const results = [];
    const runGroup = async (page, states) => {
      for (const s of states) {
        const bufs = await shoot(page, s);
        for (const el of stateElements(s)) {
          const candB64 = bufs[el].toString('base64');
          const refB64 = (await readFile(`${refDir}/${s.name}__${elTag(el)}.png`)).toString(
            'base64',
          );
          const d = await diffPng(page, candB64, refB64);
          const fail =
            d.meanDelta > THRESHOLD.meanDelta ||
            d.maxDelta > THRESHOLD.maxDelta ||
            d.pctChanged > THRESHOLD.pctChanged;
          results.push({ state: s.name, element: el, ...d, fail });
        }
      }
    };
    await withGatePage(server, port, false, async (page) => {
      await shoot(page, normalStates[0]);
      await shoot(
        page,
        STATES.find((s) => s.name === 'distinct-geo'),
      );
      await shoot(page, normalStates[0]);
      await runGroup(page, normalStates);
    });
    if (reducedStates.length) {
      await withGatePage(server, port, true, async (page) => {
        await shoot(page, reducedStates[0]);
        await runGroup(page, reducedStates);
      });
    }
    const pass = results.every((r) => !r.fail);
    return { pass, threshold: THRESHOLD, results };
  } finally {
    server.close();
  }
}

/* ════════════════════════════════════════════════════════════════════════════
 * Hermetic gate — freeze the BASE engine on THIS machine, diff HEAD against it.
 * ════════════════════════════════════════════════════════════════════════════ */

/** The git ref whose engine is the pixel reference. CI passes the PR base (or
 *  the pre-push sha) via LG_GATE_BASE; locally the branch upstream is exactly
 *  "what this branch will merge into". There is deliberately NO silent
 *  fallback: freezing HEAD and diffing the same tree is a gate that can never
 *  go red — loud failure beats an evergreen no-op. */
export function resolveGateBase() {
  if (process.env.LG_GATE_BASE) return process.env.LG_GATE_BASE;
  try {
    const up = execFileSync(
      'git',
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
    if (up) return up;
  } catch {
    // no upstream configured — fall through to the loud error below
  }
  throw new Error(
    'resolveGateBase: cannot resolve a pixel-reference base — set LG_GATE_BASE ' +
      '(e.g. origin/feat/liquid-glass) or configure an upstream for this branch. ' +
      'Refusing to fall back to HEAD: diffing a tree against itself is a gate ' +
      'that can never fail.',
  );
}

/** Check out `base` into a throwaway git worktree, hand its engine dir to `fn`,
 *  and always clean the worktree up — the repo itself is never touched. */
async function withBaseEngine(base, fn) {
  const work = await mkdtemp(join(tmpdir(), 'lg-gate-'));
  // git derives the worktree's admin id from the path basename — suffix it with
  // the unique mkdtemp name so concurrent gates never race for the same id.
  const wt = join(work, `wt-${basename(work)}`);
  let added = false;
  try {
    execFileSync('git', ['worktree', 'add', '--detach', '--force', wt, base], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    added = true;
    const baseEngine = join(wt, 'prototypes', 'liquid-glass');
    if (!existsSync(join(baseEngine, 'index.html'))) {
      throw new Error(
        `runHermeticGate: base ref '${base}' has no prototypes/liquid-glass engine to freeze`,
      );
    }
    return await fn(baseEngine, work);
  } finally {
    if (added) {
      try {
        execFileSync('git', ['worktree', 'remove', '--force', wt], {
          cwd: REPO_ROOT,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch {
        // worktree dir is inside `work` — the rm below still reclaims it
      }
    }
    await rm(work, { recursive: true, force: true });
  }
}

/**
 * The PR pixel gate: freeze the base-ref engine on THIS machine, then diff the
 * working engine against that freeze `runs` times (runs>1 = determinism check).
 * Same machine + same Chromium + same fonts ⇒ the only thing that can move a
 * row is a change in the engine itself.
 */
export async function runHermeticGate({ base = resolveGateBase(), runs = 1 } = {}) {
  return withBaseEngine(base, async (baseEngine, work) => {
    const refDir = join(work, 'ref');
    await runVisualGate({ mode: 'baseline', dir: baseEngine, ref: refDir });
    const verdicts = [];
    for (let i = 0; i < runs; i++) {
      verdicts.push(await runVisualGate({ mode: 'diff', ref: refDir }));
    }
    return { base, runs: verdicts, pass: verdicts.every((v) => v.pass) };
  });
}

/* ════════════════════════════════════════════════════════════════════════════
 * #8 — Class-D mutation bite-proof. Port of lg-mutate-test.mjs. Freezes the
 *   CURRENT engine on THIS machine as the reference, then for each of the 10
 *   effect dimensions mkdtemp-copies the engine, weakens ONE dimension, re-runs
 *   the gate against that fresh reference, and asserts the gate FAILS (caught).
 *   The committed engine is never mutated; no baseline is ever committed.
 * ════════════════════════════════════════════════════════════════════════════ */
// C2: each mutation names the SPECIFIC baseline row that ISOLATES its dimension
// — the row where that effect is actually visible. A lens-relevant dimension
// (MAX_PULL, dispersion, depth) MUST be caught by a LENS row, never by a flat
// frost/duplicate row that moved for an unrelated reason. We assert the named
// row itself failed, not merely that ≥1 of ~20 rows moved somewhere.
//   · `state__element` of `isolating` must exist as a committed baseline PNG
//     (survive the C1 dedup) and must show this effect.
const MUTATIONS = [
  {
    dimension: 'lens-strength',
    file: 'lg-math.js',
    find: 'export const MAX_PULL = 0.15;',
    repl: 'export const MAX_PULL = 0.138;',
    // Displacement magnitude → the strongest pure-lens row (refraction 2,
    // dispersion 0): the bend, not the fringe, must shift.
    isolating: { state: 'depth-default', element: '#pane' },
  },
  {
    dimension: 'dispersion',
    file: 'liquid-glass.js',
    find: 'const k = dispersion * 0.08; // gentle per-channel spread',
    repl: 'const k = dispersion * 0.04; // gentle per-channel spread',
    // Chromatic rim fringe → the dispersion-0.9 row (the only state that turns
    // dispersion up); a flat frost row cannot see this.
    isolating: { state: 'dispersion', element: '#pane' },
  },
  {
    dimension: 'blur',
    file: 'liquid-glass.css',
    find: '  --lg-radius: 4px;',
    repl: '  --lg-radius: 2px;',
    // Default CSS backdrop blur → the default-param resting pane.
    isolating: { state: 'dark-rest', element: '#pane' },
  },
  {
    dimension: 'tint',
    file: 'liquid-glass.css',
    find: '  --lg-tint-opacity: 0.03;',
    repl: '  --lg-tint-opacity: 0.06;',
    // The base --lg-tint-opacity:0.03 is OVERRIDDEN to 0.05 by the dark-theme
    // rule, so this mutation only renders under LIGHT theme. Its isolating row is
    // therefore a light-theme row, not a dark one. (This is the C2 catch: the old
    // ≥1-row check passed `tint` for the WRONG reason — a coincidental dark row
    // moved while the actual base-tint guard is light.)
    isolating: { state: 'light-rest', element: '#pane' },
  },
  {
    dimension: 'rim-sheen',
    file: 'liquid-glass.css',
    find: '    rgba(255, 255, 255, 0.22) 0%,',
    repl: '    rgba(255, 255, 255, 0.11) 0%,',
    isolating: { state: 'dark-rest', element: '#pane' },
  },
  {
    dimension: 'depth',
    file: 'liquid-glass.css',
    find: '  --lg-depth: 40; /* consumed by JS — px width of the magnified rim band */',
    repl: '  --lg-depth: 34; /* consumed by JS — px width of the magnified rim band */',
    // Default lens-band width → resting pane carries the default depth lens.
    isolating: { state: 'dark-rest', element: '#pane' },
  },
  {
    dimension: 'saturate',
    file: 'liquid-glass.css',
    find: '  --lg-saturate: 1.3;',
    repl: '  --lg-saturate: 1.0;',
    isolating: { state: 'dark-rest', element: '#pane' },
  },
  {
    dimension: 'brightness',
    file: 'liquid-glass.css',
    find: '  --lg-brightness: 1.05;',
    repl: '  --lg-brightness: 0.95;',
    isolating: { state: 'dark-rest', element: '#pane' },
  },
  {
    dimension: 'contrast',
    file: 'liquid-glass.css',
    find: '  --lg-contrast: 1.2; /* contrast, not blur, gives the "glassy" body */',
    repl: '  --lg-contrast: 1.05; /* contrast, not blur, gives the "glassy" body */',
    isolating: { state: 'dark-rest', element: '#pane' },
  },
  {
    dimension: 'reduced-tint-opacity',
    file: 'liquid-glass.css',
    find: '    --lg-tint-opacity: 1;',
    repl: '    --lg-tint-opacity: 0.85;',
    // The reduced-transparency block only applies under prefers-reduced-
    // transparency → only the reduced state isolates it.
    isolating: { state: 'reduced-transparency', element: '#pane' },
  },
];

export async function runMutationHarness() {
  const results = {};
  const detail = {};
  // Hermetic reference: frozen from the CURRENT engine on THIS machine, so a
  // mutant row can only move because of the mutation — never because the
  // machine's fonts/raster differ from wherever a committed PNG was born.
  const refWork = await mkdtemp(join(tmpdir(), 'lg-mut-ref-'));
  const refDir = join(refWork, 'ref');
  try {
    await runVisualGate({ mode: 'baseline', dir: PROTO_DIR, ref: refDir });
    await runMutations(results, detail, refDir);
  } finally {
    await rm(refWork, { recursive: true, force: true });
  }
  const allCaught = Object.values(results).every(Boolean);
  return { ...results, allCaught, detail };
}

async function runMutations(results, detail, refDir) {
  for (const m of MUTATIONS) {
    const work = await mkdtemp(join(tmpdir(), 'lg-mut-'));
    const copy = join(work, 'engine');
    try {
      await cp(PROTO_DIR, copy, { recursive: true });
      const target = join(copy, m.file);
      const src = await readFile(target, 'utf8');
      if (!src.includes(m.find)) {
        throw new Error(`[${m.dimension}] anchor not found in ${m.file}: ${m.find}`);
      }
      const patched = src.replace(m.find, m.repl);
      if (patched === src) throw new Error(`[${m.dimension}] patch was a no-op`);
      await writeFile(target, patched);

      // Diff the PATCHED copy against the fresh on-machine reference. A
      // weakening must move pixels past threshold — AND, for C2 correctness, it
      // must do so in the SPECIFIC row that isolates this dimension.
      const verdict = await runVisualGate({ mode: 'diff', dir: copy, ref: refDir });
      const iso = m.isolating;
      const row = verdict.results.find((r) => r.state === iso.state && r.element === iso.element);
      if (!row) {
        // The isolating row vanished from the baseline (e.g. dedup dropped it) —
        // the dimension is no longer guarded by a real row. That is a HOLE, not a
        // catch: leave caught=false so allCaught fails loudly.
        results[m.dimension] = false;
        detail[m.dimension] = `isolating row ${iso.state}/${iso.element} absent from gate results`;
        continue;
      }
      // Caught == the isolating row itself moved past threshold.
      results[m.dimension] = row.fail === true;
      detail[m.dimension] =
        `${iso.state}/${iso.element} mean=${row.meanDelta} max=${row.maxDelta} pct=${row.pctChanged} fail=${row.fail}`;
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }
}
