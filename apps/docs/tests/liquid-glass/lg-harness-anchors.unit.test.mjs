import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
// Liquid Glass — harness path-anchor guard (browserless, per-PR). Class: regression.
//
// CLASS CLOSED: when the harness was split from the monolithic
// prototypes/liquid-glass/lg-harness.mjs into prototypes/liquid-glass/harness/*.mjs,
// the shared `common.mjs` moved ONE directory deeper. Its anchors are derived from
// `import.meta.url` — the SAME text `resolve(HERE, '../../')` that meant "repo root"
// from prototypes/liquid-glass/lg-harness.mjs now resolves to `prototypes/` from
// prototypes/liquid-glass/harness/common.mjs. That silently mis-anchored PROTO_DIR
// (the served engine dir) and REPO_ROOT (the @playwright/test resolution anchor),
// so chromium() threw MODULE_NOT_FOUND and every browser suite + the hermetic gate
// broke — while the code stayed byte-identical to the monolith (a move-not-edit bug
// that structural diff cannot see, only a runtime anchor check can).
//
// This guard pins the anchors so ANY future harness-module move that mis-resolves
// them fails here, per-PR, without launching a browser.
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS = resolve(HERE, '../../../../prototypes/liquid-glass/lg-harness.mjs');

let harness = null;
let importError = null;
try {
  harness = await import(`file://${HARNESS}`);
} catch (err) {
  importError = err;
}

function need() {
  assert.ok(
    harness !== null,
    `repo harness must import; import failed: ${importError ? importError.message : 'unknown'}`,
  );
  return harness;
}

test('PROTO_DIR anchors on the engine dir (prototypes/liquid-glass), not the harness subdir', () => {
  const { PROTO_DIR } = need();
  assert.equal(typeof PROTO_DIR, 'string', 'PROTO_DIR must be exported as a path string');
  assert.equal(
    basename(PROTO_DIR),
    'liquid-glass',
    `PROTO_DIR must point at prototypes/liquid-glass, got ${PROTO_DIR}`,
  );
  assert.ok(
    existsSync(join(PROTO_DIR, 'index.html')),
    `PROTO_DIR must hold the engine playground (index.html) — got ${PROTO_DIR}`,
  );
  assert.ok(
    existsSync(join(PROTO_DIR, 'liquid-glass.js')),
    `PROTO_DIR must hold the engine module (liquid-glass.js) — got ${PROTO_DIR}`,
  );
});

test('REPO_ROOT anchors on the repo root that holds apps/docs (the @playwright/test anchor)', () => {
  const { REPO_ROOT } = need();
  assert.equal(typeof REPO_ROOT, 'string', 'REPO_ROOT must be exported as a path string');
  assert.ok(
    existsSync(join(REPO_ROOT, 'apps', 'docs', 'package.json')),
    `REPO_ROOT must hold apps/docs/package.json (the @playwright/test resolution anchor) — got ${REPO_ROOT}`,
  );
});

test('chromium() resolves @playwright/test from the repo anchor and returns a launcher', () => {
  const { chromium } = need();
  assert.equal(typeof chromium, 'function', 'chromium must be exported');
  // Resolve-only: this reproduces the split bug (MODULE_NOT_FOUND at chromium())
  // WITHOUT launching a browser — a fast, per-PR guard on the resolution anchor.
  const launcher = chromium();
  assert.equal(
    typeof launcher?.launch,
    'function',
    'chromium() must resolve @playwright/test and expose .launch() — a mis-anchored REPO_ROOT throws MODULE_NOT_FOUND here',
  );
});
