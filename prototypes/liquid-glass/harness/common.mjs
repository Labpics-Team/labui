/*
 * lg-harness/common — shared plumbing: repo paths, the repo-anchored
 * @playwright/test resolver, MIME map and the static prototype server.
 * Extracted from the monolithic lg-harness.mjs; the facade re-exports keep
 * every consumer import stable.
 *
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
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url)); // prototypes/liquid-glass/harness
// This module lives ONE level below the engine dir (harness/), so PROTO_DIR is the
// PARENT of HERE, and REPO_ROOT keeps the monolith's '../../' anchored on PROTO_DIR
// (== the monolith's HERE). Deriving REPO_ROOT off raw HERE would resolve one level
// short (to prototypes/), mis-anchoring the @playwright/test resolver.
export const PROTO_DIR = resolve(HERE, '..'); // prototypes/liquid-glass — the engine + playground we serve
export const REPO_ROOT = resolve(PROTO_DIR, '../../'); // repo root

// Resolve @playwright/test from THIS repo (apps/docs holds it as a devDependency)
// — never a foreign absolute path. createRequire anchored at apps/docs/package.json
// walks the repo's own pnpm store.
const PW_ANCHOR = pathToFileURL(resolve(REPO_ROOT, 'apps/docs/package.json')).href;
const require = createRequire(PW_ANCHOR);
export function chromium() {
  const pw = require('@playwright/test');
  return pw.chromium ?? pw.default?.chromium;
}

export const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

// Serve a static directory (path-traversal guarded). Returns { server, port }.
export async function serveDir(dir) {
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
