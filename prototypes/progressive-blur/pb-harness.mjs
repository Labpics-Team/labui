/*
 * lab-progressive-blur — repo-resident test harness.
 *
 * A brand-new effect has no golden pixels to diff against, so the gate is
 * PHYSICAL: render a known high-frequency pattern behind the surface and
 * measure LOCAL CONTRAST along the axis in the screenshot. Blur destroys
 * high-frequency contrast, so the contrast profile IS the blur profile:
 *   · attenuation at the strong end vs the sharp end (does it blur at all),
 *   · monotonicity where the stops are monotone,
 *   · smoothness between strips (banding = a cliff in the profile),
 *   · easing bends the profile the way the curve says,
 *   · multi-stop valleys/peaks land where the stops put them,
 *   · the axis actually follows the configured points (angle),
 * plus DOM invariants (the strip ladder tops out at the strongest stop; strips
 * stay TIGHT — the perf guarantee), determinism, reduced-transparency honesty,
 * and a Class-D mutation bite-proof over five deliberately weakened engines.
 *
 * Exports:
 *   runPbSuite()     → { pass, checks: {name: {pass, detail}} }
 *   runPbMutations() → { <dim>: caught, allCaught, detail }
 */
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // prototypes/progressive-blur
const REPO_ROOT = resolve(HERE, '../../');
const PROTO_DIR = HERE;

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
  '.svg': 'image/svg+xml',
};

/* The measurement page: a TWO-SCALE test pattern behind a bare effect surface.
 * The fine 4px grid discriminates blur radii 0..~2px; it is DEAD past ~2px —
 * every deeper level would look identical to the meter (and to the eye).
 * The coarse 32px line grid keeps decaying up to ~16px radius, so interior
 * level boundaries (3.5|9|24) stay measurable. Both axes carry both scales. */
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0}
  #field{position:fixed;inset:0;background:
    repeating-linear-gradient(90deg,#000 0 2px,#fff 2px 4px),
    repeating-linear-gradient(0deg,#000 0 2px,#fff 2px 4px);
    background-blend-mode:screen}
  #coarse{position:fixed;inset:0;background:
    repeating-linear-gradient(90deg,#000 0 4px,transparent 4px 32px),
    repeating-linear-gradient(0deg,#000 0 4px,transparent 4px 32px)}
  #pb{position:absolute;left:40px;top:40px;width:400px;height:400px}
</style><link rel="stylesheet" href="/progressive-blur.css"></head><body>
<div id="field"></div><div id="coarse"></div><div id="pb"></div>
<script type="module">
  import * as PB from '/progressive-blur.js';
  window.__PB = PB; window.__ready = true;
</script></body></html>`;

async function serveProto(dir) {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      return res.end(PAGE);
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
  return { server, port };
}

async function withPage(dir, reduced, fn) {
  const { server, port } = await serveProto(dir);
  const browser = await chromium().launch({ headless: true });
  try {
    const page = await browser
      .newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 })
      .then((c) => c.newPage());
    if (reduced) {
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
      });
    }
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__ready && window.__PB?.attach);
    return await fn(page);
  } finally {
    await browser.close();
    server.close();
  }
}

/** Attach with a config, settle two frames, screenshot the surface. */
async function shoot(page, config) {
  await page.evaluate(async (cfg) => {
    window.__pb?.destroy();
    window.__pb = window.__PB.attach(document.getElementById('pb'), cfg);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, config);
  await page.waitForTimeout(150);
  return (await page.locator('#pb').screenshot()).toString('base64');
}

/**
 * The contrast profile: split the shot into `windows` bands along `axis` and
 * return each band's mean adjacent-pixel luminance difference measured
 * PERPENDICULAR to the axis. Sharp grid → high energy; blur(r) → energy decays
 * with r. The profile therefore mirrors the blur profile, inverted.
 */
async function contrastProfile(page, b64, axis = 'y', windows = 20) {
  return page.evaluate(
    async ({ b64, axis, windows }) => {
      const im = await new Promise((res) => {
        const i = new Image();
        i.onload = () => res(i);
        i.src = `data:image/png;base64,${b64}`;
      });
      const w = im.width;
      const h = im.height;
      const cv = new OffscreenCanvas(w, h);
      const cx = cv.getContext('2d');
      cx.drawImage(im, 0, 0);
      const d = cx.getImageData(0, 0, w, h).data;
      const g = (x, y) => {
        const o = (y * w + x) * 4;
        return 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
      };
      const out = new Array(windows).fill(0);
      const cnt = new Array(windows).fill(0);
      if (axis === 'y') {
        for (let y = 0; y < h; y++) {
          const wi = Math.min(windows - 1, Math.floor((y / h) * windows));
          for (let x = 0; x + 1 < w; x++) {
            out[wi] += Math.abs(g(x + 1, y) - g(x, y));
            cnt[wi]++;
          }
        }
      } else {
        for (let x = 0; x < w; x++) {
          const wi = Math.min(windows - 1, Math.floor((x / w) * windows));
          for (let y = 0; y + 1 < h; y++) {
            out[wi] += Math.abs(g(x, y + 1) - g(x, y));
            cnt[wi]++;
          }
        }
      }
      return out.map((s, i) => +(s / Math.max(1, cnt[i])).toFixed(3));
    },
    { b64, axis, windows },
  );
}

/** Mean of the profile windows whose centres fall into t ∈ [a, b]. */
function bandMean(profile, a, b) {
  const vals = [];
  for (let i = 0; i < profile.length; i++) {
    const t = (i + 0.5) / profile.length;
    if (t >= a && t <= b) vals.push(profile[i]);
  }
  return vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
}

/* Thresholds — calibrated on the honest engine (see PR notes), with the
 * mutation harness proving each one still bites when its dimension breaks. */
const T = {
  strongAttenuation: 0.3, // blurred end retains < 30% of sharp-end contrast
  monoTolerance: 0.12, // profile may wiggle ≤12% of sharp energy against monotonicity
  maxWindowJump: 3.0, // interior ratio ceiling: feathered step ≈×2.4 over ~3 windows; feather-0 mutant ≈×6 in one
  bandingScope: [0.05, 0.85], // where both the eye and the 32px meter can compare levels
  easingMidRatio: 0.8, // ease-in must hold the middle ≥20% deeper than linear
  valleyDepth: 0.55, // multi-stop valley: centre < 55% of flank energy
  areaBudget: 4.6, // Σ strip area ≤ budget × area (onion ramp ≈ 4.0–4.3; full-size mutant = levels× ≈ 5)
};

export async function runPbSuite({ dir } = {}) {
  const checks = {};
  const ok = (name, pass, detail) => {
    checks[name] = { pass: !!pass, detail };
  };

  await withPage(dir ?? PROTO_DIR, false, async (page) => {
    // ── ramp: 0→24px top-down; the workhorse scenario for S1/S2/S7/S8 ──
    const RAMP = { from: '50% 0%', to: '50% 100%', stops: '0 24px, 1 0px' };
    const rampShot = await shoot(page, RAMP);
    const ramp = await contrastProfile(page, rampShot, 'y', 40);

    const sharpE = ramp[ramp.length - 1];
    ok(
      'strong-end-attenuation',
      ramp[0] < sharpE * T.strongAttenuation && sharpE > 8,
      `blurEnd=${ramp[0]} sharpEnd=${sharpE}`,
    );

    let monoViolation = 0;
    for (let i = 1; i < ramp.length; i++) {
      monoViolation = Math.max(monoViolation, ramp[i - 1] - ramp[i]);
    }
    ok(
      'monotone-profile',
      monoViolation <= sharpE * T.monoTolerance,
      `worst backwards step=${monoViolation.toFixed(2)} tol=${(sharpE * T.monoTolerance).toFixed(2)}`,
    );

    // Banding: adjacent-window energy cliffs INSIDE the comparable zone. The
    // terminal sharp-end windows are excluded on purpose: there the profile
    // crosses sub-pixel radii where the energy metric is hypersensitive while
    // the ladder steps (0.5↔1.3px behind a wide feather) are sub-perceptual.
    let worstJump = 1;
    let jumpAt = -1;
    const lo = Math.floor(T.bandingScope[0] * ramp.length);
    const hi = Math.ceil(T.bandingScope[1] * ramp.length);
    for (let i = lo + 1; i < hi; i++) {
      const a = Math.max(ramp[i - 1], 0.3);
      const b = Math.max(ramp[i], 0.3);
      const jump = Math.max(a / b, b / a);
      if (jump > worstJump) {
        worstJump = jump;
        jumpAt = i;
      }
    }
    ok(
      'no-banding-cliff',
      worstJump <= T.maxWindowJump,
      `worst interior jump ×${worstJump.toFixed(2)} @w${jumpAt} profile=[${ramp.join(',')}]`,
    );

    const domRamp = await page.evaluate(() => {
      const el = document.getElementById('pb');
      const strips = [...el.querySelectorAll('.lab-pb__strip')];
      const area = strips.reduce((s, n) => s + n.offsetWidth * n.offsetHeight, 0);
      // Cumulative model: strips covering a probe point near the STRONG end
      // must compose (√Σr²) to the strongest stop. Probe at 5% down the axis,
      // horizontally centred.
      const probeY = el.offsetHeight * 0.05;
      let sumSq = 0;
      const inc = [];
      const allInc = [];
      const masks = [];
      for (const n of strips) {
        const r = Number.parseFloat((n.style.backdropFilter.match(/blur\(([\d.]+)px\)/) || [])[1]);
        allInc.push(r);
        const top = n.offsetTop;
        const bot = top + n.offsetHeight;
        if (probeY >= top && probeY <= bot) {
          sumSq += r * r;
          inc.push(r);
        }
        const mi = n.style.maskImage || '';
        if (mi.includes('gradient')) {
          const stops = [...mi.matchAll(/(transparent|rgb\(0, 0, 0\))\s+([\d.]+)px/g)].map((m) => ({
            opaque: m[1].startsWith('rgb'),
            px: Number.parseFloat(m[2]),
          }));
          const fadePairs = [];
          for (let i = 0; i + 1 < stops.length; i++) {
            if (stops[i].opaque !== stops[i + 1].opaque) {
              fadePairs.push([
                Math.min(stops[i].px, stops[i + 1].px),
                Math.max(stops[i].px, stops[i + 1].px),
              ]);
            }
          }
          masks.push({ fadePairs });
        }
      }
      return {
        count: strips.length,
        area,
        elArea: el.offsetWidth * el.offsetHeight,
        cumulative: Math.sqrt(sumSq),
        inc,
        allInc,
        masks,
      };
    });
    ok(
      'cumulative-blur-at-strong-end',
      Math.abs(domRamp.cumulative - 24) < 0.5,
      `√Σr²=${domRamp.cumulative.toFixed(2)} (increments=[${domRamp.inc.join(',')}])`,
    );
    ok(
      'feather-fades-present',
      (() => {
        // Every masked strip must carry REAL fades: a transparent→#000 pair at
        // least 6px apart. feather=0 collapses the pair onto one coordinate.
        for (const m of domRamp.masks) {
          for (const [a, b] of m.fadePairs) if (b - a < 6) return false;
        }
        return domRamp.masks.some((m) => m.fadePairs.length > 0);
      })(),
      `fade spans: ${JSON.stringify(domRamp.masks.map((m) => m.fadePairs))}`,
    );
    ok(
      'ladder-dense-enough',
      (() => {
        // Cumulative levels must step geometrically (≤×3 apart) and cover the
        // 0.5→24px range with enough rungs — 2 levels = visible terracing.
        const cum = [];
        let sq = 0;
        for (const r of domRamp.allInc) {
          sq += r * r;
          cum.push(Math.sqrt(sq));
        }
        if (cum.length < 4) return false;
        for (let i = 1; i < cum.length; i++) if (cum[i] / cum[i - 1] > 3.0) return false;
        return true;
      })(),
      `increments=[${domRamp.allInc.join(',')}]`,
    );
    ok(
      'strips-stay-tight',
      domRamp.area <= domRamp.elArea * T.areaBudget && domRamp.count <= 6,
      `Σarea/el=${(domRamp.area / domRamp.elArea).toFixed(2)} count=${domRamp.count}`,
    );

    // ── easing bends the profile (S2) ────────────────────────────────────────
    // ease-in on the 24→0 segment keeps blur HIGHER through the middle
    // (B(0.5): linear 12px, ease-in ≈16.5px) → measurably LESS mid contrast.
    const easedShot = await shoot(page, { ...RAMP, stops: '0 24px, 1 0px ease-in' });
    const eased = await contrastProfile(page, easedShot, 'y', 40);
    const linMid = bandMean(ramp, 0.35, 0.65);
    const easedMid = bandMean(eased, 0.35, 0.65);
    ok(
      'easing-bends-profile',
      easedMid < linMid * T.easingMidRatio && linMid > 0.5,
      `mid-band energy linear=${linMid.toFixed(2)} eased=${easedMid.toFixed(2)} ratio=${(easedMid / linMid).toFixed(2)}`,
    );

    // ── multi-stop valley (S3): sharp — blurred — sharp ──
    const valleyShot = await shoot(page, { ...RAMP, stops: '0 0px, 0.5 24px, 1 0px' });
    const valley = await contrastProfile(page, valleyShot, 'y');
    const mid = valley[Math.floor(valley.length / 2)];
    const flank = (valley[0] + valley[valley.length - 1]) / 2;
    ok('multi-stop-valley', mid < flank * T.valleyDepth, `mid=${mid} flanks=${flank.toFixed(2)}`);

    // ── the axis follows the points (S4): horizontal ramp ──
    const hShot = await shoot(page, { from: '0% 50%', to: '100% 50%', stops: '0 24px, 1 0px' });
    const hProfile = await contrastProfile(page, hShot, 'x');
    const vOfH = await contrastProfile(page, hShot, 'y');
    const hRange = Math.max(...hProfile) - Math.min(...hProfile);
    const vRange = Math.max(...vOfH.slice(2, -2)) - Math.min(...vOfH.slice(2, -2));
    ok(
      'axis-follows-points',
      hProfile[0] < hProfile[hProfile.length - 1] * T.strongAttenuation && hRange > vRange * 2,
      `x-range=${hRange.toFixed(2)} y-range=${vRange.toFixed(2)}`,
    );

    // ── determinism (S5): same config → same pixels ──
    const again = await shoot(page, RAMP);
    const det = await page.evaluate(
      async ({ a, b }) => {
        const load = (u) =>
          new Promise((res) => {
            const i = new Image();
            i.onload = () => res(i);
            i.src = `data:image/png;base64,${u}`;
          });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const w = Math.min(ia.width, ib.width);
        const h = Math.min(ia.height, ib.height);
        const px = (im) => {
          const c = new OffscreenCanvas(w, h);
          const x = c.getContext('2d');
          x.drawImage(im, 0, 0);
          return x.getImageData(0, 0, w, h).data;
        };
        const A = px(ia);
        const B = px(ib);
        let max = 0;
        for (let i = 0; i < w * h * 4; i += 4) {
          max = Math.max(
            max,
            Math.abs(A[i] - B[i]),
            Math.abs(A[i + 1] - B[i + 1]),
            Math.abs(A[i + 2] - B[i + 2]),
          );
        }
        return max;
      },
      { a: rampShot, b: again },
    );
    ok('deterministic', det <= 1, `maxDelta=${det}`);
  });

  // ── reduced transparency (S6): zero strips, honest no-op ──
  await withPage(dir ?? PROTO_DIR, true, async (page) => {
    await shoot(page, { from: '50% 0%', to: '50% 100%', stops: '0 24px, 1 0px' });
    const strips = await page.evaluate(
      () => document.querySelectorAll('#pb .lab-pb__strip').length,
    );
    ok('reduced-transparency-honest', strips === 0, `strips=${strips}`);
  });

  const pass = Object.values(checks).every((c) => c.pass);
  return { pass, checks };
}

/* ── Class-D mutation bite-proof ─────────────────────────────────────────────
 * Weaken ONE dimension in a throwaway engine copy; the NAMED isolating check
 * must flip to fail. A gate that survives a deliberate break is theater. */
const MUTATIONS = [
  {
    dimension: 'feather',
    file: 'progressive-blur.js',
    find: 'Math.min(48, Math.max(8, axisLen * 0.06))',
    repl: '0',
    isolating: 'feather-fades-present',
  },
  {
    dimension: 'level-count',
    file: 'progressive-blur.js',
    find: 'levels: 6,',
    repl: 'levels: 2,',
    isolating: 'ladder-dense-enough',
  },
  {
    dimension: 'easing',
    file: 'pb-math.js',
    find: 'if (!spec) return LINEAR;',
    repl: 'return LINEAR; // mutation: every curve straightened',
    isolating: 'easing-bends-profile',
  },
  {
    dimension: 'blur-strength',
    file: 'progressive-blur.js',
    find: 'const blur = `blur(${rInc.toFixed(2)}px)`;',
    repl: 'const blur = `blur(${(rInc / 2).toFixed(2)}px)`;',
    isolating: 'cumulative-blur-at-strong-end',
  },
  {
    dimension: 'strip-tightness',
    file: 'pb-math.js',
    find: 'export function bandBBox(w, h, A, B, t0, t1) {',
    repl: 'export function bandBBox(w, h, A, B, t0, t1) { return { x: 0, y: 0, w, h }; } function __unusedBandBBox(w, h, A, B, t0, t1) {',
    isolating: 'strips-stay-tight',
  },
];

export async function runPbMutations() {
  const results = {};
  const detail = {};
  for (const m of MUTATIONS) {
    const work = await mkdtemp(join(tmpdir(), 'pb-mut-'));
    const copy = join(work, 'engine');
    try {
      await cp(PROTO_DIR, copy, { recursive: true });
      const target = join(copy, m.file);
      const src = await readFile(target, 'utf8');
      if (!src.includes(m.find)) {
        throw new Error(`[${m.dimension}] anchor not found in ${m.file}`);
      }
      await writeFile(target, src.replace(m.find, m.repl));
      const verdict = await runPbSuite({ dir: copy });
      const row = verdict.checks[m.isolating];
      results[m.dimension] = row ? row.pass === false : false;
      detail[m.dimension] = row
        ? `${m.isolating}: pass=${row.pass} (${row.detail})`
        : `isolating check '${m.isolating}' missing`;
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }
  const allCaught = Object.values(results).every(Boolean);
  return { ...results, allCaught, detail };
}
