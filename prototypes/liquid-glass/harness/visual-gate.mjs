/*
 * lg-harness/visual-gate — the deterministic pane+panel pixel gate and the
 * hermetic freeze-on-machine wrapper (base ref → throwaway worktree → diff).
 * See lg-harness.mjs (facade) for the contract.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { PROTO_DIR, REPO_ROOT, chromium, serveDir } from './common.mjs';

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
